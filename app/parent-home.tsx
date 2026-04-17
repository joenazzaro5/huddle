import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { useRole } from '../lib/roleStore'
import { supabase } from '../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'

const tc = '#1A56DB'

const CONFETTI_COLORS_P = ['#F59E0B', '#1A56DB', '#10B981', '#EF4444', '#7C3AED', '#F97316', '#06B6D4', '#EC4899']

const FOCUS_COLORS_P: Record<string, { bg: string; text: string }> = {
  Dribbling:   { bg: '#F0F4FF', text: '#1A56DB' },
  Passing:     { bg: '#F0FDF4', text: '#059669' },
  Shooting:    { bg: '#FFF7ED', text: '#D97706' },
  Defending:   { bg: '#FEF2F2', text: '#DC2626' },
  Goalkeeping: { bg: '#F5F3FF', text: '#7C3AED' },
}

const HOME_DRILLS_P = [
  { id: 1, name: 'Cone Weaving',          focus: 'Dribbling', duration: '10 min', desc: 'Place 6 cones in a straight line, about 1 meter apart. Dribble the ball through all of them using both your left and right foot — try not to knock any over! Go slow at first, then speed up as you get the hang of it.' },
  { id: 2, name: 'Wall Pass Combos',       focus: 'Passing',   duration: '10 min', desc: 'Find a wall and stand about 3 big steps away. Kick the ball at the wall, then control it when it bounces back to you. Try moving closer or farther to make it harder — focus on stopping the ball with one touch.' },
  { id: 3, name: 'Shooting at Target',     focus: 'Shooting',  duration: '10 min', desc: 'Use chalk or tape to mark a target circle on a wall or fence. Stand back a few steps and try to hit the target from different angles — left side, right side, and straight on. See how many times in a row you can hit it!' },
  { id: 4, name: '1v1 Shadow Dribbling',   focus: 'Dribbling', duration: '8 min',  desc: 'Place two cones about 5 big steps apart. Dribble the ball back and forth between them, changing direction at each cone. Practice using the inside and outside of both feet — the goal is quick, tight touches.' },
  { id: 5, name: 'Passing Triangle',       focus: 'Passing',   duration: '10 min', desc: 'Set up 3 cones in a triangle shape, each about 5 steps apart. Pass the ball from one cone to the next, then run to where you just passed from. Keep going around the triangle — it works your brain and your feet at the same time!' },
  { id: 6, name: 'Toe Taps & Sole Rolls',  focus: 'Dribbling', duration: '8 min',  desc: 'Put the ball in front of you and alternate tapping the top of it with each foot — left, right, left, right — for 30 seconds. Then roll the ball side-to-side with the bottom of your foot for 30 seconds. Simple but amazing for ball control!' },
  { id: 7, name: 'Long Pass & Control',    focus: 'Passing',   duration: '12 min', desc: 'Stand far from a wall or target and kick the ball hard toward it, then sprint to where it lands. Practice stopping the ball with your chest, thigh, or foot — whatever it takes to bring it under control. The sprint is part of the drill!' },
]

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function thisWeekDayIndices(dates: string[]): number[] {
  const now = new Date()
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  return dates
    .filter(d => { const dt = new Date(d + 'T00:00:00'); return dt >= monday && dt < nextMonday })
    .map(d => { const day = new Date(d + 'T00:00:00').getDay(); return (day + 6) % 7 })
}

const FALLBACK_PLAN = {
  title: 'Passing & Movement',
  plan: [
    { phase: 'Opening Play',   duration: '15 min', drill: 'Rondo 4v2',                  desc: '4 players keep ball away from 2 defenders in a small square. First touch only. High energy, competitive.' },
    { phase: 'Practice Phase', duration: '30 min', drill: 'Triangle Passing + Overlap', desc: 'Three players form a triangle. After each pass, the passer runs to a new position. Add a wall pass variation after 10 minutes.' },
    { phase: 'Final Play',     duration: '15 min', drill: 'Possession Game 5v5',        desc: 'Keep the ball. Every 5 consecutive passes = 1 point. No long balls — short and sharp only.' },
  ],
}
const PHASE_COLORS = ['#4CAF50', '#1A56DB', '#FF6B35']


