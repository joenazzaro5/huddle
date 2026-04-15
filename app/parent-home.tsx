import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { useRole } from '../lib/roleStore'
import { supabase } from '../lib/supabase'
import { getScheduleEvents, SEASON_SCHEDULE } from '../lib/season'
import AsyncStorage from '@react-native-async-storage/async-storage'

const tc = '#1A56DB'

const CHEETAHS_PLAYERS = [
  { id: 'm1', number: 1,  name: 'Sofia',     position: 'GK'  },
  { id: 'm2', number: 2,  name: 'Emma',      position: 'DEF' },
  { id: 'm3', number: 5,  name: 'Olivia',    position: 'MID' },
  { id: 'm4', number: 9,  name: 'Isabella',  position: 'FWD' },
  { id: 'm5', number: 8,  name: 'Charlotte', position: 'MID' },
  { id: 'm6', number: 4,  name: 'Mia',       position: 'DEF' },
  { id: 'm7', number: 11, name: 'Ava',       position: 'FWD' },
  { id: 'm8', number: 3,  name: 'Zoe',       position: 'DEF' },
  { id: 'm9', number: 6,  name: 'Lily',      position: 'MID' },
  { id: 'm10',number: 7,  name: 'Grace',     position: 'MID' },
  { id: 'm11',number: 10, name: 'Ella',      position: 'FWD' },
]

const TIGERS_PLAYERS = [
  { id: 't1', number: 1,  name: 'Luna Santos',     position: 'GK'  },
  { id: 't2', number: 3,  name: 'Maya Johnson',    position: 'DEF' },
  { id: 't3', number: 4,  name: 'Chloe Williams',  position: 'DEF' },
  { id: 't4', number: 5,  name: 'Lily Brown',      position: 'DEF' },
  { id: 't5', number: 7,  name: 'Zoe Davis',       position: 'MID' },
  { id: 't6', number: 8,  name: 'Aria Miller',     position: 'MID' },
  { id: 't7', number: 10, name: 'Emma',            position: 'MID' },
  { id: 't8', number: 6,  name: 'Olivia',          position: 'MID' },
  { id: 't9', number: 9,  name: 'Mia',             position: 'FWD' },
  { id: 't10',number: 11, name: 'Ava',             position: 'FWD' },
  { id: 't11',number: 2,  name: 'Bella',           position: 'DEF' },
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
    { phase: 'Opening Play',   duration: '15 min', drill: 'Rondo 4v2',                    desc: '4 players keep ball away from 2 defenders in a small square. First touch only. High energy, competitive.' },
    { phase: 'Practice Phase', duration: '30 min', drill: 'Triangle Passing + Overlap',   desc: 'Three players form a triangle. After each pass, the passer runs to a new position. Add a wall pass variation after 10 minutes.' },
    { phase: 'Final Play',     duration: '15 min', drill: 'Possession Game 5v5',          desc: 'Keep the ball. Every 5 consecutive passes = 1 point. No long balls — short and sharp only.' },
  ],
}
const PHASE_COLORS = ['#4CAF50', '#1A56DB', '#FF6B35']


