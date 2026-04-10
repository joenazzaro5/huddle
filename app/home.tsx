import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'
import { useRole } from '../lib/roleStore'

const SNACK_DATA = [
  { date: 'Apr 5', type: 'Practice', name: 'Sarah M', claimed: true },
  { date: 'Apr 12', type: 'Practice', name: null as string | null, claimed: false },
  { date: 'Apr 19', type: 'Game', name: 'Tom K', claimed: true },
  { date: 'Apr 26', type: 'Practice', name: null as string | null, claimed: false },
]

const POLL_OPTS = [
  { label: "Let's go, team!", votes: 12 },
  { label: 'Hustle hard!', votes: 8 },
  { label: 'All day, every day!', votes: 5 },
]

export default function HomeScreen() {
  const router = useRouter()
  const { currentRole, setRole } = useRole()
  const [team, setTeam] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<any>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [isOfflinePlan, setIsOfflinePlan] = useState(false)
  const [rsvpYes, setRsvpYes] = useState(0)
  const [rsvpNo, setRsvpNo] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const [snacks] = useState(SNACK_DATA)
  const [pollOptions] = useState(POLL_OPTS)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberships } = await supabase
      .from('team_members')
      .select('team:teams(*), role')
      .eq('user_id', user.id)
    setAllTeams(memberships ?? [])

    const coachMembership = memberships?.find(m => m.role === 'coach')
    if (!coachMembership?.team) { setLoading(false); return }

    const teamData = coachMembership.team
    setTeam(teamData)

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamData.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setEvents(eventData ?? [])

    const { count: pc } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamData.id)
      .eq('is_active', true)
    setPlayerCount(pc ?? 0)

    if (eventData && eventData.length > 0) {
      const { count: yes } = await supabase
        .from('rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventData[0].id).eq('status', 'yes')
      const { count: no } = await supabase
        .from('rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventData[0].id).eq('status', 'no')
      setRsvpYes(yes ?? 0)
      setRsvpNo(no ?? 0)
      if (eventData[0].type === 'practice') autoGeneratePlan(eventData[0], teamData)
    }

    const { data: msgData } = await supabase
      .from('messages')
      .select('*, sender:users(display_name, email)')
      .eq('team_id', teamData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastMessage(msgData)

    setLoading(false)
  }

  const autoGeneratePlan = async (event: any, teamData: any) => {
    setPlanLoading(true)
    setIsOfflinePlan(false)
    const focus = event.focus ?? 'general skills'
    const fallback = {
      title: `${focus} Practice`,
      plan: [
        { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump into a game. Coach observes.' },
        { phase: 'Practice Phase', duration: '30 min', drill: `${focus} drills`, desc: 'Coach-guided skill work with positive cues and repetition.' },
        { phase: 'Final Play', duration: '15 min', drill: '7v7 full game', desc: 'Full game. Let them play.' },
      ],
      coachTip: 'Keep energy high. Every player should touch the ball often.'
    }
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      const result = await Promise.race([
        generatePracticePlan(
          `${event.duration_min ?? 60} minute ${focus} session`,
          teamData.name, teamData.age_group
        ),
        timeoutPromise
      ])
      setPlan(result)
      // TODO: trigger push notification to parents — "Coach just updated the practice plan"
    } catch {
      setPlan(fallback)
      setIsOfflinePlan(true)
    }
    setPlanLoading(false)
  }

  const switchTeam = async (teamData: any) => {
    setTeam(teamData)
    setShowTeamPicker(false)
    setPlan(null)

    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamData.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setEvents(eventData ?? [])

    const { count: pc } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamData.id)
      .eq('is_active', true)
    setPlayerCount(pc ?? 0)

    if (eventData && eventData.length > 0) {
      const { count: yes } = await supabase
        .from('rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventData[0].id).eq('status', 'yes')
      const { count: no } = await supabase
        .from('rsvps').select('*', { count: 'exact', head: true })
        .eq('event_id', eventData[0].id).eq('status', 'no')
      setRsvpYes(yes ?? 0)
      setRsvpNo(no ?? 0)
      if (eventData[0].type === 'practice') autoGeneratePlan(eventData[0], teamData)
    } else {
      setRsvpYes(0)
      setRsvpNo(0)
    }

    const { data: msgData } = await supabase
      .from('messages')
      .select('*, sender:users(display_name, email)')
      .eq('team_id', teamData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastMessage(msgData)
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

  const handleRolePress = () => {
    const isParent = currentRole === 'parent'
    if (isParent) {
      Alert.alert('Switch role', 'You are viewing as Parent.', [
        { text: 'Switch to Coach view', onPress: () => setRole('coach') },
        { text: 'Stay as Parent', style: 'cancel' },
      ])
    } else {
      Alert.alert('Switch role', 'You are viewing as Coach.', [
        { text: 'Switch to Parent view', onPress: () => setRole('parent') },
        { text: 'Stay as Coach', style: 'cancel' },
      ])
    }
  }

  const nextEvent = events[0]
  const tc = '#1A56DB'
  const pending = Math.max(0, playerCount - rsvpYes - rsvpNo)

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#1A56DB" size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header — three zone */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerTeam}
          onPress={() => allTeams.length > 1 && setShowTeamPicker(true)}
        >
          <View style={[styles.teamDot, { backgroundColor: tc }]} />
          <View>
            <Text style={styles.headerTeamName} numberOfLines={1}>{team?.name ?? 'My Team'}</Text>
            {allTeams.length > 1 && <Text style={styles.headerSwitch}>Switch ↓</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerBall}>⚽</Text>
          <Text style={[styles.wordmark, { color: tc }]}>Huddle</Text>
          <Text style={styles.headerBall}>⚽</Text>
        </View>

        <TouchableOpacity
          style={[styles.roleChip, { backgroundColor: currentRole === 'parent' ? '#F3F4F620' : tc + '20' }]}
          onPress={handleRolePress}
        >
          <Text style={[styles.roleText, { color: currentRole === 'parent' ? '#6B7280' : tc }]}>
            {currentRole === 'parent' ? 'Parent' : 'Coach'}
          </Text>
        </TouchableOpacity>
      </View>

      {showTeamPicker && (
        <View style={styles.teamPicker}>
          <Text style={styles.teamPickerTitle}>Switch team</Text>
          {allTeams.map(m => (
            <TouchableOpacity
              key={m.team.id}
              style={styles.teamPickerRow}
              onPress={() => switchTeam(m.team)}
            >
              <View style={[styles.teamPickerSwatch, { backgroundColor: m.team.color ?? tc }]} />
              <View>
                <Text style={styles.teamPickerName}>{m.team.name}</Text>
                <Text style={styles.teamPickerMeta}>{m.team.age_group} · {m.role}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowTeamPicker(false)}>
            <Text style={styles.teamPickerCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* 1. Hero event card */}
        {nextEvent ? (
          <View style={[styles.heroCard, { backgroundColor: tc }]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroMeta}>{nextEvent.type === 'practice' ? 'Next practice' : 'Next game'}</Text>
              <Text style={styles.heroMeta}>{daysUntil(nextEvent.starts_at)}</Text>
            </View>
            <Text style={styles.heroDay}>{formatDay(nextEvent.starts_at)}</Text>
            <Text style={styles.heroTitle}>
              {nextEvent.type === 'practice'
                ? `Focus: ${nextEvent.focus ?? 'General skills'}`
                : `vs ${nextEvent.opponent}`}
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
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Your league administrator will add your schedule</Text>
          </View>
        )}

        {/* 2. Practice preview module */}
        <View style={styles.card}>
          <View style={styles.practicePreviewHeader}>
            <TouchableOpacity onPress={() => nextEvent && autoGeneratePlan(nextEvent, team)} activeOpacity={0.6}>
              <Text style={styles.practiceIcon}>⚡</Text>
            </TouchableOpacity>
            <Text style={styles.cardLabel}>Practice plan · AI generated</Text>
          </View>
          {planLoading ? (
            <View style={styles.planLoadingRow}>
              <ActivityIndicator color={tc} size="small" />
              <Text style={styles.planLoadingText}>Building your plan...</Text>
            </View>
          ) : plan ? (
            <>
              <Text style={styles.cardTitle}>{plan.title}</Text>
              {isOfflinePlan && <Text style={styles.offlineLabel}>Using saved plan</Text>}
              {plan.plan?.map((phase: any, i: number) => (
                <View key={i} style={[styles.planPhaseRow, i < (plan.plan?.length ?? 0) - 1 && styles.planPhaseBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planPhaseName}>{phase.phase} · {phase.drill}</Text>
                  </View>
                  <Text style={styles.planPhaseDur}>{phase.duration}</Text>
                </View>
              ))}
            </>
          ) : (
            <TouchableOpacity onPress={() => nextEvent && autoGeneratePlan(nextEvent, team)}>
              <Text style={styles.planTapHint}>Tap to generate →</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push('/practice')}>
            <Text style={[styles.viewLink, { color: tc }]}>View full plan →</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Upcoming module */}
        {events.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Upcoming</Text>
            {events.slice(1, 4).map((event, i) => {
              const isGame = event.type === 'game'
              return (
                <View key={event.id} style={[styles.eventRow, i < events.slice(1, 4).length - 1 && styles.eventBorder]}>
                  <View style={[styles.eventIconBox, { backgroundColor: isGame ? '#FF8C4220' : tc + '20' }]}>
                    <Text style={[styles.eventIconText, { color: isGame ? '#FF8C42' : tc }]}>
                      {isGame ? 'G' : event.focus?.[0] ?? 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>
                      {isGame ? `Game vs ${event.opponent}` : `Practice · ${event.focus}`}
                    </Text>
                    <Text style={styles.eventSub}>{formatDay(event.starts_at)}</Text>
                    <Text style={styles.eventTime}>{formatTimeRange(event.starts_at, event.duration_min ?? 60)}</Text>
                  </View>
                  <Text style={[styles.eventDays, { color: tc }]}>{daysUntil(event.starts_at)}</Text>
                </View>
              )
            })}
            <TouchableOpacity onPress={() => router.push('/games')}>
              <Text style={[styles.viewLink, { color: tc }]}>View full schedule →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Your team module */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your team</Text>
          <View style={styles.teamRow}>
            <View style={[styles.teamSwatch, { backgroundColor: tc }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{team?.name}</Text>
              <Text style={styles.teamMeta}>{team?.age_group} · {team?.gender} · {playerCount} players</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.viewRosterBtn, { borderColor: tc }]} onPress={() => router.push('/games')}>
            <Text style={[styles.viewRosterText, { color: tc }]}>View roster →</Text>
          </TouchableOpacity>
        </View>

        {/* 5. Snack schedule */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/games')} activeOpacity={0.85}>
          <Text style={styles.cardLabel}>Snack schedule</Text>
          {snacks.slice(0, 2).map((item, i) => (
            <View key={i} style={[styles.snackRow, i < 1 && styles.snackBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.snackDate}>{item.date} · {item.type}</Text>
                <Text style={[styles.snackName, { color: item.claimed ? '#1a1a1a' : '#888' }]}>
                  {item.claimed ? item.name : 'Open'}
                </Text>
              </View>
            </View>
          ))}
          <Text style={[styles.viewLink, { color: tc }]}>View schedule →</Text>
        </TouchableOpacity>

        {/* 6. Team poll */}
        <TouchableOpacity style={styles.card} onPress={() => router.push('/games')} activeOpacity={0.85}>
          <Text style={styles.cardLabel}>Team poll</Text>
          <Text style={styles.pollQuestion}>What should our team cheer be?</Text>
          {(() => {
            const leading = [...pollOptions].sort((a, b) => b.votes - a.votes)[0]
            return (
              <View style={styles.pollLeadRow}>
                <Text style={styles.pollLeadLabel}>{leading.label}</Text>
                <Text style={styles.pollLeadVotes}>{leading.votes} votes</Text>
              </View>
            )
          })()}
          <Text style={[styles.viewLink, { color: tc }]}>See results →</Text>
        </TouchableOpacity>

        {/* 7. Chat preview */}
        {lastMessage && (
          <TouchableOpacity style={styles.card} onPress={() => router.push('/chat')}>
            <Text style={styles.cardLabel}>Team chat</Text>
            <View style={styles.chatPreviewRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatSender}>{getSenderName(lastMessage)}</Text>
                <Text style={styles.chatPreviewBody} numberOfLines={2}>{lastMessage.body}</Text>
              </View>
              <Text style={styles.chatPreviewTime}>{formatMsgTime(lastMessage.created_at)}</Text>
            </View>
            <Text style={[styles.viewLink, { color: tc }]}>Open chat →</Text>
          </TouchableOpacity>
        )}

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
  emptyHero: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  practicePreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  practiceIcon: { fontSize: 14 },
  offlineLabel: { fontSize: 11, color: '#aaa', marginBottom: 4 },
  planTapHint: { fontSize: 14, color: '#aaa', marginBottom: 6 },
  planLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  planLoadingText: { fontSize: 13, color: '#888' },
  planPhaseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  planPhaseBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  planPhaseName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  planPhaseDur: { fontSize: 12, color: '#888', fontWeight: '600' },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  eventIconBox: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  eventIconText: { fontSize: 12, fontWeight: '900' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  eventSub: { fontSize: 12, color: '#888', marginTop: 1 },
  eventTime: { fontSize: 11, color: '#bbb', marginTop: 1 },
  eventDays: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  teamSwatch: { width: 34, height: 34, borderRadius: 9 },
  teamName: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  teamMeta: { fontSize: 12, color: '#888', marginTop: 1 },
  viewRosterBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5 },
  viewRosterText: { fontSize: 13, fontWeight: '700' },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, marginBottom: 6 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
  snackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  snackBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  snackDate: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 2 },
  snackName: { fontSize: 14, fontWeight: '600' },
  pollQuestion: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  pollLeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F7F7F5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 2 },
  pollLeadLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  pollLeadVotes: { fontSize: 12, color: '#888', fontWeight: '600' },
})
