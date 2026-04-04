import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { AppHeader } from '../lib/header'

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3B5d21od3FkYXB4ZW14bHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDIwMjksImV4cCI6MjA5MDY3ODAyOX0.HXsFNltsIhtL0S2tLtzFK55lbQX6GMFQKxw-U3OY6KQ'
const SUPABASE_URL = 'https://yvspywmhwqdapxemxlug.supabase.co'

const FORMATION_737 = [
  { position: 'GK', x: 50, y: 85 },
  { position: 'LB', x: 15, y: 65 },
  { position: 'CB', x: 50, y: 63 },
  { position: 'RB', x: 85, y: 65 },
  { position: 'MF', x: 50, y: 42 },
  { position: 'LW', x: 20, y: 22 },
  { position: 'RW', x: 80, y: 22 },
]

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
  const [team, setTeam] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'gameday' | 'roster'>('gameday')
  const [lineupPrompt, setLineupPrompt] = useState('')
  const [lineupLoading, setLineupLoading] = useState(false)
  const [lineupGenerated, setLineupGenerated] = useState(true)
  const [gameRunning, setGameRunning] = useState(false)
  const [gameTime, setGameTime] = useState(0)
  const [period, setPeriod] = useState(1)
  const [nextGame, setNextGame] = useState<any>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'field' | 'list'>('field')
  const timerRef = useRef<any>(null)

  useEffect(() => {
    loadData()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

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

      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', membership.team.id)
        .eq('is_active', true)
        .order('number', { ascending: true })

      if (playerData) {
        setPlayers(playerData.map((p, i) => ({
          id: p.id,
          name: p.name,
          number: p.number,
          positions: p.positions ?? [],
          isOn: i < 7,
          fieldSlot: i < 7 ? i : null,
          minutes: 0,
          targetPercent: 50,
        })))
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

    const systemPrompt = `You are a youth soccer coaching assistant for ${team.name} (${team.age_group}, 7v7).
Formation: 1 GK, 3 DEF, 1 MF, 2 FWD
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
Slots: 0=GK, 1=LB, 2=CB, 3=RB, 4=MF, 5=LW, 6=RW`

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
        setPlayers(prev => {
          const updated = prev.map(p => ({ ...p, isOn: false, fieldSlot: null }))
          data.starters.forEach((s: any) => {
            const idx = updated.findIndex(p =>
              p.name.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]) ||
              s.name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
            )
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], isOn: true, fieldSlot: s.slot }
            }
          })
          return updated
        })
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

  const toggleTimer = () => {
    if (gameRunning) {
      clearInterval(timerRef.current)
      setGameRunning(false)
    } else {
      timerRef.current = setInterval(() => {
        setGameTime(t => t + 1)
        setPlayers(prev => prev.map(p => ({
          ...p, minutes: p.isOn ? p.minutes + (1/60) : p.minutes
        })))
      }, 1000)
      setGameRunning(true)
    }
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
    // Swap two players
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

  const resetGame = () => {
    Alert.alert('Reset game', 'Reset all minutes and the timer?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: () => {
          clearInterval(timerRef.current)
          setGameRunning(false)
          setGameTime(0)
          setPeriod(1)
          setPlayers(prev => prev.map(p => ({ ...p, minutes: 0 })))
        }
      }
    ])
  }

  const formatTime = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
  const formatMins = (m: number) => m < 1 ? '0m' : `${Math.floor(m)}m`

  const onPlayers = players.filter(p => p.isOn).sort((a, b) => (a.fieldSlot ?? 0) - (b.fieldSlot ?? 0))
  const offPlayers = players.filter(p => !p.isOn)
  const tc = '#1A56DB'
  const totalMins = players.reduce((sum, p) => sum + p.minutes, 0)
  const fairShare = players.length > 0 ? totalMins / players.length : 0

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#1A56DB" size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName={team?.name} />

      <View style={styles.subTabs}>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'gameday' && { borderBottomColor: tc, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('gameday')}
        >
          <Text style={[styles.subTabText, { color: activeTab === 'gameday' ? tc : '#999', fontWeight: activeTab === 'gameday' ? '700' : '500' }]}>
            Game Day
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTab, activeTab === 'roster' && { borderBottomColor: tc, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab('roster')}
        >
          <Text style={[styles.subTabText, { color: activeTab === 'roster' ? tc : '#999', fontWeight: activeTab === 'roster' ? '700' : '500' }]}>
            Roster
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'roster' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.teamCard, { backgroundColor: tc }]}>
            <Text style={styles.teamCardName}>{team?.name}</Text>
            <Text style={styles.teamCardSub}>{team?.age_group} · {team?.gender} · {players.length} players</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Players · {players.length}</Text>
            {players.map((player, i) => (
              <TouchableOpacity
                key={player.id}
                style={[styles.rosterRow, i < players.length - 1 && styles.rosterBorder]}
                onPress={() => router.push({ pathname: '/player', params: { id: player.id } })}
                activeOpacity={0.7}
              >
                <View style={[styles.numBadge, { backgroundColor: tc + '20' }]}>
                  <Text style={[styles.numText, { color: tc }]}>{player.number ?? '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rosterName}>{player.name}</Text>
                  {player.positions?.length > 0 && (
                    <Text style={styles.rosterPos}>{player.positions.join(' · ')}</Text>
                  )}
                </View>
                {player.is_starter && (
                  <View style={[styles.starterChip, { backgroundColor: tc + '20' }]}>
                    <Text style={[styles.starterText, { color: tc }]}>Starter</Text>
                  </View>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {nextGame && (
            <View style={[styles.gameCard, { backgroundColor: '#1A56DB' }]}>
              <Text style={styles.gameCardLabel}>Next game</Text>
              <Text style={styles.gameCardTitle}>vs {nextGame.opponent}</Text>
              <Text style={styles.gameCardSub}>
                {new Date(nextGame.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}

          {!lineupGenerated ? (
            <View style={styles.card}>
              <View style={styles.aiHeader}>
                <View style={[styles.aiIcon, { backgroundColor: tc }]}>
                  <Text style={styles.aiIconText}>⚡</Text>
                </View>
                <View>
                  <Text style={styles.cardTitle}>AI Lineup Builder</Text>
                  <Text style={styles.cardSub}>1 GK · 3 DEF · 1 MF · 2 FWD</Text>
                </View>
              </View>

              <TextInput
                style={styles.promptInput}
                placeholder={`Example:\n#1 Sofia: goalkeeper all game\n#2, 3, 8: starting defenders\n#5: center mid\n#6, 7: starting forwards\nAll players ~50% playing time`}
                placeholderTextColor="#bbb"
                value={lineupPrompt}
                onChangeText={setLineupPrompt}
                multiline
                numberOfLines={6}
              />

              <TouchableOpacity
                style={[styles.generateBtn, { backgroundColor: lineupPrompt.trim() ? tc : '#E0E0E0' }]}
                onPress={generateLineup}
                disabled={lineupLoading || !lineupPrompt.trim()}
              >
                {lineupLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.generateBtnText}>Generate lineup</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={() => {
                setPlayers(prev => prev.map((p, i) => ({ ...p, isOn: i < 7, fieldSlot: i < 7 ? i : null })))
                setLineupGenerated(true)
              }}>
                <Text style={styles.skipBtnText}>Skip — use default lineup</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Timer */}
              <View style={[styles.timerCard, { backgroundColor: '#1A56DB' }]}>
                <View style={styles.timerRow}>
                  <View>
                    <Text style={styles.timerLabel}>Half {period}</Text>
                    <Text style={styles.timerTime}>{formatTime(gameTime)}</Text>
                  </View>
                  <View style={styles.timerActions}>
                    <TouchableOpacity style={[styles.timerBtn, { backgroundColor: gameRunning ? '#E24B4A' : '#fff' }]} onPress={toggleTimer}>
                      <Text style={[styles.timerBtnText, { color: gameRunning ? '#fff' : tc }]}>{gameRunning ? 'Pause' : 'Start'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timerBtnOutline} onPress={() => setPeriod(p => p === 1 ? 2 : 1)}>
                      <Text style={styles.timerBtnOutlineText}>2nd half →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timerBtnOutline} onPress={resetGame}>
                      <Text style={styles.timerBtnOutlineText}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.viewToggle}>
                  <TouchableOpacity onPress={() => setViewMode('field')} style={[styles.viewToggleBtn, viewMode === 'field' && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={styles.viewToggleText}>Field</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.viewToggleBtn, viewMode === 'list' && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={styles.viewToggleText}>Roster</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {viewMode === 'field' ? (
                /* Field view */
                <View style={styles.fieldContainer}>
                  {selectedPlayer && (
                    <Text style={styles.fieldHint}>Tap another player to swap · tap same to deselect</Text>
                  )}
                  <View style={styles.field}>
                    {/* Field markings */}
                    <View style={styles.fieldCenterCircle} />
                    <View style={styles.fieldCenterLine} />
                    <View style={styles.fieldPenaltyTop} />
                    <View style={styles.fieldPenaltyBottom} />

                    {/* On-field players */}
                    {onPlayers.map(player => {
                      const slot = player.fieldSlot ?? 0
                      const pos = FORMATION_737[slot] ?? FORMATION_737[0]
                      const isSelected = selectedPlayer === player.id
                      const isBehind = player.minutes < fairShare * 0.7 && gameTime > 120
                      return (
                        <TouchableOpacity
                          key={player.id}
                          style={[
                            styles.fieldPlayer,
                            {
                              left: `${pos.x}%`,
                              top: `${pos.y}%`,
                              backgroundColor: isSelected ? '#FFD700' : tc,
                              borderColor: isBehind ? '#E24B4A' : 'rgba(255,255,255,0.4)',
                              borderWidth: isBehind ? 2.5 : 1.5,
                            }
                          ]}
                          onPress={() => handlePlayerTap(player.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.fieldPlayerNum}>{player.number ?? '?'}</Text>
                          <Text style={styles.fieldPlayerName} numberOfLines={1}>{player.name.split(' ')[0]}</Text>
                          <Text style={styles.fieldPlayerMins}>{formatMins(player.minutes)}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  {/* Bench */}
                  <View style={styles.benchArea}>
                    <Text style={styles.benchLabel}>Bench · {offPlayers.length}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                        {offPlayers.map(player => {
                          const isSelected = selectedPlayer === player.id
                          const needsTime = player.minutes < fairShare * 0.7 && gameTime > 120
                          return (
                            <TouchableOpacity
                              key={player.id}
                              style={[
                                styles.benchPlayer,
                                isSelected && { borderColor: '#FFD700', borderWidth: 2 },
                                needsTime && { borderColor: '#E24B4A', borderWidth: 2 },
                              ]}
                              onPress={() => handlePlayerTap(player.id)}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.benchPlayerNum, { backgroundColor: tc + '20' }]}>
                                <Text style={[styles.benchPlayerNumText, { color: tc }]}>{player.number ?? '?'}</Text>
                              </View>
                              <Text style={styles.benchPlayerName} numberOfLines={1}>{player.name.split(' ')[0]}</Text>
                              <Text style={[styles.benchPlayerMins, { color: needsTime ? '#E24B4A' : '#aaa' }]}>{formatMins(player.minutes)}</Text>
                            </TouchableOpacity>
                          )
                        })}
                      </View>
                    </ScrollView>
                  </View>
                </View>
              ) : (
                /* List view */
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>On the field · {onPlayers.length}</Text>
                    {onPlayers.map(player => {
                      const isBehind = player.minutes < fairShare * 0.7 && gameTime > 120
                      const isSelected = selectedPlayer === player.id
                      return (
                        <TouchableOpacity
                          key={player.id}
                          style={[styles.playerRow, isSelected && { borderColor: '#FFD700', borderWidth: 2 }]}
                          onPress={() => handlePlayerTap(player.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.numBadge, { backgroundColor: tc + '20' }]}>
                            <Text style={[styles.numText, { color: tc }]}>{player.number ?? '—'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.playerName}>{player.name}</Text>
                            <Text style={styles.playerPos}>{FORMATION_737[player.fieldSlot ?? 0]?.position ?? ''}</Text>
                          </View>
                          <Text style={[styles.playerMins, { color: isBehind ? '#E24B4A' : '#888' }]}>{formatMins(player.minutes)}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  {offPlayers.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionLabel}>Bench · {offPlayers.length}</Text>
                      {offPlayers.map(player => {
                        const needsTime = player.minutes < fairShare * 0.7 && gameTime > 120
                        const isSelected = selectedPlayer === player.id
                        return (
                          <TouchableOpacity
                            key={player.id}
                            style={[styles.playerRow, styles.playerRowBench, isSelected && { borderColor: '#FFD700', borderWidth: 2 }]}
                            onPress={() => handlePlayerTap(player.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.numBadge, { backgroundColor: '#f0f0f0' }]}>
                              <Text style={[styles.numText, { color: '#aaa' }]}>{player.number ?? '—'}</Text>
                            </View>
                            <Text style={[styles.playerName, { color: '#888', flex: 1 }]}>{player.name}</Text>
                            <Text style={[styles.playerMins, { color: needsTime ? '#E24B4A' : '#bbb' }]}>{formatMins(player.minutes)}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Equal time */}
              {gameTime > 120 && players.some(p => p.minutes < fairShare * 0.7) && (
                <View style={styles.fairPlayCard}>
                  <Text style={styles.fairPlayTitle}>⚠ Playing time alert</Text>
                  {players.filter(p => p.minutes < fairShare * 0.7).map(p => (
                    <Text key={p.id} style={styles.fairPlayAlert}>{p.name} needs more time ({formatMins(p.minutes)} vs {formatMins(fairShare)} avg)</Text>
                  ))}
                </View>
              )}

              <TouchableOpacity style={[styles.resetLineupBtn, { borderColor: tc }]} onPress={() => {
                clearInterval(timerRef.current)
                setGameRunning(false)
                setGameTime(0)
                setPeriod(1)
                setLineupGenerated(false)
                setLineupPrompt('')
                setPlayers(prev => prev.map(p => ({ ...p, isOn: false, fieldSlot: null, minutes: 0 })))
              }}>
                <Text style={[styles.resetLineupText, { color: tc }]}>New lineup</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  subTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabText: { fontSize: 14 },
  content: { padding: 16 },
  teamCard: { borderRadius: 20, padding: 18, marginBottom: 14 },
  teamCardName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  teamCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  cardSub: { fontSize: 12, color: '#888' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rosterBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  rosterName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rosterPos: { fontSize: 12, color: '#888', marginTop: 1 },
  starterChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  starterText: { fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 18, color: '#ccc', marginLeft: 4 },
  gameCard: { borderRadius: 20, padding: 16, marginBottom: 14 },
  gameCardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  gameCardTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 2 },
  gameCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  aiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiIconText: { fontSize: 14 },
  promptInput: { backgroundColor: '#F7F7F5', borderRadius: 14, padding: 14, fontSize: 14, color: '#1a1a1a', borderWidth: 1.5, borderColor: '#E0E0E0', minHeight: 130, textAlignVertical: 'top', marginBottom: 12, lineHeight: 22 },
  generateBtn: { borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 8 },
  generateBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn: { padding: 12, alignItems: 'center' },
  skipBtnText: { fontSize: 13, color: '#aaa' },
  timerCard: { borderRadius: 16, padding: 16, marginBottom: 14 },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  timerLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerTime: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  timerActions: { flexDirection: 'row', gap: 8 },
  timerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  timerBtnText: { fontSize: 14, fontWeight: '700' },
  timerBtnOutline: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  timerBtnOutlineText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  viewToggle: { flexDirection: 'row', gap: 8 },
  viewToggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  fieldContainer: { marginBottom: 14 },
  fieldHint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 8 },
  field: { backgroundColor: '#3d7a35', borderRadius: 16, height: 300, position: 'relative', marginBottom: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#2d5a25' },
  fieldCenterCircle: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', top: '50%', left: '50%', marginTop: -30, marginLeft: -30 },
  fieldCenterLine: { position: 'absolute', left: 8, right: 8, top: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  fieldPenaltyTop: { position: 'absolute', top: 0, left: '28%', right: '28%', height: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopWidth: 0 },
  fieldPenaltyBottom: { position: 'absolute', bottom: 0, left: '28%', right: '28%', height: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderBottomWidth: 0 },
  fieldPenaltyTop: { position: 'absolute', top: 0, left: '28%', right: '28%', height: 36, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopWidth: 0 },
  fieldGoalBottom: { position: 'absolute', bottom: 0, left: '38%', right: '38%', height: 10, backgroundColor: 'rgba(255,255,255,0.5)', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  fieldGoalTop: { position: 'absolute', top: 0, left: '38%', right: '38%', height: 10, backgroundColor: 'rgba(255,255,255,0.5)', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  fieldCenterDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', top: '50%', left: '50%', marginTop: -4, marginLeft: -4 },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 14, height: 14, borderBottomRightRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopWidth: 0, borderLeftWidth: 0 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderBottomLeftRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderTopWidth: 0, borderRightWidth: 0 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 14, height: 14, borderTopRightRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderTopLeftRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderBottomWidth: 0, borderRightWidth: 0 },
  yourHalfLabel: { position: 'absolute', top: '53%', left: 8 },
  yourHalfText: { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.25)', letterSpacing: 1 },
  fieldPlayer: { position: 'absolute', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginLeft: -26, marginTop: -26, borderWidth: 1.5 },
  fieldPlayerNum: { fontSize: 13, fontWeight: '900', color: '#fff' },
  fieldPlayerName: { fontSize: 8, color: 'rgba(255,255,255,0.9)', fontWeight: '600', maxWidth: 48 },
  fieldPlayerMins: { fontSize: 8, color: 'rgba(255,255,255,0.7)' },
  benchArea: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#eee' },
  benchLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  benchPlayer: { alignItems: 'center', width: 64, borderRadius: 10, padding: 8, backgroundColor: '#F7F7F5', borderWidth: 1, borderColor: '#eee' },
  benchPlayerNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  benchPlayerNumText: { fontSize: 13, fontWeight: '800' },
  benchPlayerName: { fontSize: 10, fontWeight: '600', color: '#555', maxWidth: 56, textAlign: 'center' },
  benchPlayerMins: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#eee' },
  playerRowBench: { backgroundColor: '#F7F7F5' },
  numBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '800' },
  playerName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  playerPos: { fontSize: 11, color: '#aaa', marginTop: 1 },
  playerMins: { fontSize: 13, fontWeight: '600', minWidth: 28, textAlign: 'right' },
  fairPlayCard: { backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FFCCCC' },
  fairPlayTitle: { fontSize: 14, fontWeight: '800', color: '#E24B4A', marginBottom: 6 },
  fairPlayAlert: { fontSize: 13, color: '#E24B4A', marginBottom: 3 },
  resetLineupBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, marginBottom: 14 },
  resetLineupText: { fontSize: 14, fontWeight: '700' },
})
