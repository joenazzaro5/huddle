import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'
import { supabase } from '../lib/supabase'
import { getScheduleEvents } from '../lib/season'

const tc = '#1A56DB'

const FALLBACK_PLAN = {
  title: 'Dribbling Focus',
  plan: [
    { phase: 'Opening Play',   duration: '15 min', drill: 'Dribble Tag',     desc: 'Players dribble freely. Coach calls out a color cone to dribble to.' },
    { phase: 'Practice Phase', duration: '30 min', drill: 'Cone Weaving',    desc: 'Dribble through a line of cones using both feet. Focus on soft touches.' },
    { phase: 'Final Play',     duration: '15 min', drill: '3v3 Small Sided', desc: 'Free play. Let them express themselves.' },
  ],
}
const PHASE_COLORS = ['#4CAF50', '#1A56DB', '#FF6B35']

const STANDINGS = [
  { team: 'Marin Cheetahs', w: 4, l: 1, d: 1, pts: 13, isUs: true },
  { team: 'Tiburon FC',     w: 3, l: 2, d: 1, pts: 10 },
  { team: 'Mill Valley SC', w: 3, l: 2, d: 0, pts: 9  },
  { team: 'Novato United',  w: 2, l: 2, d: 2, pts: 8  },
  { team: 'San Anselmo FC', w: 1, l: 4, d: 1, pts: 4  },
  { team: 'Fairfax FC',     w: 0, l: 5, d: 1, pts: 1  },
]

export default function ParentHomeScreen() {
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [myRsvp, setMyRsvp] = useState<'yes' | 'no' | 'maybe' | null>(null)
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, no: 0, maybe: 0 })
  const [eventRsvps, setEventRsvps] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({})
  const [players, setPlayers] = useState<any[]>([])
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [practiceStreak, setPracticeStreak] = useState(0)
  const [practicedDays, setPracticedDays] = useState<number[]>([])
  const [watchedToday, setWatchedToday] = useState(false)
  const [practicedToday, setPracticedToday] = useState(false)
  const [snackSignedUp, setSnackSignedUp] = useState(false)

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

  const todayDayIdx = (new Date().getDay() + 6) % 7

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
            <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 12 }}>
              Set up 6 cones in a line. Dribble through using both feet. Focus on soft touches.
            </Text>
            {practiceStreak > 0 && (
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B', marginBottom: 10 }}>
                🔥 {practiceStreak} day{practiceStreak !== 1 ? 's' : ''} streak
              </Text>
            )}
            <TouchableOpacity
              style={{ backgroundColor: practicedToday ? '#F0FDF4' : '#059669', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: practicedToday ? 1 : 0, borderColor: '#059669' }}
              onPress={() => {
                if (!practicedToday) {
                  setPracticedToday(true)
                  setPracticeStreak(s => s + 1)
                }
              }}
              disabled={practicedToday}
              activeOpacity={practicedToday ? 1 : 0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: practicedToday ? '#059669' : '#fff' }}>
                {practicedToday ? '✓ Done for today!' : '✓ I practiced this drill today'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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
              <TouchableOpacity onPress={() => router.push('/parent-schedule')}>
                <Text style={[styles.viewLink, { color: tc }]}>View schedule →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. Standings card */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>Division standings 🏆</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
            {/* Header */}
            <View style={styles.standingsHeader}>
              <Text style={[styles.standingsCell, { flex: 1 }]}>Team</Text>
              <Text style={styles.standingsHdr}>W</Text>
              <Text style={styles.standingsHdr}>L</Text>
              <Text style={[styles.standingsHdr, { color: tc }]}>Pts</Text>
            </View>
            {STANDINGS.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.standingsRow,
                  row.isUs && { backgroundColor: tc + '12', borderRadius: 8, paddingHorizontal: 6, marginHorizontal: -6 },
                  i < STANDINGS.length - 1 && !row.isUs && styles.standingsBorder,
                ]}
              >
                <Text style={[styles.standingsTeam, row.isUs && { fontWeight: '700', color: tc }]} numberOfLines={1}>
                  {row.isUs ? '⭐ ' : ''}{row.team}
                </Text>
                <Text style={styles.standingsVal}>{row.w}</Text>
                <Text style={styles.standingsVal}>{row.l}</Text>
                <Text style={[styles.standingsVal, row.isUs && { fontWeight: '700', color: tc }]}>{row.pts}</Text>
              </View>
            ))}
            <TouchableOpacity onPress={() => router.push('/parent-standings')}>
              <Text style={[styles.viewLink, { color: tc }]}>View standings →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Snack duty card */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>Snack duty 🍊</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Apr 26 · Practice</Text>
              <Text style={{ fontSize: 12, color: snackSignedUp ? '#059669' : '#888', marginTop: 3, fontWeight: snackSignedUp ? '600' : '400' }}>
                {snackSignedUp ? '✓ You signed up!' : 'Nobody signed up yet'}
              </Text>
            </View>
            {!snackSignedUp && (
              <TouchableOpacity
                style={{ backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                onPress={() => router.push('/parent-snacks')}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Sign up →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 6. Team poll preview */}
        <TouchableOpacity
          style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#8B5CF6', padding: 0, overflow: 'hidden' }]}
          onPress={() => router.push({ pathname: '/parent-team', params: { tab: 'polls' } })}
          activeOpacity={0.85}
        >
          <View style={{ backgroundColor: '#F5F3FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>🗳️ Team poll</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
              What should our team cheer be?
            </Text>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
              Leading: "Let's go, team!" · 12 votes
            </Text>
            <Text style={[styles.viewLink, { color: tc }]}>Vote →</Text>
          </View>
        </TouchableOpacity>

        {/* 7. The Squad */}
        <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#1A56DB', padding: 0, overflow: 'hidden' }]}>
          <View style={{ backgroundColor: '#F0F4FF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
            <Text style={styles.cardLabel}>The squad 👟</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
            {players.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>Roster not available yet</Text>
            ) : (
              players.slice(0, 3).map((player, i) => (
                <View
                  key={player.id ?? i}
                  style={[styles.rosterRow, i < Math.min(players.length, 3) - 1 && styles.rosterBorder]}
                >
                  <View style={[styles.rosterNumBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[styles.rosterNum, { color: tc }]}>{player.number ?? player.jersey_number ?? '—'}</Text>
                  </View>
                  <Text style={styles.rosterName}>
                    {player.name ?? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()}
                  </Text>
                  {(player.positions?.[0] ?? player.position) ? (
                    <Text style={styles.rosterPos}>
                      {player.positions?.[0] ?? player.position}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
            <TouchableOpacity onPress={() => router.push('/parent-roster')}>
              <Text style={[styles.viewLink, { color: tc }]}>View full roster →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 8. Chat preview */}
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

  // Standings card
  standingsHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 4 },
  standingsHdr: { width: 32, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#aaa' },
  standingsCell: { fontSize: 11, fontWeight: '700', color: '#aaa' },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  standingsBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  standingsTeam: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  standingsVal: { width: 32, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#444' },
})
