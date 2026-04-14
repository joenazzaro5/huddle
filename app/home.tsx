import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { useRole } from '../lib/roleStore'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'
import { getScheduleEvents, SEASON_SCHEDULE } from '../lib/season'
import AsyncStorage from '@react-native-async-storage/async-storage'

const FALLBACK_PLAN = {
  title: 'Passing & Movement',
  plan: [
    { phase: 'Opening Play',   duration: '15 min', drill: 'Rondo 4v2',                    desc: '4 players keep ball away from 2 defenders in a small square. First touch only. High energy, competitive.' },
    { phase: 'Practice Phase', duration: '30 min', drill: 'Triangle Passing + Overlap',   desc: 'Three players form a triangle. After each pass, the passer runs to a new position. Add a wall pass variation after 10 minutes.' },
    { phase: 'Final Play',     duration: '15 min', drill: 'Possession Game 5v5',          desc: 'Keep the ball. Every 5 consecutive passes = 1 point. No long balls — short and sharp only.' },
  ],
  coachTip: "Remind players to check their shoulder before receiving. The best passers always know what's around them before the ball arrives.",
}

function getUpcomingSnackSlots() {
  const now = new Date()
  return SEASON_SCHEDULE
    .filter(e => e.type === 'game' && new Date(e.starts_at) >= now)
    .map(e => ({
      date: new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      type: 'Game' as string,
      name: null as string | null,
      claimed: false,
    }))
}

