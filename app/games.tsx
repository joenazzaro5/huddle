import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { AppHeader } from '../lib/header'
import { SEASON_SCHEDULE } from '../lib/season'

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3B5d21od3FkYXB4ZW14bHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDIwMjksImV4cCI6MjA5MDY3ODAyOX0.HXsFNltsIhtL0S2tLtzFK55lbQX6GMFQKxw-U3OY6KQ'
const SUPABASE_URL = 'https://yvspywmhwqdapxemxlug.supabase.co'

const FORMATIONS: Record<string, { position: string; x: number; y: number }[]> = {
  '3-1-2': [
    { position: 'GK', x: 50, y: 85 },
    { position: 'LB', x: 22, y: 67 },
    { position: 'CB', x: 50, y: 67 },
    { position: 'RB', x: 78, y: 67 },
    { position: 'CM', x: 50, y: 44 },
    { position: 'CF', x: 32, y: 18 },
    { position: 'ST', x: 68, y: 18 },
  ],
  '2-3-1': [
    { position: 'GK', x: 50, y: 85 },
    { position: 'LB', x: 30, y: 68 },
    { position: 'RB', x: 70, y: 68 },
    { position: 'LM', x: 22, y: 46 },
    { position: 'CM', x: 50, y: 44 },
    { position: 'RM', x: 78, y: 46 },
    { position: 'ST', x: 50, y: 18 },
  ],
  '2-2-2': [
    { position: 'GK', x: 50, y: 85 },
    { position: 'LB', x: 30, y: 68 },
    { position: 'RB', x: 70, y: 68 },
    { position: 'LM', x: 32, y: 46 },
    { position: 'RM', x: 68, y: 46 },
    { position: 'LW', x: 32, y: 20 },
    { position: 'RW', x: 68, y: 20 },
  ],
}
const FORMATION_NAMES = ['3-1-2', '2-3-1', '2-2-2'] as const
const SUB_ROUND_MINS = [8, 16, 24]

const LEAGUE_STANDINGS = [
  { name: 'Marin Cheetahs',    w: 6, l: 2, d: 1, pts: 19, isOwn: true },
  { name: 'Novato Eagles',     w: 5, l: 3, d: 1, pts: 16, isOwn: false },
  { name: 'San Rafael Sharks', w: 5, l: 3, d: 0, pts: 15, isOwn: false },
  { name: 'Mill Valley FC',    w: 4, l: 4, d: 1, pts: 13, isOwn: false },
  { name: 'Tiburon Tigers',    w: 3, l: 4, d: 2, pts: 11, isOwn: false },
  { name: 'Sausalito Stars',   w: 2, l: 6, d: 1, pts:  7, isOwn: false },
]

const SNACK_SCHEDULE_DATA = [
  { id: 's1', date: 'Apr 19', family: "Sofia's family" },
  { id: 's2', date: 'Apr 26', family: null },
  { id: 's3', date: 'May 3',  family: null },
  { id: 's4', date: 'May 10', family: null },
  { id: 's5', date: 'May 17', family: null },
]

const TABS = [
  { key: 'schedule',  label: 'Schedule'  },
  { key: 'games',     label: 'Game Day'  },
  { key: 'roster',    label: 'Roster'    },
  { key: 'standings', label: 'Standings' },
  { key: 'snacks',    label: 'Snacks'    },
] as const

type TabKey = typeof TABS[number]['key']

type Player = {
  id: string
  name: string
  number: number | null
  positions: string[]
  isOn: boolean
  fieldSlot: number | null
  minutes: number
  targetPercent: number
}

