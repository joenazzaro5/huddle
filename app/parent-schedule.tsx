import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '../lib/header'
import { supabase } from '../lib/supabase'

const tc = '#1A56DB'

export default function ParentScheduleScreen() {
  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [rsvps, setRsvps] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({})
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
    await loadTeamEvents(teamData.id, user.id)
    setLoading(false)
  }

  const loadTeamEvents = async (teamId: string, userId: string) => {
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamId)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setEvents(eventData ?? [])

    if (eventData && eventData.length > 0) {
      const { data: rsvpData } = await supabase
        .from('rsvps')
        .select('event_id, status')
        .eq('user_id', userId)
        .in('event_id', eventData.map(e => e.id))
      const map: Record<string, 'yes' | 'no' | 'maybe'> = {}
      rsvpData?.forEach(r => { map[r.event_id] = r.status })
      setRsvps(map)
    }
  }

  const submitRsvp = async (eventId: string, status: 'yes' | 'no' | 'maybe') => {
    if (!currentUser) return
    setRsvps(prev => ({ ...prev, [eventId]: status }))
    await supabase.from('rsvps').upsert(
      { user_id: currentUser.id, event_id: eventId, status },
      { onConflict: 'user_id,event_id' }
    )
  }

  const showRsvpPicker = (eventId: string) => {
    Alert.alert('Update RSVP', undefined, [
      { text: 'Going ✓', onPress: () => submitRsvp(eventId, 'yes') },
      { text: "Can't make it", onPress: () => submitRsvp(eventId, 'no') },
      { text: 'Maybe', onPress: () => submitRsvp(eventId, 'maybe') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const addToCalendar = (dateStr: string) => {
    const ts = Math.floor(new Date(dateStr).getTime() / 1000)
    Linking.openURL(`calshow://${ts}`)
  }

  const formatDay = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const formatTime = (dateStr: string, dur: number) => {
    const s = new Date(dateStr)
    const e = new Date(s.getTime() + dur * 60000)
    const f = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `${f(s)} – ${f(e)}`
  }

  const getMonthKey = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Group events by month
  const grouped: { month: string; events: any[] }[] = []
  events.forEach(event => {
    const month = getMonthKey(event.starts_at)
    const last = grouped[grouped.length - 1]
    if (last && last.month === month) {
      last.events.push(event)
    } else {
      grouped.push({ month, events: [event] })
    }
  })

  const eventDotColor = (type: string) => {
    if (type === 'practice') return tc
    if (type === 'game') return '#F97316'
    return '#9CA3AF'
  }

  const rsvpChipStyle = (status: 'yes' | 'no' | 'maybe' | undefined) => {
    if (status === 'yes') return { bg: '#DCFCE7', text: '#16A34A', label: 'Going' }
    if (status === 'no') return { bg: '#FEE2E2', text: '#DC2626', label: 'Out' }
    return { bg: '#F3F4F6', text: '#6B7280', label: '?' }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={tc} size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        teamColor={tc}
        teamName={team?.name}
        allTeams={allTeams}
        onTeamSelect={(t) => {
          setTeam(t)
          if (currentUser) loadTeamEvents(t.id, currentUser.id)
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Check back soon — your coach will add events</Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.month}>
              <Text style={styles.monthHeader}>{group.month}</Text>
              <View style={styles.monthCard}>
                {group.events.map((event, i) => {
                  const chip = rsvpChipStyle(rsvps[event.id])
                  const isGame = event.type === 'game'
                  return (
                    <View key={event.id} style={[styles.eventRow, i < group.events.length - 1 && styles.eventBorder]}>
                      <View style={[styles.dotWrap, { marginTop: 6 }]}>
                        <View style={[styles.dot, { backgroundColor: eventDotColor(event.type) }]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventType}>
                          {isGame
                            ? `Game vs ${event.opponent ?? 'TBD'}`
                            : event.focus
                            ? `Practice · ${event.focus}`
                            : 'Practice'}
                        </Text>
                        <Text style={styles.eventDate}>{formatDay(event.starts_at)}</Text>
                        <Text style={styles.eventTime}>{formatTime(event.starts_at, event.duration_min ?? 60)}</Text>
                        {event.location && <Text style={styles.eventLocation}>{event.location}</Text>}
                      </View>
                      <View style={styles.rightCol}>
                        <TouchableOpacity
                          style={[styles.rsvpChip, { backgroundColor: chip.bg }]}
                          onPress={() => showRsvpPicker(event.id)}
                        >
                          <Text style={[styles.rsvpChipText, { color: chip.text }]}>{chip.label}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.calBtn}
                          onPress={() => addToCalendar(event.starts_at)}
                        >
                          <Text style={styles.calBtnText}>📅</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  content: { padding: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center' },
  monthHeader: { fontSize: 13, fontWeight: '800', color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  monthCard: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#eee' },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, gap: 12 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  dotWrap: { paddingTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 3 },
  eventType: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  eventDate: { fontSize: 12, color: '#555', marginBottom: 1 },
  eventTime: { fontSize: 11, color: '#888' },
  eventLocation: { fontSize: 11, color: '#aaa', marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: 8 },
  rsvpChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  rsvpChipText: { fontSize: 12, fontWeight: '700' },
  calBtn: { padding: 4 },
  calBtnText: { fontSize: 16 },
})
