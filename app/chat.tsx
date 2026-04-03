import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

export default function ChatScreen() {
  const [team, setTeam] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => { loadData() }, [])

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
      await loadMessages(membership.team.id)
      subscribeToMessages(membership.team.id)
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
    setMessages(data ?? [])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100)
  }

  const subscribeToMessages = (teamId: string) => {
    supabase
      .channel(`team:${teamId}:messages`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `team_id=eq.${teamId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !team || !currentUser) return
    setSending(true)
    const body = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      team_id: team.id,
      user_id: currentUser.id,
      body,
      type: 'user',
    })

    if (error) {
      console.log('Send error:', error.message, error.code)
      Alert.alert('Error', error.message)
      setNewMessage(body)
    }
    setSending(false)
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const teamColor = team?.color ?? '#1D9E75'

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={teamColor} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: teamColor }]}>Cue</Text>
        <View>
          <Text style={styles.headerTitle}>{team?.name}</Text>
          <Text style={styles.headerSub}>Team chat</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Send the first message to your team</Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === currentUser?.id
              const isSystem = msg.type === 'system'

              if (isSystem) {
                return (
                  <View key={msg.id} style={styles.systemMsg}>
                    <Text style={styles.systemMsgText}>{msg.body}</Text>
                  </View>
                )
              }

              return (
                <View key={msg.id} style={[styles.msgWrap, isMe && styles.msgWrapMe]}>
                  <View style={[
                    styles.bubble,
                    isMe ? [styles.bubbleMe, { backgroundColor: teamColor }] : styles.bubbleOther
                  ]}>
                    <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                      {msg.body}
                    </Text>
                  </View>
                  <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                    {formatTime(msg.created_at)}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
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
            style={[styles.sendBtn, { backgroundColor: newMessage.trim() ? teamColor : '#E0E0E0' }]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', textAlign: 'right' },
  headerSub: { fontSize: 12, color: '#888', textAlign: 'right' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#888' },
  systemMsg: { alignItems: 'center', paddingVertical: 6 },
  systemMsgText: { fontSize: 12, color: '#aaa', textAlign: 'center' },
  msgWrap: { alignItems: 'flex-start', marginBottom: 8 },
  msgWrapMe: { alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#eee' },
  bubbleText: { fontSize: 15, color: '#1a1a1a', lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  msgTime: { fontSize: 11, color: '#bbb', marginTop: 3, marginLeft: 4 },
  msgTimeMe: { marginLeft: 0, marginRight: 4 },
  composer: { flexDirection: 'row', padding: 12, gap: 10, borderTopWidth: 0.5, borderTopColor: '#eee', backgroundColor: '#fff' },
  composerInput: { flex: 1, backgroundColor: '#F7F7F5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1a1a1a', maxHeight: 80 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
})