const DRILLS_OF_DAY = [
  { title: 'Cone Weaving',         focus: 'Dribbling',    level: 'Beginner',     duration: '10 min', desc: 'Set up 6 cones in a line. Dribble through using both feet. Focus on soft touches.' },
  { title: 'Wall Pass',            focus: 'Passing',      level: 'Intermediate', duration: '15 min', desc: 'Pass against a wall and control the return. Aim for the same spot each time.' },
  { title: 'Juggling Challenge',   focus: 'Ball Control', level: 'All levels',   duration: '10 min', desc: 'See how many touches you can get without the ball hitting the ground.' },
  { title: '1v1 Defending',        focus: 'Defense',      level: 'Intermediate', duration: '20 min', desc: 'Stay on your toes, jockey the attacker, and force them wide.' },
  { title: 'First Touch Drill',    focus: 'Control',      level: 'Beginner',     duration: '15 min', desc: 'Toss the ball in the air and control it with different surfaces of your foot.' },
  { title: 'Shooting Accuracy',    focus: 'Finishing',    level: 'All levels',   duration: '20 min', desc: 'Place cones as targets in the goal corners. Take 10 shots from different angles.' },
  { title: 'Agility Ladder',       focus: 'Footwork',     level: 'All levels',   duration: '10 min', desc: 'Quick feet through the ladder pattern. Keep your eyes up and stay light.' },
]

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
  const { setRole, setActiveTeamId, activeTeamId } = useRole()
  const [team, setTeam] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<any>(FALLBACK_PLAN)
  const [planLoading, setPlanLoading] = useState(false)
  const [isOfflinePlan, setIsOfflinePlan] = useState(false)
  const [isAiPlan, setIsAiPlan] = useState(false)
  const [rsvpYes, setRsvpYes] = useState(0)
  const [rsvpNo, setRsvpNo] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [players, setPlayers] = useState<any[]>([])
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [heroSwitching, setHeroSwitching] = useState(false)
  const [snacks] = useState(() => getUpcomingSnackSlots())
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [myRsvp, setMyRsvp] = useState<'yes' | 'no' | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastAnim = useRef(new Animated.Value(-60)).current
  const mountedRef = useRef(false)
  const [practicedToday, setPracticedToday] = useState(false)
  const [practiceStreak, setPracticeStreak] = useState(0)
  const [practicedDays, setPracticedDays] = useState<number[]>([])

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (team?.id && !loading) {
      loadData(team)
    }
  }, [team?.id])

  // Sync with activeTeamId from roleStore — handles team switches made on other screens
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
    setPlan(FALLBACK_PLAN)
    setIsAiPlan(false)
    setIsOfflinePlan(false)

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamData.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setEvents(eventData ?? [])

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamData.id)
      .eq('is_active', true)
      .order('number', { ascending: true })
    setPlayers(playerData ?? [])
    setPlayerCount(playerData?.length ?? 0)

    const cacheKey = `huddle_active_plan`
    const rawCache = await AsyncStorage.getItem(cacheKey)
    let needsGenerate = true
    if (rawCache) {
      const { plan: p, timestamp } = JSON.parse(rawCache)
      setPlan(p); setIsAiPlan(true)
      needsGenerate = Date.now() - timestamp > 86400000
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
      if (needsGenerate) autoGeneratePlan(eventData[0], teamData)
    } else {
      if (needsGenerate) autoGeneratePlan(getScheduleEvents()[0] ?? null, teamData)
    }

    const { data: msgData } = await supabase
      .from('messages')
      .select('*, sender:users(display_name, email)')
      .eq('team_id', teamData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastMessage(msgData)

    const storedStreak = await AsyncStorage.getItem('huddle_practice_streak')
    if (storedStreak) setPracticeStreak(parseInt(storedStreak, 10))

    setLoading(false)
  }

  const autoGeneratePlan = async (event: any, teamData: any) => {
    setPlanLoading(true)
    setIsOfflinePlan(false)
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      const result = await Promise.race([
        generatePracticePlan(
          `${event?.focus ?? 'Passing and Movement'} focus, ${event?.duration_min ?? 60} minutes`,
          teamData?.name, teamData?.age_group
        ),
        timeoutPromise
      ])
      await AsyncStorage.setItem('huddle_active_plan', JSON.stringify({ plan: result, timestamp: Date.now() }))
      setPlan(result)
      setIsAiPlan(true)
    } catch {
      setIsOfflinePlan(true)
      const existing = await AsyncStorage.getItem('huddle_active_plan')
      if (!existing) {
        await AsyncStorage.setItem('huddle_active_plan', JSON.stringify({ plan: FALLBACK_PLAN, timestamp: 0 }))
      }
    } finally {
      setPlanLoading(false)
    }
  }

  const switchTeam = async (teamData: any) => {
    if (teamData.id === team?.id) return

    setLoading(true)
    setHeroSwitching(true)
    setTeam(null)
    setEvents([])
    setPlayerCount(0)
    setPlayers([])
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
    if (days <= 0) return 'Season ended'
    if (days === 1) return 'Tomorrow'
    return `In ${days} days`
  }

  const openDirections = (addr: string) =>
    Linking.openURL(`maps://maps.apple.com/?q=${encodeURIComponent(addr)}`)
      .catch(() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(addr)}`))

  const addToCalendar = (dateStr: string) => {
    const ts = Math.floor(new Date(dateStr).getTime() / 1000)
    Linking.openURL(`calshow://${ts}`)
  }

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
    const eventLabel = nextEvent.type === 'practice'
      ? 'Practice'
      : `Game vs ${nextEvent.opponent ?? 'opponent'}`
    const dateLabel = new Date(nextEvent.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    await supabase.from('messages').insert({
      team_id: team.id,
      user_id: currentUser.id,
      body: `✅ Coach is ${status === 'yes' ? 'Going' : 'Not going'} to ${eventLabel} on ${dateLabel}!`,
      type: 'user',
    })
    showToast()
  }

  const drillOfDay = DRILLS_OF_DAY[new Date().getDay() % DRILLS_OF_DAY.length]
  const scheduleEvents = events.length > 0 ? events : getScheduleEvents()
  const nextEvent = scheduleEvents[0] ?? null
  const upcomingEvents = events.length > 0 ? events.slice(1, 4) : getScheduleEvents().slice(1, 4)
  const tc = '#1A56DB'
  const pending = Math.max(0, playerCount - rsvpYes - rsvpNo)

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 1. Hero event card */}
        {heroSwitching ? (
          <View style={[styles.heroCard, { backgroundColor: tc, minHeight: 120, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color="rgba(255,255,255,0.8)" size="large" />
          </View>
        ) : nextEvent ? (
          <View style={[styles.heroCard, { backgroundColor: tc }]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroMeta}>
                {nextEvent.type === 'practice' ? 'Next practice'
                  : nextEvent.type === 'game' ? 'Next game'
                  : nextEvent.type === 'picture_day' ? '📸 Picture Day'
                  : '🎉 End of Season Party'}
              </Text>
              <Text style={styles.heroMeta}>{daysUntil(nextEvent.starts_at)}</Text>
            </View>
            <Text style={styles.heroDay}>{formatDay(nextEvent.starts_at)}</Text>
            <Text style={styles.heroTitle}>
              {nextEvent.type === 'practice'
                ? `Focus: ${nextEvent.focus ?? 'General skills'}`
                : nextEvent.type === 'game'
                ? `vs ${nextEvent.opponent}${nextEvent.home != null ? (nextEvent.home ? ' · Home' : ' · Away') : ''}`
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
            <TouchableOpacity onPress={() => addToCalendar(nextEvent.starts_at)} style={{ marginBottom: 8 }}>
              <Text style={styles.heroCalLink}>📅 Add to calendar</Text>
            </TouchableOpacity>
            <View style={styles.rsvpRow}>
              <Text style={styles.rsvpText}>
                {rsvpYes > 0 ? `${rsvpYes} confirmed` : 'No RSVPs yet'}
                {rsvpNo > 0 ? ` · ${rsvpNo} out` : ''}
                {pending > 0 ? ` · ${pending} pending` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
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
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Your league administrator will add your schedule</Text>
          </View>
        )}

        {/* 2. Practice preview module */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#1A56DB', padding: 0, overflow: 'hidden' }]}>
          {/* Header strip */}
          <View style={styles.practicePlanHeader}>
            <Text style={[styles.cardLabel, { marginBottom: 0, flex: 1 }]}>Practice plan</Text>
            <TouchableOpacity
              onPress={() => autoGeneratePlan(nextEvent ?? getScheduleEvents()[0] ?? null, team)}
              activeOpacity={0.6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              {planLoading
                ? <ActivityIndicator color={tc} size="small" />
                : <Text style={styles.practiceIcon}>🔀</Text>
              }
              <Text style={{ fontSize: 12, fontWeight: '700', color: tc }}>New plan</Text>
            </TouchableOpacity>
          </View>
          {/* Body */}
          <View style={styles.practicePlanBody}>
            <Text style={styles.cardTitle}>{plan?.title ?? "Building your plan..."}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
                backgroundColor: isAiPlan ? '#D1FAE5' : '#F3F4F6',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: isAiPlan ? '#065F46' : '#6B7280' }}>
                  {planLoading ? '⏳ Generating...' : isAiPlan ? '✨ AI Generated' : '📋 Default plan'}
                </Text>
              </View>
            </View>
            {(plan?.plan ?? []).map((phase: any, i: number) => {
              const phaseColors = ['#10B981', '#1A56DB', '#F59E0B']
              const phaseColor = phaseColors[i % phaseColors.length]
              return (
                <View key={i} style={[styles.planPhaseRow, i < (plan.plan?.length ?? 0) - 1 && styles.planPhaseBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planPhaseHeader, { color: phaseColor }]}>{phase.phase}</Text>
                    <Text style={styles.planPhaseName}>{phase.drill}</Text>
                  </View>
                  <Text style={styles.planPhaseDur}>{phase.duration}</Text>
                </View>
              )
            })}
            <TouchableOpacity onPress={() => router.push('/practice')}>
              <Text style={[styles.viewLink, { color: tc }]}>View full plan →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Drill of the day + Practice streak */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>Drill of the day 🎯</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 }}>{drillOfDay.title}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              <View style={{ backgroundColor: '#F0F4FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: tc }}>{drillOfDay.focus}</Text>
              </View>
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>{drillOfDay.level}</Text>
              </View>
              <View style={{ backgroundColor: '#F5F3FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>{drillOfDay.duration}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 14 }}>{drillOfDay.desc}</Text>

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
                if (!practicedToday) {
                  setPracticedToday(true)
                  const newStreak = practiceStreak + 1
                  setPracticeStreak(newStreak)
                  const todayIdx = (new Date().getDay() + 6) % 7
                  setPracticedDays(prev => prev.includes(todayIdx) ? prev : [...prev, todayIdx])
                  await AsyncStorage.setItem('huddle_practice_streak', String(newStreak))
                }
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

        {/* 4. Upcoming module */}
        {upcomingEvents.length > 0 && (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#1A56DB', padding: 0, overflow: 'hidden' }]}>
            <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
              <Text style={styles.cardLabel}>Upcoming</Text>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 }}>
              {upcomingEvents.map((event, i) => {
                const isGame = event.type === 'game'
                const isParty = event.type === 'party'
                const isPicDay = event.type === 'picture_day'
                const dotColor = isGame ? '#F59E0B' : isParty ? '#8B5CF6' : isPicDay ? '#9C27B0' : '#1A56DB'
                return (
                  <TouchableOpacity
                    key={event.id}
                    style={[styles.eventRow, i < upcomingEvents.length - 1 && styles.eventBorder]}
                    onPress={() => isGame ? router.push({ pathname: '/games', params: { tab: 'games' } }) : null}
                    activeOpacity={isGame ? 0.7 : 1}
                  >
                    <View style={[styles.upcomingDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTitle}>
                        {isGame ? `Game vs ${event.opponent}${event.home != null ? (event.home ? ' · Home' : ' · Away') : ''}`
                          : isPicDay ? '📸 Picture Day'
                          : isParty ? `🎉 ${event.title ?? 'End of Season Party'}`
                          : `Practice · ${event.focus ?? 'General skills'}`}
                      </Text>
                      <Text style={styles.eventSub}>{formatDay(event.starts_at)}</Text>
                      <Text style={styles.eventTime}>{formatTimeRange(event.starts_at, event.duration_min ?? 60)}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity onPress={() => router.push({ pathname: '/games', params: { tab: 'schedule' } })}>
                <Text style={[styles.viewLink, { color: tc }]}>View full schedule →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. Your team module */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#1A56DB', padding: 0, overflow: 'hidden' }]}>
          <View style={styles.teamCardHeader}>
            <Text style={styles.cardLabel}>Your team</Text>
          </View>
          <View style={styles.teamCardBody}>
            <Text style={styles.teamMeta}>{team?.age_group} · {team?.gender} · {playerCount} players</Text>
            {players.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#aaa', marginTop: 8, marginBottom: 4 }}>Add players in the Team tab</Text>
            ) : players.slice(0, 3).map((player, i) => {
              const firstPos = (player.positions?.[0] ?? player.position ?? '').toUpperCase()
              const posColor = firstPos === 'GK' ? '#F59E0B'
                : ['CB','LB','RB','LWB','RWB'].includes(firstPos) ? tc
                : ['CM','LM','RM','DM','AM','CAM','CDM'].includes(firstPos) ? '#10B981'
                : firstPos ? '#FF6B35' : null
              return (
                <View key={player.id ?? i} style={[styles.squadRow, i < Math.min(players.length, 3) - 1 && styles.squadBorder]}>
                  <View style={[styles.squadNumBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[styles.squadNum, { color: tc }]}>{player.number ?? '—'}</Text>
                  </View>
                  <Text style={styles.squadName}>{player.name ?? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()}</Text>
                  {posColor && (
                    <View style={{ backgroundColor: posColor + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: posColor }}>{firstPos}</Text>
                    </View>
                  )}
                </View>
              )
            })}
            <TouchableOpacity style={{ marginTop: 6 }} onPress={() => router.push({ pathname: '/games', params: { tab: 'roster' } })}>
              <Text style={[styles.viewLink, { color: tc }]}>View roster →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Team chat */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#10B981', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push('/chat')}
        >
          <View style={styles.chatCardHeader}>
            <Text style={styles.cardLabel}>💬 Team chat</Text>
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

        {/* 6. Snack schedule */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push({ pathname: '/games', params: { tab: 'snacks' } })}
          activeOpacity={0.85}
        >
          <View style={styles.snackCardHeader}>
            <Text style={styles.cardLabel}>🍊 Snack schedule</Text>
          </View>
          <View style={styles.cardBody}>
            {snacks.filter(s => !s.claimed).slice(0, 2).map((item, i) => (
              <View key={i} style={[styles.snackRow, i < 1 && styles.snackBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.snackDate}>{item.date} · {item.type}</Text>
                  <Text style={[styles.snackName, { color: item.claimed ? '#1a1a1a' : '#888' }]}>
                    {item.claimed ? item.name : 'Open'}
                  </Text>
                </View>
              </View>
            ))}
            <Text style={[styles.viewLink, { color: tc }]}>Snack me! 🍊 →</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  header: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  headerTeam: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  headerTeamName: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', maxWidth: 110 },
  headerSwitch: { fontSize: 10, color: '#aaa', fontWeight: '500' },
  headerCenter: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  headerBall: { fontSize: 12, opacity: 0.5 },
  wordmark: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  roleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700' },
  teamPicker: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee', padding: 16 },
  teamPickerTitle: { fontSize: 11, fontWeight: '700', color: '#aaa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  teamPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  teamPickerSwatch: { width: 30, height: 30, borderRadius: 8 },
  teamPickerName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  teamPickerMeta: { fontSize: 12, color: '#888' },
  teamPickerCancel: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 12, fontWeight: '600' },
  content: { padding: 14 },
  heroCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  heroMeta: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroDay: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroTime: { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 4 },
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  heroCalLink: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginBottom: 8 },
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
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 2, marginTop: 2 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  // Practice plan card
  practicePlanHeader: { backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  practicePlanBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  practiceIcon: { fontSize: 16 },
  offlineLabel: { fontSize: 11, color: '#aaa', marginBottom: 4 },
  planTapHint: { fontSize: 14, color: '#aaa', marginBottom: 6 },
  planLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  planLoadingText: { fontSize: 13, color: '#888' },
  planPhaseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  planPhaseBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  planPhaseHeader: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  planPhaseName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  planPhaseDur: { fontSize: 12, color: '#888', fontWeight: '600' },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  upcomingDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  eventSub: { fontSize: 12, color: '#888', marginTop: 1 },
  eventTime: { fontSize: 11, color: '#bbb', marginTop: 1 },
  eventDays: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  // Team card
  teamCardHeader: { backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  teamCardBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10 },
  teamMeta: { fontSize: 12, color: '#888', marginBottom: 4 },
  squadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  squadBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  squadNumBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  squadNum: { fontSize: 13, fontWeight: '700' },
  squadName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  // Snack card
  snackCardHeader: { backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  snackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  snackBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  snackDate: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 2 },
  snackName: { fontSize: 14, fontWeight: '600' },
  // Poll card
  pollCardHeader: { backgroundColor: '#F5F3FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  pollQuestion: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  pollLeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F7F7F5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 2 },
  pollLeadLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  pollLeadVotes: { fontSize: 12, color: '#888', fontWeight: '600' },
  // Chat card
  chatCardHeader: { backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
})