export default function GamesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('games')
  const [lineupPrompt, setLineupPrompt] = useState('')
  const [lineupLoading, setLineupLoading] = useState(false)
  const [lineupGenerated, setLineupGenerated] = useState(true)
  const [activeFormation, setActiveFormation] = useState<string>('3-1-2')
  const [lineupBuilderOpen, setLineupBuilderOpen] = useState(false)
  const [lineupFocusPills, setLineupFocusPills] = useState<string[]>([])
  const [nextGame, setNextGame] = useState<any>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [confirmedSubRounds, setConfirmedSubRounds] = useState(0)
  const [originalStarterIds, setOriginalStarterIds] = useState<string[]>([])
  const [claimedSnacks, setClaimedSnacks] = useState<Set<string>>(new Set(['s1']))

  useEffect(() => {
    const validTabs = TABS.map(t => t.key)
    if (validTabs.includes(params.tab as TabKey)) {
      setActiveTab(params.tab as TabKey)
    }
  }, [params.tab])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: memberships } = await supabase
      .from('team_members')
      .select('team:teams(*), role')
      .eq('user_id', user.id)
    setAllTeams(memberships ?? [])

    const { data: membership } = await supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('user_id', user.id)
      .eq('role', 'coach')
      .limit(1)
      .single()

    if (membership?.team) {
      setTeam(membership.team)

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', membership.team.id)
        .eq('is_active', true)
        .order('number', { ascending: true })

      if (playerData) {
        const mapped = playerData.map((p, i) => ({
          id: p.id,
          name: p.name,
          number: p.number,
          positions: p.positions ?? [],
          isOn: i < 7,
          fieldSlot: i < 7 ? i : null,
          minutes: 0,
          targetPercent: 50,
        }))
        setPlayers(mapped)
        setOriginalStarterIds(mapped.slice(0, 7).map(p => p.id))
      }

      const { data: gameData } = await supabase
        .from('events')
        .select('*')
        .eq('team_id', membership.team.id)
        .eq('type', 'game')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      setNextGame(gameData)
    }
    setLoading(false)
  }

  const generateLineup = async () => {
    if (!lineupPrompt.trim() || !team) return
    setLineupLoading(true)

    const playerList = players.map(p => `#${p.number ?? '?'} ${p.name}${p.positions.length ? ` (${p.positions.join('/')})` : ''}`).join(', ')
    const formationSlots = FORMATIONS[activeFormation].map((s, i) => `${i}=${s.position}`).join(', ')
    const systemPrompt = `You are a youth soccer coaching assistant for ${team.name} (${team.age_group}, 7v7).
Formation: ${activeFormation}
Players: ${playerList}
Game: 60 min (two 30-min halves)

Generate a starting lineup and sub plan based on the coach's instructions.
Respond ONLY with valid JSON:
{
  "starters": [
    {"name": "exact player name", "slot": 0, "position": "GK"}
  ],
  "subPlan": "Plain English sub schedule",
  "coachNote": "One tactical tip"
}
Slots: ${formationSlots}`

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({ prompt: lineupPrompt, systemPrompt }),
      })

      const data = await response.json()

      if (data?.starters) {
        const matchedIds: string[] = []
        setPlayers(prev => {
          const updated = prev.map(p => ({ ...p, isOn: false, fieldSlot: null }))
          data.starters.forEach((s: any) => {
            const idx = updated.findIndex(p =>
              p.name.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]) ||
              s.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
            )
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], isOn: true, fieldSlot: s.slot }
              matchedIds.push(updated[idx].id)
            }
          })
          return updated
        })
        if (matchedIds.length > 0) {
          setOriginalStarterIds(matchedIds)
          setConfirmedSubRounds(0)
        }
        if (data.subPlan) Alert.alert('Sub plan', data.subPlan + (data.coachNote ? '\n\n💡 ' + data.coachNote : ''))
      } else {
        setPlayers(prev => prev.map((p, i) => ({ ...p, isOn: i < 7, fieldSlot: i < 7 ? i : null })))
      }
    } catch {
      setPlayers(prev => prev.map((p, i) => ({ ...p, isOn: i < 7, fieldSlot: i < 7 ? i : null })))
    }

    setLineupGenerated(true)
    setLineupLoading(false)
  }

  const handlePlayerTap = (playerId: string) => {
    if (!selectedPlayer) {
      setSelectedPlayer(playerId)
      return
    }
    if (selectedPlayer === playerId) {
      setSelectedPlayer(null)
      return
    }
    setPlayers(prev => {
      const a = prev.find(p => p.id === selectedPlayer)
      const b = prev.find(p => p.id === playerId)
      if (!a || !b) return prev
      return prev.map(p => {
        if (p.id === a.id) return { ...p, isOn: b.isOn, fieldSlot: b.fieldSlot }
        if (p.id === b.id) return { ...p, isOn: a.isOn, fieldSlot: a.fieldSlot }
        return p
      })
    })
    setSelectedPlayer(null)
  }

  const groupEventsByMonth = (evts: any[]) => {
    const groups: { month: string; events: any[] }[] = []
    evts.forEach(evt => {
      const month = new Date(evt.starts_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const existing = groups.find(g => g.month === month)
      if (existing) existing.events.push(evt)
      else groups.push({ month, events: [evt] })
    })
    return groups
  }

  const activeFormationSlots = FORMATIONS[activeFormation] ?? FORMATIONS['3-1-2']
  const onPlayers = players.filter(p => p.isOn).sort((a, b) => (a.fieldSlot ?? 0) - (b.fieldSlot ?? 0))
  const offPlayers = players.filter(p => !p.isOn)
  const tc = '#1A56DB'

  const benchPlayers = players.filter(p => !originalStarterIds.includes(p.id))
  const starterPlayers = players.filter(p => originalStarterIds.includes(p.id))
  const nonGkStarters = starterPlayers.filter(p => activeFormationSlots[p.fieldSlot ?? 0]?.position !== 'GK')
  const subCount = Math.min(benchPlayers.length, nonGkStarters.length)
  const subRoundIns = benchPlayers.slice(0, subCount)
  const subRoundOuts = nonGkStarters.slice(0, subCount)
  const subRounds = [
    { min: SUB_ROUND_MINS[0], ins: subRoundIns,  outs: subRoundOuts },
    { min: SUB_ROUND_MINS[1], ins: subRoundOuts, outs: subRoundIns  },
    { min: SUB_ROUND_MINS[2], ins: subRoundIns,  outs: subRoundOuts },
  ]

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#1A56DB" size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader
        teamColor={tc}
        teamName={team?.name}
        allTeams={allTeams}
        onTeamSelect={() => {}}
      />

      {/* 5-tab scrollable bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 44, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee', flexGrow: 0 }}
        contentContainerStyle={{ flexDirection: 'row' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={{ paddingHorizontal: 18, height: 44, alignItems: 'center', justifyContent: 'center', paddingBottom: 2 }}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={{ fontSize: 14, color: isActive ? tc : '#999', fontWeight: isActive ? '700' : '500' }}>
                {tab.label}
              </Text>
              {isActive && (
                <View style={{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 2.5, backgroundColor: tc, borderRadius: 2 }} />
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Schedule ── */}
      {activeTab === 'schedule' && (
        <ScrollView contentContainerStyle={styles.content}>
          {groupEventsByMonth(SEASON_SCHEDULE).map(({ month, events: monthEvents }) => (
            <View key={month}>
              <Text style={styles.monthHeader}>{month}</Text>
              <View style={styles.card}>
                {monthEvents.map((event, i) => {
                  const d = new Date(event.starts_at)
                  const isGame = event.type === 'game'
                  const isPictureDay = event.type === 'picture_day'
                  const isParty = event.type === 'party'
                  const typeColor = isGame ? '#FF8C42' : isPictureDay ? '#9C27B0' : isParty ? '#7C3AED' : tc
                  const typeLabel = isGame ? '🏆 Game' : isPictureDay ? '📸 Picture Day' : isParty ? '🎉 Party' : '⚽ Practice'
                  return (
                    <TouchableOpacity
                      key={event.id}
                      style={[
                        styles.scheduleRow,
                        i % 2 === 1 && styles.scheduleRowAlt,
                        i < monthEvents.length - 1 && styles.scheduleBorder,
                      ]}
                      onPress={() => {
                        if (event.type === 'practice') router.push('/practice')
                        else if (event.type === 'game') setActiveTab('games')
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.scheduleDateCol}>
                        <Text style={styles.scheduleDay}>{d.getDate()}</Text>
                        <Text style={styles.scheduleDOW}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scheduleType, { color: typeColor }]}>{typeLabel}</Text>
                        <Text style={styles.scheduleTitle}>
                          {isGame
                            ? `vs ${event.opponent}${event.home != null ? (event.home ? ' · Home' : ' · Away') : ''}`
                            : (event.focus ?? event.title ?? event.location ?? '')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.scheduleTime}>
                          {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                        {event.location ? <Text style={styles.scheduleLoc} numberOfLines={1}>{event.location}</Text> : null}
                        {(event.type === 'practice' || event.type === 'game') && (
                          <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Tap to open →</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Game Day ── */}
      {activeTab === 'games' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {nextGame && (
            <View style={[styles.gameCard, { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#eee', borderLeftWidth: 4, borderLeftColor: tc }]}>
              <Text style={[styles.gameCardLabel, { color: tc }]}>Next game</Text>
              <Text style={[styles.gameCardTitle, { color: '#111827' }]}>vs {nextGame.opponent}</Text>
              <Text style={[styles.gameCardSub, { color: '#6B7280' }]}>
                {new Date(nextGame.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}

          {/* AI Lineup Builder */}
          <TouchableOpacity
            style={styles.lineupBuilderToggle}
            onPress={() => setLineupBuilderOpen(v => !v)}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.lineupBuilderTitle}>⚡ Build your lineup</Text>
              <Text style={styles.lineupBuilderSub}>Tap to generate your starting lineup</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>{lineupBuilderOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {lineupBuilderOpen && (
            <View style={[styles.card, { marginBottom: 12 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {['Strongest lineup', 'Equal playing time', 'Hide injured'].map(pill => {
                  const active = lineupFocusPills.includes(pill)
                  return (
                    <TouchableOpacity
                      key={pill}
                      onPress={() => setLineupFocusPills(prev => active ? prev.filter(p => p !== pill) : [...prev, pill])}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, backgroundColor: active ? tc : '#F3F4F6', borderColor: active ? tc : '#E5E7EB' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : '#555' }}>{pill}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TextInput
                style={styles.promptInput}
                placeholder="e.g. #1 Sofia in goal all game, rotate everyone equally"
                placeholderTextColor="#bbb"
                value={lineupPrompt}
                onChangeText={setLineupPrompt}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: (lineupPrompt.trim() || lineupFocusPills.length > 0) ? tc : '#E0E0E0' }]}
                onPress={generateLineup}
                disabled={lineupLoading || (!lineupPrompt.trim() && lineupFocusPills.length === 0)}
              >
                {lineupLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.generateBtnText}>Generate lineup</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Field view */}
          <View style={styles.fieldContainer}>
            {selectedPlayer && (
              <Text style={styles.fieldHint}>Tap another player to swap · tap same to deselect</Text>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                {FORMATION_NAMES.map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setActiveFormation(f)}
                    style={[styles.formationPill, activeFormation === f && { backgroundColor: tc, borderColor: tc }]}
                  >
                    <Text style={[styles.formationPillText, { color: activeFormation === f ? '#fff' : '#555' }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.field}>
              <View style={styles.fieldCenterCircle} />
              <View style={styles.fieldCenterLine} />
              <View style={styles.fieldPenaltyTop} />
              <View style={styles.fieldPenaltyBottom} />

              {onPlayers.map(player => {
                const slot = player.fieldSlot ?? 0
                const pos = activeFormationSlots[slot] ?? activeFormationSlots[0]
                const isSelected = selectedPlayer === player.id
                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[styles.fieldPlayer, {
                      left: `${pos.x}%`, top: `${pos.y}%`,
                      backgroundColor: isSelected ? '#FFD700' : '#fff',
                      borderColor: isSelected ? '#FFD700' : 'rgba(255,255,255,0.6)',
                      borderWidth: 1.5,
                    }]}
                    onPress={() => handlePlayerTap(player.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.fieldPlayerNum, { color: '#1C1C1E' }]}>{player.number ?? '?'}</Text>
                    <Text style={[styles.fieldPlayerName, { color: 'rgba(28,28,30,0.8)' }]} numberOfLines={1}>{player.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.benchArea}>
              <Text style={styles.benchLabel}>Bench · {offPlayers.length}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                  {offPlayers.map(player => {
                    const isSelected = selectedPlayer === player.id
                    return (
                      <TouchableOpacity
                        key={player.id}
                        style={[styles.benchPlayer, isSelected && { borderColor: '#FFD700', borderWidth: 2 }]}
                        onPress={() => handlePlayerTap(player.id)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.benchPlayerNum, { backgroundColor: '#f0f0f0' }]}>
                          <Text style={[styles.benchPlayerNumText, { color: '#1C1C1E' }]}>{player.number ?? '?'}</Text>
                        </View>
                        <Text style={styles.benchPlayerName} numberOfLines={1}>{player.name.split(' ')[0]}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Sub rounds card */}
          {subCount > 0 && (
            <View style={styles.subPlanCard}>
              <Text style={styles.subPlanTitle}>Sub rounds</Text>
              {subRounds.map((round, i) => {
                const done = confirmedSubRounds > i
                return (
                  <View key={i} style={[styles.subPlanRow, i < subRounds.length - 1 && styles.subPlanBorder]}>
                    <Text style={[styles.subPlanTime, done && { color: '#10B981' }]}>
                      {done ? '✓' : `${round.min}m`}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subPlanIn}>↑ {round.ins.map(p => p.name.split(' ')[0]).join(', ')}</Text>
                      <Text style={styles.subPlanOut}>↓ {round.outs.map(p => p.name.split(' ')[0]).join(', ')}</Text>
                    </View>
                  </View>
                )
              })}
              {confirmedSubRounds < 3 ? (
                <TouchableOpacity
                  style={{ backgroundColor: tc, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 }}
                  onPress={() => setConfirmedSubRounds(v => v + 1)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                    Confirm Sub Round {confirmedSubRounds + 1} · at {SUB_ROUND_MINS[confirmedSubRounds]} min →
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>All sub rounds complete ✓</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.resetLineupBtn, { borderColor: tc }]}
            onPress={() => {
              setLineupPrompt('')
              setConfirmedSubRounds(0)
              const reset = players.map((p, i) => ({ ...p, isOn: i < 7, fieldSlot: i < 7 ? i : null, minutes: 0 }))
              setPlayers(reset)
              setOriginalStarterIds(reset.slice(0, 7).map(p => p.id))
            }}
          >
            <Text style={[styles.resetLineupText, { color: tc }]}>Reset lineup</Text>
          </TouchableOpacity>

        </ScrollView>
      )}

      {/* ── Roster ── */}
      {activeTab === 'roster' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.monthHeader}>PLAYERS · {players.length}</Text>
          <View style={styles.card}>
            {players.map((player, i) => (
              <View
                key={player.id}
                style={[
                  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
                  i < players.length - 1 && styles.scheduleBorder,
                ]}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tc + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: tc }}>{player.number ?? '—'}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 }}>{player.name}</Text>
                <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 130 }}>
                  {(player.positions.length > 0 ? player.positions : ['—']).map(pos => (
                    <View key={pos} style={{ backgroundColor: '#F0F4FF', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: tc }}>{pos}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Standings ── */}
      {activeTab === 'standings' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.monthHeader}>U10 LEAGUE STANDINGS</Text>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 2 }}>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.3 }}>TEAM</Text>
              {['W','L','D','PTS'].map(col => (
                <Text key={col} style={{ width: 34, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.3 }}>{col}</Text>
              ))}
            </View>
            {LEAGUE_STANDINGS.map((row, i) => (
              <View
                key={row.name}
                style={[
                  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
                  row.isOwn && { backgroundColor: '#EEF4FF', borderRadius: 10, marginHorizontal: -4, paddingHorizontal: 4 },
                  i < LEAGUE_STANDINGS.length - 1 && !row.isOwn && styles.scheduleBorder,
                ]}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#C4C9D4', minWidth: 16 }}>{i + 1}</Text>
                  <Text style={{ fontSize: 14, fontWeight: row.isOwn ? '800' : '600', color: row.isOwn ? tc : '#1a1a1a' }}>{row.name}</Text>
                  {row.isOwn && (
                    <View style={{ backgroundColor: tc, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>US</Text>
                    </View>
                  )}
                </View>
                {[row.w, row.l, row.d, row.pts].map((val, j) => (
                  <Text
                    key={j}
                    style={{ width: 34, textAlign: 'center', fontSize: 13, fontWeight: j === 3 ? '800' : '600', color: j === 3 ? (row.isOwn ? tc : '#1a1a1a') : '#6B7280' }}
                  >
                    {val}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Snacks ── */}
      {activeTab === 'snacks' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.monthHeader}>SNACK SCHEDULE</Text>
          <View style={styles.card}>
            {SNACK_SCHEDULE_DATA.map((item, i) => {
              const claimed = claimedSnacks.has(item.id)
              return (
                <View
                  key={item.id}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
                    i < SNACK_SCHEDULE_DATA.length - 1 && styles.scheduleBorder,
                  ]}
                >
                  <Text style={{ width: 52, fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>{item.date}</Text>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: claimed || item.family ? '#1a1a1a' : '#9CA3AF' }}>
                    {claimed ? 'Your family' : (item.family ?? 'Available')}
                  </Text>
                  {claimed ? (
                    <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>✓ Claimed</Text>
                    </View>
                  ) : item.family ? (
                    <View style={{ backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#9CA3AF' }}>Taken</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={{ backgroundColor: tc, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                      onPress={() => setClaimedSnacks(prev => new Set([...prev, item.id]))}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Claim</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </View>
          <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>Tap Claim to sign up for snacks on that date</Text>
        </ScrollView>
      )}

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 32 },
  monthHeader: { fontSize: 12, fontWeight: '700', color: '#aaa', letterSpacing: 0.3, marginBottom: 8, marginTop: 4 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  scheduleRowAlt: { backgroundColor: '#FAFAFA' },
  scheduleBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  scheduleDateCol: { width: 32, alignItems: 'center' },
  scheduleDay: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  scheduleDOW: { fontSize: 10, color: '#aaa', fontWeight: '600' },
  scheduleType: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  scheduleTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  scheduleTime: { fontSize: 12, fontWeight: '600', color: '#555' },
  scheduleLoc: { fontSize: 11, color: '#aaa', maxWidth: 90 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  gameCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  gameCardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  gameCardTitle: { fontSize: 26, fontWeight: '900', marginBottom: 2 },
  gameCardSub: { fontSize: 14 },
  promptInput: { backgroundColor: '#F7F7F5', borderRadius: 14, padding: 14, fontSize: 14, color: '#1a1a1a', borderWidth: 1.5, borderColor: '#E0E0E0', minHeight: 130, textAlignVertical: 'top', marginBottom: 12, lineHeight: 22 },
  generateBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 8 },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  fieldContainer: { marginBottom: 14 },
  fieldHint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 8 },
  field: { backgroundColor: '#3d7a35', borderRadius: 16, height: 300, position: 'relative', marginBottom: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#2d5a25' },
  fieldCenterCircle: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', top: '50%', left: '50%', marginTop: -30, marginLeft: -30 },
  fieldCenterLine: { position: 'absolute', left: 8, right: 8, top: '50%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  fieldPenaltyTop: { position: 'absolute', top: 0, left: '28%', right: '28%', height: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopWidth: 0 },
  fieldPenaltyBottom: { position: 'absolute', bottom: 0, left: '28%', right: '28%', height: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderBottomWidth: 0 },
  fieldPlayer: { position: 'absolute', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginLeft: -26, marginTop: -26, borderWidth: 1.5 },
  fieldPlayerNum: { fontSize: 13, fontWeight: '900' },
  fieldPlayerName: { fontSize: 8, fontWeight: '600', maxWidth: 48 },
  benchArea: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#eee' },
  benchLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.3, marginBottom: 8 },
  benchPlayer: { alignItems: 'center', width: 64, borderRadius: 10, padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  benchPlayerNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  benchPlayerNumText: { fontSize: 13, fontWeight: '700' },
  benchPlayerName: { fontSize: 10, fontWeight: '600', color: '#555', maxWidth: 56, textAlign: 'center' },
  resetLineupBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, marginBottom: 14 },
  resetLineupText: { fontSize: 14, fontWeight: '700' },
  lineupBuilderToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A56DB', borderRadius: 16, padding: 16, marginBottom: 10 },
  lineupBuilderTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 3 },
  lineupBuilderSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
  formationPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  formationPillText: { fontSize: 13, fontWeight: '700' },
  subPlanCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#E5E7EB' },
  subPlanTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  subPlanRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
  subPlanBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  subPlanTime: { fontSize: 12, fontWeight: '700', color: '#6B7280', minWidth: 32, marginTop: 1 },
  subPlanIn: { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  subPlanOut: { fontSize: 13, fontWeight: '600', color: '#DC2626', marginTop: 1 },
})
