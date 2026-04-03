import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'

const FALLBACK_PLAN = [
  { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump straight in. Coach observes.' },
  { phase: 'Practice Phase', duration: '30 min', drill: 'Dribbling exercise', desc: 'Coach-guided skill practice with repetition and cues.' },
  { phase: 'Final Play', duration: '15 min', drill: '7v7 full game', desc: 'Full-sided game. Coach observes without interrupting.' },
]

const PHASE_COLORS = ['#4CAF50', '#378ADD', '#FF6B35']

const DRILLS = [
  { id: '1', title: 'Cone dribbling', focus: 'Dribbling', duration: '10 min', level: 'Beginner', desc: 'Set up 6 cones in a line 2 yards apart. Players dribble through using both feet.' },
  { id: '2', title: 'Ball mastery', focus: 'Dribbling', duration: '12 min', level: 'Beginner', desc: 'Touches, rolls, and stepovers to build close control and confidence on the ball.' },
  { id: '3', title: 'Sharks and minnows', focus: 'Dribbling', duration: '8 min', level: 'Beginner', desc: 'Fun tag game — dribblers keep the ball while sharks try to kick it out.' },
  { id: '4', title: 'Triangle passing', focus: 'Passing', duration: '15 min', level: 'Beginner', desc: 'Three players form a triangle. Pass and move to the next cone.' },
  { id: '5', title: 'Rondo possession', focus: 'Passing', duration: '10 min', level: 'Intermediate', desc: '5 vs 2 in the middle. Keep the ball moving with one or two touches.' },
  { id: '6', title: 'Shooting on goal', focus: 'Shooting', duration: '15 min', level: 'Beginner', desc: 'Players take turns shooting from different angles. Rotate goalkeeper every 5 shots.' },
  { id: '7', title: '1v1 defending', focus: 'Defending', duration: '10 min', level: 'Intermediate', desc: 'Stay between player and goal. No diving in — wait for the right moment.' },
  { id: '8', title: 'GK shot stopping', focus: 'Goalkeeping', duration: '12 min', level: 'Beginner', desc: 'Reaction saves at close range. Keeper stays on feet and spreads wide.' },
]

const FOCUSES = ['All', 'Dribbling', 'Passing', 'Shooting', 'Defending', 'Goalkeeping']

const FOCUS_COLORS: Record<string, string> = {
  Dribbling: '#1D9E75',
  Passing: '#378ADD',
  Shooting: '#FF6B35',
  Defending: '#9C27B0',
  Goalkeeping: '#607D8B',
}

export default function PracticeScreen() {
  const [team, setTeam] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [planSource, setPlanSource] = useState<'ai' | 'fallback' | null>(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeTab, setActiveTab] = useState<'planner' | 'drills'>('planner')

  useEffect(() => { loadTeam() }, [])

  const loadTeam = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: membership } = await supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('user_id', user.id)
      .eq('role', 'coach')
      .limit(1)
      .single()
    if (membership?.team) setTeam(membership.team)
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
      setPlan({ title: 'Practice Plan', plan: FALLBACK_PLAN, coachTip: 'Keep energy high and make sure every player touches the ball often.' })
      setPlanSource('fallback')
    }
    setAiLoading(false)
  }

  const teamColor = team?.color ?? '#1D9E75'
  const filteredDrills = activeFilter === 'All' ? DRILLS : DRILLS.filter(d => d.focus === activeFilter)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: teamColor }]}>Cue</Text>
        <Text style={styles.headerTitle}>Practice</Text>
      </View>

      {/* Sub tabs */}
      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'planner' && { borderBottomColor: teamColor, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('planner')}
        >
          <Text style={[styles.subTabText, { color: activeTab === 'planner' ? teamColor : '#999', fontWeight: activeTab === 'planner' ? '700' : '500' }]}>
            AI Planner
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'drills' && { borderBottomColor: teamColor, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('drills')}
        >
          <Text style={[styles.subTabText, { color: activeTab === 'drills' ? teamColor : '#999', fontWeight: activeTab === 'drills' ? '700' : '500' }]}>
            Drill Library
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'planner' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* AI prompt card */}
          <View style={styles.card}>
            <View style={styles.aiHeader}>
              <View style={[styles.aiIcon, { backgroundColor: teamColor }]}>
                <Text style={styles.aiIconText}>⚡</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>Ask Cue AI</Text>
                <Text style={styles.cardSub}>{team?.age_group ?? 'U10'} · Play-Practice-Play · 60 min</Text>
              </View>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { borderColor: plan ? teamColor : '#E0E0E0' }]}
                placeholder="Describe what you want to work on..."
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
                  {['Dribbling focus', 'Passing & movement', 'Shooting practice', 'Defending shape'].map((ex, i) => (
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
          </View>

          {/* Plan result */}
          {plan && (
            <View style={styles.card}>
              <View style={styles.planHeader}>
                <Text style={[styles.planTitle, { color: teamColor }]}>{plan.title}</Text>
                {planSource === 'fallback' && <Text style={styles.fallbackBadge}>Offline plan</Text>}
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

        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Focus filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FOCUSES.map(focus => {
                const isActive = activeFilter === focus
                const focusColor = focus === 'All' ? teamColor : (FOCUS_COLORS[focus] ?? teamColor)
                return (
                  <TouchableOpacity
                    key={focus}
                    onPress={() => setActiveFilter(focus)}
                    style={[styles.filterChip, {
                      backgroundColor: isActive ? focusColor : '#fff',
                      borderColor: isActive ? focusColor : '#ddd',
                    }]}
                  >
                    <Text style={[styles.filterChipText, { color: isActive ? '#fff' : '#555' }]}>{focus}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          {/* Drill cards */}
          {filteredDrills.map(drill => {
            const drillColor = FOCUS_COLORS[drill.focus] ?? teamColor
            return (
              <View key={drill.id} style={styles.drillCard}>
                <View style={styles.drillTop}>
                  <View style={[styles.drillBadge, { backgroundColor: drillColor + '20' }]}>
                    <Text style={[styles.drillBadgeText, { color: drillColor }]}>{drill.focus}</Text>
                  </View>
                  <Text style={styles.drillMeta}>{drill.level} · {drill.duration}</Text>
                </View>
                <Text style={styles.drillTitle}>{drill.title}</Text>
                <Text style={styles.drillDesc}>{drill.desc}</Text>
              </View>
            )
          })}

        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabText: { fontSize: 14 },
  content: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  cardSub: { fontSize: 12, color: '#888' },
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
  planTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
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
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  drillCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#eee' },
  drillTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  drillBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  drillBadgeText: { fontSize: 11, fontWeight: '700' },
  drillMeta: { fontSize: 11, color: '#aaa' },
  drillTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  drillDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
})
