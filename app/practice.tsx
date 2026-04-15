import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { generatePracticePlan } from '../lib/ai'
import { AppHeader } from '../lib/header'
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

const PHASE_COLORS = ['#4CAF50', '#1A56DB', '#FF6B35']

function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function thisWeekDayIndices(dates: string[]): number[] {
  const now = new Date()
  const dow = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  return dates
    .filter(d => { const dt = new Date(d + 'T00:00:00'); return dt >= monday && dt < nextMonday })
    .map(d => { const day = new Date(d + 'T00:00:00').getDay(); return (day + 6) % 7 })
}

const DRILLS = [
  { id: '1', title: 'Cone dribbling', focus: 'Dribbling', duration: '10 min', level: 'Beginner', desc: 'Set up 6 cones in a line 2 yards apart. Players dribble through using both feet.', videoId: 'RukcQggHAZU' },
  { id: '2', title: 'Ball mastery', focus: 'Dribbling', duration: '12 min', level: 'Beginner', desc: 'Touches, rolls, and stepovers to build close control and confidence on the ball.', videoId: 'YqAyi27WejY' },
  { id: '3', title: 'Sharks and minnows', focus: 'Dribbling', duration: '8 min', level: 'Beginner', desc: 'Fun tag game — dribblers keep the ball while sharks try to kick it out.', videoId: null },
  { id: '4', title: 'Triangle passing', focus: 'Passing', duration: '15 min', level: 'Beginner', desc: 'Three players form a triangle. Pass and move to the next cone.', videoId: 'CosG13seo3o' },
  { id: '5', title: 'Rondo possession', focus: 'Passing', duration: '10 min', level: 'Intermediate', desc: '5 vs 2 in the middle. Keep the ball moving with one or two touches.', videoId: 'Cq0rsuSEgvA' },
  { id: '6', title: 'Shooting on goal', focus: 'Shooting', duration: '15 min', level: 'Beginner', desc: 'Players take turns shooting from different angles. Rotate goalkeeper every 5 shots.', videoId: 'DnWdr2DI758' },
  { id: '7', title: '1v1 defending', focus: 'Defending', duration: '10 min', level: 'Intermediate', desc: 'Stay between player and goal. No diving in — wait for the right moment.', videoId: 'OIm6xrR0QRg' },
  { id: '8', title: 'GK shot stopping', focus: 'Goalkeeping', duration: '12 min', level: 'Beginner', desc: 'Reaction saves at close range. Keeper stays on feet and spreads wide.', videoId: null },
]

const FOCUSES = ['All', 'Favorites', 'Dribbling', 'Passing', 'Shooting', 'Defending', 'Goalkeeping']

const FOCUS_PILLS = [
  { label: 'Dribbling' },
  { label: 'Passing' },
  { label: 'Shooting' },
  { label: 'Defending' },
  { label: 'Fitness' },
  { label: 'Set Pieces' },
]

const FOCUS_COLORS: Record<string, string> = {
  Dribbling: '#1A56DB',
  Passing: '#10B981',
  Shooting: '#EF4444',
  Defending: '#8B5CF6',
  Goalkeeping: '#F59E0B',
}

