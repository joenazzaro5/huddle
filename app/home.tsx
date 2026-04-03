import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'

const PHASE_COLORS = ['#4CAF50', '#378ADD', '#FF6B35']

export default function HomeScreen() {
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<any>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [rsvpYes, setRsvpYes] = useState(0)
  const [rsvpNo, setRsvpNo] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [showTeamPicker, setShowTeamPicker] = useState(false)

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
    const focus = event.focus ?? 'general skills'
    try {
      const result = await generatePracticePlan(
        `${event.duration_min ?? 60} minute ${focus} session`,
        teamData.name, teamData.age_group
      )
      setPlan(result)
    } catch {
      setPlan({
        title: `${focus} Practice`,
        plan: [
          { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump into a game. Coach observes.' },
          { phase: 'Practice Phase', duration: '30 min', drill: `${focus} drills`, desc: 'Coach-guided skill work with positive cues and repetition.' },
          { phase: 'Final Play', duration: '15 min', drill: '7v7 full game', desc: 'Full game. Let them play.' },
        ],
        coachTip: 'Keep energy high. Every player should touch the ball often.'
      })
    }
    setPlanLoading(false)
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

  const formatMsgTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const getSenderName = (msg: any) => {
    if (!msg?.sender) return 'Team'
    return msg.sender.display_name || msg.sender.email?.split('@')[0] || 'Team'
  }

  const nextEvent = events[0]
  const tc = team?.color ?? '#1a3a5c'
  const pending = Math.max(0, playerCount - rsvpYes - rsvpNo)

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#1D9E75" size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header — three zone */}
      <View style={styles.header}>
        {/* Left: team switcher */}
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

        {/* Center: Cue wordmark with soccer ball accents */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerBall}>⚽</Text>
          <Text style={[styles.wordmark, { color: tc }]}>Cue</Text>
          <Text style={styles.headerBall}>⚽</Text>
        </View>

        {/* Right: role chip */}
        <TouchableOpacity style={[styles.roleChip, { backgroundColor: tc + '20' }]}>
          <Text style={[styles.roleText, { color: tc }]}>Coach</Text>
        </TouchableOpacity>
      </View>

      {/* Team picker dropdown */}
      {showTeamPicker && (
        <View style={styles.teamPicker}>
          <Text style={styles.teamPickerTitle}>Switch team</Text>
          {allTeams.map(m => (
            <TouchableOpacity
              key={m.team.id}
              style={styles.teamPickerRow}
              onPress={() => { setTeam(m.team); setShowTeamPicker(false) }}
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

        {/* Hero event card */}
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

        {/* Practice plan */}
        {nextEvent?.type === 'practice' && (
          <View style={styles.card}>
            <View style={styles.planCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Practice plan · AI generated</Text>
                <Text style={styles.cardTitle}>{plan?.title ?? `${nextEvent.focus} · ${nextEvent.duration_min ?? 60} min`}</Text>
              </View>
              <View style={[styles.aiChip, { backgroundColor: tc + '15' }]}>
                <Text style={styles.aiChipText}>⚡</Text>
              </View>
            </View>

            {planLoading && (
              <View style={styles.planLoading}>
                <ActivityIndicator color={tc} size="small" />
                <Text style={styles.planLoadingText}>Building your plan...</Text>
              </View>
            )}

            {plan && !planLoading && (
              <View>
                {plan.plan?.map((item: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.phaseCard}
                    onPress={() => setExpandedDrill(expandedDrill === i ? null : i)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.phaseHeader, { backgroundColor: PHASE_COLORS[i] ?? '#888' }]}>
                      <Text style={styles.phaseLabel}>{item.phase}</Text>
                      <Text style={styles.phaseDuration}>{item.duration}</Text>
                    </View>
                    <View style={styles.phaseBody}>
                      <View style={styles.drillRow}>
                        <Text style={styles.phaseDrill}>{item.drill}</Text>
                        <Text style={styles.expandHint}>{expandedDrill === i ? '▲' : '▼'}</Text>
                      </View>
                      {expandedDrill === i && (
                        <Text style={styles.phaseDesc}>{item.desc}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {plan.coachTip && (
                  <View style={styles.tipBox}>
                    <Text style={styles.tipLabel}>💡 Coach tip</Text>
                    <Text style={styles.tipText}>{plan.coachTip}</Text>
                  </View>
                )}

                <View style={styles.planActions}>
                  <TouchableOpacity style={[styles.planBtn, { backgroundColor: tc }]} onPress={() => router.push('/practice')}>
                    <Text style={styles.planBtnText}>Edit plan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.planBtnOutline, { borderColor: tc }]} onPress={() => nextEvent && autoGeneratePlan(nextEvent, team)}>
                    <Text style={[styles.planBtnOutlineText, { color: tc }]}>New plan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Upcoming */}
        {events.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Coming up</Text>
            {events.slice(1, 4).map((event, i) => {
              const isGame = event.type === 'game'
              return (
                <View key={event.id} style={[styles.eventRow, i < Math.min(events.length - 1, 3) - 1 && styles.eventBorder]}>
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
          </View>
        )}

        {/* Team */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your team</Text>
          <View style={styles.teamRow}>
            <View style={[styles.teamSwatch, { backgroundColor: tc }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{team?.name}</Text>
              <Text style={styles.teamMeta}>{team?.age_group} · {team?.gender} · {playerCount} players</Text>
            </View>
          </View>
          {team?.cheer && <Text style={styles.teamCheer}>"{team.cheer}"</Text>}
          <TouchableOpacity style={[styles.viewRosterBtn, { borderColor: tc }]} onPress={() => router.push('/roster')}>
            <Text style={[styles.viewRosterText, { color: tc }]}>View roster →</Text>
          </TouchableOpacity>
        </View>

        {/* Chat — last in list, mirrors tab bar order */}
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
            <Text style={[styles.chatLink, { color: tc }]}>Open chat →</Text>
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  heroLocation: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  rsvpRow: { backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  rsvpText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  emptyHero: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  planCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  aiChip: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aiChipText: { fontSize: 14 },
  planLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  planLoadingText: { fontSize: 13, color: '#888' },
  phaseCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  phaseHeader: { paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between' },
  phaseLabel: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  phaseDuration: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  phaseBody: { backgroundColor: '#fff', padding: 12 },
  drillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phaseDrill: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  expandHint: { fontSize: 10, color: '#ccc' },
  phaseDesc: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
  tipBox: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginTop: 2, marginBottom: 8 },
  tipLabel: { fontSize: 11, fontWeight: '700', color: '#F57F17', marginBottom: 2 },
  tipText: { fontSize: 12, color: '#555', lineHeight: 17 },
  planActions: { flexDirection: 'row', gap: 8 },
  planBtn: { flex: 2, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  planBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  planBtnOutline: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1.5 },
  planBtnOutlineText: { fontSize: 13, fontWeight: '700' },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
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
  teamCheer: { fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 8 },
  viewRosterBtn: { borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5 },
  viewRosterText: { fontSize: 13, fontWeight: '700' },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, marginBottom: 6 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
  chatLink: { fontSize: 13, fontWeight: '700' },
})
