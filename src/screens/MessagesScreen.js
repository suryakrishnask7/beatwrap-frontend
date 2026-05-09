import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Image, KeyboardAvoidingView, Platform, Modal,
  ActivityIndicator, Linking, Alert, PanResponder, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRuntimeConfig } from '../utils/runtimeConfig';

const { BACKEND_URL } = getRuntimeConfig();
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
function getConversationId(id1, id2) {
  return [id1, id2].sort().join('_');
}
function groupByDay(msgs) {
  const groups = [];
  let lastDay = null;
  msgs.forEach(msg => {
    const day = formatDay(msg.createdAt || msg.ts || Date.now());
    if (day !== lastDay) { groups.push({ type: 'date', label: day, id: `date-${day}` }); lastDay = day; }
    groups.push({ type: 'msg', ...msg });
  });
  return groups;
}

// ── Swipe-down-to-dismiss sheet ──────────────────────────────────────────────
function SwipeDownModal({ visible, onClose, children, sheetStyle }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          Animated.timing(translateY, { toValue: 800, duration: 200, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => { if (visible) translateY.setValue(0); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[sheetStyle, { transform: [{ translateY }] }]}>
          <View {...pan.panHandlers} style={styles.swipeHandleArea}>
            <View style={styles.fpHandle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function MessagesScreen() {
  const { user, jwtToken } = useAuth();
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState({});
  const [openChat, setOpenChat] = useState(null);
  const [input, setInput] = useState('');
  const [topTracks, setTopTracks] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showFriendProfile, setShowFriendProfile] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const chatRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useFocusEffect(useCallback(() => {
    loadFriends();
    loadTopTracks();
    connectWebSocket();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [user?._id, jwtToken]));

  const connectWebSocket = () => {
    if (!user?._id || !jwtToken || user.isGuest) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: jwtToken }));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'auth_ok') { setWsStatus('connected'); return; }
        if (msg.type === 'message' || msg.type === 'message_sent') {
          appendMessage(msg.conversationId, {
            _id: msg._id, from: msg.from, to: msg.to,
            type: msg.msgType || 'text', text: msg.text,
            payload: msg.payload, createdAt: msg.createdAt || new Date().toISOString(),
          });
        }
      } catch {}
    };
    ws.onclose = () => {
      setWsStatus('disconnected');
      reconnectTimer.current = setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = () => ws.close();
  };

  const appendMessage = (conversationId, msg) => {
    setMessages(prev => {
      const existing = prev[conversationId] || [];
      if (existing.find(m => m._id === msg._id)) return prev;
      return { ...prev, [conversationId]: [...existing, msg] };
    });
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const loadFriends = async () => {
    if (!user?._id) { setLoadingFriends(false); return; }
    try { const c = await AsyncStorage.getItem('friends_list'); if (c) setFriends(JSON.parse(c)); } catch {}
    try {
      const res = await apiService.getFriends(user._id);
      const list = res.friends || [];
      setFriends(list);
      await AsyncStorage.setItem('friends_list', JSON.stringify(list));
    } catch {}
    setLoadingFriends(false);
  };

  const loadTopTracks = async () => {
    try { const t = await AsyncStorage.getItem('my_top_tracks'); if (t) setTopTracks(JSON.parse(t)); } catch {}
  };

  const loadChatHistory = async (friend) => {
    setLoadingHistory(true);
    try {
      const res = await apiService.getMessages(friend._id);
      const convId = getConversationId(user._id, friend._id);
      setMessages(prev => ({ ...prev, [convId]: res.messages || [] }));
    } catch {}
    setLoadingHistory(false);
  };

  const openChatWith = (friend) => {
    setOpenChat(friend);
    loadChatHistory(friend);
  };

  const sendMessage = (text, msgType = 'text', payload = null) => {
    if (!text.trim() && msgType === 'text') return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      Alert.alert('Not connected', 'Reconnecting... try again in a moment.');
      connectWebSocket(); return;
    }
    wsRef.current.send(JSON.stringify({ type: 'message', to: openChat._id, text: text.trim(), msgType, payload }));
    setInput('');
  };

  const shareTrack = (track) => {
    sendMessage(`🎵 ${track.name} — ${track.artists?.[0]?.name}`, 'track', {
      name: track.name, artist: track.artists?.[0]?.name,
      imageUrl: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url,
      spotifyUrl: track.external_urls?.spotify, spotifyUri: track.uri,
    });
    setShowPicker(false);
  };

  const openSpotify = (payload) => {
    if (!payload) return;
    const uri = payload.spotifyUri, url = payload.spotifyUrl;
    if (uri) Linking.canOpenURL(uri).then(ok => ok ? Linking.openURL(uri) : url && Linking.openURL(url)).catch(() => url && Linking.openURL(url));
    else if (url) Linking.openURL(url);
  };

  const removeFriend = (friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.displayName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await apiService.unfriend(user._id, friend._id);
              const updated = friends.filter(f => f._id !== friend._id);
              setFriends(updated);
              await AsyncStorage.setItem('friends_list', JSON.stringify(updated));
              setShowFriendProfile(false);
              setOpenChat(null);
            } catch {
              Alert.alert('Error', 'Could not remove friend. Try again.');
            }
          },
        },
      ]
    );
  };

  const conversationId = openChat ? getConversationId(user._id, openChat._id) : null;
  const rawMessages = conversationId ? (messages[conversationId] || []) : [];
  const grouped = groupByDay(rawMessages);

  const Avatar = ({ friend, size = 50, style }) => {
    if (friend?.profileImage) {
      return <Image source={{ uri: friend.profileImage }} style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
    }
    return (
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.violetSoft, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: COLORS.violet }}>{friend?.displayName?.[0]}</Text>
      </View>
    );
  };

  // ── CHAT VIEW ────────────────────────────────────────────────────────────
  if (openChat) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setOpenChat(null)} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatHeaderInfo} onPress={() => setShowFriendProfile(true)} activeOpacity={0.7}>
              <Avatar friend={openChat} size={38} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.chatName}>{openChat.displayName}</Text>
                {/* Only show connection status for yourself, not implying friend is online */}
                <Text style={[styles.chatSub, { color: wsStatus === 'connected' ? '#22c55e' : COLORS.textMuted }]}>
                  {wsStatus === 'connected' ? '● connected' : '● connecting...'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowFriendProfile(true)} style={styles.chatInfoBtn}>
              <Text style={styles.chatInfoIcon}>ⓘ</Text>
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : (
            <ScrollView
              ref={chatRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatScrollContent}
              onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: false })}
              keyboardShouldPersistTaps="handled"
            >
              {grouped.length === 0 && (
                <View style={styles.chatEmpty}>
                  <Text style={styles.chatEmptyEmoji}>🎵</Text>
                  <Text style={styles.chatEmptyText}>Say hi to {openChat.displayName}!</Text>
                </View>
              )}
              {grouped.map((item, i) => {
                if (item.type === 'date') {
                  return (
                    <View key={item.id} style={styles.dateSeparator}>
                      <View style={styles.dateLine} />
                      <Text style={styles.dateLabel}>{item.label}</Text>
                      <View style={styles.dateLine} />
                    </View>
                  );
                }
                const isMe = item.from === user._id || item.from?.toString() === user._id;
                return (
                  <View key={item._id || i} style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                    {!isMe && <Avatar friend={openChat} size={28} style={{ marginRight: 6, alignSelf: 'flex-end', marginBottom: 2 }} />}
                    <View style={{ maxWidth: '72%' }}>
                      {item.type === 'track' && item.payload ? (
                        <TouchableOpacity
                          style={[styles.songCard, isMe ? styles.songCardMe : styles.songCardThem]}
                          onPress={() => openSpotify(item.payload)}
                          activeOpacity={0.85}
                        >
                          {item.payload.imageUrl ? (
                            <Image source={{ uri: item.payload.imageUrl }} style={styles.songCardImage} />
                          ) : (
                            <View style={[styles.songCardImage, { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ fontSize: 32 }}>🎵</Text>
                            </View>
                          )}
                          <View style={styles.songCardInfo}>
                            <Text style={styles.songCardName} numberOfLines={1}>{item.payload.name}</Text>
                            <Text style={styles.songCardArtist} numberOfLines={1}>{item.payload.artist}</Text>
                            <View style={styles.songCardPlay}>
                              <Text style={styles.songCardPlayIcon}>▶</Text>
                              <Text style={styles.songCardPlayText}>Open in Spotify</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
                        </View>
                      )}
                      <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                        {formatTime(item.createdAt || Date.now())}
                        {isMe && <Text style={styles.bubbleTick}> ✓</Text>}
                      </Text>
                    </View>
                    {isMe && <View style={{ width: 28 }} />}
                  </View>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.inputBar}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => setShowPicker(true)}>
              <Text style={styles.attachIcon}>🎵</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.chatInput}
              value={input}
              onChangeText={setInput}
              placeholder="Message..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.sendBtn, input.trim() && styles.sendBtnActive]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim()}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Friend profile sheet — swipe down to dismiss */}
        <SwipeDownModal
          visible={showFriendProfile}
          onClose={() => setShowFriendProfile(false)}
          sheetStyle={styles.fpSheet}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.fpHero}>
              <Avatar friend={openChat} size={76} />
              <Text style={styles.fpName}>{openChat.displayName}</Text>
              {openChat.username && <Text style={styles.fpHandle2}>@{openChat.username}</Text>}
              {openChat.wrap?.tamil_character?.name && (
                <View style={styles.fpCharBadge}>
                  <Text style={styles.fpCharLabel}>THIS WEEK AS</Text>
                  <Text style={styles.fpCharName}>{openChat.wrap.tamil_character.name}</Text>
                  <Text style={styles.fpCharFilm}>{openChat.wrap.tamil_character.film}</Text>
                </View>
              )}
            </View>

            {openChat.stats?.topTracks?.length > 0 && (
              <View style={styles.fpSection}>
                <Text style={styles.fpSectionTitle}>🎵 TOP TRACKS THIS WEEK</Text>
                {openChat.stats.topTracks.slice(0, 5).map((track, i) => {
                  const img = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url;
                  return (
                    <View key={i} style={styles.fpTrackRow}>
                      <Text style={styles.fpTrackNum}>{i + 1}</Text>
                      {img
                        ? <Image source={{ uri: img }} style={styles.fpTrackImg} />
                        : <View style={[styles.fpTrackImg, { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }]}><Text>♫</Text></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fpTrackName} numberOfLines={1}>{track.name}</Text>
                        <Text style={styles.fpTrackArtist} numberOfLines={1}>{track.artists?.[0]?.name}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {openChat.stats?.topArtists?.length > 0 && (
              <View style={styles.fpSection}>
                <Text style={styles.fpSectionTitle}>🎤 TOP ARTISTS</Text>
                <View style={styles.fpArtistWrap}>
                  {openChat.stats.topArtists.slice(0, 6).map((a, i) => (
                    <View key={i} style={styles.fpArtistPill}>
                      {a.images?.[2]?.url && <Image source={{ uri: a.images[2].url }} style={styles.fpArtistImg} />}
                      <Text style={styles.fpArtistName} numberOfLines={1}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!openChat.stats?.topTracks?.length && !openChat.stats?.topArtists?.length && (
              <View style={styles.fpNoData}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🎧</Text>
                <Text style={styles.fpNoDataText}>No wrap data yet for {openChat.displayName}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.fpRemoveBtn} onPress={() => removeFriend(openChat)}>
              <Text style={styles.fpRemoveBtnText}>Remove Friend</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </SwipeDownModal>

        {/* Song picker */}
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.fpHandle} />
              <Text style={styles.pickerTitle}>Share a Track</Text>
              <ScrollView style={{ maxHeight: 380 }}>
                {topTracks.length === 0 ? (
                  <Text style={styles.noResults}>Visit Home tab first to load tracks.</Text>
                ) : topTracks.slice(0, 10).map((track, i) => {
                  const img = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url;
                  return (
                    <TouchableOpacity key={track.id || i} style={styles.pickerRow} onPress={() => shareTrack(track)}>
                      {img
                        ? <Image source={{ uri: img }} style={styles.pickerImg} />
                        : <View style={[styles.pickerImg, { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }]}><Text>🎵</Text></View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerTrackName} numberOfLines={1}>{track.name}</Text>
                        <Text style={styles.pickerArtist} numberOfLines={1}>{track.artists?.[0]?.name}</Text>
                      </View>
                      <Text style={{ color: COLORS.accent, fontSize: 22 }}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.fpCloseBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.fpCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── CONVERSATION LIST ────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        {/* Small dot = YOUR connection status only, not friend online status */}
        <View style={[styles.wsIndicator, wsStatus === 'connected' && styles.wsIndicatorOn]} />
      </View>

      {loadingFriends ? (
        <View style={styles.emptyState}><ActivityIndicator color={COLORS.accent} /></View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyHint}>Add friends to start messaging.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── NOTES SECTION ────────────────────────────────────────────────── */}
          {friends.some(f => f.lastPlayedTrack) && (
            <View style={styles.notesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notesScroll}>
                {friends.filter(f => f.lastPlayedTrack).map(friend => {
                  const track = friend.lastPlayedTrack;
                  return (
                    <TouchableOpacity key={friend._id} style={styles.noteItem} onPress={() => openChatWith(friend)} activeOpacity={0.8}>
                      <View style={styles.noteAvatarWrap}>
                        {friend.profileImage ? (
                          <Image source={{ uri: friend.profileImage }} style={styles.noteAvatar} />
                        ) : (
                          <View style={[styles.noteAvatar, styles.convoAvatarFallback]}>
                            <Text style={styles.convoAvatarText}>{friend.displayName?.[0]}</Text>
                          </View>
                        )}
                        <View style={styles.noteBubble}>
                          {track.albumImg ? (
                            <Image source={{ uri: track.albumImg }} style={styles.noteBubbleImg} />
                          ) : (
                            <Text style={styles.noteBubbleIcon}>🎵</Text>
                          )}
                          <View style={styles.noteBubbleTextWrap}>
                            <Text style={styles.noteBubbleTrack} numberOfLines={1}>{track.name}</Text>
                            <Text style={styles.noteBubbleArtist} numberOfLines={1}>{track.artist}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.noteName} numberOfLines={1}>{friend.displayName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── CHATS LIST ───────────────────────────────────────────────────── */}
          {friends.map(friend => {
            const convId = getConversationId(user._id, friend._id);
            const convo = messages[convId] || [];
            const last = convo[convo.length - 1];
            const lastText = last
              ? (last.type === 'track' ? `🎵 ${last.payload?.name}` : last.text)
              : 'Tap to start chatting';

            return (
              <TouchableOpacity key={friend._id} style={styles.convoRow} onPress={() => openChatWith(friend)} activeOpacity={0.7}>
                {/* No online dot per friend — we don't track individual online status */}
                {friend.profileImage ? (
                  <Image source={{ uri: friend.profileImage }} style={styles.convoAvatar} />
                ) : (
                  <View style={[styles.convoAvatar, styles.convoAvatarFallback]}>
                    <Text style={styles.convoAvatarText}>{friend.displayName?.[0]}</Text>
                  </View>
                )}
                <View style={styles.convoInfo}>
                  <View style={styles.convoTopRow}>
                    <Text style={styles.convoName}>{friend.displayName}</Text>
                    {last && <Text style={styles.convoTime}>{formatTime(last.createdAt)}</Text>}
                  </View>
                  <Text style={styles.convoLast} numberOfLines={1}>{lastText}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingTop: 60, paddingHorizontal: SPACING.md, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, flex: 1 },
  wsIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  wsIndicatorOn: { backgroundColor: '#22c55e' },

  notesContainer: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  notesScroll: { paddingHorizontal: SPACING.md, gap: 16 },
  noteItem: { alignItems: 'center', width: 68 },
  noteAvatarWrap: { position: 'relative', marginBottom: 6 },
  noteAvatar: { width: 64, height: 64, borderRadius: 32 },
  noteBubble: { position: 'absolute', top: -8, left: 32, backgroundColor: COLORS.bgElevated, borderRadius: 18, padding: 5, paddingRight: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, maxWidth: 130, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
  noteBubbleImg: { width: 22, height: 22, borderRadius: 11, marginRight: 6 },
  noteBubbleIcon: { fontSize: 14, marginRight: 4 },
  noteBubbleTextWrap: { flexShrink: 1 },
  noteBubbleTrack: { fontSize: 11, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  noteBubbleArtist: { fontSize: 9, color: COLORS.textMuted, flexShrink: 1, marginTop: 1 },
  noteName: { fontSize: 12, color: COLORS.text, textAlign: 'center', fontWeight: '600' },

  convoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 14 },
  convoAvatar: { width: 54, height: 54, borderRadius: 27 },
  convoAvatarFallback: { backgroundColor: COLORS.violetSoft, alignItems: 'center', justifyContent: 'center' },
  convoAvatarText: { fontSize: 22, fontWeight: '700', color: COLORS.violet },
  convoInfo: { flex: 1 },
  convoTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  convoName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  convoTime: { fontSize: 11, color: COLORS.textMuted },
  convoLast: { fontSize: 13, color: COLORS.textMuted },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptyHint: { fontSize: 14, color: COLORS.textMuted },

  chatHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 56, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, backgroundColor: COLORS.bg },
  backBtn: { paddingRight: 8 },
  backBtnText: { fontSize: 30, color: COLORS.accent, lineHeight: 34 },
  chatHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  chatInfoBtn: { padding: 6 },
  chatInfoIcon: { fontSize: 20, color: COLORS.textMuted },
  chatName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  chatSub: { fontSize: 11, marginTop: 1 },

  chatScroll: { flex: 1 },
  chatScrollContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  chatEmpty: { alignItems: 'center', paddingVertical: 60 },
  chatEmptyEmoji: { fontSize: 44, marginBottom: 10 },
  chatEmptyText: { color: COLORS.textMuted, fontSize: 15 },

  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 4 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
  dateLabel: { fontSize: 11, color: COLORS.textMuted, marginHorizontal: 10, fontWeight: '500' },

  bubbleRow: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-end' },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  bubbleMe: { backgroundColor: COLORS.accent, borderBottomRightRadius: 5 },
  bubbleThem: { backgroundColor: COLORS.bgCard, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, borderBottomLeftRadius: 5 },
  bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, marginTop: 3, paddingHorizontal: 2 },
  bubbleTimeMe: { color: COLORS.textMuted, textAlign: 'right' },
  bubbleTimeThem: { color: COLORS.textMuted },
  bubbleTick: { color: COLORS.textMuted },

  songCard: { width: 220, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  songCardMe: { borderColor: COLORS.accent + '55', backgroundColor: COLORS.accent + '12' },
  songCardThem: { borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  songCardImage: { width: '100%', height: 220, resizeMode: 'cover' },
  songCardInfo: { padding: 12 },
  songCardName: { fontSize: 14, color: COLORS.text, fontWeight: '700', marginBottom: 2 },
  songCardArtist: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  songCardPlay: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  songCardPlayIcon: { color: '#1DB954', fontSize: 12 },
  songCardPlayText: { color: '#1DB954', fontSize: 12, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg, gap: 8,
  },
  attachBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 1 },
  attachIcon: { fontSize: 16 },
  chatInput: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingTop: 9, paddingBottom: 9, color: COLORS.text, fontSize: 15, maxHeight: 110, minHeight: 38 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  sendBtnActive: { backgroundColor: COLORS.accent },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '700' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  fpSheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  swipeHandleArea: { alignItems: 'center', paddingVertical: 14 },
  fpHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border },
  fpHero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  fpName: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 12, marginBottom: 2 },
  fpHandle2: { fontSize: 13, color: COLORS.accent, marginBottom: 10 },
  fpCharBadge: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  fpCharLabel: { fontSize: 9, color: COLORS.accent, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  fpCharName: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  fpCharFilm: { fontSize: 12, color: COLORS.textMuted },
  fpSection: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  fpSectionTitle: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  fpTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  fpTrackNum: { width: 18, fontSize: 12, color: COLORS.textMuted, textAlign: 'center', fontWeight: '500' },
  fpTrackImg: { width: 40, height: 40, borderRadius: 8 },
  fpTrackName: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  fpTrackArtist: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  fpArtistWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fpArtistPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  fpArtistImg: { width: 20, height: 20, borderRadius: 10 },
  fpArtistName: { fontSize: 12, color: COLORS.textMuted, maxWidth: 90 },
  fpNoData: { alignItems: 'center', paddingVertical: 40 },
  fpNoDataText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20 },
  fpRemoveBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.accent + '66', paddingVertical: 13, alignItems: 'center', backgroundColor: COLORS.accent + '11' },
  fpRemoveBtnText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  fpCloseBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 13, alignItems: 'center' },
  fpCloseBtnText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },

  pickerSheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, gap: 12 },
  pickerImg: { width: 46, height: 46, borderRadius: 8 },
  pickerTrackName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  pickerArtist: { fontSize: 12, color: COLORS.textMuted },
  noResults: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 30 },
});