const SOCCER_RULES = [
  {
    name: 'Throw-in',
    when: 'The ball goes out of bounds on the sideline',
    explanation: 'When the ball crosses the sideline, the team that did NOT touch it last gets to throw it back in. Stand behind the line, use both hands, and the ball must start behind your head. Both feet must stay on the ground.',
    coachTip: "Remind players to keep both feet on the ground — lifting a heel is a foul throw!",
  },
  {
    name: 'Goal kick',
    when: 'The attacking team kicks the ball out over the goal line',
    explanation: "When the team trying to score kicks the ball out past the goal line (not into the goal), the defending team gets a goal kick. The goalkeeper places the ball in the goal box and kicks it back into play. The other team must stay outside the penalty area.",
    coachTip: "Encourage the goalkeeper to kick it to an open teammate rather than just booting it far.",
  },
  {
    name: 'Corner kick',
    when: 'The defending team kicks the ball out over their own goal line',
    explanation: 'When a defender is last to touch the ball before it goes past their own goal line, the attacking team gets a corner kick. The ball is placed in the corner arc nearest to where it went out. Players can score directly from a corner!',
    coachTip: 'Have your attackers position at the near post and far post to give the kicker two targets.',
  },
  {
    name: 'Kick-off',
    when: 'Start of game, second half, or after a goal is scored',
    explanation: 'The ball is placed in the center circle. One team kicks it to start play — the ball must move forward first. The other team must stay outside the center circle until the ball is kicked.',
    coachTip: "Tell your players to spread out before kick-off — don't all crowd the center!",
  },
  {
    name: 'Offside (simplified)',
    when: 'An attacking player is behind the last defender when the ball is played to them',
    explanation: 'A player is offside if they are in the opposing half AND closer to the goal than both the ball and the second-to-last defender when a teammate passes to them. You cannot be offside on a throw-in, corner kick, or goal kick.',
    coachTip: 'Teach attackers to time their runs — wait for the pass before running behind defenders.',
  },
  {
    name: 'Free kick',
    when: 'A foul or handball is committed',
    explanation: 'After a foul, the other team gets a free kick from where it happened. On a direct free kick you can score straight away. On an indirect free kick, another player must touch the ball first before a goal counts.',
    coachTip: "Defenders should form a wall quickly — shoulder-to-shoulder, about 10 yards away.",
  },
  {
    name: 'Penalty kick',
    when: 'A foul is committed inside the penalty box by the defending team',
    explanation: 'A penalty kick is a 1v1 between the kicker and the goalkeeper from the penalty spot. All other players stand outside the penalty area until the ball is kicked. The keeper must stay on the goal line until the ball is struck.',
    coachTip: "Tell your players to pick a spot and commit — don't change their mind at the last second!",
  },
  {
    name: 'Hand ball',
    when: 'A player deliberately touches the ball with their hand or arm',
    explanation: "A hand ball is called when a player intentionally touches the ball with their hand or arm, or if their arm makes their body unnaturally bigger. It is NOT a handball if the ball hits an arm tucked close to the body.",
    coachTip: 'Teach players to keep arms close to their body when defending to avoid accidental handballs.',
  },
]