export default function ParentHomeScreen() {
  const router = useRouter()
  const { setActiveTeamId, activeTeamId } = useRole()
  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [myRsvp, setMyRsvp] = useState<'yes' | 'no' | null>(null)
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, no: 0, maybe: 0 })
  const [eventRsvps, setEventRsvps] = useState<Record<string, 'yes' | 'no'>>({})
  const [players, setPlayers] = useState<any[]>([])
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const chatSubRef = useRef<any>(null)
  const [practiceStreak, setPracticeStreak] = useState(0)
  const [practicedDays, setPracticedDays] = useState<number[]>([])
  const [watchedToday, setWatchedToday] = useState(false)
  const [practicedToday, setPracticedToday] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const toastAnim = useRef(new Animated.Value(-60)).current
  const [snacks, setSnacks] = useState(() => {
    const now = new Date()
    return SEASON_SCHEDULE
      .filter(e => e.type === 'game' && new Date(e.starts_at) >= now)
      .map(e => ({
        date: new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Game' as string,
        name: null as string | null,
        claimed: false,
      }))
  })

  useEffect(() => {
    loadData()
    return () => { if (chatSubRef.current) supabase.removeChannel(chatSubRef.current) }
  }, [])

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
    const storedStreak = await AsyncStorage.getItem('huddle_streak_data')
    const streakData = storedStreak ? JSON.parse(storedStreak) : { count: 0, dates: [] }
    setPracticeStreak(streakData.count)
    setPracticedDays(thisWeekDayIndices(streakData.dates))
    setPracticedToday(streakData.dates.includes(todayDateStr()))

    const snackKey = `huddle_snacks_${teamData.id}`
    const storedSnacks = await AsyncStorage.getItem(snackKey)
    if (storedSnacks) setSnacks(JSON.parse(storedSnacks))
    else setSnacks(SEASON_SCHEDULE
      .filter(e => e.type === 'game' && new Date(e.starts_at) >= new Date())
      .map(e => ({
        date: new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Game' as string,
        name: null as string | null,
        claimed: false,
      })))

    setLoading(false)
  }

  const loadTeamData = async (teamId: string, userId: string) => {
    const [{ data: eventData }, { data: playerData }] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .eq('team_id', teamId)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(10),
      supabase
        .from('players')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('number', { ascending: true }),
    ])
    setPlayers(playerData ?? [])

    // Fall back to static schedule if Supabase has no events
    const schedEvents = (eventData && eventData.length > 0)
      ? eventData
      : getScheduleEvents().map(e => ({ ...e, team_id: teamId }))

    setNextEvent(schedEvents[0])
    setUpcomingEvents(schedEvents.slice(1, 4))

    // Only fetch RSVPs for real Supabase events (static schedule IDs start with 'ss-')
    const firstEvent = schedEvents[0]
    const isRealEvent = firstEvent?.id && !firstEvent.id.startsWith('ss-')
    if (isRealEvent) {
      const { data: myRsvpData } = await supabase
        .from('rsvps')
        .select('status')
        .eq('event_id', firstEvent.id)
        .eq('user_id', userId)
        .maybeSingle()
      setMyRsvp(myRsvpData?.status ?? null)

      const [{ count: yes }, { count: no }, { count: maybe }] = await Promise.all([
        supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', firstEvent.id).eq('status', 'yes'),
        supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', firstEvent.id).eq('status', 'no'),
        supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', firstEvent.id).eq('status', 'maybe'),
      ])
      setRsvpCounts({ yes: yes ?? 0, no: no ?? 0, maybe: maybe ?? 0 })

      const upcomingIds = schedEvents.slice(1, 4).map(e => e.id).filter(id => !id.startsWith('ss-'))
      if (upcomingIds.length > 0) {
        const { data: upRsvps } = await supabase
          .from('rsvps').select('event_id, status').eq('user_id', userId).in('event_id', upcomingIds)
        const map: Record<string, 'yes' | 'no' | 'maybe'> = {}
        upRsvps?.forEach(r => { map[r.event_id] = r.status })
        setEventRsvps(map)
      }
    }

    // Last chat message — initial fetch then real-time subscription
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
          // Fetch with sender join so name resolves
          const { data: full } = await supabase
            .from('messages')
            .select('*, sender:users(display_name, email)')
            .eq('id', msg.id)
            .maybeSingle()
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
        Animated.timing(toastAnim, { toValue: -60, duration: 300, useNativeDriver: true }).start(() => {
          setToastVisible(false)
        })
      }, 2000)
    })
  }

  const submitRsvp = async (status: 'yes' | 'no') => {
    if (!currentUser || !nextEvent) return
    const prevRsvp = myRsvp
    setMyRsvp(status)
    setRsvpCounts(prev => {
      const updated = { ...prev }
      if (prevRsvp === 'yes' || prevRsvp === 'no') updated[prevRsvp] = Math.max(0, updated[prevRsvp] - 1)
      updated[status] = updated[status] + 1
      return updated
    })
    showRsvpToast()
    await supabase.from('rsvps').upsert(
      { user_id: currentUser.id, event_id: nextEvent.id, status },
      { onConflict: 'event_id,user_id' }
    )
    if (status === 'yes') {
      const displayName = currentUser.user_metadata?.display_name ?? currentUser.email?.split('@')[0] ?? 'Parent'
      const eventName = nextEvent.type === 'game'
        ? `game vs ${nextEvent.opponent ?? 'opponent'}`
        : 'practice'
      const dateLabel = new Date(nextEvent.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      await supabase.from('messages').insert({
        team_id: team.id,
        user_id: currentUser.id,
        body: `✅ ${displayName} is going to ${eventName} on ${dateLabel}!`,
        type: 'user',
      })
    }
    // Refresh counts
    const [{ count: yes }, { count: no }, { count: maybe }] = await Promise.all([
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', nextEvent.id).eq('status', 'yes'),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', nextEvent.id).eq('status', 'no'),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', nextEvent.id).eq('status', 'maybe'),
    ])
    setRsvpCounts({ yes: yes ?? 0, no: no ?? 0, maybe: maybe ?? 0 })
  }

  const claimSnack = async (index: number) => {
    const snackKey = `huddle_snacks_${team?.id}`
    // Pre-check AsyncStorage to get the freshest state
    const stored = await AsyncStorage.getItem(snackKey)
    const freshSnacks = stored ? JSON.parse(stored) : snacks
    const slot = freshSnacks[index]
    if (!slot || slot.claimed) {
      // Sync local state if it was stale
      if (stored) setSnacks(freshSnacks)
      return
    }
    const claimerName = currentUser?.email?.split('@')[0] ?? 'Parent'
    Alert.alert(
      'Claim snack duty',
      `Sign up as ${claimerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim it! 🙌',
          onPress: async () => {
            const updated = freshSnacks.map((s: any, i: number) => i === index ? { ...s, name: claimerName, claimed: true } : s)
            setSnacks(updated)
            await AsyncStorage.setItem(snackKey, JSON.stringify(updated))
          },
        },
      ]
    )
  }

  const formatDay = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  const formatTimeRange = (dateStr: string, dur: number) => {
    const s = new Date(dateStr)
    const e = new Date(s.getTime() + dur * 60000)
    const f = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${f(s)} – ${f(e)}`
  }

  const daysUntil = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `${days} days`
  }

  const formatMsgTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const getSenderName = (msg: any) => {
    if (!msg?.sender) return 'Team'
    return msg.sender.display_name || msg.sender.email?.split('@')[0] || 'Team'
  }

  const rsvpDot = (status: 'yes' | 'no' | 'maybe' | undefined) => {
    if (status === 'yes') return '#22C55E'
    if (status === 'no') return '#EF4444'
    return '#9CA3AF'
  }

  const todayDayIdx = (new Date().getDay() + 6) % 7

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
          const snackKey = `huddle_snacks_${t.id}`
          const stored = await AsyncStorage.getItem(snackKey)
          if (stored) setSnacks(JSON.parse(stored))
          else setSnacks(SEASON_SCHEDULE
            .filter(e => e.type === 'game' && new Date(e.starts_at) >= new Date())
            .map(e => ({
              date: new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              type: 'Game' as string,
              name: null as string | null,
              claimed: false,
            })))
          if (currentUser) loadTeamData(t.id, currentUser.id)
        }}
      />

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
              {nextEvent.type === 'practice'
                ? `Focus: ${FALLBACK_PLAN.title}`
                : `vs ${nextEvent.opponent}`}
            </Text>
            <Text style={styles.heroTime}>{formatTimeRange(nextEvent.starts_at, nextEvent.duration_min ?? 60)}</Text>
            {nextEvent.location && (
              <Text style={styles.heroLocation}>{nextEvent.location}</Text>
            )}

            {/* RSVP buttons */}
            <View style={styles.rsvpBtnRow}>
              {(['yes', 'no'] as const).map((s) => {
                const labels = { yes: 'Going ✓', no: "Can't make it" }
                const selected = myRsvp === s
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.rsvpBtn, selected && styles.rsvpBtnSelected]}
                    onPress={() => submitRsvp(s)}
                  >
                    <Text style={[styles.rsvpBtnText, selected && styles.rsvpBtnTextSelected]}>
                      {labels[s]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.rsvpCountRow}>
              <Text style={styles.rsvpCountText}>
                {rsvpCounts.yes} going · {rsvpCounts.no} out
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Check back soon — your coach will add events</Text>
          </View>
        )}

        {/* 2. Practice plan card — full plan with streak */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tc, padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.cardLabel}>This week's plan</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: tc + 'aa' }}>Read only</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <Text style={styles.practiceFocus}>{FALLBACK_PLAN.title}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            {FALLBACK_PLAN.plan.map((item, i) => (
              <View
                key={i}
                style={[
                  { paddingVertical: 10 },
                  i < FALLBACK_PLAN.plan.length - 1 && styles.planPhaseBorder,
                ]}
              >
                <Text style={[styles.planPhaseLabel, { color: PHASE_COLORS[i], marginBottom: 3 }]}>
                  {item.phase} · {item.duration}
                </Text>
                <Text style={styles.planPhaseDrill}>{item.drill}</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 20 }}>{item.desc}</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>Practice at home 🏠</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Drill of the day */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>Drill of the day 🎯</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 }}>Cone Weaving</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <View style={{ backgroundColor: '#F0F4FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: tc }}>Dribbling</Text>
              </View>
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Beginner</Text>
              </View>
              <View style={{ backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>10 min</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 14 }}>
              Set up 6 cones in a line. Dribble through using both feet. Focus on soft touches.
            </Text>
            {/* Practice streak */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B', flex: 1 }}>
                Practice streak 🔥
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#F59E0B' }}>
                {practiceStreak}
              </Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 4 }}>
                day{practiceStreak !== 1 ? 's' : ''}
              </Text>
            </View>
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
            <TouchableOpacity
              style={{ backgroundColor: practicedToday ? '#F0FDF4' : '#F59E0B', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: practicedToday ? 1 : 0, borderColor: '#D97706' }}
              onPress={async () => {
                const today = todayDateStr()
                const raw = await AsyncStorage.getItem('huddle_streak_data')
                const streakData = raw ? JSON.parse(raw) : { count: 0, dates: [] }
                if (!streakData.dates.includes(today)) {
                  const newDates = [...streakData.dates, today]
                  const newData = { count: newDates.length, dates: newDates }
                  await AsyncStorage.setItem('huddle_streak_data', JSON.stringify(newData))
                  setPracticeStreak(newData.count)
                  setPracticedDays(thisWeekDayIndices(newDates))
                }
                setPracticedToday(true)
              }}
              disabled={practicedToday}
              activeOpacity={practicedToday ? 1 : 0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: practicedToday ? '#059669' : '#fff' }}>
                {practicedToday ? '✓ Practiced today!' : '✓ I practiced today'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Upcoming events */}
        {upcomingEvents.length > 0 && (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tc, padding: 0, overflow: 'hidden' }]}>
            <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
              <Text style={styles.cardLabel}>Upcoming</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 }}>
              {upcomingEvents.map((event, i) => {
                const isGame = event.type === 'game'
                const rsvpStatus = eventRsvps[event.id]
                return (
                  <View key={event.id} style={[styles.eventRow, i < upcomingEvents.length - 1 && styles.eventBorder]}>
                    <View style={[styles.upcomingTypeDot, { backgroundColor: isGame ? '#F59E0B' : tc }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>
                        {isGame ? `Game vs ${event.opponent}` : `Practice · ${event.focus ?? 'General'}`}
                      </Text>
                      <Text style={styles.eventSub}>{formatDay(event.starts_at)}</Text>
                      <Text style={styles.eventTime}>{formatTimeRange(event.starts_at, event.duration_min ?? 60)}</Text>
                    </View>
                    <View style={styles.eventRight}>
                      <Text style={[styles.eventDays, { color: tc }]}>{daysUntil(event.starts_at)}</Text>
                      <View style={[styles.rsvpDot, { backgroundColor: rsvpDot(rsvpStatus) }]} />
                    </View>
                  </View>
                )
              })}
              <TouchableOpacity onPress={() => router.push({ pathname: '/parent-team', params: { tab: 'schedule' } })}>
                <Text style={[styles.viewLink, { color: tc }]}>View schedule →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Next Game card */}
        {(() => {
          const nextGame = [nextEvent, ...upcomingEvents].find(e => e?.type === 'game')
          if (!nextGame) return null
          return (
            <TouchableOpacity
              style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}
              onPress={() => router.push({ pathname: '/parent-team', params: { tab: 'games' } })}
              activeOpacity={0.85}
            >
              <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
                <Text style={styles.cardLabel}>Next game ⚽</Text>
              </View>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 }}>
                  vs {nextGame.opponent ?? 'TBD'}
                </Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 2 }}>{formatDay(nextGame.starts_at)}</Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{formatTimeRange(nextGame.starts_at, nextGame.duration_min ?? 90)}</Text>
                {nextGame.location && (
                  <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{nextGame.location}</Text>
                )}
                <Text style={[styles.viewLink, { color: '#F59E0B', marginTop: 8 }]}>View game details →</Text>
              </View>
            </TouchableOpacity>
          )
        })()}

        {/* The squad */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#1A56DB', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>The squad 👟</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
            {(() => {
              const teamName = team?.name ?? ''
              const mockPlayers = (teamName.includes('Tiger') || teamName.includes('San Rafael')) ? TIGERS_PLAYERS : CHEETAHS_PLAYERS
              const displayPlayers = players.length > 0 ? players : mockPlayers
              return displayPlayers.slice(0, 3).map((player, i) => {
                const pos = (player.positions?.[0] ?? player.position ?? '').toUpperCase()
                const posColor = pos === 'GK' ? '#F59E0B' : ['CB','LB','RB','DEF'].includes(pos) ? tc : pos === 'FWD' ? '#FF6B35' : '#10B981'
                return (
                  <View
                    key={player.id ?? i}
                    style={[styles.rosterRow, i < 2 && styles.rosterBorder]}
                  >
                    <View style={[styles.rosterNumBadge, { backgroundColor: tc + '18' }]}>
                      <Text style={[styles.rosterNum, { color: tc }]}>{player.number ?? player.jersey_number ?? '—'}</Text>
                    </View>
                    <Text style={[styles.rosterName, { flex: 1 }]}>
                      {player.name ?? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()}
                    </Text>
                    {pos ? (
                      <View style={{ backgroundColor: posColor + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: posColor }}>{pos}</Text>
                      </View>
                    ) : null}
                  </View>
                )
              })
            })()}
            <TouchableOpacity onPress={() => router.push({ pathname: '/parent-team', params: { tab: 'roster' } })}>
              <Text style={[styles.viewLink, { color: tc }]}>View full roster →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Chat preview */}
        {lastMessage && lastMessage.team_id === team?.id && (
          <TouchableOpacity
            style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#10B981', padding: 0, overflow: 'hidden' }]}
            onPress={() => router.push('/chat')}
          >
            <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
              <Text style={styles.cardLabel}>💬 Team chat</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={styles.chatPreviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatSender}>{getSenderName(lastMessage)}</Text>
                  <Text style={styles.chatPreviewBody} numberOfLines={2}>{lastMessage.body?.startsWith('https://') ? 'Sent a GIF 🎬' : lastMessage.body}</Text>
                </View>
                <Text style={styles.chatPreviewTime}>{formatMsgTime(lastMessage.created_at)}</Text>
              </View>
              <Text style={[styles.viewLink, { color: tc }]}>Open chat →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Snack schedule card */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push('/parent-snacks')}
          activeOpacity={0.85}
        >
          <View style={styles.snackCardHeader}>
            <Text style={styles.cardLabel}>🍊 Snack schedule</Text>
          </View>
          <View style={styles.cardBody}>
            {snacks.slice(0, 2).map((item, i) => {
              const originalIndex = snacks.indexOf(item)
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.snackRow, i < 1 && styles.snackBorder]}
                  onPress={() => !item.claimed && claimSnack(originalIndex)}
                  activeOpacity={item.claimed ? 1 : 0.7}
                  disabled={item.claimed}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.snackDate}>{item.date} · {item.type}</Text>
                    <Text style={[styles.snackName, { color: item.claimed ? '#1a1a1a' : '#888' }]}>
                      {item.claimed ? `${item.name} ✓` : 'Tap to claim'}
                    </Text>
                  </View>
                  {!item.claimed && <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '700' }}>Claim →</Text>}
                  {item.claimed && <Text style={{ fontSize: 11, color: '#22C55E', fontWeight: '700' }}>Claimed ✓</Text>}
                </TouchableOpacity>
              )
            })}
            <Text style={[styles.viewLink, { color: tc }]}>Snack me! 🍊 →</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      {toastVisible && (
        <Animated.View style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
          transform: [{ translateY: toastAnim }],
          backgroundColor: '#22C55E', paddingVertical: 14, alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>RSVP saved! Coach has been notified 🎉</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  content: { padding: 14 },
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  heroMeta: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroDay: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroTime: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 4 },
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  rsvpBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  rsvpBtn: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  rsvpBtnSelected: { backgroundColor: '#fff', borderColor: '#fff' },
  rsvpBtnText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  rsvpBtnTextSelected: { color: tc },
  rsvpCountRow: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  rsvpCountText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  emptyHero: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  practicePreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  bellIcon: { fontSize: 16 },
  practiceFocus: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  practiceDate: { fontSize: 13, color: '#888', marginBottom: 6 },
  practicePlanNote: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  upcomingTypeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  eventSub: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  eventTime: { fontSize: 11, color: '#bbb', marginTop: 1 },
  eventRight: { alignItems: 'flex-end', gap: 6 },
  eventDays: { fontSize: 11, fontWeight: '700' },
  rsvpDot: { width: 8, height: 8, borderRadius: 4 },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  snackCardHeader: { backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  snackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  snackBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  snackDate: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 2 },
  snackName: { fontSize: 14, fontWeight: '600' },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, marginBottom: 6 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },

  // Practice plan card
  planPhaseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  planPhaseBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  phaseAccent: { width: 4, height: 40, borderRadius: 2 },
  planPhaseLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  planPhaseDrill: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  planPhaseDur: { fontSize: 12, fontWeight: '600', color: '#888' },
  practiceStreakNote: { backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  practiceStreakText: { fontSize: 12, fontWeight: '600', color: '#D97706' },

  // Roster card
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rosterBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  rosterNumBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rosterNum: { fontSize: 13, fontWeight: '700' },
  rosterName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  rosterPos: { fontSize: 12, color: '#888', fontWeight: '500' },

})
