import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function HomeScreen() {
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const { data: membership } = await supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('user_id', user.id)
      .eq('role', 'coach')
      .limit(1)
      .single()

    if (membership?.team) {
      setTeam(membership.team)
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('team_id', membership.team.id)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
      setEvents(eventData ?? [])
    }
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const nextEvent = events[0]
  const teamColor = team?.color ?? '#1D9E75'

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1D9E75" size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: teamColor }]}>Cue</Text>
        <View style={[styles.roleChip, { backgroundColor: teamColor + '20' }]}>
          <Text style={[styles.roleText, { color: teamColor }]}>Coach</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero card */}
        {nextEvent ? (
          <View style={[styles.heroCard, { backgroundColor: teamColor }]}>
            <Text style={styles.heroLabel}>Next up · {formatDate(nextEvent.starts_at)}</Text>
            <Text style={styles.heroTitle}>
              {nextEvent.type === 'practice' ? 'Practice' : `Game vs ${nextEvent.opponent}`}
            </Text>
            <Text style={styles.heroSub}>
              {nextEvent.location}{nextEvent.focus ? ` · ${nextEvent.focus}` : ''}
            </Text>
            <Text style={styles.heroDetail}>{team?.age_group} · {nextEvent.duration_min} min</Text>
            <TouchableOpacity
              style={styles.heroPlanBtn}
              onPress={() => router.push('/practice')}
            >
              <Text style={[styles.heroPlanBtnText, { color: teamColor }]}>Generate practice plan →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyHero}>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>Your league administrator will add your schedule</Text>
          </View>
        )}

        {/* Team card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your team</Text>
          <Text style={styles.teamName}>{team?.name}</Text>
          <Text style={styles.cardSub}>{team?.age_group} · {team?.gender} · Soccer</Text>
          <TouchableOpacity
            style={[styles.viewRosterBtn, { borderColor: teamColor }]}
            onPress={() => router.push('/roster')}
          >
            <Text style={[styles.viewRosterText, { color: teamColor }]}>View roster →</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming events */}
        {events.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Upcoming · {team?.name}</Text>
            {events.slice(0, 4).map((event, i) => (
              <View key={event.id} style={[styles.eventRow, i < Math.min(events.length, 4) - 1 && styles.eventBorder]}>
                <View style={[styles.eventIcon, { backgroundColor: event.type === 'game' ? '#FF8C4220' : teamColor + '20' }]}>
                  <Text style={[styles.eventIconText, { color: event.type === 'game' ? '#FF8C42' : teamColor }]}>
                    {event.type === 'game' ? 'G' : event.focus?.[0] ?? 'P'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>
                    {event.type === 'practice' ? `Practice · ${event.focus}` : `Game vs ${event.opponent}`}
                  </Text>
                  <Text style={styles.eventSub}>{formatDate(event.starts_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  roleChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 20 },
  heroCard: { borderRadius: 20, padding: 20, marginBottom: 14 },
  heroLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  heroDetail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: 16 },
  heroPlanBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 13, alignItems: 'center' },
  heroPlanBtnText: { fontSize: 14, fontWeight: '700' },
  emptyHero: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  teamName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  cardSub: { fontSize: 13, color: '#888' },
  viewRosterBtn: { marginTop: 12, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5 },
  viewRosterText: { fontSize: 13, fontWeight: '700' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  eventIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventIconText: { fontSize: 13, fontWeight: '900' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  eventSub: { fontSize: 12, color: '#888', marginTop: 2 },
})