export default function PracticeScreen() {
  const [team, setTeam] = useState<any>(null)
  const [nextEvent, setNextEvent] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [selectedFocuses, setSelectedFocuses] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [plan, setPlan] = useState<any>(FALLBACK_PLAN)
  const [planLoading, setPlanLoading] = useState(false)
  const [isOfflinePlan, setIsOfflinePlan] = useState(false)
  const [isAiPlan, setIsAiPlan] = useState(false)
  const [showDrillPicker, setShowDrillPicker] = useState(false)
  const [selectedPickDrills, setSelectedPickDrills] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeTab, setActiveTab] = useState<'planner' | 'drills' | 'rules'>('planner')
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [favoriteDrills, setFavoriteDrills] = useState<Set<string>>(new Set())
  const [drillStreak, setDrillStreak] = useState(0)
  const [practicedDays, setPracticedDays] = useState<number[]>([])
  const [practicedToday, setPracticedToday] = useState(false)
  const [lastDrillDate, setLastDrillDate] = useState('')
  const [practicedDrills, setPracticedDrills] = useState<Set<string>>(new Set())
  const [drillFeedback, setDrillFeedback] = useState<Record<string, string>>({})
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  const appendFeedback = (base: string) => {
    const entries = Object.entries(drillFeedback)
    if (entries.length === 0) return base
    const feedbackText = entries.map(([drill, rating]) => `${drill} was ${rating}`).join(', ')
    return base ? `${base}. Previous feedback: ${feedbackText}` : `Previous feedback: ${feedbackText}`
  }

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
      const storedStreak = await AsyncStorage.getItem('huddle_streak_data')
      const streakData = storedStreak ? JSON.parse(storedStreak) : { count: 0, dates: [] }
      setDrillStreak(streakData.count)
      setPracticedDays(thisWeekDayIndices(streakData.dates))
      setPracticedToday(streakData.dates.includes(todayDateStr()))
      const rawCache = await AsyncStorage.getItem('huddle_active_plan')
      let needsGenerate = true
      if (rawCache) {
        const { plan: p, timestamp } = JSON.parse(rawCache)
        setPlan(p); setIsAiPlan(true)
        needsGenerate = Date.now() - timestamp > 86400000
      }
      if (needsGenerate) autoGenerate(eventData ?? null, membership.team)
    }
  }

  const autoGenerate = async (event: any, teamData: any) => {
    setPlanLoading(true)
    setIsOfflinePlan(false)
    const focus = appendFeedback(event?.focus ?? '')
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      const result = await Promise.race([
        generatePracticePlan(
          `${event?.duration_min ?? 60} minute ${focus} session`,
          teamData?.name,
          teamData?.age_group
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

  const toggleFocus = (label: string) => {
    setSelectedFocuses(prev =>
      prev.includes(label) ? prev.filter(f => f !== label) : [...prev, label]
    )
  }

  const buildPrompt = () => {
    const focusText = selectedFocuses.length > 0 ? selectedFocuses.join(' and ') : null
    const customText = prompt.trim()
    if (focusText && customText) return `${focusText} focus — ${customText}`
    if (focusText) return `${focusText} focus`
    if (customText) return customText
    return ''
  }

  const handleGenerate = async () => {
    const finalPrompt = appendFeedback(buildPrompt())
    if (!finalPrompt || !team) return
    setAiLoading(true)
    setIsOfflinePlan(false)
    setPlan(null)
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      const result = await Promise.race([
        generatePracticePlan(finalPrompt, team.name, team.age_group),
        timeoutPromise
      ])
      await AsyncStorage.setItem('huddle_active_plan', JSON.stringify({ plan: result, timestamp: Date.now() }))
      setPlan(result)
      setIsAiPlan(true)
    } catch {
      setIsOfflinePlan(true)
      // keep current plan
    }
    setAiLoading(false)
  }

  const handleGenerateWithDrills = async () => {
    setShowDrillPicker(false)
    const drillNames = DRILLS.filter(d => selectedPickDrills.has(d.id)).map(d => d.title)
    const basePrompt = buildPrompt() || 'general skills'
    const finalPrompt = appendFeedback(drillNames.length > 0
      ? `${basePrompt} — include these drills: ${drillNames.join(', ')}`
      : basePrompt)
    setAiLoading(true)
    setIsOfflinePlan(false)
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      )
      const result = await Promise.race([
        generatePracticePlan(finalPrompt, team?.name, team?.age_group),
        timeoutPromise
      ])
      await AsyncStorage.setItem('huddle_active_plan', JSON.stringify({ plan: result, timestamp: Date.now() }))
      setPlan(result)
      setIsAiPlan(true)
    } catch {
      setIsOfflinePlan(true)
    }
    setAiLoading(false)
  }

  const recordPracticeDay = async () => {
    const today = todayDateStr()
    const raw = await AsyncStorage.getItem('huddle_streak_data')
    const streakData = raw ? JSON.parse(raw) : { count: 0, dates: [] }
    if (!streakData.dates.includes(today)) {
      const newDates = [...streakData.dates, today]
      const newData = { count: newDates.length, dates: newDates }
      await AsyncStorage.setItem('huddle_streak_data', JSON.stringify(newData))
      setDrillStreak(newData.count)
      setPracticedDays(thisWeekDayIndices(newDates))
    }
    setPracticedToday(true)
    setLastDrillDate(today)
  }

  const markDrillPracticed = async (drillId: string) => {
    if (practicedDrills.has(drillId)) return
    setPracticedDrills(prev => { const n = new Set(prev); n.add(drillId); return n })
    await recordPracticeDay()
  }

  const onVideoTap = async (drillId: string, videoId: string) => {
    WebBrowser.openBrowserAsync('https://www.youtube.com/watch?v=' + videoId)
    await recordPracticeDay()
  }

  const canGenerate = buildPrompt().length > 0
  const teamColor = '#1A56DB'
  const filteredDrills = activeFilter === 'All'
    ? DRILLS
    : activeFilter === 'Favorites'
    ? DRILLS.filter(d => favoriteDrills.has(d.id))
    : DRILLS.filter(d => d.focus === activeFilter)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={teamColor} teamName={team?.name} />

      <View style={styles.subTabs}>
        {(['planner', 'drills', 'rules'] as const).map(tab => {
          const labels = { planner: 'AI Planner', drills: 'Drill Library', rules: 'Rules' }
          const isActive = activeTab === tab
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.subTab, isActive && { borderBottomColor: teamColor, borderBottomWidth: 2.5 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.subTabText, { color: isActive ? teamColor : '#999', fontWeight: isActive ? '700' : '500' }]}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {activeTab === 'planner' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {nextEvent && (
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Next practice</Text>
              <Text style={styles.contextTitle}>{nextEvent.focus ? `Focus: ${nextEvent.focus}` : 'Next practice'}</Text>
              <Text style={styles.contextSub}>
                {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {nextEvent.duration_min ?? 60} min · {nextEvent.location}
              </Text>
            </View>
          )}

          {/* Current plan — always visible */}
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#4CAF50' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Current plan</Text>
                {!planLoading && <Text style={[styles.planTitle, { marginBottom: 0 }]}>{plan.title}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  {planLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator color={teamColor} size="small" />
                      <Text style={{ fontSize: 12, color: '#888' }}>Building your plan...</Text>
                    </View>
                  ) : (
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
                      backgroundColor: isAiPlan ? '#D1FAE5' : '#F3F4F6',
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: isAiPlan ? '#065F46' : '#6B7280' }}>
                        {isAiPlan ? '✨ AI Generated' : '📋 Default plan'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {!planLoading && (
                <TouchableOpacity
                  onPress={async () => { await AsyncStorage.removeItem('huddle_active_plan'); autoGenerate(nextEvent, team) }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}
                >
                  <Text style={{ fontSize: 18 }}>🔀</Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: teamColor }}>New plan</Text>
                </TouchableOpacity>
              )}
            </View>
            {!planLoading && plan.plan?.map((item: any, i: number) => (
              <View key={i}>
                <TouchableOpacity
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
              </View>
            ))}
            {!planLoading && plan.coachTip && (
              <View style={styles.tipBox}>
                <Text style={styles.tipLabel}>💡 Coach tip</Text>
                <Text style={styles.tipText}>{plan.coachTip}</Text>
              </View>
            )}
            {!planLoading && (
              <TouchableOpacity
                style={{ borderWidth: 1.5, borderColor: '#1A56DB', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10 }}
                onPress={() => setShowFeedbackModal(true)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A56DB' }}>Practice feedback</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Plan builder — below current plan */}
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#1A56DB' }]}>
            <View style={[styles.aiHeader, { backgroundColor: '#F0F4FF', borderRadius: 10, padding: 10 }]}>
              <View style={styles.aiIcon}>
                <Text style={styles.aiIconText}>⚡</Text>
              </View>
              <View>
                <Text style={styles.cardTitle}>Adjust your plan</Text>
                <Text style={styles.cardSub}>{team?.age_group} · Play-Practice-Play · 60 min</Text>
              </View>
            </View>

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
                      { backgroundColor: isSelected ? teamColor : '#F3F4F6', borderColor: isSelected ? teamColor : '#E5E7EB' }
                    ]}
                  >
                    <Text style={[styles.focusPillText, { color: isSelected ? '#fff' : '#555' }]}>{fp.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={[styles.inputRow, { marginTop: 12 }]}>
              <TextInput
                style={[styles.input, { borderColor: inputFocused ? teamColor : '#E5E7EB' }]}
                placeholder="Any extra details? (optional)"
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

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.pickDrillsBtn}
                onPress={() => setShowDrillPicker(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.pickDrillsBtnText}>🎯 Pick drills</Text>
              </TouchableOpacity>
              {selectedFocuses.length > 0 && (
                <TouchableOpacity
                  style={[styles.generateFullBtn, { flex: 1, marginTop: 0 }]}
                  onPress={handleGenerate}
                  disabled={aiLoading}
                  activeOpacity={0.85}
                >
                  {aiLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.generateFullBtnText}>Generate plan →</Text>
                  }
                </TouchableOpacity>
              )}
            </View>

            {aiLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={teamColor} size="small" />
                <Text style={styles.loadingBoxText}>Building your Play-Practice-Play plan...</Text>
              </View>
            )}
          </View>

        </ScrollView>
      ) : activeTab === 'drills' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Streak banner */}
          <View style={styles.streakBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.streakText, { flex: 1 }]}>Your drill streak 🔥</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#F57F17' }}>{drillStreak}</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 4 }}>day{drillStreak !== 1 ? 's' : ''}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, marginBottom: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: practicedDays.includes(i) ? '#F59E0B' : '#F3F4F6' }}>
                    {practicedDays.includes(i) && <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '600' }}>{d}</Text>
                </View>
              ))}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FOCUSES.map(focus => {
                const isActive = activeFilter === focus
                const fc = focus === 'All' || focus === 'Favorites' ? teamColor : (FOCUS_COLORS[focus] ?? teamColor)
                return (
                  <TouchableOpacity
                    key={focus}
                    onPress={() => setActiveFilter(focus)}
                    style={[styles.filterChip, { backgroundColor: isActive ? fc : '#fff', borderColor: isActive ? fc : '#ddd' }]}
                  >
                    {focus !== 'All' && focus !== 'Favorites' && (
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: isActive ? '#fff' : fc, marginRight: 5 }} />
                    )}
                    <Text style={[styles.filterChipText, { color: isActive ? '#fff' : '#555' }]}>{focus}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          {activeFilter === 'Favorites' && favoriteDrills.size === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 14, color: '#aaa' }}>Tap ♡ on any drill to save it here.</Text>
            </View>
          )}

          {filteredDrills.map(drill => {
            const dc = FOCUS_COLORS[drill.focus] ?? teamColor
            const isFav = favoriteDrills.has(drill.id)
            const isPracticed = practicedDrills.has(drill.id)
            return (
              <View key={drill.id} style={styles.drillCard}>
                {/* Colored top banner */}
                <View style={{ height: 6, backgroundColor: dc }} />

                <View style={{ padding: 16 }}>
                  {/* Row 1: focus badge + meta + heart */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={[styles.drillBadge, { backgroundColor: dc + '20' }]}>
                      <Text style={[styles.drillBadgeText, { color: dc }]}>{drill.focus}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.drillMeta}>{drill.level} · {drill.duration}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setFavoriteDrills(prev => {
                            const next = new Set(prev)
                            if (next.has(drill.id)) next.delete(drill.id)
                            else next.add(drill.id)
                            return next
                          })
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ fontSize: 20, color: isFav ? '#EF4444' : '#ccc' }}>
                          {isFav ? '♥' : '♡'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Row 2: drill title */}
                  <Text style={styles.drillTitle}>{drill.title}</Text>

                  {/* Row 3: description */}
                  <Text style={styles.drillDesc}>{drill.desc}</Text>

                  {/* YouTube thumbnail */}
                  {drill.videoId && (
                    <TouchableOpacity
                      onPress={() => onVideoTap(drill.id, drill.videoId!)}
                      activeOpacity={0.85}
                      style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden' }}
                    >
                      <Image
                        source={{ uri: `https://img.youtube.com/vi/${drill.videoId}/mqdefault.jpg` }}
                        style={{ width: '100%', height: 160, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                      <View style={styles.playOverlay}>
                        <View style={styles.playCircle}>
                          <Text style={styles.playIcon}>▶</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.practicedBtn, isPracticed && styles.practicedBtnDone]}
                    onPress={() => markDrillPracticed(drill.id)}
                  >
                    <Text style={[styles.practicedBtnText, isPracticed && styles.practicedBtnTextDone]}>
                      {isPracticed ? '✓ Practiced' : '✓ I practiced this'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </ScrollView>
      ) : (
        /* Rules tab */
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {(() => {
            const ageGroup = team?.age_group ?? ''
            const ag = ageGroup.toUpperCase().replace('-', '')
            const isYoung = ag.includes('U6') || ag.includes('U8') || ag === '6U' || ag === '8U'
            const YOUNG_RULE_NAMES = ['Throw-in', 'Goal kick', 'Corner kick', 'Kick-off']
            const filteredRules = isYoung
              ? SOCCER_RULES.filter(r => YOUNG_RULE_NAMES.includes(r.name))
              : SOCCER_RULES
            return (
              <>
                <Text style={styles.ageGroupLabel}>Rules for {ageGroup || 'your age group'}</Text>
                {filteredRules.map((rule, i) => (
                  <View key={i} style={styles.ruleCard}>
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    <View style={styles.ruleWhenRow}>
                      <Text style={styles.ruleWhenLabel}>When it happens: </Text>
                      <Text style={styles.ruleWhen}>{rule.when}</Text>
                    </View>
                    <Text style={styles.ruleExplanation}>{rule.explanation}</Text>
                    {!isYoung && (
                      <View style={styles.tipBox}>
                        <Text style={styles.tipLabel}>💡 Coach tip</Text>
                        <Text style={styles.tipText}>{rule.coachTip}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )
          })()}
        </ScrollView>
      )}

      {/* Post-practice feedback modal */}
      <Modal visible={showFeedbackModal} transparent animationType="slide" onRequestClose={() => setShowFeedbackModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }} activeOpacity={1} onPress={() => setShowFeedbackModal(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>How did practice go? 🏆</Text>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Rate each drill so your next plan is even better.</Text>
            {plan?.plan?.map((item: any, i: number) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 }}>{item.drill}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['😓 Hard', '👍 Good', '😴 Easy'] as const).map((label) => {
                    const rating = label.split(' ')[1]
                    const isSelected = drillFeedback[item.drill] === rating
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[styles.feedbackBtn, isSelected && styles.feedbackBtnSelected, { flex: 1 }]}
                        onPress={() => setDrillFeedback(prev => ({ ...prev, [item.drill]: rating }))}
                      >
                        <Text style={[styles.feedbackBtnText, isSelected && styles.feedbackBtnTextSelected]}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={{ backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
              onPress={() => { setShowFeedbackModal(false); Alert.alert('Thanks!', 'Your next plan will be even better.') }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>Submit feedback</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drill picker modal */}
      <Modal visible={showDrillPicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#eee' }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#1a1a1a' }}>Pick drills to include</Text>
            <TouchableOpacity onPress={() => setShowDrillPicker(false)}>
              <Text style={{ fontSize: 15, color: '#888', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {DRILLS.map(drill => {
              const isSelected = selectedPickDrills.has(drill.id)
              return (
                <TouchableOpacity
                  key={drill.id}
                  onPress={() => setSelectedPickDrills(prev => {
                    const next = new Set(prev)
                    if (next.has(drill.id)) next.delete(drill.id)
                    else next.add(drill.id)
                    return next
                  })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
                    borderColor: isSelected ? teamColor : '#ddd',
                    backgroundColor: isSelected ? teamColor : '#fff',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>{drill.title}</Text>
                    <Text style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{drill.focus} · {drill.duration} · {drill.level}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
          <View style={{ padding: 16, paddingBottom: 28, borderTopWidth: 0.5, borderTopColor: '#eee' }}>
            <TouchableOpacity
              style={{ backgroundColor: teamColor, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              onPress={handleGenerateWithDrills}
              disabled={aiLoading}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff' }}>
                {selectedPickDrills.size > 0
                  ? `Generate with ${selectedPickDrills.size} drill${selectedPickDrills.size > 1 ? 's' : ''} →`
                  : 'Generate plan →'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabText: { fontSize: 13 },
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
  offlineLabel: { fontSize: 11, color: '#aaa', marginTop: 2, marginBottom: 4 },
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
  streakBanner: { backgroundColor: '#FFF8E1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  streakText: { fontSize: 14, fontWeight: '700', color: '#F57F17' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center' },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  drillCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee', overflow: 'hidden' },
  drillTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  drillBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  drillBadgeText: { fontSize: 11, fontWeight: '700' },
  drillMeta: { fontSize: 11, color: '#aaa' },
  drillTitle: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 6 },
  drillDesc: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 18 },
  generateFullBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14, backgroundColor: '#1A56DB' },
  generateFullBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  pickDrillsBtn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1.5, borderColor: '#1A56DB', alignItems: 'center', justifyContent: 'center' },
  pickDrillsBtnText: { fontSize: 14, fontWeight: '700', color: '#1A56DB' },
  practicedBtn: { borderWidth: 1.5, borderColor: '#1A56DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 10 },
  practicedBtnDone: { backgroundColor: '#1A56DB' },
  practicedBtnText: { fontSize: 13, fontWeight: '600', color: '#1A56DB' },
  practicedBtnTextDone: { color: '#fff' },
  feedbackRow: { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 2 },
  feedbackBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center', backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#eee' },
  feedbackBtnSelected: { backgroundColor: '#EEF4FF', borderColor: '#1A56DB' },
  feedbackBtnText: { fontSize: 12, fontWeight: '600', color: '#888' },
  feedbackBtnTextSelected: { color: '#1A56DB' },
  submitFeedbackBtn: { backgroundColor: '#F0F4FF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#C7D7FD' },
  submitFeedbackBtnText: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },
  ageGroupLabel: { fontSize: 12, color: '#aaa', fontWeight: '600', marginBottom: 12 },
  ruleCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  ruleName: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  ruleWhenRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  ruleWhenLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.3 },
  ruleWhen: { fontSize: 12, color: '#555', flex: 1 },
  ruleExplanation: { fontSize: 14, color: '#333', lineHeight: 21, marginBottom: 10 },
})
