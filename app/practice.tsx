import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
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
  Passing: '#1A56DB',
  Shooting: '#FF6B35',
  Defending: '#9C27B0',
  Goalkeeping: '#607D8B',
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
  const [plan, setPlan] = useState<any>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [isOfflinePlan, setIsOfflinePlan] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [activeTab, setActiveTab] = useState<'planner' | 'drills' | 'rules'>('planner')
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null)
  const [inputFocused, setInputFocused] = useState(false)
  const [favoriteDrills, setFavoriteDrills] = useState<Set<string>>(new Set())
  const [drillStreak, setDrillStreak] = useState(0)
  const [lastDrillDate, setLastDrillDate] = useState('')
  const [practicedDrills, setPracticedDrills] = useState<Set<string>>(new Set())

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
    setIsOfflinePlan(false)
    const focus = event.focus ?? 'general skills'
    const fallback = {
      title: `${focus} Practice`,
      plan: [
        { phase: 'Opening Play', duration: '15 min', drill: 'Small-sided free play', desc: 'Players arrive and jump into a game. Coach observes.' },
        { phase: 'Practice Phase', duration: '30 min', drill: `${focus} drills`, desc: 'Coach-guided skill work with positive cues.' },
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
          teamData.name,
          teamData.age_group
        ),
        timeoutPromise
      ])
      setPlan(result)
    } catch {
      setPlan(fallback)
      setIsOfflinePlan(true)
    }
    setPlanLoading(false)
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
    const finalPrompt = buildPrompt()
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
      setPlan(result)
    } catch {
      setPlan({ title: 'Practice Plan', plan: FALLBACK_PLAN, coachTip: 'Keep energy high.' })
      setIsOfflinePlan(true)
    }
    setAiLoading(false)
  }

  const markDrillPracticed = (drillId: string) => {
    if (practicedDrills.has(drillId)) return
    setPracticedDrills(prev => { const n = new Set(prev); n.add(drillId); return n })
    setDrillStreak(s => s + 1)
    setLastDrillDate(new Date().toISOString().split('T')[0])
  }

  const onVideoTap = (drillId: string, videoId: string) => {
    WebBrowser.openBrowserAsync('https://www.youtube.com/watch?v=' + videoId)
    setDrillStreak(s => s + 1)
    setLastDrillDate(new Date().toISOString().split('T')[0])
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
              <Text style={styles.contextTitle}>Focus: {nextEvent.focus ?? 'General skills'}</Text>
              <Text style={styles.contextSub}>
                {new Date(nextEvent.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {nextEvent.duration_min ?? 60} min · {nextEvent.location}
              </Text>
            </View>
          )}

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

            {selectedFocuses.length > 0 && (
              <TouchableOpacity
                style={[styles.generateFullBtn, { backgroundColor: teamColor }]}
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

            {aiLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={teamColor} size="small" />
                <Text style={styles.loadingBoxText}>Building your Play-Practice-Play plan...</Text>
              </View>
            )}
          </View>

          {planLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <ActivityIndicator color={teamColor} size="small" />
              <Text style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Shuffling your plan...</Text>
            </View>
          )}

          {plan && !planLoading && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>Current plan</Text>
                  <Text style={[styles.planTitle, { marginBottom: 0 }]}>{plan.title}</Text>
                  {isOfflinePlan && <Text style={styles.offlineLabel}>Using saved plan</Text>}
                </View>
                <TouchableOpacity onPress={() => nextEvent && autoGenerate(nextEvent, team)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 20 }}>🔀</Text>
                </TouchableOpacity>
              </View>
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
      ) : activeTab === 'drills' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Streak banner */}
          <View style={styles.streakBanner}>
            <Text style={styles.streakText}>
              {drillStreak > 0
                ? `🔥 ${drillStreak} drill streak`
                : 'Start your streak — watch a drill or practice today'}
            </Text>
          </View>

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
                <View style={styles.drillTop}>
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
                      <Text style={{ fontSize: 18, color: isFav ? teamColor : '#ccc' }}>
                        {isFav ? '♥' : '♡'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.drillTitle}>{drill.title}</Text>
                <Text style={styles.drillDesc}>{drill.desc}</Text>
                {drill.videoId && (
                  <TouchableOpacity
                    onPress={() => onVideoTap(drill.id, drill.videoId!)}
                    activeOpacity={0.85}
                    style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden' }}
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
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  drillCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: '#eee' },
  drillTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  drillBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  drillBadgeText: { fontSize: 11, fontWeight: '700' },
  drillMeta: { fontSize: 11, color: '#aaa' },
  drillTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  drillDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#fff', fontSize: 18 },
  generateFullBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  generateFullBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  practicedBtn: { borderWidth: 1.5, borderColor: '#1A56DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', marginTop: 10 },
  practicedBtnDone: { backgroundColor: '#1A56DB' },
  practicedBtnText: { fontSize: 13, fontWeight: '600', color: '#1A56DB' },
  practicedBtnTextDone: { color: '#fff' },
  ageGroupLabel: { fontSize: 12, color: '#aaa', fontWeight: '600', marginBottom: 12 },
  ruleCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  ruleName: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  ruleWhenRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  ruleWhenLabel: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.3 },
  ruleWhen: { fontSize: 12, color: '#555', flex: 1 },
  ruleExplanation: { fontSize: 14, color: '#333', lineHeight: 21, marginBottom: 10 },
})
