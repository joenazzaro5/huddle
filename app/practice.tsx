import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'
import { AppHeader } from '../lib/header'

const FALLBACK_PLAN = [
  { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump straight in. Coach observes.' },
  { phase: 'Practice Phase', duration: '30 min', drill: 'Skill exercise', desc: 'Coach-guided skill practice with repetition and cues.' },
  { phase: 'Final Play', duration: '15 min', drill: '7v7 full game', desc: 'Full game. Let them play.' },
]

const PHASE_COLORS = ['#4CAF50', '#1A56DB', '#FF6B35']

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

const FOCUS_PILLS = [
  { label: 'Dribbling', color: '#1A56DB' },
  { label: 'Passing', color: '#1A56DB' },
  { label: 'Shooting', color: '#FF6B35' },
  { label: 'Defending', color: '#9C27B0' },
  { label: 'Fitness', color: '#4CAF50' },
  { label: 'Set Pieces', color: '#607D8B' },
]

const FOCUS_COLORS: Record<string, string> = {
  Dribbling: '#1A56DB',
  Passing: '#1A56DB',
  Shooting: '#FF6B35',
  Defending: '#9C27B0',
  Goalkeeping: '#607D8B',
}

export default function PracticeScreen() {
  const [team, setTeam] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedFocuses, setSelectedFocuses] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeTab, setActiveTab] = useState<'planner' | 'drills'>('planner')
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null)
  const [inputFocused, setInputFocused] = useState(false)

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
    if (membership?.team) {
      setTeam(membership.team)
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('team_id', membership.team.id)
        .eq('type', 'practice')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      setNextEvent(eventData)
      if (eventData) autoGenerate(eventData, membership.team)
    }
  }

  const autoGenerate = async (event: any, teamData: any) => {
    setPlanLoading(true)
    const focus = event.focus ?? 'general skills'
    try {
      const result = await generatePracticePlan(
        `${event.duration_min ?? 60} minute ${focus} session`,
        teamData.name,
        teamData.age_group
      )
      setPlan(result)
    } catch {
      setPlan({
        title: `${focus} Practice`,
        plan: [
          { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump into a game. Coach observes.' },
          { phase: 'Practice Phase', duration: '30 min', drill: `${focus} drills`, desc: 'Coach-guided skill work with positive cues.' },
          { phase: 'Final Play', duration: '15 min', drill: '7v7 full game', desc: 'Full game. Let them play.' },
        ],
        coachTip: 'Keep energy high. Every player should touch the ball often.'
      })
    }
    setPlanLoading(false)
  }

  const toggleFocus = (label: string) => {
    setSelectedFocuses(prev =>
      prev.includes(label) ? prev.filter(f => f !== label) : [...prev, label]
    )
  }

  const buildPrompt = () => {
    const focusText = selectedFocuses.length > 0
      ? selectedFocuses.join(' and ')
      : null
    const customText = prompt.trim()
    if (focusText && customText) return `${focusText} focus — ${customText}`
    if (focusText) return `${focusText} focus`
    if (customText) return customText
    return ''
  }

  const handleGenerate = async () => {
    const finalPrompt = buildPrompt()
    if (!finalPrompt || !team) return
    setAiLoading(true)
    setPlan(null)
    try {
      const result = await generatePracticePlan(finalPrompt, team.name, team.age_group)
      setPlan(result)
    } catch {
      setPlan({ title: 'Practice Plan', plan: FALLBACK_PLAN, coachTip: 'Keep energy high.' })
    }
    setAiLoading(false)
  }

  const canGenerate = buildPrompt().length > 0
  const teamColor = '#1A56DB'
  const filteredDrills = activeFilter === 'All' ? DRILLS : DRILLS.filter(d => d.focus === activeFilter)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={teamColor} teamName={team?.name} />

      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'planner' && { borderBottomColor: teamColor, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('planner')}
        >
          <Text style={[styles.subTabText, { color: activeTab === 'planner' ? teamColor : '#999', fontWeight: activeTab === 'planner' ? '700' : '500' }]}>AI Planner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'drills' && { borderBottomColor: teamColor, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('drills')}
        >
          <Text style={[styles.subTabText, { color: activeTab === 'drills' ? teamColor : '#999', fontWeight: activeTab === 'drills' ? '700' : '500' }]}>Drill Library</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'planner' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Next practice context */}
          {nextEvent && (
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Next practice</Text>
              <Text style={styles.contextTitle}>Focus: {nextEvent.focus ?? 'General skills'}</Text>
              <Text style={styles.contextSub}>
                {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {nextEvent.duration_min ?? 60} min · {nextEvent.location}
              </Text>
            </View>
          )}

          {/* AI prompt — always on top */}
          <View style={styles.card}>
            <View style={styles.aiHeader}>
              <View style={styles.aiIcon}>
                <Text style={styles.aiIconText}>⚡</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>{plan ? 'Adjust your plan' : 'Build a practice plan'}</Text>
                <Text style={styles.cardSub}>{team?.age_group ?? 'U10'} · Play-Practice-Play · 60 min</Text>
              </View>
            </View>

            {/* Focus pills — multi select */}
            <Text style={styles.pillsLabel}>Select one or more focuses</Text>
            <View style={styles.pillsRow}>
              {FOCUS_PILLS.map(fp => {
                const isSelected = selectedFocuses.includes(fp.label)
                return (
                  <TouchableOpacity
                    key={fp.label}
                    onPress={() => toggleFocus(fp.label)}
                    style={[
                      styles.focusPill,
                      { backgroundColor: isSelected ? fp.color : '#F3F4F6', borderColor: isSelected ? fp.color : '#E5E7EB' }
                    ]}
                  >
                    <Text style={[styles.focusPillText, { color: isSelected ? '#fff' : '#555' }]}>{fp.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Text input */}
            <View style={[styles.inputRow, { marginTop: 12 }]}>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: inputFocused ? teamColor : '#E5E7EB' }
                ]}
                placeholder={plan ? 'Add any extra details or changes...' : 'Any extra details? (optional)'}
                placeholderTextColor="#bbb"
                value={prompt}
                onChangeText={setPrompt}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: canGenerate ? teamColor : '#E0E0E0' }]}
                onPress={handleGenerate}
                disabled={aiLoading || !canGenerate}
              >
                {aiLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>↑</Text>}
              </TouchableOpacity>
            </View>

            {aiLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={teamColor} size="small" />
                <Text style={styles.loadingBoxText}>Building your Play-Practice-Play plan...</Text>
              </View>
            )}
          </View>

          {/* Loading state */}
          {planLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={teamColor} size="small" />
              <Text style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Building your plan...</Text>
            </View>
          )}

          {/* Current plan below prompt */}
          {plan && !planLoading && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Current plan</Text>
              <Text style={styles.planTitle}>{plan.title}</Text>
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
                    {expandedDrill === i && <Text style={styles.phaseDesc}>{item.desc}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
              {plan.coachTip && (
                <View style={styles.tipBox}>
                  <Text style={styles.tipLabel}>💡 Coach tip</Text>
                  <Text style={styles.tipText}>{plan.coachTip}</Text>
                </View>
              )}
            </View>
          )}

        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FOCUSES.map(focus => {
                const isActive = activeFilter === focus
                const fc = focus === 'All' ? teamColor : (FOCUS_COLORS[focus] ?? teamColor)
                return (
                  <TouchableOpacity
                    key={focus}
                    onPress={() => setActiveFilter(focus)}
                    style={[styles.filterChip, { backgroundColor: isActive ? fc : '#fff', borderColor: isActive ? fc : '#ddd' }]}
                  >
                    <Text style={[styles.filterChipText, { color: isActive ? '#fff' : '#555' }]}>{focus}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          {filteredDrills.map(drill => {
            const dc = FOCUS_COLORS[drill.focus] ?? teamColor
            return (
              <View key={drill.id} style={styles.drillCard}>
                <View style={styles.drillTop}>
                  <View style={[styles.drillBadge, { backgroundColor: dc + '20' }]}>
                    <Text style={[styles.drillBadgeText, { color: dc }]}>{drill.focus}</Text>
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
  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabText: { fontSize: 14 },
  content: { padding: 16 },
  contextCard: { borderRadius: 16, padding: 14, marginBottom: 12, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#eee' },
  contextLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  contextTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  contextSub: { fontSize: 12, color: '#888' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  cardSub: { fontSize: 12, color: '#888' },
  planTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 },
  phaseCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  phaseHeader: { paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between' },
  phaseLabel: { fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  phaseDuration: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  phaseBody: { backgroundColor: '#fff', padding: 12 },
  drillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phaseDrill: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  expandHint: { fontSize: 10, color: '#ccc' },
  phaseDesc: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
  tipBox: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginTop: 4 },
  tipLabel: { fontSize: 11, fontWeight: '700', color: '#F57F17', marginBottom: 2 },
  tipText: { fontSize: 12, color: '#555', lineHeight: 17 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  aiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  aiIconText: { fontSize: 14 },
  pillsLabel: { fontSize: 11, fontWeight: '600', color: '#888', marginBottom: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  focusPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  focusPillText: { fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#F7F7F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1a1a1a', borderWidth: 1.5, maxHeight: 80 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingBoxText: { fontSize: 13, color: '#888' },
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
