import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { AppHeader } from '../lib/header'
import { SEASON_SCHEDULE } from '../lib/season'

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3B5d21od3FkYXB4ZW14bHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDIwMjksImV4cCI6MjA5MDY3ODAyOX0.HXsFNltsIhtL0S2tLtzFK55lbQX6GMFQKxw-U3OY6KQ'
const SUPABASE_URL = 'https://yvspywmhwqdapxemxlug.supabase.co'

const STANDINGS = [
  { team:'Marin Cheetahs', w:4, l:1, d:1, pts:13, isUs:true },
  { team:'Tiburon FC',     w:3, l:2, d:1, pts:10 },
  { team:'Mill Valley SC', w:3, l:2, d:0, pts:9 },
  { team:'Novato United',  w:2, l:2, d:2, pts:8 },
  { team:'San Anselmo FC', w:1, l:4, d:1, pts:4 },
  { team:'Fairfax FC',     w:0, l:5, d:1, pts:1 },
]

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
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'schedule' | 'games' | 'roster' | 'standings' | 'snacks' | 'polls'>('schedule')
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

  const [snackData, setSnackData] = useState([
    { date: 'Apr 5', type: 'Practice', name: 'Sarah M', claimed: true },
    { date: 'Apr 12', type: 'Practice', name: null as string | null, claimed: false },
    { date: 'Apr 19', type: 'Game', name: 'Tom K', claimed: true },
    { date: 'Apr 26', type: 'Practice', name: null as string | null, claimed: false },
    { date: 'May 3', type: 'Practice', name: 'Lisa R', claimed: true },
    { date: 'May 10', type: 'Game', name: null as string | null, claimed: false },
  ])
  const [pollOptions, setPollOptions] = useState([
    { label: "Let's go, team!", votes: 12 },
    { label: 'Hustle hard!', votes: 8 },
    { label: 'All day, every day!', votes: 5 },
  ])
  const [votedOption, setVotedOption] = useState<number | null>(null)

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

      const { data: allEvents } = await supabase
        .from('events')
        .select('*')
        .eq('team_id', membership.team.id)
        .order('starts_at', { ascending: true })
      setEvents(allEvents ?? [])
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

  const groupEventsByMonth = (evts: any[]) => {
    const groups: { month: string; events: any[] }[] = []
    evts.forEach(evt => {
      const month = new Date(evt.starts_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const existing = groups.find(g => g.month === month)
      if (existing) {
        existing.events.push(evt)
      } else {
        groups.push({ month, events: [evt] })
      }
    })
    return groups
  }

  const onPlayers = players.filter(p => p.isOn).sort((a, b) => (a.fieldSlot ?? 0) - (b.fieldSlot ?? 0))
  const offPlayers = players.filter(p => !p.isOn)
  const tc = '#1A56DB'
  const totalMins = players.reduce((sum, p) => sum + p.minutes, 0)
  const fairShare = players.length > 0 ? totalMins / players.length : 0

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#1A56DB" size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName={team?.name} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabsScroll} contentContainerStyle={styles.subTabsContent}>
        {(['schedule', 'games', 'roster', 'standings', 'snacks', 'polls'] as const).map(tab => {
          const labels: Record<string, string> = { schedule: 'Schedule', games: 'Games', roster: 'Roster', standings: 'Standings', snacks: 'Snacks', polls: 'Polls' }
          const isActive = activeTab === tab
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.subTab, isActive && { borderBottomColor: tc, borderBottomWidth: 2.5 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.subTabText, { color: isActive ? tc : '#999', fontWeight: isActive ? '700' : '500' }]}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {activeTab === 'schedule' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {groupEventsByMonth(events.length > 0 ? events : SEASON_SCHEDULE).map(({ month, events: monthEvents }) => (
            <View key={month}>
              <Text style={styles.monthHeader}>{month}</Text>
              <View style={styles.card}>
                {monthEvents.map((event, i) => {
                  const d = new Date(event.starts_at)
                  const isGame = event.type === 'game'
                  const isPictureDay = event.type === 'picture_day'
                  const isParty = event.type === 'party'
                  const typeColor = isGame ? '#FF8C42' : isPictureDay ? '#9C27B0' : isParty ? '#7C3AED' : tc
                  const typeLabel = isGame ? '⚽ Game' : isPictureDay ? '📸 Picture Day' : isParty ? '🎉 Party' : '🏃 Practice'
                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.scheduleRow,
                        i % 2 === 1 && styles.scheduleRowAlt,
                        i < monthEvents.length - 1 && styles.scheduleBorder,
                      ]}
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
                        {event.location ? (
                          <Text style={styles.scheduleLoc} numberOfLines={1}>{event.location}</Text>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : activeTab === 'roster' ? (
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
                {(player as any).is_starter && (
                  <View style={[styles.starterChip, { backgroundColor: tc + '20' }]}>
                    <Text style={[styles.starterText, { color: tc }]}>Starter</Text>
                  </View>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : activeTab === 'snacks' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Snack schedule</Text>
            <Text style={styles.cardSub}>Sign up to bring snacks for your team</Text>
            <View style={{ marginTop: 14 }}>
              {snackData.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.snackListRow, i < snackData.length - 1 && styles.snackListBorder, item.claimed && { opacity: 0.85 }]}
                  onPress={() => {
                    if (item.claimed) return
                    Alert.alert(
                      'Sign up for snacks',
                      `Sign up to bring snacks on ${item.date}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Confirm',
                          onPress: () => {
                            const updated = [...snackData]
                            updated[i] = { ...item, claimed: true, name: 'You ✓' }
                            setSnackData(updated)
                          },
                        },
                      ]
                    )
                  }}
                  activeOpacity={item.claimed ? 1 : 0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.snackListDate}>{item.date} · {item.type}</Text>
                    <Text style={[styles.snackListName, { color: item.name === 'You ✓' ? '#2E7D32' : item.claimed ? '#1a1a1a' : tc }]}>
                      {item.claimed ? item.name : 'Open — tap to sign up'}
                    </Text>
                  </View>
                  {!item.claimed && <Text style={[styles.snackPlusIcon, { color: tc }]}>+</Text>}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.snackFootnote}>The coach will send a reminder if spots go unfilled</Text>
          </View>
        </ScrollView>
      ) : activeTab === 'polls' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.pollClosesLabel}>Poll closes in 3 days</Text>
            <Text style={styles.pollQuestion}>What should our team cheer be?</Text>
            {pollOptions.map((option, i) => {
              const total = pollOptions.reduce((sum, o) => sum + o.votes, 0)
              const pct = total > 0 ? option.votes / total : 0
              const isVoted = votedOption === i
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.pollRow,
                    isVoted && { borderLeftWidth: 3, borderLeftColor: tc, backgroundColor: '#EEF4FF', borderRadius: 10, paddingLeft: 10 },
                  ]}
                  onPress={() => {
                    if (votedOption === i) return
                    setPollOptions(prev => prev.map((o, idx) => {
                      if (idx === i) return { ...o, votes: o.votes + 1 }
                      if (idx === votedOption) return { ...o, votes: Math.max(0, o.votes - 1) }
                      return o
                    }))
                    setVotedOption(i)
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.pollLabelRow}>
                    <Text style={[styles.pollOptionLabel, { fontWeight: isVoted ? '700' : '500', color: isVoted ? tc : '#1a1a1a' }]}>
                      {option.label}
                    </Text>
                    <Text style={styles.pollVoteCount}>{option.votes}</Text>
                  </View>
                  <View style={styles.pollBarBg}>
                    <View style={[styles.pollBarFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: isVoted ? tc : tc + '40' }]} />
                  </View>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity style={[styles.newPollBtn, { borderColor: tc }]}>
              <Text style={[styles.newPollBtnText, { color: tc }]}>Create new poll +</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'standings' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>League standings</Text>
            {/* Header row */}
            <View style={styles.standingsHeaderRow}>
              <Text style={[styles.standingsCell, { flex: 1 }]}>Team</Text>
              <Text style={styles.standingsColHdr}>W</Text>
              <Text style={styles.standingsColHdr}>L</Text>
              <Text style={styles.standingsColHdr}>D</Text>
              <Text style={[styles.standingsColHdr, { color: tc }]}>Pts</Text>
            </View>
            {STANDINGS.map((row, i) => (
              <View key={i} style={[styles.standingsRow, row.isUs && styles.standingsRowUs, i < STANDINGS.length - 1 && styles.standingsBorder]}>
                <Text style={[styles.standingsTeamName, row.isUs && { fontWeight: '800', color: tc }]} numberOfLines={1}>{row.team}</Text>
                <Text style={styles.standingsVal}>{row.w}</Text>
                <Text style={styles.standingsVal}>{row.l}</Text>
                <Text style={styles.standingsVal}>{row.d}</Text>
                <Text style={[styles.standingsVal, { fontWeight: '800', color: tc }]}>{row.pts}</Text>
              </View>
            ))}
          </View>

          {/* Season stats 2x2 grid */}
          <Text style={[styles.cardLabel, { marginBottom: 8, marginLeft: 2 }]}>Season stats</Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'Goals scored', value: '12' },
              { label: 'Goals against', value: '6' },
              { label: 'Clean sheets', value: '2' },
              { label: 'Win rate', value: '67%' },
            ].map((stat, i) => (
              <View key={i} style={styles.statBox}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        /* Games tab — game day content */
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {nextGame && (
            <View style={[
              styles.gameCard,
              { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderLeftWidth: 4, borderLeftColor: '#1A56DB' },
              lineupGenerated && { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
            ]}>
              <Text style={[styles.gameCardLabel, { color: '#1A56DB' }]}>NEXT GAME</Text>
              <Text style={[styles.gameCardTitle, { color: '#111827' }]}>vs {nextGame.opponent}</Text>
              <Text style={[styles.gameCardSub, { color: '#6B7280' }]}>
                {new Date(nextGame.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
            </View>
          )}
          {nextGame && lineupGenerated && (
            <View style={{ height: 1, backgroundColor: '#E5E7EB' }} />
          )}

          {!lineupGenerated ? (
            <View style={styles.card}>
              <View style={styles.aiHeader}>
                <View style={[styles.aiIcon, { backgroundColor: '#F3F4F6' }]}>
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
              <View style={[
                styles.timerCard,
                { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderLeftWidth: 4, borderLeftColor: '#1A56DB' },
                nextGame && { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
              ]}>
                <View style={styles.timerRow}>
                  <View>
                    <Text style={[styles.timerLabel, { color: '#6B7280' }]}>Half {period}</Text>
                    <Text style={[styles.timerTime, { color: '#111827' }]}>{formatTime(gameTime)}</Text>
                  </View>
                  <View style={styles.timerActions}>
                    <TouchableOpacity style={[styles.timerBtn, { backgroundColor: gameRunning ? '#E24B4A' : '#F3F4F6', borderRadius: 10 }]} onPress={toggleTimer}>
                      <Text style={[styles.timerBtnText, { color: gameRunning ? '#fff' : '#111827', fontWeight: '600' }]}>{gameRunning ? 'Pause' : 'Start'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.timerBtnOutline, { backgroundColor: '#F3F4F6', borderRadius: 10 }]} onPress={() => setPeriod(p => p === 1 ? 2 : 1)}>
                      <Text style={[styles.timerBtnOutlineText, { color: '#111827', fontWeight: '600' }]}>2nd half →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.timerBtnOutline, { backgroundColor: '#F3F4F6', borderRadius: 10 }]} onPress={resetGame}>
                      <Text style={[styles.timerBtnOutlineText, { color: '#111827', fontWeight: '600' }]}>Reset</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.viewToggle}>
                  <TouchableOpacity onPress={() => setViewMode('field')} style={[styles.viewToggleBtn, viewMode === 'field' ? { backgroundColor: '#1A56DB' } : { backgroundColor: '#F3F4F6' }]}>
                    <Text style={[styles.viewToggleText, { color: viewMode === 'field' ? '#fff' : '#6B7280', fontWeight: viewMode === 'field' ? '700' : '500' }]}>Field</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setViewMode('list')} style={[styles.viewToggleBtn, viewMode === 'list' ? { backgroundColor: '#1A56DB' } : { backgroundColor: '#F3F4F6' }]}>
                    <Text style={[styles.viewToggleText, { color: viewMode === 'list' ? '#fff' : '#6B7280', fontWeight: viewMode === 'list' ? '700' : '500' }]}>Roster</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {viewMode === 'field' ? (
                <View style={styles.fieldContainer}>
                  {selectedPlayer && (
                    <Text style={styles.fieldHint}>Tap another player to swap · tap same to deselect</Text>
                  )}
                  <View style={styles.field}>
                    <View style={styles.fieldCenterCircle} />
                    <View style={styles.fieldCenterLine} />
                    <View style={styles.fieldPenaltyTop} />
                    <View style={styles.fieldPenaltyBottom} />

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
                              backgroundColor: isSelected ? '#FFD700' : '#fff',
                              borderColor: isBehind ? '#E24B4A' : 'rgba(255,255,255,0.6)',
                              borderWidth: isBehind ? 2.5 : 1.5,
                            }
                          ]}
                          onPress={() => handlePlayerTap(player.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.fieldPlayerNum, { color: '#1C1C1E' }]}>{player.number ?? '?'}</Text>
                          <Text style={[styles.fieldPlayerName, { color: 'rgba(28,28,30,0.8)' }]} numberOfLines={1}>{player.name.split(' ')[0]}</Text>
                          <Text style={[styles.fieldPlayerMins, { color: 'rgba(28,28,30,0.6)' }]}>{formatMins(player.minutes)}</Text>
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
                              <View style={[styles.benchPlayerNum, { backgroundColor: '#f0f0f0' }]}>
                                <Text style={[styles.benchPlayerNumText, { color: '#1C1C1E' }]}>{player.number ?? '?'}</Text>
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

              {/* Substitution plan — Equal time rotator */}
              {(() => {
                const on = players.filter(p => p.isOn).sort((a,b)=>(a.fieldSlot??99)-(b.fieldSlot??99))
                const bench = players.filter(p => !p.isOn)
                if (bench.length === 0) return null

                const gk  = on.find(p => p.fieldSlot === 0)
                const def = on.find(p => [1,2,3].includes(p.fieldSlot??-1))
                const mf  = on.find(p => p.fieldSlot === 4)
                const fwd = on.find(p => [5,6].includes(p.fieldSlot??-1))

                type Sub = { minute:number; onName:string; onId:string; offName:string; offId:string }
                const tl: Sub[] = []
                let bi = 0
                if (mf  && bench[bi]) { tl.push({minute:15,onName:bench[bi].name,onId:bench[bi].id,offName:mf.name,offId:mf.id}); bi++ }
                if (def && bench[bi]) { tl.push({minute:20,onName:bench[bi].name,onId:bench[bi].id,offName:def.name,offId:def.id}); bi++ }
                if (fwd && bench[bi]) { tl.push({minute:25,onName:bench[bi].name,onId:bench[bi].id,offName:fwd.name,offId:fwd.id}); bi++ }
                if (gk  && bench[bi]) { tl.push({minute:30,onName:bench[bi].name,onId:bench[bi].id,offName:gk.name,offId:gk.id}); bi++ }
                const first = [...tl]
                if (first[0]) tl.push({minute:35,onName:first[0].offName,onId:first[0].offId,offName:first[0].onName,offId:first[0].onId})
                if (first[1]) tl.push({minute:40,onName:first[1].offName,onId:first[1].offId,offName:first[1].onName,offId:first[1].onId})
                if (first[2]) tl.push({minute:45,onName:first[2].offName,onId:first[2].offId,offName:first[2].onName,offId:first[2].onId})
                tl.sort((a,b) => a.minute - b.minute)

                // Projected minutes per player
                const proj: Record<string,number> = {}
                players.forEach(p => { proj[p.id] = 0 })
                const field = new Set(on.map(p => p.id))
                let prev = 0
                for (const evt of tl) {
                  field.forEach(id => { proj[id] = (proj[id]??0) + (evt.minute - prev) })
                  prev = evt.minute
                  field.delete(evt.offId)
                  field.add(evt.onId)
                }
                field.forEach(id => { proj[id] = (proj[id]??0) + (60 - prev) })

                return (
                  <View style={styles.subPlanCard}>
                    <Text style={styles.subPlanTitle}>Sub plan · Equal time</Text>
                    {tl.map((evt, i) => (
                      <View key={i} style={[styles.subPlanRow, i < tl.length - 1 && styles.subPlanBorder]}>
                        <Text style={styles.subPlanTime}>{evt.minute}'</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subPlanIn}>↑ {evt.onName}</Text>
                          <Text style={styles.subPlanOut}>↓ {evt.offName}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={styles.projMinsRow}>
                      {players.map(p => (
                        <View key={p.id} style={styles.projMinsChip}>
                          <Text style={styles.projMinsChipText}>{p.name.split(' ')[0]} {proj[p.id]??0}m</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )
              })()}

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
  subTabsScroll: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee', maxHeight: 46 },
  subTabsContent: { flexDirection: 'row' },
  subTab: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  subTabText: { fontSize: 13 },
  content: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: '#aaa' },
  monthHeader: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  scheduleRowAlt: { backgroundColor: '#FAFAFA' },
  scheduleBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  scheduleDateCol: { width: 32, alignItems: 'center' },
  scheduleDay: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  scheduleDOW: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },
  scheduleType: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  scheduleTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  scheduleTime: { fontSize: 12, fontWeight: '600', color: '#555' },
  scheduleLoc: { fontSize: 11, color: '#aaa', maxWidth: 90 },
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
  gameCardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  gameCardTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 2 },
  gameCardSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
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
  timerLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerTime: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  timerActions: { flexDirection: 'row', gap: 8 },
  timerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  timerBtnText: { fontSize: 13, fontWeight: '600' },
  timerBtnOutline: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  timerBtnOutlineText: { fontSize: 13, fontWeight: '600' },
  viewToggle: { flexDirection: 'row', gap: 8 },
  viewToggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  viewToggleText: { fontSize: 13, fontWeight: '600' },
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
  fieldPlayerMins: { fontSize: 8 },
  benchArea: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: '#eee' },
  benchLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  benchPlayer: { alignItems: 'center', width: 64, borderRadius: 10, padding: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
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
  snackListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  snackListBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  snackListDate: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 2 },
  snackListName: { fontSize: 14, fontWeight: '600' },
  snackWarning: { fontSize: 11, color: '#FF8C42', fontWeight: '600', marginTop: 2 },
  snackPlusIcon: { fontSize: 20, fontWeight: '300', marginLeft: 8 },
  snackFootnote: { fontSize: 11, color: '#aaa', marginTop: 14, fontStyle: 'italic', textAlign: 'center' },
  pollClosesLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pollQuestion: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 14 },
  pollRow: { marginBottom: 12, paddingVertical: 4 },
  pollLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pollOptionLabel: { fontSize: 14 },
  pollVoteCount: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  pollBarBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  pollBarFill: { height: 6, borderRadius: 3 },
  newPollBtn: { borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1.5, marginTop: 8 },
  newPollBtnText: { fontSize: 13, fontWeight: '700' },
  subPlanCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: '#E5E7EB' },
  subPlanTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 10 },
  subPlanRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
  subPlanBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  subPlanTime: { fontSize: 12, fontWeight: '700', color: '#6B7280', minWidth: 32, marginTop: 1 },
  subPlanIn:  { fontSize: 13, fontWeight: '600', color: '#16A34A' },
  subPlanOut: { fontSize: 13, fontWeight: '600', color: '#DC2626', marginTop: 1 },
  projMinsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  projMinsChip: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  projMinsChipText: { fontSize: 11, fontWeight: '600', color: '#555' },
  // Standings
  standingsHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 2 },
  standingsColHdr: { fontSize: 11, fontWeight: '700', color: '#aaa', width: 30, textAlign: 'center' },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  standingsRowUs: { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 6, marginHorizontal: -6 },
  standingsBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  standingsTeamName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  standingsCell: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  standingsVal: { width: 30, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#555' },
  // Season stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flex: 1, minWidth: '45%', borderWidth: 0.5, borderColor: '#eee', alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '900', color: '#1A56DB', marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#888', textAlign: 'center' },
})