export default function ParentHomeScreen() {
  const router = useRouter()
  const { setActiveTeamId } = useRole()
  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [myRsvp, setMyRsvp] = useState<'yes' | 'no' | null>(null)
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, no: 0, maybe: 0 })
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const chatSubRef = useRef<any>(null)
  const [practiceStreak, setPracticeStreak] = useState(0)
  const [practicedDays, setPracticedDays] = useState<number[]>([])
  const [practicedToday, setPracticedToday] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const toastAnim = useRef(new Animated.Value(-60)).current
  const [streakMilestone, setStreakMilestone] = useState<string | null>(null)
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
    }))
  ).current

  const todayDrill = HOME_DRILLS_P[new Date().getDay() % HOME_DRILLS_P.length]

  useEffect(() => {
    loadData()
    return () => { if (chatSubRef.current) supabase.removeChannel(chatSubRef.current) }
  }, [])

  const triggerConfetti = () => {
    const anims = confettiAnims.map(a => {
      const dx = (Math.random() - 0.5) * 160
      const dy = -(Math.random() * 120 + 60)
      a.opacity.setValue(1)
      a.translateX.setValue(0)
      a.translateY.setValue(0)
      return Animated.parallel([
        Animated.timing(a.opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        Animated.timing(a.translateX, { toValue: dx, duration: 1500, useNativeDriver: true }),
        Animated.timing(a.translateY, { toValue: dy, duration: 1500, useNativeDriver: true }),
      ])
    })
    Animated.stagger(30, anims).start()
  }

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: memberships } = await supabase
      .from('team_members')
      .select('team:teams(*), role')
      .eq('user_id', user.id)
    setAllTeams(memberships ?? [])

    const parentMembership = memberships?.find(m => m.role === 'parent') ?? memberships?.[0]
    if (!parentMembership?.team) { setLoading(false); return }

    const teamData = parentMembership.team
    setTeam(teamData)
    setActiveTeamId(teamData.id)
    await loadTeamData(teamData.id, user.id)

    const storedStreak = await AsyncStorage.getItem('huddle_streak_data_parent')
    const streakData = storedStreak ? JSON.parse(storedStreak) : { count: 0, dates: [] }
    setPracticeStreak(streakData.count)
    setPracticedDays(thisWeekDayIndices(streakData.dates))
    setPracticedToday(streakData.dates.includes(todayDateStr()))

    setLoading(false)
  }

  const loadTeamData = async (teamId: string, userId: string) => {
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamId)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)

    const resolvedEvents = (eventData && eventData.length > 0)
      ? eventData
      : [{ id: 'mock-parent-1', type: 'practice', focus: 'Passing', starts_at: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), location: 'Marin Community Fields', duration_min: 60 }]

    if (resolvedEvents.length > 0) {
      const firstEvent = resolvedEvents[0]
      setNextEvent(firstEvent)
      const isRealEvent = firstEvent?.id && !firstEvent.id.startsWith('ss-') && !firstEvent.id.startsWith('mock-')
      if (isRealEvent) {
        const { data: myRsvpData } = await supabase
          .from('rsvps').select('status').eq('event_id', firstEvent.id).eq('user_id', userId).maybeSingle()
        setMyRsvp(myRsvpData?.status ?? null)
        const [{ count: yes }, { count: no }, { count: maybe }] = await Promise.all([
          supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', firstEvent.id).eq('status', 'yes'),
          supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', firstEvent.id).eq('status', 'no'),
          supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', firstEvent.id).eq('status', 'maybe'),
        ])
        setRsvpCounts({ yes: yes ?? 0, no: no ?? 0, maybe: maybe ?? 0 })
      }
    }

    const { data: msgData } = await supabase
      .from('messages')
      .select('*, sender:users(display_name, email)')
      .eq('team_id', teamId)
      .neq('is_deleted', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastMessage(msgData?.team_id === teamId ? msgData : null)

    if (chatSubRef.current) supabase.removeChannel(chatSubRef.current)
    const channel = supabase
      .channel(`parent_home_messages:team_id=eq.${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `team_id=eq.${teamId}` },
        async (payload) => {
          const msg = payload.new
          if (!msg?.id || msg.is_deleted) return
          const { data: full } = await supabase
            .from('messages').select('*, sender:users(display_name, email)').eq('id', msg.id).maybeSingle()
          if (full) setLastMessage(full)
        }
      )
      .subscribe()
    chatSubRef.current = channel
  }

  const showRsvpToast = () => {
    setToastVisible(true)
    Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, { toValue: -60, duration: 300, useNativeDriver: true }).start(() => setToastVisible(false))
      }, 2000)
    })
  }

  const submitRsvp = async (status: 'yes' | 'no') => {
    if (!currentUser || !nextEvent) return
    const prevRsvp = myRsvp
    setMyRsvp(status)
    setRsvpCounts(prev => {
      const next = { ...prev }
      if (prevRsvp === 'yes' || prevRsvp === 'no') next[prevRsvp] = Math.max(0, next[prevRsvp] - 1)
      next[status] = next[status] + 1
      return next
    })
    showRsvpToast()
    const eventId = nextEvent.id
    if (!eventId || /^(ss-|mock-)/.test(eventId)) return
    await supabase.from('rsvps').upsert(
      { user_id: currentUser.id, event_id: eventId, status },
      { onConflict: 'event_id,user_id' }
    )
  }

  const formatDay = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const formatTime12 = (d: Date) => {
    const h = d.getHours()
    const m = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const formatTimeRange = (dateStr: string, dur: number) => {
    const s = new Date(dateStr)
    const e = new Date(s.getTime() + dur * 60000)
    return `${formatTime12(s)} – ${formatTime12(e)}`
  }

  const daysUntil = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `${days} days`
  }

  const formatMsgTime = (dateStr: string) => formatTime12(new Date(dateStr))

  const getSenderName = (msg: any) => {
    if (!msg?.sender) return 'Team'
    return msg.sender.display_name || msg.sender.email?.split('@')[0] || 'Team'
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={tc} size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        teamColor={tc}
        teamName={team?.name}
        showTeamSwitch={allTeams.length > 1}
        allTeams={allTeams}
        onTeamSelect={async (t) => {
          setActiveTeamId(t.id)
          setTeam(t)
          setLastMessage(null)
          if (chatSubRef.current) { supabase.removeChannel(chatSubRef.current); chatSubRef.current = null }
          if (currentUser) loadTeamData(t.id, currentUser.id)
        }}
      />

      {toastVisible && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}>
          <Text style={styles.toastText}>RSVP confirmed! Team notified 💬</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 1. Hero event card with RSVP */}
        {nextEvent ? (
          <View style={[styles.heroCard, { backgroundColor: tc }]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroMeta}>{nextEvent.type === 'practice' ? 'Next practice' : 'Next game'}</Text>
              <Text style={styles.heroMeta}>{daysUntil(nextEvent.starts_at)}</Text>
            </View>
            <Text style={styles.heroDay}>{formatDay(nextEvent.starts_at)}</Text>
            <Text style={styles.heroTitle}>
              {nextEvent.type === 'practice' ? `Focus: ${FALLBACK_PLAN.title}` : `vs ${nextEvent.opponent}`}
            </Text>
            <Text style={styles.heroTime}>{formatTimeRange(nextEvent.starts_at, nextEvent.duration_min ?? 60)}</Text>
            {nextEvent.location && <Text style={styles.heroLocation}>{nextEvent.location}</Text>}
            <View style={styles.rsvpRow}>
              <Text style={styles.rsvpText}>
                {rsvpCounts.yes > 0 ? `${rsvpCounts.yes} confirmed` : 'No RSVPs yet'}
                {rsvpCounts.no > 0 ? ` · ${rsvpCounts.no} out` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={[styles.rsvpBtn, myRsvp === 'yes' && styles.rsvpBtnGoing]} onPress={() => submitRsvp('yes')} activeOpacity={0.8}>
                <Text style={styles.rsvpBtnText}>{myRsvp === 'yes' ? '✅ Going' : 'Going'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.rsvpBtn, myRsvp === 'no' && styles.rsvpBtnOut]} onPress={() => submitRsvp('no')} activeOpacity={0.8}>
                <Text style={styles.rsvpBtnText}>{myRsvp === 'no' ? "❌ Can't make it" : "Can't make it"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Check back soon — your coach will add events</Text>
          </View>
        )}

        {/* 2. This week's focus */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tc, padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.cardLabel}>This week's focus</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF' }}>✦ Personalized for your team</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <Text style={styles.practiceFocus}>{FALLBACK_PLAN.title}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            {FALLBACK_PLAN.plan.map((item, i) => (
              <View key={i} style={[{ paddingVertical: 10 }, i < FALLBACK_PLAN.plan.length - 1 && styles.planPhaseBorder]}>
                <Text style={[styles.planPhaseLabel, { color: PHASE_COLORS[i], marginBottom: 3 }]}>{item.phase} · {item.duration}</Text>
                <Text style={styles.planPhaseDrill}>{item.drill}</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 20 }}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 3. Do this drill at home today */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>Do this drill at home today 🏠</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 }}>{todayDrill.name}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {(() => {
                const fc = FOCUS_COLORS_P[todayDrill.focus] ?? { bg: '#F3F4F6', text: '#6B7280' }
                return (
                  <View style={{ backgroundColor: fc.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: fc.text }}>{todayDrill.focus}</Text>
                  </View>
                )
              })()}
              <View style={{ backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>{todayDrill.duration}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#D97706', marginBottom: 6 }}>Here's what to do:</Text>
              <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>{todayDrill.desc}</Text>
            </View>

            {/* Streak header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B', flex: 1 }}>Practice streak 🔥</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#F59E0B' }}>{practiceStreak}</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 4 }}>day{practiceStreak !== 1 ? 's' : ''}</Text>
            </View>

            {streakMilestone && (
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#D97706' }}>{streakMilestone}</Text>
              </View>
            )}

            {/* 7-day dot tracker */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={[{ width: 28, height: 28, borderRadius: 14, marginBottom: 3, alignItems: 'center', justifyContent: 'center' }, practicedDays.includes(i) ? { backgroundColor: '#F59E0B' } : { backgroundColor: '#F3F4F6' }]}>
                    {practicedDays.includes(i) && <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '600' }}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Confetti + button */}
            <View style={{ position: 'relative' }}>
              {confettiAnims.map((a, i) => (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    bottom: 18,
                    alignSelf: 'center',
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: CONFETTI_COLORS_P[i % CONFETTI_COLORS_P.length],
                    opacity: a.opacity,
                    transform: [{ translateX: a.translateX }, { translateY: a.translateY }],
                  }}
                />
              ))}
              <TouchableOpacity
                style={{ backgroundColor: practicedToday ? '#F0FDF4' : '#F59E0B', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: practicedToday ? 1 : 0, borderColor: '#D97706' }}
                onPress={async () => {
                  const today = todayDateStr()
                  const raw = await AsyncStorage.getItem('huddle_streak_data_parent')
                  const streakData = raw ? JSON.parse(raw) : { count: 0, dates: [] }
                  if (!streakData.dates.includes(today)) {
                    const newDates = [...streakData.dates, today]
                    const newCount = newDates.length
                    await AsyncStorage.setItem('huddle_streak_data_parent', JSON.stringify({ count: newCount, dates: newDates }))
                    setPracticeStreak(newCount)
                    setPracticedDays(thisWeekDayIndices(newDates))
                    if (newCount === 3) {
                      setStreakMilestone('🎉 3-day streak!')
                      triggerConfetti()
                      setTimeout(() => setStreakMilestone(null), 3000)
                    } else if (newCount === 7) {
                      setStreakMilestone('🏆 One week streak!')
                      triggerConfetti()
                      setTimeout(() => setStreakMilestone(null), 3000)
                    } else if (newCount === 14) {
                      setStreakMilestone('🔥 14-day streak! Incredible!')
                      triggerConfetti()
                      setTimeout(() => setStreakMilestone(null), 3000)
                    } else {
                      triggerConfetti()
                    }
                  }
                  setPracticedToday(true)
                }}
                disabled={practicedToday}
                activeOpacity={practicedToday ? 1 : 0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: practicedToday ? '#059669' : '#fff' }}>
                  {practicedToday ? '✓ Practiced today!' : '✓ I did it today'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 4. Chat preview */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#10B981', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push('/chat')}
        >
          <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>💬 Team chat</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            {lastMessage && lastMessage.team_id === team?.id ? (
              <View style={styles.chatPreviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatSender}>{getSenderName(lastMessage)}</Text>
                  <Text style={styles.chatPreviewBody} numberOfLines={2}>{lastMessage.body?.startsWith('https://') ? 'Sent a GIF 🎬' : lastMessage.body}</Text>
                </View>
                <Text style={styles.chatPreviewTime}>{formatMsgTime(lastMessage.created_at)}</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>No messages yet — say hi! 👋</Text>
            )}
            <Text style={[styles.viewLink, { color: tc }]}>Open chat →</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  content: { padding: 14 },
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  heroMeta: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },
  heroDay: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroTime: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 4 },
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  rsvpRow: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  rsvpText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  rsvpBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  rsvpBtnGoing: { backgroundColor: '#059669' },
  rsvpBtnOut: { backgroundColor: '#DC2626' },
  rsvpBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyHero: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.3, marginBottom: 8 },
  practiceFocus: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  planPhaseBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  planPhaseLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  planPhaseDrill: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, marginBottom: 6 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
  toast: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100, backgroundColor: '#059669', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
