import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Animated, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { AppHeader } from '../lib/header'
import { useRole } from '../lib/roleStore'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'
import { getScheduleEvents } from '../lib/season'
import AsyncStorage from '@react-native-async-storage/async-storage'

const CONFETTI_COLORS_HOME = ['#F59E0B', '#1A56DB', '#10B981', '#EF4444', '#7C3AED', '#F97316', '#06B6D4', '#EC4899']

const FOCUS_COLORS_HOME: Record<string, { bg: string; text: string }> = {
  Dribbling:   { bg: '#F0F4FF', text: '#1A56DB' },
  Passing:     { bg: '#F0FDF4', text: '#059669' },
  Shooting:    { bg: '#FFF7ED', text: '#D97706' },
  Defending:   { bg: '#FEF2F2', text: '#DC2626' },
  Goalkeeping: { bg: '#F5F3FF', text: '#7C3AED' },
}

const HOME_DRILLS = [
  { id: 1, name: 'Cone Weaving',         focus: 'Dribbling', duration: '10 min', desc: 'Place 6 cones in a straight line, about 1 meter apart. Dribble the ball through all of them using both your left and right foot — try not to knock any over! Go slow at first, then speed up as you get the hang of it.' },
  { id: 2, name: 'Wall Pass Combos',      focus: 'Passing',   duration: '10 min', desc: 'Find a wall and stand about 3 big steps away. Kick the ball at the wall, then control it when it bounces back to you. Try moving closer or farther to make it harder — focus on stopping the ball with one touch.' },
  { id: 3, name: 'Shooting at Target',    focus: 'Shooting',  duration: '10 min', desc: 'Use chalk or tape to mark a target circle on a wall or fence. Stand back a few steps and try to hit the target from different angles — left side, right side, and straight on. See how many times in a row you can hit it!' },
  { id: 4, name: '1v1 Shadow Dribbling',  focus: 'Dribbling', duration: '8 min',  desc: 'Place two cones about 5 big steps apart. Dribble the ball back and forth between them, changing direction at each cone. Practice using the inside and outside of both feet — the goal is quick, tight touches.' },
  { id: 5, name: 'Passing Triangle',      focus: 'Passing',   duration: '10 min', desc: 'Set up 3 cones in a triangle shape, each about 5 steps apart. Pass the ball from one cone to the next, then run to where you just passed from. Keep going around the triangle — it works your brain and your feet at the same time!' },
  { id: 6, name: 'Toe Taps & Sole Rolls', focus: 'Dribbling', duration: '8 min',  desc: 'Put the ball in front of you and alternate tapping the top of it with each foot — left, right, left, right — for 30 seconds. Then roll the ball side-to-side with the bottom of your foot for 30 seconds. Simple but amazing for ball control!' },
  { id: 7, name: 'Long Pass & Control',   focus: 'Passing',   duration: '12 min', desc: 'Stand far from a wall or target and kick the ball hard toward it, then sprint to where it lands. Practice stopping the ball with your chest, thigh, or foot — whatever it takes to bring it under control. The sprint is part of the drill!' },
]

const FALLBACK_PLAN = {
  title: 'Passing & Movement',
  plan: [
    { phase: 'Opening Play',   duration: '15 min', drill: 'Rondo 4v2',                    desc: '4 players keep ball away from 2 defenders in a small square. First touch only. High energy, competitive.' },
    { phase: 'Practice Phase', duration: '30 min', drill: 'Triangle Passing + Overlap',   desc: 'Three players form a triangle. After each pass, the passer runs to a new position. Add a wall pass variation after 10 minutes.' },
    { phase: 'Final Play',     duration: '15 min', drill: 'Possession Game 5v5',          desc: 'Keep the ball. Every 5 consecutive passes = 1 point. No long balls — short and sharp only.' },
  ],
  coachTip: "Remind players to check their shoulder before receiving. The best passers always know what's around them before the ball arrives.",
}

const PHASE_COLORS_HOME = ['#10B981', '#1A56DB', '#F97316']
const FOCUS_PILLS = ['Dribbling', 'Passing', 'Shooting', 'Defending', 'All'] as const

