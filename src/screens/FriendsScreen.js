import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Dimensions, Modal, TextInput, Alert, Share,
  PanResponder, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const TABS = ['Friends', 'Requests'];

// ── Reusable swipe-down modal ────────────────────────────────────────────────
function SwipeDownModal({ visible, onClose, children, sheetStyle }) {
  const translateY = React.useRef(new Animated.Value(0)).current;

  const panResponder = React.useRef(
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
          <View {...panResponder.panHandlers} style={styles.swipeHandleArea}>
            <View style={styles.modalHandle} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function FriendsScreen({ route }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [loadingCompat, setLoadingCompat] = useState(false);
  const [myStats, setMyStats] = useState(null);
  const [myWrap, setMyWrap] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addMethod, setAddMethod] = useState('search');
  // Friend profile sheet state
  const [showFriendSheet, setShowFriendSheet] = useState(false);
  const [sheetFriend, setSheetFriend] = useState(null);
  const searchTimer = React.useRef(null);

  useEffect(() => {
    const inviteUserId = route?.params?.inviteUserId;
    if (inviteUserId && user?._id && inviteUserId !== user._id) {
      handleDeepLinkInvite(inviteUserId);
    }
  }, [route?.params?.inviteUserId]);

  const handleDeepLinkInvite = async (toUserId) => {
    try {
      await apiService.sendFriendRequest(user._id, toUserId);
      Alert.alert('Request Sent! 🎵', 'Friend request sent successfully.');
      loadFriends();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || '';
      if (msg.toLowerCase().includes('already')) {
        Alert.alert('Already sent', 'You already sent a request to this user.');
      } else {
        Alert.alert('Error', 'Could not send request. Try again.');
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMyStats();
      loadFriends();
      loadRequests();
    }, [user?._id])
  );

  const loadMyStats = async () => {
    try {
      const cached = await AsyncStorage.getItem('weekly_wrap');
      if (cached) {
        const { stats, wrap } = JSON.parse(cached);
        setMyStats(stats);
        setMyWrap(wrap);
      }
    } catch {}
  };

  const loadFriends = async () => {
    try {
      const raw = await AsyncStorage.getItem('friends_list');
      if (raw) setFriends(JSON.parse(raw));
    } catch {}
    if (!user?._id) return;
    setLoadingFriends(true);
    try {
      const res = await apiService.getFriends(user._id);
      const list = res.friends || [];
      setFriends(list);
      await AsyncStorage.setItem('friends_list', JSON.stringify(list));
    } catch (e) {
      console.log('loadFriends error:', e?.message);
    } finally {
      setLoadingFriends(false);
    }
  };

  const loadRequests = async () => {
    try {
      const raw = await AsyncStorage.getItem('friend_requests');
      if (raw) setRequests(JSON.parse(raw));
    } catch {}
    if (!user?._id) return;
    try {
      const res = await apiService.getPendingRequests(user._id);
      const list = res.requests || [];
      setRequests(list);
      await AsyncStorage.setItem('friend_requests', JSON.stringify(list));
    } catch {}
  };

  const handleAddSearch = (text) => {
    setAddQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) { setAddResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const res = await apiService.searchUsers(text);
        const filtered = (res.users || []).filter(u =>
          u._id !== user?._id && !friends.find(f => f._id === u._id)
        );
        setAddResults(filtered);
      } catch (e) {
        console.log('Search error:', e?.message);
        setAddResults([]);
      } finally {
        setAddSearching(false);
      }
    }, 500);
  };

  const sendRequest = async (toUser) => {
    try {
      await apiService.sendFriendRequest(user._id, toUser._id);
      Alert.alert('Request Sent! 🎵', `Friend request sent to ${toUser.displayName}`);
      setAddResults(prev => prev.filter(u => u._id !== toUser._id));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || '';
      if (msg.toLowerCase().includes('already')) {
        Alert.alert('Already sent', 'A request to this user already exists.');
      } else {
        Alert.alert('Error', 'Could not send request. Try again.');
      }
    }
  };

  const shareInviteLink = async () => {
    if (!user?._id) return;
    const link = `beatwrap://add/${user._id}`;
    try {
      await Share.share({
        message: `Add me on BeatWrap! 🎵\n\nOpen the BeatWrap app and tap this link:\n${link}`,
        title: 'Join me on BeatWrap!',
      });
    } catch {}
  };

  const acceptRequest = async (req) => {
    try {
      await apiService.acceptFriendRequest(req._id);
      const updated = requests.filter(r => r._id !== req._id);
      setRequests(updated);
      await AsyncStorage.setItem('friend_requests', JSON.stringify(updated));
      loadFriends();
    } catch {
      Alert.alert('Error', 'Could not accept request.');
    }
  };

  const declineRequest = async (req) => {
    setRequests(prev => prev.filter(r => r._id !== req._id));
  };

  const checkCompatibility = async (friend) => {
    setSelectedFriend(friend);
    setLoadingCompat(true);
    setCompatibility(null);
    try {
      const result = await apiService.getCompatibility(user._id, friend._id);
      setCompatibility(result);
    } catch (e) {
      console.log('Compatibility error:', e?.message);
      setCompatibility({ score: 0, vibe_description: 'No wrap data yet — come back after your first wrap!', shared_traits: [], chemistry: 'Generate your weekly wrap first.' });
    } finally {
      setLoadingCompat(false);
    }
  };

  // ── Remove friend — called from profile sheet only ───────────────────────
  const unfriend = (friend) => {
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
              if (selectedFriend?._id === friend._id) {
                setSelectedFriend(null);
                setCompatibility(null);
              }
              setShowFriendSheet(false);
            } catch {
              Alert.alert('Error', 'Could not remove friend. Try again.');
            }
          },
        },
      ]
    );
  };

  const openFriendSheet = (friend) => {
    setSheetFriend(friend);
    setShowFriendSheet(true);
  };

  const getScoreColor = (score) => score >= 80 ? COLORS.green : score >= 60 ? COLORS.gold : COLORS.accent;

  const closeAddModal = () => { setShowAddModal(false); setAddQuery(''); setAddResults([]); setAddMethod('search'); };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}{tab === 'Requests' && requests.length > 0 ? ` (${requests.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
        {loadingFriends && <ActivityIndicator size="small" color={COLORS.accent} style={{ marginLeft: 'auto', marginRight: SPACING.md }} />}
      </View>

      {activeTab === 'Friends' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Compatibility card */}
          {selectedFriend && (
            <View style={styles.compatCard}>
              <LinearGradient colors={['#1A0A1E', '#0D0D22']} style={styles.compatGradient}>
                <Text style={styles.compatHeader}>VIBE MATCH</Text>
                <View style={styles.compatNames}>
                  <Text style={styles.compatName}>You</Text>
                  <View style={styles.compatScoreWrap}>
                    {loadingCompat ? <ActivityIndicator color={COLORS.accent} /> : (
                      <>
                        <Text style={[styles.compatScore, { color: getScoreColor(compatibility?.score || 0) }]}>{compatibility?.score ?? '—'}%</Text>
                        <Text style={styles.compatScoreLabel}>match</Text>
                      </>
                    )}
                  </View>
                  <Text style={[styles.compatName, { textAlign: 'right' }]}>{selectedFriend.displayName}</Text>
                </View>
                {compatibility && !loadingCompat && (
                  <>
                    <View style={styles.compatBar}>
                      <LinearGradient colors={[COLORS.accent, getScoreColor(compatibility.score)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.compatBarFill, { width: `${compatibility.score}%` }]} />
                    </View>
                    <Text style={styles.compatDesc}>{compatibility.vibe_description}</Text>
                    <Text style={styles.compatChemistry}>"{compatibility.chemistry}"</Text>
                    <View style={styles.sharedTraits}>
                      {(compatibility.shared_traits || []).map((t, i) => (
                        <View key={i} style={styles.trait}><Text style={styles.traitText}>{t}</Text></View>
                      ))}
                    </View>
                  </>
                )}
              </LinearGradient>
            </View>
          )}

          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎧</Text>
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptyHint}>Tap + Add to search by @username or share your invite link.</Text>
            </View>
          ) : (
            friends.map(friend => (
              <View key={friend._id} style={[styles.friendCard, selectedFriend?._id === friend._id && { borderColor: COLORS.accent + '66' }]}>
                {/* Avatar — tap opens profile sheet */}
                <TouchableOpacity onPress={() => openFriendSheet(friend)}>
                  {friend.profileImage ? (
                    <Image source={{ uri: friend.profileImage }} style={styles.friendAvatarImg} />
                  ) : (
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>{friend.displayName?.[0]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.displayName}</Text>
                  {friend.username && <Text style={styles.friendUsername}>@{friend.username}</Text>}
                  {friend.wrap?.tamil_character?.name && (
                    <Text style={styles.friendChar}>As {friend.wrap.tamil_character.name} · {friend.wrap.tamil_character.film}</Text>
                  )}
                </View>
                {/* Only Match button — no Remove Friend here */}
                <TouchableOpacity style={styles.matchBtn} onPress={() => checkCompatibility(friend)}>
                  <Text style={styles.matchBtnText}>⚡ Match</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {activeTab === 'Requests' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No pending requests</Text>
              <Text style={styles.emptyHint}>Share your invite link so friends can find you.</Text>
              <TouchableOpacity style={styles.shareBtn} onPress={shareInviteLink}>
                <Text style={styles.shareBtnText}>📤 Share My Invite Link</Text>
              </TouchableOpacity>
            </View>
          ) : (
            requests.map(req => (
              <View key={req._id} style={styles.requestCard}>
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendAvatarText}>{req.from?.displayName?.[0] || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{req.from?.displayName}</Text>
                  {req.from?.username && <Text style={styles.friendUsername}>@{req.from.username}</Text>}
                  <Text style={styles.reqSub}>wants to be friends</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(req)}>
                    <Text style={styles.acceptBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(req)}>
                    <Text style={styles.declineBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Friend Profile Sheet (swipe down to dismiss) ── */}
      {sheetFriend && (
        <SwipeDownModal
          visible={showFriendSheet}
          onClose={() => setShowFriendSheet(false)}
          sheetStyle={styles.friendSheet}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.fpHero}>
              {sheetFriend.profileImage ? (
                <Image source={{ uri: sheetFriend.profileImage }} style={styles.fpAvatar} />
              ) : (
                <View style={[styles.fpAvatar, styles.fpAvatarFallback]}>
                  <Text style={styles.fpAvatarText}>{sheetFriend.displayName?.[0]}</Text>
                </View>
              )}
              <Text style={styles.fpName}>{sheetFriend.displayName}</Text>
              {sheetFriend.username && <Text style={styles.fpUsername}>@{sheetFriend.username}</Text>}
              {sheetFriend.wrap?.tamil_character?.name && (
                <View style={styles.fpCharBadge}>
                  <Text style={styles.fpCharLabel}>THIS WEEK AS</Text>
                  <Text style={styles.fpCharName}>{sheetFriend.wrap.tamil_character.name}</Text>
                  <Text style={styles.fpCharFilm}>{sheetFriend.wrap.tamil_character.film}</Text>
                </View>
              )}
            </View>

            {sheetFriend.stats?.topTracks?.length > 0 && (
              <View style={styles.fpSection}>
                <Text style={styles.fpSectionTitle}>🎵 TOP TRACKS THIS WEEK</Text>
                {sheetFriend.stats.topTracks.slice(0, 5).map((track, i) => {
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

            {sheetFriend.stats?.topArtists?.length > 0 && (
              <View style={styles.fpSection}>
                <Text style={styles.fpSectionTitle}>🎤 TOP ARTISTS</Text>
                <View style={styles.fpArtistWrap}>
                  {sheetFriend.stats.topArtists.slice(0, 6).map((a, i) => (
                    <View key={i} style={styles.fpArtistPill}>
                      {a.images?.[2]?.url && <Image source={{ uri: a.images[2].url }} style={styles.fpArtistImg} />}
                      <Text style={styles.fpArtistName} numberOfLines={1}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!sheetFriend.stats?.topTracks?.length && !sheetFriend.stats?.topArtists?.length && (
              <View style={styles.fpNoData}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🎧</Text>
                <Text style={styles.fpNoDataText}>No wrap data yet for {sheetFriend.displayName}</Text>
              </View>
            )}

            {/* Remove Friend button */}
            <TouchableOpacity style={styles.fpRemoveBtn} onPress={() => unfriend(sheetFriend)}>
              <Text style={styles.fpRemoveBtnText}>Remove Friend</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </SwipeDownModal>
      )}

      {/* ADD FRIEND MODAL */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Friend</Text>

            <View style={styles.methodToggle}>
              <TouchableOpacity style={[styles.methodBtn, addMethod === 'search' && styles.methodBtnActive]} onPress={() => setAddMethod('search')}>
                <Text style={[styles.methodBtnText, addMethod === 'search' && styles.methodBtnTextActive]}>🔍 Search</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.methodBtn, addMethod === 'link' && styles.methodBtnActive]} onPress={() => setAddMethod('link')}>
                <Text style={[styles.methodBtnText, addMethod === 'link' && styles.methodBtnTextActive]}>🔗 Share Link</Text>
              </TouchableOpacity>
            </View>

            {addMethod === 'search' ? (
              <>
                <Text style={styles.modalSub}>Search by name or @username</Text>
                <View style={styles.modalSearch}>
                  <Text>🔍</Text>
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search @username or name..."
                    placeholderTextColor={COLORS.textMuted}
                    value={addQuery}
                    onChangeText={handleAddSearch}
                    autoFocus
                    autoCapitalize="none"
                  />
                  {addSearching && <ActivityIndicator size="small" color={COLORS.accent} />}
                </View>
                <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                  {addResults.length === 0 && addQuery.length > 1 && !addSearching ? (
                    <Text style={styles.noResults}>No users found for "{addQuery}"</Text>
                  ) : null}
                  {addResults.map(u => (
                    <View key={u._id} style={styles.searchResultRow}>
                      <View style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>{u.displayName?.[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{u.displayName}</Text>
                        {u.username && <Text style={styles.friendUsername}>@{u.username}</Text>}
                      </View>
                      <TouchableOpacity style={styles.sendReqBtn} onPress={() => sendRequest(u)}>
                        <Text style={styles.sendReqBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={styles.linkSection}>
                <Text style={styles.modalSub}>
                  Share your link. When someone opens it in BeatWrap, you'll get a friend request automatically.
                </Text>
                <View style={styles.linkBox}>
                  <Text style={styles.linkText} numberOfLines={1} selectable>beatwrap://add/{user?._id}</Text>
                </View>
                <TouchableOpacity style={styles.shareDeepBtn} onPress={shareInviteLink}>
                  <Text style={styles.shareDeepBtnText}>📤 Share My Link</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={closeAddModal}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.black, color: COLORS.text, letterSpacing: -1 },
  addBtn: { backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent + '66', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  addBtnText: { color: COLORS.accent, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  tabs: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent + '66' },
  tabText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  tabTextActive: { color: COLORS.accent, fontWeight: FONTS.weights.bold },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  compatCard: { borderRadius: 20, overflow: 'hidden', marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.accent + '33' },
  compatGradient: { padding: SPACING.lg },
  compatHeader: { fontSize: 10, color: COLORS.accent, fontWeight: FONTS.weights.bold, letterSpacing: 2, marginBottom: SPACING.md },
  compatNames: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  compatName: { fontSize: FONTS.sizes.sm, color: COLORS.text, fontWeight: FONTS.weights.bold, flex: 1 },
  compatScoreWrap: { alignItems: 'center' },
  compatScore: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.black },
  compatScoreLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  compatBar: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.md },
  compatBarFill: { height: '100%', borderRadius: 3 },
  compatDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, lineHeight: 22, marginBottom: SPACING.sm },
  compatChemistry: { fontSize: FONTS.sizes.md, color: COLORS.text, fontStyle: 'italic', marginBottom: SPACING.md },
  sharedTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trait: { backgroundColor: COLORS.accentSoft, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.accent + '44' },
  traitText: { color: COLORS.accent, fontSize: FONTS.sizes.xs },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.lg, color: COLORS.text, fontWeight: FONTS.weights.bold, marginBottom: 6 },
  emptyHint: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 20 },
  shareBtn: { marginTop: SPACING.md, backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent + '66', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  shareBtnText: { color: COLORS.accent, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },

  // Friend card — no unfriend button
  friendCard: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: SPACING.sm },
  friendAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.violetSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.violet + '55' },
  friendAvatarImg: { width: 46, height: 46, borderRadius: 23 },
  friendAvatarText: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.violet },
  friendInfo: { flex: 1 },
  friendName: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: 1 },
  friendUsername: { fontSize: FONTS.sizes.xs, color: COLORS.accent, marginBottom: 1 },
  friendChar: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  matchBtn: { borderWidth: 1, borderColor: COLORS.accent + '66', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  matchBtnText: { color: COLORS.accent, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

  requestCard: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: SPACING.sm },
  reqSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.green + '22', borderWidth: 1, borderColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: COLORS.green, fontWeight: FONTS.weights.bold },
  declineBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent + '22', borderWidth: 1, borderColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { color: COLORS.accent, fontWeight: FONTS.weights.bold },

  // Friend profile sheet
  friendSheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  swipeHandleArea: { alignItems: 'center', paddingVertical: 14 },
  fpHero: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  fpAvatar: { width: 76, height: 76, borderRadius: 38 },
  fpAvatarFallback: { backgroundColor: COLORS.violetSoft, alignItems: 'center', justifyContent: 'center' },
  fpAvatarText: { fontSize: 30, fontWeight: '700', color: COLORS.violet },
  fpName: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 12, marginBottom: 2 },
  fpUsername: { fontSize: 13, color: COLORS.accent, marginBottom: 10 },
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

  // Add modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: { backgroundColor: COLORS.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: height * 0.85 },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.black, color: COLORS.text, marginBottom: SPACING.sm },
  modalSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 18 },
  methodToggle: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  methodBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  methodBtnActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent + '66' },
  methodBtnText: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  methodBtnTextActive: { color: COLORS.accent, fontWeight: FONTS.weights.bold },
  modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md },
  modalSearchInput: { flex: 1, color: COLORS.text, fontSize: FONTS.sizes.sm, paddingVertical: SPACING.md },
  noResults: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, textAlign: 'center', paddingVertical: SPACING.lg },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  sendReqBtn: { backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent + '66', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  sendReqBtnText: { color: COLORS.accent, fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  linkSection: { paddingVertical: SPACING.sm },
  linkBox: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, marginBottom: SPACING.md },
  linkText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
  shareDeepBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: SPACING.md, alignItems: 'center' },
  shareDeepBtnText: { color: '#000', fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
  closeModalBtn: { marginTop: SPACING.md, alignItems: 'center', paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  closeModalText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
});