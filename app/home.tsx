import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'

const FALLBACK_PLAN = [
  { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump straight in. Coach observes.' },
  { phase: 'Practice Phase', duration: '30 min', drill: 'Dribbling exercise', desc: 'Coach-guided skill practice with repetition and cues.' },
  { phase: 'Final Play', duration: '15 min', drill: '7v7 full game', desc: 'Full-sided game. Coach observes without interrupting.' },
]

const PHASE_COLORS = ['#4CAF50', '#378ADD', '#FF6B35']

export default function HomeScreen() {
  const router = useRouter()
  const [team, setTeam] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [planSource, setPlanSource] = useState<'ai' | 'fallback' | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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

  const handleGenerate = async () => {
    if (!prompt.trim() || !team) return
    setAiLoading(true)
    setPlan(null)

    try {
      const result = await generatePracticePlan(prompt.trim(), team.name, team.age_group)
      setPlan(result)
      setPlanSource('ai')
    } catch (err) {
      console.log('AI failed, using fallback:', err)
      setPlan({ title: 'Practice Plan', plan: FALLBACK_PLAN, coachTip: 'Keep energy high and make sure every player touches the ball often.' })
      setPlanSource('fallback')
    }

    setAiLoading(false)
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
          <Text style={[styles.roleText, { color: teamColor }]}>Coach ↓</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {nextEvent && (
          <View style={[styles.heroCard, { backgroundColor: teamColor }]}>
            <Text style={styles.heroLabel}>Next up · {formatDate(nextEvent.starts_at)}</Text>
            <Text style={styles.heroTitle}>
              {nextEvent.type === 'practice' ? 'Practice' : `Game vs ${nextEvent.opponent}`}
            </Text>
            <Text style={styles.heroSub}>{nextEvent.location} · {nextEvent.focus ?? nextEvent.opponent}</Text>
            <Text style={styles.heroDetail}>U10 · {nextEvent.duration_min} min</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.aiHeader}>
            <View style={[styles.aiIcon, { backgroundColor: teamColor }]}>
              <Text style={styles.aiIconText}>⚡</Text>
            </View>
            <View>
              <Text style={styles.cardTitle}>Ask Cue AI</Text>
              <Text style={styles.cardSub}>U10 · 7v7 · 60 min · Play-Practice-Play</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { borderColor: plan ? teamColor : '#E0E0E0' }]}
              placeholder="e.g. 60 min dribbling session for U10..."
              placeholderTextColor="#bbb"
              value={prompt}
              onChangeText={setPrompt}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: prompt.trim() ? teamColor : '#E0E0E0' }]}
              onPress={handleGenerate}
              disabled={aiLoading || !prompt.trim()}
            >
              {aiLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendIcon}>↑</Text>
              }
            </TouchableOpacity>
          </View>

          {!plan && !aiLoading && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Dribbling focus · U10', 'Passing & movement', 'Shooting practice'].map((ex, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setPrompt(ex)}
                    style={[styles.chip, { backgroundColor: teamColor + '15', borderColor: teamColor + '40' }]}
                  >
                    <Text style={[styles.chipText, { color: teamColor }]}>{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {aiLoading && (
            <View style={styles.loadingBox}>
              <Text style={styles.loadingBoxText}>Building your Play-Practice-Play plan...</Text>
            </View>
          )}

          {plan && (
            <View style={{ marginTop: 14 }}>
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: teamColor }]}>{plan.title}</Text>
                {planSource === 'fallback' && (
                  <Text style={styles.fallbackBadge}>Offline plan</Text>
                )}
              </View>

              {plan.plan?.map((item: any, i: number) => (
                <View key={i} style={styles.phaseCard}>
                  <View style={[styles.phaseHeader, { backgroundColor: PHASE_COLORS[i] ?? '#888' }]}>
                    <Text style={styles.phaseLabel}>{item.phase}</Text>
                    <Text style={styles.phaseDuration}>{item.duration}</Text>
                  </View>
                  <View style={styles.phaseBody}>
                    <Text style={styles.phaseDrill}>{item.drill}</Text>
                    <Text style={styles.phaseDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              {plan.coachTip && (
                <View style={styles.tipBox}>
                  <Text style={styles.tipLabel}>💡 Coach tip</Text>
                  <Text style={styles.tipText}>{plan.coachTip}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.newPlanBtn, { borderColor: teamColor }]}
                onPress={() => { setPlan(null); setPrompt('') }}
              >
                <Text style={[styles.newPlanText, { color: teamColor }]}>Generate new plan</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your team</Text>
          <Text style={styles.teamName}>{team?.name}</Text>
          <Text style={styles.cardSub}>U10 · Girls · Invite code: {team?.invite_code}</Text>
          <TouchableOpacity
            style={[styles.rosterBtn, { borderColor: teamColor }]}
            onPress={() => router.push('/roster')}
          >
            <Text style={[styles.rosterBtnText, { color: teamColor }]}>Manage roster →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Upcoming · {team?.name}</Text>
          {events.slice(0, 3).map((event, i) => (
            <View key={event.id} style={[styles.eventRow, i < Math.min(events.length, 3) - 1 && styles.eventBorder]}>
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
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  heroDetail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  cardSub: { fontSize: 12, color: '#888' },
  teamName: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  rosterBtn: { marginTop: 12, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5 },
  rosterBtnText: { fontSize: 13, fontWeight: '700' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  aiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiIconText: { fontSize: 14 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F7F7F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a', borderWidth: 1.5, maxHeight: 80 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
  loadingBox: { alignItems: 'center', paddingVertical: 20 },
  loadingBoxText: { fontSize: 13, color: '#888' },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  planTitle: { fontSize: 15, fontWeight: '800' },
  fallbackBadge: { fontSize: 10, color: '#854F0B', backgroundColor: '#FAEEDA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontWeight: '600' },
  phaseCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  phaseHeader: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' },
  phaseLabel: { fontSize: 11, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  phaseDuration: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  phaseBody: { backgroundColor: '#fff', padding: 12 },
  phaseDrill: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  phaseDesc: { fontSize: 12, color: '#888', marginTop: 3, lineHeight: 17 },
  tipBox: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginTop: 4 },
  tipLabel: { fontSize: 12, fontWeight: '700', color: '#F57F17', marginBottom: 4 },
  tipText: { fontSize: 13, color: '#555', lineHeight: 18 },
  newPlanBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5 },
  newPlanText: { fontSize: 14, fontWeight: '700' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  eventBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  eventIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eventIconText: { fontSize: 13, fontWeight: '900' },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  eventSub: { fontSize: 12, color: '#888', marginTop: 2 },
})