async function getRecentFeedbackText(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem('huddle_practice_feedback')
    if (!raw) return ''
    const all: any[] = JSON.parse(raw)
    const recent = all.slice(-3)
    const items = recent.flatMap((fb: any) =>
      (fb.ratings ?? [])
        .filter((r: any) => r.rating === 'Hard' || r.rating === 'Easy')
        .map((r: any) => `${r.drill} was ${r.rating}`)
    )
    return items.length > 0
      ? `Previous feedback from coach: ${items.join(', ')}. Adjust difficulty accordingly.`
      : ''
  } catch { return '' }
}

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

function getChatPreviewText(body: string | null | undefined): string {
  if (!body) return ''
  if (body.startsWith('POLL:')) {
    let q = 'New poll'
    try { q = JSON.parse(body.slice(5)).question ?? 'New poll' } catch {}
    return `📊 ${q}`
  }
  if (body.startsWith('https://')) return 'Sent a GIF 🎬'
  return body
}


export default function HomeScreen() {
  const router = useRouter()
  const { setActiveTeamId, activeTeamId } = useRole()
  const [team, setTeam] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<any>(FALLBACK_PLAN)
  const [planLoading, setPlanLoading] = useState(false)
  const [isOfflinePlan, setIsOfflinePlan] = useState(false)
  const [isAiPlan, setIsAiPlan] = useState(false)
  const [rsvpYes, setRsvpYes] = useState(0)
  const [rsvpNo, setRsvpNo] = useState(0)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [heroSwitching, setHeroSwitching] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [myRsvp, setMyRsvp] = useState<'yes' | 'no' | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastAnim = useRef(new Animated.Value(-60)).current
  const scrollRef = useRef<ScrollView>(null)
  const mountedRef = useRef(false)
  const lastMsgTeamRef = useRef<string | null>(null)
  const [practicedToday, setPracticedToday] = useState(false)
  const [practiceStreak, setPracticeStreak] = useState(0)
  const [practicedDays, setPracticedDays] = useState<number[]>([])
  const [streakMilestone, setStreakMilestone] = useState<string | null>(null)
  const [selectedFocus, setSelectedFocus] = useState<string>('All')
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [drillRatings, setDrillRatings] = useState<Record<string, string>>({})
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
    }))
  ).current

  const todayDrill = HOME_DRILLS[new Date().getDay() % HOME_DRILLS.length]

  useEffect(() => { loadData() }, [])

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, []))

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (team?.id && !loading) {
      loadData(team)
    }
  }, [team?.id])

  useEffect(() => {
    if (!activeTeamId || activeTeamId === team?.id) return
    const membership = allTeams.find(m => m.team?.id === activeTeamId)
    if (membership?.team) {
      setLastMessage(null)
      loadData(membership.team)
    }
  }, [activeTeamId])

  const loadData = async (preferredTeamData?: any) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: memberships } = await supabase
      .from('team_members')
      .select('team:teams(*), role')
      .eq('user_id', user.id)
    setAllTeams(memberships ?? [])

    let teamData = preferredTeamData
    if (!teamData) {
      const coachMembership = memberships?.find(m => m.role === 'coach')
      if (!coachMembership?.team) { setLoading(false); return }
      teamData = coachMembership.team
    }
    setTeam(teamData)
    setActiveTeamId(teamData.id)
    lastMsgTeamRef.current = teamData.id
    setPlan(FALLBACK_PLAN)
    setIsAiPlan(false)
    setIsOfflinePlan(false)

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamData.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    let resolvedEvents: any[] = (eventData && eventData.length > 0) ? eventData : []
    if (resolvedEvents.length === 0) {
      const n = teamData.name ?? ''
      if (n.includes('Cheetah') || n.includes('Marin')) {
        resolvedEvents = [{ id: 'mock-1', type: 'practice', focus: 'Dribbling', starts_at: '2026-04-22T16:00:00', location: 'Marin Community Fields', duration_min: 60 }]
      } else if (n.includes('Tiger')) {
        resolvedEvents = [{ id: 'mock-2', type: 'practice', focus: 'Passing', starts_at: '2026-04-22T16:00:00', location: 'Marin Community Fields', duration_min: 60 }]
      } else if (n.includes('Shark')) {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        const pad = (x: number) => String(x).padStart(2, '0')
        const tomorrowStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00:00`
        resolvedEvents = [{ id: 'mock-sharks-1', type: 'game', opponent: 'Mill Valley FC', starts_at: tomorrowStr, location: 'Terra Linda Park, San Rafael', duration_min: 60 }]
      } else {
        resolvedEvents = getScheduleEvents()
      }
    }
    setNextEvent(resolvedEvents[0] ?? null)
    const validFocuses: string[] = ['Dribbling', 'Passing', 'Shooting', 'Defending']
    setSelectedFocus(validFocuses.includes(resolvedEvents[0]?.focus) ? resolvedEvents[0].focus : 'All')

    const cacheKey = 'huddle_active_plan'
    const rawCache = await AsyncStorage.getItem(cacheKey)
    let needsGenerate = true
    if (rawCache) {
      const { plan: p, timestamp, focus: cachedFocus } = JSON.parse(rawCache)
      const currentFocus = resolvedEvents[0]?.focus ?? null
      if (cachedFocus !== currentFocus) {
        await AsyncStorage.removeItem(cacheKey)
      } else {
        setPlan(p); setIsAiPlan(true)
        needsGenerate = Date.now() - timestamp > 86400000
      }
    }

    if (eventData && eventData.length > 0) {
      const { count: yes } = await supabase
        .from('rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventData[0].id).eq('status', 'yes')
      const { count: no } = await supabase
        .from('rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventData[0].id).eq('status', 'no')
      setRsvpYes(yes ?? 0)
      setRsvpNo(no ?? 0)
    }
    if (needsGenerate) autoGeneratePlan(resolvedEvents[0] ?? null, teamData)

    const { data: msgData } = await supabase
      .from('messages')
      .select('*, sender:users(display_name, email)')
      .eq('team_id', teamData.id)
      .neq('is_deleted', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastMsgTeamRef.current === teamData.id) {
      setLastMessage(msgData?.team_id === teamData.id && !msgData?.is_deleted ? msgData : null)
    }

    const storedStreak = await AsyncStorage.getItem('huddle_streak_data_coach')
    const streakData = storedStreak ? JSON.parse(storedStreak) : { count: 0, dates: [] }
    setPracticeStreak(streakData.count)
    setPracticedDays(thisWeekDayIndices(streakData.dates))
    setPracticedToday(streakData.dates.includes(todayDateStr()))

    setLoading(false)
  }

  const autoGeneratePlan = async (event: any, teamData: any) => {
    setPlanLoading(true)
    setIsOfflinePlan(false)
    try {
      const feedbackText = await getRecentFeedbackText()
      const basePrompt = event?.focus
        ? `${event.focus} focus, ${event?.duration_min ?? 60} minutes`
        : `${event?.duration_min ?? 60} minute practice session`
      const promptWithFeedback = feedbackText ? `${basePrompt}. ${feedbackText}` : basePrompt
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      const result = await Promise.race([
        generatePracticePlan(
          promptWithFeedback,
          teamData?.name, teamData?.age_group
        ),
        timeoutPromise
      ])
      await AsyncStorage.setItem('huddle_active_plan', JSON.stringify({ plan: result, timestamp: Date.now(), focus: event?.focus ?? null }))
      setPlan(result)
      setIsAiPlan(true)
    } catch {
      setIsOfflinePlan(true)
      const existing = await AsyncStorage.getItem('huddle_active_plan')
      if (!existing) {
        await AsyncStorage.setItem('huddle_active_plan', JSON.stringify({ plan: FALLBACK_PLAN, timestamp: 0, focus: event?.focus ?? null }))
      }
    } finally {
      setPlanLoading(false)
    }
  }

  const regeneratePlanWithFocus = async (focus: string) => {
    if (!team) return
    setSelectedFocus(focus)
    await AsyncStorage.removeItem('huddle_active_plan')
    autoGeneratePlan(
      focus === 'All' ? { ...nextEvent, focus: null } : { ...nextEvent, focus },
      team
    )
  }

  const switchTeam = async (teamData: any) => {
    if (teamData.id === team?.id) return
    await AsyncStorage.removeItem('huddle_active_plan')
    setLoading(true)
    setHeroSwitching(true)
    setTeam(null)
    setNextEvent(null)
    setRsvpYes(0)
    setRsvpNo(0)
    setLastMessage(null)
    setPlan(null)
    try {
      await loadData(teamData)
    } finally {
      setHeroSwitching(false)
    }
  }

  const formatTimeRange = (dateStr: string, dur: number) => {
    const s = new Date(dateStr)
    const e = new Date(s.getTime() + dur * 60000)
    const f = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${f(s)} – ${f(e)}`
  }

  const openDirections = (addr: string) =>
    Linking.openURL(`maps://maps.apple.com/?q=${encodeURIComponent(addr)}`)
      .catch(() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`))

  const formatMsgTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const getSenderName = (msg: any) => {
    if (!msg?.sender) return 'Team'
    return msg.sender.display_name || msg.sender.email?.split('@')[0] || 'Team'
  }

  const showToast = () => {
    setToastVisible(true)
    Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, { toValue: -60, duration: 300, useNativeDriver: true }).start(() => {
          setToastVisible(false)
        })
      }, 2000)
    })
  }

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

  const shareDrill = async () => {
    if (!team || !currentUser) return
    const body = `🏠 Home drill of the day: ${todayDrill.name} (${todayDrill.duration})\n${todayDrill.desc}`
    const { error } = await supabase.from('messages').insert({
      team_id: team.id,
      user_id: currentUser.id,
      body,
      type: 'user',
    })
    if (!error) Alert.alert('Shared!', `"${todayDrill.name}" sent to team chat.`)
  }

  const handleRsvp = async (status: 'yes' | 'no') => {
    if (!nextEvent || !currentUser || !team) return
    const prev = myRsvp
    setMyRsvp(status)
    if (status === 'yes') {
      setRsvpYes(n => n + (prev === 'yes' ? 0 : 1))
      if (prev === 'no') setRsvpNo(n => Math.max(0, n - 1))
    } else {
      setRsvpNo(n => n + (prev === 'no' ? 0 : 1))
      if (prev === 'yes') setRsvpYes(n => Math.max(0, n - 1))
    }
    await supabase.from('rsvps').upsert(
      { event_id: nextEvent.id, user_id: currentUser.id, status },
      { onConflict: 'event_id,user_id' }
    )
    showToast()
  }

  const tc = team?.color ?? '#1A56DB'
  const isSharkTeam = !!(team?.name?.includes('Shark'))

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#1A56DB" size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      <AppHeader
        teamColor={tc}
        teamName={team?.name}
        allTeams={allTeams}
        onTeamSelect={switchTeam}
      />

      {toastVisible && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}>
          <Text style={styles.toastText}>RSVP confirmed! Team notified 💬</Text>
        </Animated.View>
      )}

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 1. Hero card */}
        {heroSwitching ? (
          <View style={[styles.heroCard, { backgroundColor: tc, minHeight: 120, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color="rgba(255,255,255,0.8)" size="large" />
          </View>
        ) : nextEvent ? (
          <View style={[styles.heroCard, { backgroundColor: tc }]}>
            <Text style={styles.heroDateLabel}>
              {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.heroTitle}>
              {nextEvent.type === 'practice'
                ? (nextEvent.focus ? `Focus: ${nextEvent.focus}` : 'Practice')
                : nextEvent.type === 'game'
                ? `vs ${nextEvent.opponent}`
                : nextEvent.title ?? nextEvent.type}
            </Text>
            <Text style={styles.heroTime}>{formatTimeRange(nextEvent.starts_at, nextEvent.duration_min ?? 60)}</Text>
            {nextEvent.location && (
              <TouchableOpacity onPress={() => nextEvent.address && openDirections(nextEvent.address)}>
                <Text style={styles.heroLocation}>
                  {nextEvent.location}{nextEvent.address ? ' · Get directions →' : ''}
                </Text>
              </TouchableOpacity>
            )}
            {nextEvent.type === 'game' && (
              <>
                <View style={[styles.rsvpRow, { marginTop: 14 }]}>
                  <Text style={styles.rsvpText}>
                    {rsvpYes > 0 ? `${rsvpYes} confirmed` : 'No RSVPs yet'}
                    {rsvpNo > 0 ? ` · ${rsvpNo} out` : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, myRsvp === 'yes' && styles.rsvpBtnGoing]}
                    onPress={() => handleRsvp('yes')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rsvpBtnText}>{myRsvp === 'yes' ? '✅ Going' : 'Going'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rsvpBtn, myRsvp === 'no' && styles.rsvpBtnOut]}
                    onPress={() => handleRsvp('no')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rsvpBtnText}>{myRsvp === 'no' ? "❌ Can't make it" : "Can't make it"}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Your league administrator will add your schedule</Text>
          </View>
        )}

        {/* 2. Practice plan / Substitution plan */}
        {isSharkTeam ? (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tc, padding: 0, overflow: 'hidden' }]}>
            <View style={[styles.practicePlanHeader, { backgroundColor: '#FEF2F2' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planReadyTitle}>Game day lineup</Text>
                <Text style={styles.planPersonalizedBadge}>✦ U12 Boys · 7v7</Text>
              </View>
            </View>
            <View style={styles.practicePlanBody}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Starting 7</Text>
              {[
                { pos: 'GK', name: 'Alex M.' },
                { pos: 'RD', name: 'Jordan K.' },
                { pos: 'LD', name: 'Tyler S.' },
                { pos: 'CM', name: 'Ethan R.' },
                { pos: 'RM', name: 'Lucas P.' },
                { pos: 'LM', name: 'Noah C.' },
                { pos: 'ST', name: 'Mason B.' },
              ].map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ width: 28, backgroundColor: tc, borderRadius: 4, alignItems: 'center', paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>{p.pos}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{p.name}</Text>
                </View>
              ))}
              <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 12, marginBottom: 4 }]}>Bench</Text>
              <Text style={{ fontSize: 13, color: '#6B7280' }}>Liam T. · Owen G. · Carter H. · Dylan W.</Text>
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginTop: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tc }}>Sub waves: bring in full bench at 8 min and 24 min</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/games')}>
                <Text style={[styles.viewLink, { color: tc }]}>Build your lineup →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tc, padding: 0, overflow: 'hidden' }]}>
            {/* Header */}
            <View style={[styles.practicePlanHeader, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planReadyTitle}>Your practice plan</Text>
                <Text style={styles.planPersonalizedBadge}>✦ Personalized for your team</Text>
              </View>
              {planLoading && <ActivityIndicator color={tc} size="small" />}
            </View>

            <View style={styles.practicePlanBody}>
              {/* Focus selector pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {FOCUS_PILLS.map(f => {
                    const isActive = selectedFocus === f
                    const fc = FOCUS_COLORS_HOME[f] ?? { bg: '#F3F4F6', text: '#6B7280' }
                    return (
                      <TouchableOpacity
                        key={f}
                        onPress={() => regeneratePlanWithFocus(f)}
                        disabled={planLoading}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
                          backgroundColor: isActive ? (f === 'All' ? tc : fc.bg) : '#F9FAFB',
                          borderColor: isActive ? (f === 'All' ? tc : fc.text) : '#E5E7EB',
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? (f === 'All' ? '#fff' : fc.text) : '#9CA3AF' }}>
                          {f}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>

              {/* Session title */}
              <Text style={[styles.cardTitle, { marginBottom: 10 }]}>{plan?.title ?? 'Building your plan...'}</Text>

              {/* Drills with phase labels */}
              {!planLoading && plan?.plan?.map((item: any, i: number) => (
                <View
                  key={i}
                  style={{
                    paddingVertical: 9,
                    borderBottomWidth: i < (plan.plan.length - 1) ? 0.5 : 0,
                    borderBottomColor: '#F3F4F6',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: PHASE_COLORS_HOME[i] ?? '#9CA3AF', letterSpacing: 0.3 }}>
                      {(item.phase ?? `Phase ${i + 1}`).toUpperCase()}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#9CA3AF' }}>{item.duration}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{item.drill}</Text>
                </View>
              ))}

              {/* Coach tip */}
              {!planLoading && plan?.coachTip && (
                <View style={{ backgroundColor: '#F0F4FF', borderRadius: 10, padding: 10, marginTop: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: tc, marginBottom: 3 }}>💡 Coach tip</Text>
                  <Text style={{ fontSize: 13, color: '#374151', lineHeight: 19 }}>
                    {plan.coachTip.split('. ')[0] + (plan.coachTip.includes('. ') ? '.' : '')}
                  </Text>
                </View>
              )}

              {/* CTAs */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: tc, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  onPress={() => router.push('/practice')}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Customize →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}
                  onPress={() => setFeedbackModalOpen(v => !v)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151' }}>
                    {feedbackModalOpen ? 'Close' : 'Give practice feedback'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline feedback */}
              {feedbackModalOpen && (
                <View style={{ marginTop: 12, backgroundColor: '#F7F7F5', borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.3, marginBottom: 10 }}>HOW DID THE DRILLS GO?</Text>
                  {plan?.plan?.map((item: any, i: number) => (
                    <View key={i} style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 }}>{item.drill}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {['Too easy', 'Just right', 'Too hard'].map(rating => {
                          const key = `${i}-${item.drill}`
                          const isSelected = drillRatings[key] === rating
                          return (
                            <TouchableOpacity
                              key={rating}
                              style={{
                                flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
                                backgroundColor: isSelected ? tc : '#fff',
                                borderWidth: 1, borderColor: isSelected ? tc : '#E5E7EB',
                              }}
                              onPress={() => setDrillRatings(prev => ({ ...prev, [key]: rating }))}
                              activeOpacity={0.8}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#fff' : '#6B7280' }}>{rating}</Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={{ backgroundColor: tc, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 4 }}
                    onPress={async () => {
                      const fb = {
                        date: todayDateStr(),
                        planTitle: plan?.title,
                        ratings: plan?.plan?.map((item: any, i: number) => ({
                          drill: item.drill,
                          rating: drillRatings[`${i}-${item.drill}`] ?? null,
                        })) ?? [],
                      }
                      const raw = await AsyncStorage.getItem('huddle_practice_feedback')
                      const all: any[] = raw ? JSON.parse(raw) : []
                      await AsyncStorage.setItem('huddle_practice_feedback', JSON.stringify([...all, fb]))
                      setFeedbackModalOpen(false)
                      setDrillRatings({})
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Submit feedback</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 3. Drill of the day + streak */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>Do this drill at home today 🏠</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 6 }}>{todayDrill.name}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {(() => {
                const fc = FOCUS_COLORS_HOME[todayDrill.focus] ?? { bg: '#F3F4F6', text: '#6B7280' }
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

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4FF', borderRadius: 10, paddingVertical: 10, marginTop: 12 }}
              onPress={shareDrill}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: tc }}>Share with players →</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Text style={[styles.streakLine, { flex: 1, marginBottom: 0 }]}>Practice streak 🔥</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#F59E0B' }}>{practiceStreak}</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 4 }}>day{practiceStreak !== 1 ? 's' : ''}</Text>
            </View>

            {streakMilestone && (
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#D97706' }}>{streakMilestone}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={[styles.streakDot, practicedDays.includes(i) ? styles.streakDotActive : styles.streakDotInactive]}>
                    {practicedDays.includes(i) && <Text style={styles.streakDotCheck}>✓</Text>}
                  </View>
                  <Text style={styles.streakDayLabel}>{d}</Text>
                </View>
              ))}
            </View>

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
                    backgroundColor: CONFETTI_COLORS_HOME[i % CONFETTI_COLORS_HOME.length],
                    opacity: a.opacity,
                    transform: [{ translateX: a.translateX }, { translateY: a.translateY }],
                  }}
                />
              ))}
              <TouchableOpacity
                style={[styles.practicedBtn, practicedToday && styles.practicedBtnDone]}
                onPress={async () => {
                  const today = todayDateStr()
                  const todayIdx = (new Date().getDay() + 6) % 7
                  setPracticedToday(true)
                  if (!practicedDays.includes(todayIdx)) {
                    setPracticedDays(prev => [...prev, todayIdx])
                    setPracticeStreak(prev => {
                      const next = prev + 1
                      if (next === 3) {
                        setStreakMilestone('🎉 3-day streak!')
                        triggerConfetti()
                        setTimeout(() => setStreakMilestone(null), 3000)
                      } else if (next === 7) {
                        setStreakMilestone('🏆 One week streak!')
                        triggerConfetti()
                        setTimeout(() => setStreakMilestone(null), 3000)
                      } else if (next === 14) {
                        setStreakMilestone('🔥 14-day streak! Incredible!')
                        triggerConfetti()
                        setTimeout(() => setStreakMilestone(null), 3000)
                      } else {
                        triggerConfetti()
                      }
                      return next
                    })
                  }
                  const raw = await AsyncStorage.getItem('huddle_streak_data_coach')
                  const streakData = raw ? JSON.parse(raw) : { count: 0, dates: [] }
                  if (!streakData.dates.includes(today)) {
                    const newDates = [...streakData.dates, today]
                    await AsyncStorage.setItem('huddle_streak_data_coach', JSON.stringify({ count: newDates.length, dates: newDates }))
                  }
                }}
                disabled={practicedToday}
                activeOpacity={practicedToday ? 1 : 0.8}
              >
                <Text style={[styles.practicedBtnText, practicedToday && styles.practicedBtnTextDone]}>
                  {practicedToday ? '✓ Practiced today!' : '✓ I practiced today'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 4. Team chat */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#10B981', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push('/chat')}
        >
          <View style={styles.chatCardHeader}>
            <Text style={styles.cardLabel}>Team chat</Text>
          </View>
          <View style={styles.cardBody}>
            {lastMessage ? (
              <View style={styles.chatPreviewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatSender}>{getSenderName(lastMessage)}</Text>
                  <Text style={styles.chatPreviewBody} numberOfLines={2}>{getChatPreviewText(lastMessage.body)}</Text>
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
  // Hero card
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  heroDateLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroTime: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 4 },
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  rsvpRow: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  rsvpText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  rsvpBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  rsvpBtnGoing: { backgroundColor: '#059669' },
  rsvpBtnOut: { backgroundColor: '#DC2626' },
  rsvpBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  toast: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100, backgroundColor: '#059669', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  emptyHero: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  // Cards
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', letterSpacing: 0.3 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  // Practice plan card
  practicePlanHeader: { backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  practicePlanBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 12 },
  planReadyTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  planPersonalizedBadge: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  planMeta: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  // Streak card
  streakLine: { fontSize: 14, fontWeight: '700', color: '#F59E0B', marginBottom: 10 },
  streakDot: { width: 24, height: 24, borderRadius: 12, marginBottom: 3, alignItems: 'center', justifyContent: 'center' },
  streakDotActive: { backgroundColor: '#F59E0B' },
  streakDotInactive: { backgroundColor: '#F3F4F6' },
  streakDotCheck: { fontSize: 10, color: '#fff', fontWeight: '700' },
  streakDayLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600' },
  practicedBtn: { backgroundColor: '#F59E0B', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  practicedBtnDone: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#D97706' },
  practicedBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  practicedBtnTextDone: { color: '#059669' },
  // Chat card
  chatCardHeader: { backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
})
