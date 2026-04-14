import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, FlatList, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Modal, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../lib/supabase'
import { AppHeader } from '../lib/header'

const MOCK_TEAM_MEMBERS = [
  'Sarah Martinez',
  'Tom Kim',
  'Jessica Chen',
  'David Park',
  'Emily Rodriguez',
]

export default function ChatScreen() {
  const [team, setTeam] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [gifModalVisible, setGifModalVisible] = useState(false)
  const [gifQuery, setGifQuery] = useState('soccer celebration')
  const [gifs, setGifs] = useState<any[]>([])
  const [gifsLoading, setGifsLoading] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)
  const [pollModalVisible, setPollModalVisible] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOpts, setPollOpts] = useState(['', '', ''])
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({})
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({})
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([])
  const [actionMsg, setActionMsg] = useState<any | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const teamIdRef = useRef<string | null>(null)
  const latestMessageRef = useRef<string | null>(null)
  const pollInterval = useRef<any>(null)

  useEffect(() => {
    loadData()
    return () => { if (pollInterval.current) clearInterval(pollInterval.current) }
  }, [])

  useEffect(() => {
    if (gifModalVisible) loadGifs('soccer celebration')
  }, [gifModalVisible])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: membership } = await supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('user_id', user.id)
      .eq('role', 'coach')
      .limit(1)
      .single()

    if (membership?.team) {
      setTeam(membership.team)
      teamIdRef.current = membership.team.id
      await loadMessages(membership.team.id)
      startPolling(membership.team.id)
    }
    setLoading(false)
  }

  const loadMessages = async (teamId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (data && data.length > 0) {
      setMessages(data)
      latestMessageRef.current = data[data.length - 1].id
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }

  const startPolling = (teamId: string) => {
    pollInterval.current = setInterval(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true })
        .limit(50)

      if (data && data.length > 0) {
        const latest = data[data.length - 1].id
        if (latest !== latestMessageRef.current) {
          latestMessageRef.current = latest
          setMessages(data)
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
        }
      }
    }, 3000)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !team || !currentUser) return
    setSending(true)
    const rawText = newMessage.trim()
    const body = replyingTo
      ? `> ${replyingTo.body?.startsWith('https://media') ? 'GIF' : (replyingTo.body ?? '').slice(0, 80)}\n${rawText}`
      : rawText
    setNewMessage('')
    setReplyingTo(null)

    const { error } = await supabase.from('messages').insert({
      team_id: team.id,
      user_id: currentUser.id,
      body,
      type: 'user',
    })

    if (error) {
      Alert.alert('Error', error.message)
      setNewMessage(rawText)
    } else {
      if (teamIdRef.current) await loadMessages(teamIdRef.current)
    }
    setSending(false)
  }

  const loadGifs = async (query: string) => {
    setGifsLoading(true)
    setGifError(null)
    try {
      const url = 'https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=' + encodeURIComponent(query) + '&limit=6&rating=g'
      console.log('[GIF] Fetching URL:', url)
      const res = await fetch(url)
      const json = await res.json()
      console.log('[GIF] Full response:', JSON.stringify(json))
      setGifs(json.data || [])
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      console.log('[GIF] Fetch error:', msg)
      setGifError(msg)
      setGifs([])
    } finally {
      setGifsLoading(false)
    }
  }

  const sendPoll = async () => {
    if (!team || !currentUser || !pollQuestion.trim()) return
    const options = pollOpts.filter(o => o.trim())
    if (options.length < 2) return
    const body = 'POLL:' + JSON.stringify({ question: pollQuestion.trim(), options })
    setPollModalVisible(false)
    setPollQuestion('')
    setPollOpts(['', '', ''])
    const { error } = await supabase.from('messages').insert({
      team_id: team.id, user_id: currentUser.id, body, type: 'user',
    })
    if (!error && teamIdRef.current) await loadMessages(teamIdRef.current)
  }

  const votePoll = (msgId: string, optIndex: number) => {
    setPollVotes(prev => ({ ...prev, [msgId]: optIndex }))
  }

  const addReaction = (msgId: string, emoji: string) => {
    setReactions(prev => {
      const msgReactions = { ...(prev[msgId] ?? {}) }
      msgReactions[emoji] = (msgReactions[emoji] ?? 0) + 1
      return { ...prev, [msgId]: msgReactions }
    })
    setActionMsg(null)
  }

  const pinMessage = (msg: any) => {
    setPinnedMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev
      return [msg, ...prev]
    })
    setActionMsg(null)
  }

  const parseReply = (body: string): { quote: string; text: string } | null => {
    if (!body?.startsWith('> ')) return null
    const newline = body.indexOf('\n')
    if (newline === -1) return null
    return { quote: body.slice(2, newline), text: body.slice(newline + 1) }
  }

  const sendGif = async (item: any) => {
    if (!team || !currentUser) return
    setGifModalVisible(false)
    const url = item.images.fixed_height_small.url
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      team_id: team.id,
      user_id: currentUser.id,
      body: url,
      type: 'user',
    })
    if (!error && teamIdRef.current) await loadMessages(teamIdRef.current)
    setSending(false)
  }

  const openImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to share images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setPendingImage(result.assets[0].uri)
      Alert.alert('Image sharing coming soon', 'Image sharing coming soon — stay tuned!')
    }
  }

  const showDirectMessage = () => {
    Alert.alert(
      'Direct message',
      'Choose a team member',
      [
        ...MOCK_TEAM_MEMBERS.map(name => ({
          text: name,
          onPress: () => Alert.alert('Coming soon', `1:1 messaging with ${name} coming soon!`),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    )
  }

  const isToday = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
  }

  const formatTime = (dateStr: string) => {
    if (isToday(dateStr)) {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const getSenderInitial = (msg: any): string => {
    if (msg.sender_name) return msg.sender_name[0].toUpperCase()
    if (msg.user_id) return msg.user_id[0].toUpperCase()
    return '?'
  }

  const getSenderName = (msg: any): string => {
    if (msg.sender_name) return msg.sender_name
    return 'Team member'
  }

  const avatarColor = (userId: string) => {
    const colors = ['#1A56DB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2']
    let hash = 0
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
  }

  const tc = '#1A56DB'
  const { width } = Dimensions.get('window')

  if (loading) return <View style={styles.loading}><ActivityIndicator color={tc} size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName={team?.name} />

      {/* Chat header with DM button */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>{team?.name} · Team chat</Text>
        <TouchableOpacity style={styles.dmBtn} onPress={showDirectMessage}>
          <Text style={styles.dmIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {pinnedMessages.length > 0 && (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedIcon}>📌</Text>
          <Text style={styles.pinnedText} numberOfLines={1}>
            {pinnedMessages[0].body?.startsWith('https://media') ? 'GIF' : pinnedMessages[0].body}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Send the first message to your team</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === currentUser?.id
              if (msg.type === 'system') {
                return (
                  <View key={msg.id} style={styles.systemMsg}>
                    <Text style={styles.systemMsgText}>{msg.body}</Text>
                  </View>
                )
              }
              const replyData = parseReply(msg.body)
              const displayBody = replyData ? replyData.text : msg.body
              const msgReactions = reactions[msg.id]
              return (
                <TouchableOpacity key={msg.id} style={[styles.msgWrap, isMe && styles.msgWrapMe]} onLongPress={() => setActionMsg(msg)} activeOpacity={1} delayLongPress={350}>
                  {!isMe && (
                    <View style={styles.senderRow}>
                      <View style={[styles.avatar, { backgroundColor: avatarColor(msg.user_id ?? 'x') }]}>
                        <Text style={styles.avatarText}>{getSenderInitial(msg)}</Text>
                      </View>
                      <Text style={styles.senderName}>{getSenderName(msg)}</Text>
                    </View>
                  )}
                  <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
                    {!isMe && <View style={styles.avatarSpacer} />}
                    {msg.body?.startsWith('POLL:') ? (() => {
                      try {
                        const poll = JSON.parse(msg.body.slice(5))
                        const myVote = pollVotes[msg.id]
                        return (
                          <View style={styles.pollCard}>
                            <Text style={styles.pollCardQuestion}>{poll.question}</Text>
                            {poll.options.map((opt: string, i: number) => {
                              const isVoted = myVote === i
                              return (
                                <TouchableOpacity key={i} onPress={() => votePoll(msg.id, i)} activeOpacity={0.75}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                    <Text style={{ fontSize: 13, fontWeight: isVoted ? '700' : '500', color: isVoted ? '#7C3AED' : '#333', flex: 1 }}>{opt}</Text>
                                    {isVoted && <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600' }}>✓</Text>}
                                  </View>
                                  <View style={{ height: 5, backgroundColor: '#f0f0f0', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
                                    <View style={{ height: 5, borderRadius: 3, backgroundColor: isVoted ? '#7C3AED' : '#E9D5FF', width: isVoted ? '100%' : '0%' }} />
                                  </View>
                                </TouchableOpacity>
                              )
                            })}
                            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                              {typeof myVote === 'number' ? 'Voted' : 'Tap to vote'}
                            </Text>
                          </View>
                        )
                      } catch { return null }
                    })() : msg.body?.startsWith('https://media') ? (
                      <Image source={{ uri: msg.body }} style={styles.gifBubble} resizeMode="cover" />
                    ) : (
                      <View style={[styles.bubble, isMe ? [styles.bubbleMe, { backgroundColor: tc }] : styles.bubbleOther]}>
                        {replyData && (
                          <View style={[styles.quoteBlock, !isMe && styles.quoteBlockOther]}>
                            <Text style={[styles.quoteText, !isMe && styles.quoteTextOther]} numberOfLines={2}>{replyData.quote}</Text>
                          </View>
                        )}
                        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{displayBody}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.timeRow, isMe && styles.timeRowMe]}>
                    {!isMe && <View style={styles.avatarSpacer} />}
                    <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{formatTime(msg.created_at)}</Text>
                  </View>
                  {msgReactions && Object.keys(msgReactions).length > 0 && (
                    <View style={[styles.reactionsRow, isMe && styles.reactionsRowMe]}>
                      {!isMe && <View style={styles.avatarSpacer} />}
                      <View style={styles.reactionsList}>
                        {Object.entries(msgReactions).map(([emoji, count]) => (
                          <View key={emoji} style={styles.reactionPill}>
                            <Text style={styles.reactionEmoji}>{emoji}</Text>
                            <Text style={styles.reactionCount}>{count}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })
          )}
        </ScrollView>

        {/* Reply preview bar */}
        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarLabel}>Replying to</Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyingTo.body?.startsWith('https://media') ? 'GIF' : replyingTo.body}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={styles.replyBarClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Image preview above composer */}
        {pendingImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: pendingImage }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setPendingImage(null)}>
              <Text style={styles.imageRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composer}>
          {/* + image button */}
          <TouchableOpacity style={styles.composerAction} onPress={openImagePicker}>
            <Text style={styles.composerActionText}>+</Text>
          </TouchableOpacity>
          {/* GIF button */}
          <TouchableOpacity
            style={styles.composerAction}
            onPress={() => { setGifModalVisible(true); loadGifs(gifQuery) }}
          >
            <Text style={[styles.composerActionText, { fontSize: 11, fontWeight: '800' }]}>GIF</Text>
          </TouchableOpacity>
          {/* Poll button */}
          <TouchableOpacity
            style={styles.composerAction}
            onPress={() => setPollModalVisible(true)}
          >
            <Text style={{ fontSize: 17 }}>🗳️</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.composerInput}
            placeholder="Message team..."
            placeholderTextColor="#aaa"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: newMessage.trim() ? tc : '#E0E0E0' }]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={pollModalVisible} transparent animationType="slide" onRequestClose={() => setPollModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setPollModalVisible(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1a1a1a' }}>Create a poll</Text>
              <TouchableOpacity onPress={() => setPollModalVisible(false)}>
                <Text style={{ fontSize: 18, color: '#888' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 }}
              placeholder="Ask the team something..."
              placeholderTextColor="#bbb"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOpts.map((opt, i) => (
              <TextInput
                key={i}
                style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 14, color: '#1a1a1a', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 }}
                placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ''}`}
                placeholderTextColor="#bbb"
                value={opt}
                onChangeText={t => setPollOpts(prev => prev.map((o, j) => j === i ? t : o))}
              />
            ))}
            <TouchableOpacity
              style={[{ backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 }, (!pollQuestion.trim() || pollOpts.filter(o => o.trim()).length < 2) && { opacity: 0.4 }]}
              onPress={sendPoll}
              disabled={!pollQuestion.trim() || pollOpts.filter(o => o.trim()).length < 2}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Post poll</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Action sheet: long press on a message */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setActionMsg(null)}>
          <View style={styles.actionSheet}>
            <View style={styles.emojiRow}>
              {['👍', '❤️', '😂', '🎉', '⚽'].map(emoji => (
                <TouchableOpacity key={emoji} style={styles.emojiBtn} onPress={() => addReaction(actionMsg!.id, emoji)}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionItem} onPress={() => { setReplyingTo(actionMsg); setActionMsg(null) }}>
              <Text style={styles.actionItemText}>↩ Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => pinMessage(actionMsg!)}>
              <Text style={styles.actionItemText}>📌 Pin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionItem, { borderTopWidth: 0.5, borderTopColor: '#f0f0f0', marginTop: 4 }]} onPress={() => setActionMsg(null)}>
              <Text style={[styles.actionItemText, { color: '#9CA3AF' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={gifModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGifModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setGifModalVisible(false)}>
              <Text style={{ fontSize: 18, color: '#888' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TextInput
              placeholder="Search GIFs..."
              placeholderTextColor="#aaa"
              style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a' }}
              value={gifQuery}
              onChangeText={setGifQuery}
              returnKeyType="search"
              onSubmitEditing={() => loadGifs(gifQuery)}
            />
            <TouchableOpacity
              style={{ backgroundColor: '#1A56DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
              onPress={() => loadGifs(gifQuery)}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Search</Text>
            </TouchableOpacity>
          </View>
          {gifsLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#1A56DB" size="large" />
            </View>
          ) : gifError ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>Error loading GIFs:</Text>
              <Text style={{ color: '#DC2626', fontSize: 13, textAlign: 'center', marginTop: 6 }}>{gifError}</Text>
            </View>
          ) : (
            <FlatList
              data={gifs}
              keyExtractor={(item) => item.id}
              numColumns={3}
              style={{ flex: 1, minHeight: 200 }}
              contentContainerStyle={{ flexGrow: 1 }}
              ListEmptyComponent={
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                  <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '600', textAlign: 'center' }}>No results — try another search</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ width: (width - 40) / 3, height: 100, margin: 2, borderRadius: 8, overflow: 'hidden' }}
                  onPress={() => sendGif(item)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: item.images.fixed_height_small.url }} style={{ width: (width - 40) / 3, height: 100, borderRadius: 8 }} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatHeader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatTitle: { fontSize: 13, fontWeight: '600', color: '#888' },
  dmBtn: { padding: 4 },
  dmIcon: { fontSize: 18 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#888' },
  systemMsg: { alignItems: 'center', paddingVertical: 6 },
  systemMsgText: { fontSize: 12, color: '#aaa' },
  msgWrap: { alignItems: 'flex-start', marginBottom: 12 },
  msgWrapMe: { alignItems: 'flex-end' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  avatarSpacer: { width: 30 },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubbleWrapMe: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#111827', lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  timeRowMe: { flexDirection: 'row-reverse' },
  msgTime: { fontSize: 10, color: '#9CA3AF', marginLeft: 4 },
  msgTimeMe: { marginLeft: 0, marginRight: 4 },
  imagePreviewWrap: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#eee' },
  imagePreview: { width: 60, height: 60, borderRadius: 10 },
  imageRemoveBtn: { position: 'absolute', top: 4, left: 62, backgroundColor: '#333', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  imageRemoveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  composer: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  composerAction: {
    width: 36,
    height: 44,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  composerActionText: { fontSize: 18, color: '#6B7280', fontWeight: '600' },
  composerInput: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
    maxHeight: 100,
    minHeight: 44,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
  gifBubble: { width: 200, height: 150, borderRadius: 12 },
  pollCard: { borderLeftWidth: 3, borderLeftColor: '#7C3AED', backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, maxWidth: 280, borderWidth: 0.5, borderColor: '#E5E7EB' },
  pollCardQuestion: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  pinnedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9C3', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#FDE68A', gap: 6 },
  pinnedIcon: { fontSize: 14 },
  pinnedText: { fontSize: 13, color: '#92400E', flex: 1, fontWeight: '500' },
  quoteBlock: { backgroundColor: 'rgba(0,0,0,0.12)', borderLeftWidth: 3, borderLeftColor: 'rgba(255,255,255,0.6)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 },
  quoteBlockOther: { backgroundColor: 'rgba(0,0,0,0.06)', borderLeftColor: '#9CA3AF' },
  quoteText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' },
  quoteTextOther: { color: '#6B7280' },
  reactionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  reactionsRowMe: { flexDirection: 'row-reverse' },
  reactionsList: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  reactionPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, gap: 3, borderWidth: 0.5, borderColor: '#E5E7EB' },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F7FF', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#BFDBFE', gap: 10 },
  replyBarLabel: { fontSize: 11, fontWeight: '600', color: '#3B82F6', marginBottom: 1 },
  replyBarText: { fontSize: 13, color: '#374151' },
  replyBarClose: { fontSize: 16, color: '#9CA3AF', padding: 4 },
  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, paddingTop: 16 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingVertical: 12 },
  emojiBtn: { padding: 8 },
  emojiText: { fontSize: 28 },
  actionDivider: { height: 0.5, backgroundColor: '#F0F0F0', marginHorizontal: 16, marginBottom: 4 },
  actionItem: { paddingHorizontal: 20, paddingVertical: 14 },
  actionItemText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
})
