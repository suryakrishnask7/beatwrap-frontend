import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Dimensions, Modal, TextInput, Alert, Share,
  PanResponder, Animated, Pressable, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { COLORS, FONTS, SPACING } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const FILTER_TABS = ['All', 'Requests'];

function SwipeDownModal({ visible, onClose, children, sheetStyle }) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          Animated.timing(translateY, { toValue: 800, duration: 200, useNativeDriver: true }).start(() => { translateY.setValue(0); onClose(); });
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

// Vibe Match badge
function MatchBadge({ onReveal }) {
  return (
    <Pressable onPress={onReveal} style={styles.matchBadge}>
      <View style={[styles.matchBadgeInner, { backgroundColor: '#FF336611', borderColor: '#FF336644' }]}>
        <Text style={styles.matchBolt}>⚡</Text>
        <Text style={[styles.matchScore, { color: '#FF3366', fontSize: 11 }]}>Vibe Match</Text>
      </View>
    </Pressable>
  );
}

export default function FriendsScreen({ route }) {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [loadingCompat, setLoadingCompat] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addMethod, setAddMethod] = useState('search');
  const [showFriendSheet, setShowFriendSheet] = useState(false);
  const [sheetFriend, setSheetFriend] = useState(null);
  const [friendWrapStatus, setFriendWrapStatus] = useState(null); // { hasWrap, data } | null
  const [searchQuery, setSearchQuery] = useState('');
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
      Alert.alert(msg.toLowerCase().includes('already') ? 'Already sent' : 'Error', msg.toLowerCase().includes('already') ? 'You already sent a request.' : 'Could not send request.');
    }
  };

  useFocusEffect(useCallback(() => { loadFriends(); loadRequests(); }, [user?._id]));

  const loadFriends = async () => {
    try { const raw = await AsyncStorage.getItem('friends_list'); if (raw) { try { setFriends(JSON.parse(raw)); } catch { await AsyncStorage.removeItem('friends_list'); } } } catch {}
    if (!user?._id) return;
    setLoadingFriends(true);
    try {
      const res = await apiService.getFriends(user._id);
      const list = res.friends || [];
      setFriends(list);
      await AsyncStorage.setItem('friends_list', JSON.stringify(list));
    } catch (e) { console.log('loadFriends error:', e?.message); }
    finally { setLoadingFriends(false); }
  };

  const loadRequests = async () => {
    try { const raw = await AsyncStorage.getItem('friend_requests'); if (raw) { try { setRequests(JSON.parse(raw)); } catch { await AsyncStorage.removeItem('friend_requests'); } } } catch {}
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
        const filtered = (res.users || []).filter(u => u._id !== user?._id && !friends.find(f => f._id === u._id));
        setAddResults(filtered);
      } catch { setAddResults([]); }
      finally { setAddSearching(false); }
    }, 500);
  };

  const sendRequest = async (toUser) => {
    try {
      await apiService.sendFriendRequest(user._id, toUser._id);
      Alert.alert('Request Sent! 🎵', `Friend request sent to ${toUser.displayName}`);
      setAddResults(prev => prev.filter(u => u._id !== toUser._id));
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || '';
      Alert.alert(msg.toLowerCase().includes('already') ? 'Already sent' : 'Error', msg.toLowerCase().includes('already') ? 'Request already exists.' : 'Could not send request.');
    }
  };

  const shareInviteLink = async () => {
    if (!user?._id) return;
    try { await Share.share({ message: `Add me on BeatWrap! 🎵\nbeatwrap://add/${user._id}`, title: 'Join me on BeatWrap!' }); } catch {}
  };

  const acceptRequest = async (req) => {
    try {
      await apiService.acceptFriendRequest(req._id);
      const updated = requests.filter(r => r._id !== req._id);
      setRequests(updated);
      await AsyncStorage.setItem('friend_requests', JSON.stringify(updated));
      loadFriends();
    } catch { Alert.alert('Error', 'Could not accept request.'); }
  };

  const declineRequest = (req) => setRequests(prev => prev.filter(r => r._id !== req._id));

  const checkCompatibility = async (friend) => {
    setSelectedFriend(friend);
    setLoadingCompat(true);
    setCompatibility(null);
    try {
      const result = await apiService.getCompatibility(user._id, friend._id);
      setCompatibility(result);
    } catch {
      setCompatibility({ noData: true, message: 'No wrap data yet — come back after your first wrap!' });
    } finally { setLoadingCompat(false); }
  };

  const unfriend = (friend) => {
    Alert.alert('Remove Friend', `Remove ${friend.displayName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await apiService.unfriend(user._id, friend._id);
            const updated = friends.filter(f => f._id !== friend._id);
            setFriends(updated);
            await AsyncStorage.setItem('friends_list', JSON.stringify(updated));
            if (selectedFriend?._id === friend._id) { setSelectedFriend(null); setCompatibility(null); }
            setShowFriendSheet(false);
          } catch { Alert.alert('Error', 'Could not remove friend.'); }
        },
      },
    ]);
  };

  const filteredFriends = friends.filter(f => {
    if (searchQuery) return f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || f.username?.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor="#5A5A7A"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {loadingFriends && <ActivityIndicator size="small" color="#FF3366" />}
      </View>

      {/* ── Filter Tabs ── */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
              {tab}{tab === 'Requests' && requests.length > 0 ? ` (${requests.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loadingFriends}
            onRefresh={() => {
              loadFriends();
              loadRequests();
            }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >

        {/* Compatibility card */}
        {selectedFriend && (
          <View style={styles.compatCard}>
            <LinearGradient colors={['#1A0A1E', '#0D0D22']} style={styles.compatGrad}>
              <Text style={styles.compatLabel}>VIBE MATCH</Text>
              <View style={styles.compatRow}>
                <Text style={styles.compatNameText}>You</Text>
                <View style={styles.compatCenter}>
                  {loadingCompat ? <ActivityIndicator color="#FF3366" /> :
                    compatibility?.noData ? <Text style={styles.compatNoData}>—</Text> :
                    <Text style={[styles.compatScore, { color: (compatibility?.score || 0) >= 80 ? '#10B981' : (compatibility?.score || 0) >= 60 ? '#FFD700' : '#FF3366' }]}>
                      {compatibility?.score ?? '—'}%
                    </Text>
                  }
                </View>
                <Text style={[styles.compatNameText, { textAlign: 'right' }]}>{selectedFriend.displayName}</Text>
              </View>
              {compatibility && !loadingCompat && !compatibility.noData && (
                <>
                  <Text style={styles.compatDesc}>{compatibility.vibe_description}</Text>
                  <Text style={styles.compatChemistry}>"{compatibility.chemistry}"</Text>
                  <View style={styles.traitRow}>
                    {(compatibility.shared_traits || []).map((t, i) => (
                      <View key={i} style={styles.traitPill}><Text style={styles.traitText}>{t}</Text></View>
                    ))}
                  </View>
                </>
              )}
              {compatibility?.noData && <Text style={styles.compatNoDataMsg}>{compatibility.message}</Text>}
            </LinearGradient>
          </View>
        )}

        {/* Friend List */}
        {activeFilter === 'All' && (
          filteredFriends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎧</Text>
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptyHint}>Tap + to search or share your link</Text>
            </View>
          ) : (
            filteredFriends.map(friend => (
              <TouchableOpacity
                key={friend._id}
                style={[styles.friendRow, selectedFriend?._id === friend._id && styles.friendRowActive]}
                onPress={async () => {
                  setSheetFriend(friend);
                  setShowFriendSheet(true);
                  setFriendWrapStatus(null);
                  try {
                    const result = await apiService.getFriendWrap(friend._id);
                    setFriendWrapStatus(result);
                  } catch {
                    setFriendWrapStatus({ hasWrap: false });
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={styles.friendAvatarWrap}>
                  {friend.profileImage
                    ? <Image source={{ uri: friend.profileImage }} style={styles.friendAvatar} />
                    : <LinearGradient colors={['#8B5CF655', '#FF336633']} style={styles.friendAvatar}>
                        <Text style={styles.friendAvatarText}>{friend.displayName?.[0]}</Text>
                      </LinearGradient>
                  }
                  <View style={styles.friendOnlineDot} />
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.displayName}</Text>
                  {friend.username && <Text style={styles.friendHandle}>@{friend.username}</Text>}
                  {friend.wrap?.tamil_character?.name && (
                    <Text style={styles.friendListening}>As {friend.wrap.tamil_character.name} · {friend.wrap.tamil_character.film}</Text>
                  )}
                </View>
                <MatchBadge onReveal={() => checkCompatibility(friend)} />
              </TouchableOpacity>
            ))
          )
        )}

        {/* Requests tab */}
        {activeFilter === 'Requests' && (
          requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          ) : (
            requests.map(req => (
              <View key={req._id} style={styles.requestRow}>
                <View style={styles.friendAvatarWrap}>
                  <LinearGradient colors={['#8B5CF655', '#FF336633']} style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>{req.from?.displayName?.[0] || '?'}</Text>
                  </LinearGradient>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{req.from?.displayName}</Text>
                  {req.from?.username && <Text style={styles.friendHandle}>@{req.from.username}</Text>}
                  <Text style={styles.reqSub}>wants to be friends</Text>
                </View>
                <View style={styles.reqActions}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(req)}>
                    <Text style={styles.acceptBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => declineRequest(req)}>
                    <Text style={styles.declineBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Friend Profile Sheet ── */}
      {sheetFriend && (
        <SwipeDownModal visible={showFriendSheet} onClose={() => setShowFriendSheet(false)} sheetStyle={styles.friendSheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.fpHero}>
              {sheetFriend.profileImage
                ? <Image source={{ uri: sheetFriend.profileImage }} style={styles.fpAvatar} />
                : <LinearGradient colors={['#8B5CF6', '#FF3366']} style={styles.fpAvatar}>
                    <Text style={styles.fpAvatarText}>{sheetFriend.displayName?.[0]}</Text>
                  </LinearGradient>
              }
              <Text style={styles.fpName}>{sheetFriend.displayName}</Text>
              {sheetFriend.username && <Text style={styles.fpHandle}>@{sheetFriend.username}</Text>}
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
                <Text style={styles.fpSectionTitle}>🎵 TOP TRACKS</Text>
                {sheetFriend.stats.topTracks.slice(0, 5).map((track, i) => {
                  const img = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url;
                  return (
                    <View key={i} style={styles.fpTrackRow}>
                      <Text style={styles.fpTrackNum}>{i + 1}</Text>
                      {img ? <Image source={{ uri: img }} style={styles.fpTrackImg} />
                        : <View style={[styles.fpTrackImg, { backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' }]}><Text>♫</Text></View>
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
            {/* No wrap state — differentiate between 'loading', 'not yet this week', and 'no data ever' */}
            {!sheetFriend.stats?.topTracks?.length && (
              <View style={styles.fpNoData}>
                {friendWrapStatus === null ? (
                  // Still loading
                  <>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>⏳</Text>
                    <Text style={styles.fpNoDataText}>Checking wrap...</Text>
                  </>
                ) : friendWrapStatus.hasWrap === false ? (
                  // Friend hasn't generated their wrap this week
                  <>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>🎵</Text>
                    <Text style={styles.fpNoDataText}>Not yet this week</Text>
                    <Text style={[styles.fpNoDataText, { fontSize: 11, marginTop: 6, opacity: 0.6 }]}>
                      {sheetFriend.displayName?.split(' ')[0] || 'They'} hasn't generated their wrap yet.
                    </Text>
                  </>
                ) : (
                  // Has a wrap but no topTracks in old format
                  <>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>🎧</Text>
                    <Text style={styles.fpNoDataText}>No track data this week</Text>
                  </>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.fpRemoveBtn} onPress={() => unfriend(sheetFriend)}>
              <Text style={styles.fpRemoveBtnText}>Remove Friend</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </SwipeDownModal>
      )}

      {/* ── Add Friend Modal ── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.addSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.addTitle}>Add Friend</Text>
            <View style={styles.methodToggle}>
              {['search', 'link'].map(m => (
                <TouchableOpacity key={m} style={[styles.methodBtn, addMethod === m && styles.methodBtnActive]} onPress={() => setAddMethod(m)}>
                  <Text style={[styles.methodBtnText, addMethod === m && styles.methodBtnTextActive]}>{m === 'search' ? '🔍 Search' : '🔗 Link'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {addMethod === 'search' ? (
              <>
                <View style={styles.addSearchBar}>
                  <TextInput
                    style={styles.addSearchInput}
                    placeholder="Search @username or name..."
                    placeholderTextColor="#5A5A7A"
                    value={addQuery}
                    onChangeText={handleAddSearch}
                    autoFocus
                    autoCapitalize="none"
                  />
                  {addSearching && <ActivityIndicator size="small" color="#FF3366" />}
                </View>
                <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                  {addResults.length === 0 && addQuery.length > 1 && !addSearching && (
                    <Text style={styles.noResults}>No users found for "{addQuery}"</Text>
                  )}
                  {addResults.map(u => (
                    <View key={u._id} style={styles.addResultRow}>
                      <LinearGradient colors={['#8B5CF633', '#FF336622']} style={styles.addResultAvatar}>
                        <Text style={styles.addResultAvatarText}>{u.displayName?.[0]}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.friendName}>{u.displayName}</Text>
                        {u.username && <Text style={styles.friendHandle}>@{u.username}</Text>}
                      </View>
                      <TouchableOpacity style={styles.addResultBtn} onPress={() => sendRequest(u)}>
                        <Text style={styles.addResultBtnText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={{ paddingVertical: 12 }}>
                <Text style={styles.linkHint}>Share your link. When someone opens it in BeatWrap, a friend request is sent automatically.</Text>
                <View style={styles.linkBox}>
                  <Text style={styles.linkText} selectable numberOfLines={1}>beatwrap://add/{user?._id}</Text>
                </View>
                <TouchableOpacity style={styles.shareLinkBtn} onPress={shareInviteLink}>
                  <Text style={styles.shareLinkBtnText}>📤 Share My Link</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowAddModal(false); setAddQuery(''); setAddResults([]); }}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', color: '#F0F0FF', letterSpacing: -0.5 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF336622', borderWidth: 1, borderColor: '#FF336644', alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FF3366', fontSize: 20, lineHeight: 22 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111118', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A40', marginHorizontal: 20, paddingHorizontal: 14, marginBottom: 12, gap: 8 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: '#F0F0FF', fontSize: 14, paddingVertical: 12 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#111118', borderWidth: 1, borderColor: '#2A2A40' },
  filterTabActive: { backgroundColor: '#FF336622', borderColor: '#FF336666' },
  filterTabText: { fontSize: 12, color: '#9090B0', fontWeight: '600' },
  filterTabTextActive: { color: '#FF3366', fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  // Compat card
  compatCard: { borderRadius: 18, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#FF336622' },
  compatGrad: { padding: 18 },
  compatLabel: { fontSize: 9, color: '#FF3366', fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  compatRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  compatNameText: { flex: 1, fontSize: 13, color: '#F0F0FF', fontWeight: '700' },
  compatCenter: { alignItems: 'center' },
  compatScore: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  compatNoData: { fontSize: 28, fontWeight: '900', color: '#9090B0' },
  compatDesc: { fontSize: 13, color: '#9090B0', lineHeight: 20, marginBottom: 8 },
  compatChemistry: { fontSize: 14, color: '#F0F0FF', fontStyle: 'italic', marginBottom: 10 },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  traitPill: { backgroundColor: '#FF336611', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FF336633' },
  traitText: { color: '#FF3366', fontSize: 11 },
  compatNoDataMsg: { fontSize: 13, color: '#9090B0', textAlign: 'center', paddingVertical: 8 },

  // Friend row
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A28' },
  friendRowActive: { borderRadius: 12, backgroundColor: '#FF336608', paddingHorizontal: 8, marginHorizontal: -8 },
  friendAvatarWrap: { position: 'relative' },
  friendAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: 20, fontWeight: '700', color: '#F0F0FF' },
  friendOnlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#0A0A0F' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: '700', color: '#F0F0FF', marginBottom: 2 },
  friendHandle: { fontSize: 12, color: '#FF3366', marginBottom: 2 },
  friendListening: { fontSize: 11, color: '#9090B0' },

  // Match badge
  matchBadge: {},
  matchBadgeInner: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#1A1A28', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#2A2A40' },
  matchBolt: { fontSize: 12 },
  matchScore: { fontSize: 13, fontWeight: '800' },
  matchTap: { fontSize: 16, color: '#9090B0', fontWeight: '700' },

  // Request row
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A28' },
  reqSub: { fontSize: 11, color: '#9090B0', marginTop: 2 },
  reqActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#10B98122', borderWidth: 1, borderColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { color: '#10B981', fontWeight: '700', fontSize: 14 },
  declineBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FF336622', borderWidth: 1, borderColor: '#FF3366', alignItems: 'center', justifyContent: 'center' },
  declineBtnText: { color: '#FF3366', fontWeight: '700', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#F0F0FF', fontWeight: '700', marginBottom: 6 },
  emptyHint: { fontSize: 13, color: '#9090B0', textAlign: 'center' },
  shareBtn: { marginTop: 16, backgroundColor: '#FF336622', borderWidth: 1, borderColor: '#FF336644', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  shareBtnText: { color: '#FF3366', fontWeight: '700', fontSize: 13 },

  // Friend sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  swipeHandleArea: { alignItems: 'center', paddingVertical: 14 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#2A2A40', borderRadius: 2 },
  friendSheet: { backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', borderWidth: 1, borderColor: '#2A2A40' },
  fpHero: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#1A1A28' },
  fpAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  fpAvatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  fpName: { fontSize: 20, fontWeight: '800', color: '#F0F0FF', marginBottom: 4 },
  fpHandle: { fontSize: 13, color: '#FF3366', marginBottom: 10 },
  fpCharBadge: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A40' },
  fpCharLabel: { fontSize: 9, color: '#FF3366', fontWeight: '700', letterSpacing: 2, marginBottom: 3 },
  fpCharName: { fontSize: 15, color: '#F0F0FF', fontWeight: '700' },
  fpCharFilm: { fontSize: 12, color: '#9090B0' },
  fpSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#1A1A28' },
  fpSectionTitle: { fontSize: 10, color: '#9090B0', fontWeight: '700', letterSpacing: 2, marginBottom: 14 },
  fpTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  fpTrackNum: { width: 18, fontSize: 12, color: '#9090B0', textAlign: 'center' },
  fpTrackImg: { width: 40, height: 40, borderRadius: 8 },
  fpTrackName: { fontSize: 13, color: '#F0F0FF', fontWeight: '600' },
  fpTrackArtist: { fontSize: 11, color: '#9090B0', marginTop: 1 },
  fpNoData: { alignItems: 'center', paddingVertical: 40 },
  fpNoDataText: { fontSize: 14, color: '#9090B0', textAlign: 'center' },
  fpRemoveBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: '#FF336644', paddingVertical: 14, alignItems: 'center', backgroundColor: '#FF336611' },
  fpRemoveBtnText: { color: '#FF3366', fontSize: 14, fontWeight: '700' },

  // Add modal
  addSheet: { backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: height * 0.85, borderWidth: 1, borderColor: '#2A2A40' },
  addTitle: { fontSize: 20, fontWeight: '800', color: '#F0F0FF', marginBottom: 16 },
  methodToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  methodBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: '#2A2A40', alignItems: 'center', backgroundColor: '#0A0A0F' },
  methodBtnActive: { backgroundColor: '#FF336622', borderColor: '#FF336666' },
  methodBtnText: { color: '#9090B0', fontSize: 13, fontWeight: '600' },
  methodBtnTextActive: { color: '#FF3366', fontWeight: '700' },
  addSearchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0F', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A40', paddingHorizontal: 14, marginBottom: 12 },
  addSearchInput: { flex: 1, color: '#F0F0FF', fontSize: 14, paddingVertical: 12 },
  noResults: { color: '#9090B0', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  addResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A28' },
  addResultAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addResultAvatarText: { fontSize: 16, fontWeight: '700', color: '#F0F0FF' },
  addResultBtn: { backgroundColor: '#FF336622', borderWidth: 1, borderColor: '#FF336644', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  addResultBtnText: { color: '#FF3366', fontSize: 12, fontWeight: '700' },
  linkHint: { fontSize: 12, color: '#9090B0', lineHeight: 18, marginBottom: 12 },
  linkBox: { backgroundColor: '#0A0A0F', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A40', padding: 12, marginBottom: 12 },
  linkText: { color: '#9090B0', fontSize: 12 },
  shareLinkBtn: { backgroundColor: '#FF3366', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  shareLinkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  closeBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1A1A28' },
  closeBtnText: { color: '#9090B0', fontSize: 14, fontWeight: '600' },
});