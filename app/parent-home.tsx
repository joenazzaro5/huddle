import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { supabase } from '../lib/supabase'

const tc = '#1A56DB'

export default function ParentHomeScreen() {
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [myRsvp, setMyRsvp] = useState<'yes' | 'no' | 'maybe' | null>(null)
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, no: 0, maybe: 0 })
  const [eventRsvps, setEventRsvps] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({})
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

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
    await loadTeamData(teamData.id, user.id)
    setLoading(false)
  }

  const loadTeamData = async (teamId: string, userId: string) => {
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamId)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(10)

    if (!eventData || eventData.length === 0) return

    setNextEvent(eventData[0])
    setUpcomingEvents(eventData.slice(1, 4))

    // My RSVP for next event
    const { data: myRsvpData } = await supabase
      .from('rsvps')
      .select('status')
      .eq('event_id', eventData[0].id)
      .eq('user_id', userId)
      .maybeSingle()
    setMyRsvp(myRsvpData?.status ?? null)

    // RSVP counts for next event
    const [{ count: yes }, { count: no }, { count: maybe }] = await Promise.all([
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', eventData[0].id).eq('status', 'yes'),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', eventData[0].id).eq('status', 'no'),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', eventData[0].id).eq('status', 'maybe'),
    ])
    setRsvpCounts({ yes: yes ?? 0, no: no ?? 0, maybe: maybe ?? 0 })

    // RSVPs for upcoming events
    if (eventData.length > 1) {
      const upcomingIds = eventData.slice(1, 4).map(e => e.id)
      const { data: upRsvps } = await supabase
        .from('rsvps')
        .select('event_id, status')
        .eq('user_id', userId)
        .in('event_id', upcomingIds)
      const map: Record<string, 'yes' | 'no' | 'maybe'> = {}
      upRsvps?.forEach(r => { map[r.event_id] = r.status })
      setEventRsvps(map)
    }

    // Last chat message
    const { data: msgData } = await supabase
      .from('messages')
      .select('*, sender:users(display_name, email)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastMessage(msgData)
  }

  const submitRsvp = async (status: 'yes' | 'no' | 'maybe') => {
    if (!currentUser || !nextEvent) return
    setMyRsvp(status)
    await supabase.from('rsvps').upsert(
      { user_id: currentUser.id, event_id: nextEvent.id, status },
      { onConflict: 'user_id,event_id' }
    )
    // Refresh counts
    const [{ count: yes }, { count: no }, { count: maybe }] = await Promise.all([
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', nextEvent.id).eq('status', 'yes'),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', nextEvent.id).eq('status', 'no'),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).eq('event_id', nextEvent.id).eq('status', 'maybe'),
    ])
    setRsvpCounts({ yes: yes ?? 0, no: no ?? 0, maybe: maybe ?? 0 })
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

  if (loading) return <View style={styles.loading}><ActivityIndicator color={tc} size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        teamColor={tc}
        teamName={team?.name}
        showTeamSwitch={allTeams.length > 1}
        allTeams={allTeams}
        onTeamSelect={(t) => {
          setTeam(t)
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
                ? `Focus: ${nextEvent.focus ?? 'General skills'}`
                : `vs ${nextEvent.opponent}`}
            </Text>
            <Text style={styles.heroTime}>{formatTimeRange(nextEvent.starts_at, nextEvent.duration_min ?? 60)}</Text>
            {nextEvent.location && (
              <Text style={styles.heroLocation}>{nextEvent.location}</Text>
            )}

            {/* RSVP buttons */}
            <View style={styles.rsvpBtnRow}>
              {(['yes', 'no', 'maybe'] as const).map((s) => {
                const labels = { yes: 'Going ✓', no: "Can't make it", maybe: 'Maybe' }
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
                {rsvpCounts.yes} going · {rsvpCounts.no} out · {rsvpCounts.maybe} pending
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Check back soon — your coach will add events</Text>
          </View>
        )}

        {/* 2. Practice preview card */}
        {nextEvent?.type === 'practice' && (
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: tc, padding: 0, overflow: 'hidden' }]}>
            <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.cardLabel}>This week's practice</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Practice notifications',
                    `You'll be notified when ${team?.name ?? 'your'} coach updates the practice plan. Make sure notifications are enabled in Settings.`
                  )
                }
              >
                <Text style={styles.bellIcon}>🔔</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={styles.practiceFocus}>
                This week: {nextEvent.focus ?? 'General skills'} focus
              </Text>
              <Text style={styles.practiceDate}>
                {formatDay(nextEvent.starts_at)} · {nextEvent.duration_min ?? 60} min
              </Text>
              <Text style={styles.practicePlanNote}>
                Coach will share the full plan soon
              </Text>
            </View>
          </View>
        )}

        {/* 3. Upcoming events */}
        {upcomingEvents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Upcoming</Text>
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
            <TouchableOpacity onPress={() => router.push('/parent-schedule')}>
              <Text style={[styles.viewLink, { color: tc }]}>View full schedule →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 4. Snack duty card */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>🥤 Snack schedule</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' }}>
              You're on snacks for Apr 26 🥤
            </Text>
            <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Bring enough for {'\u007E'}12 players + coaches
            </Text>
          </View>
        </View>

        {/* 5. Team poll preview */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#8B5CF6', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push('/team')}
          activeOpacity={0.85}
        >
          <View style={{ backgroundColor: '#F5F3FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>🗳️ Team poll</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 }}>
              What should our team cheer be?
            </Text>
            <Text style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
              Leading: "Let's go, team!" · 12 votes
            </Text>
            <Text style={[styles.viewLink, { color: tc }]}>Vote →</Text>
          </View>
        </TouchableOpacity>

        {/* 6. Chat preview */}
        {lastMessage && (
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
                  <Text style={styles.chatPreviewBody} numberOfLines={2}>{lastMessage.body}</Text>
                </View>
                <Text style={styles.chatPreviewTime}>{formatMsgTime(lastMessage.created_at)}</Text>
              </View>
              <Text style={[styles.viewLink, { color: tc }]}>Open chat →</Text>
            </View>
          </TouchableOpacity>
        )}

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
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  practicePreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  bellIcon: { fontSize: 16 },
  practiceFocus: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  practiceDate: { fontSize: 13, color: '#888', marginBottom: 6 },
  practicePlanNote: { fontSize: 12, color: '#aaa', fontStyle: 'italic' },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  upcomingTypeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  eventSub: { fontSize: 12, color: '#888', marginTop: 1 },
  eventTime: { fontSize: 11, color: '#bbb', marginTop: 1 },
  eventRight: { alignItems: 'flex-end', gap: 6 },
  eventDays: { fontSize: 11, fontWeight: '700' },
  rsvpDot: { width: 8, height: 8, borderRadius: 4 },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  chatPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, marginBottom: 6 },
  chatSender: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  chatPreviewBody: { fontSize: 13, color: '#555', lineHeight: 18 },
  chatPreviewTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
})
