import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

type Player = {
  id: string
  name: string
  number: number | null
  isOn: boolean
  minutes: number
  lastSubTime: number | null
}

export default function SubsScreen() {
  const [team, setTeam] = useState<any>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [gameRunning, setGameRunning] = useState(false)
  const [gameTime, setGameTime] = useState(0)
  const [period, setPeriod] = useState(1)
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
        // Start first 7 players on the field
        setPlayers(playerData.map((p, i) => ({
          id: p.id,
          name: p.name,
          number: p.number,
          isOn: i < 7,
          minutes: 0,
          lastSubTime: i < 7 ? 0 : null,
        })))
      }
    }
    setLoading(false)
  }

  const toggleTimer = () => {
    if (gameRunning) {
      clearInterval(timerRef.current)
      setGameRunning(false)
    } else {
      timerRef.current = setInterval(() => {
        setGameTime(t => t + 1)
        setPlayers(prev => prev.map(p => ({
          ...p,
          minutes: p.isOn ? p.minutes + (1/60) : p.minutes
        })))
      }, 1000)
      setGameRunning(true)
    }
  }

  const resetGame = () => {
    Alert.alert('Reset game', 'This will reset all minutes and the timer. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: () => {
          clearInterval(timerRef.current)
          setGameRunning(false)
          setGameTime(0)
          setPeriod(1)
          setPlayers(prev => prev.map((p, i) => ({
            ...p, isOn: i < 7, minutes: 0, lastSubTime: i < 7 ? 0 : null
          })))
        }
      }
    ])
  }

  const subPlayer = (playerId: string) => {
    setPlayers(prev => {
      const player = prev.find(p => p.id === playerId)
      if (!player) return prev

      const onCount = prev.filter(p => p.isOn).length

      if (player.isOn) {
        // Subbing off — need at least 1 player on
        if (onCount <= 1) {
          Alert.alert('Cannot sub off', 'You need at least 1 player on the field.')
          return prev
        }
        return prev.map(p => p.id === playerId
          ? { ...p, isOn: false, lastSubTime: null }
          : p
        )
      } else {
        // Subbing on — max 7 on field for U10
        if (onCount >= 7) {
          Alert.alert('Field full', 'Sub someone off first before adding a player.')
          return prev
        }
        return prev.map(p => p.id === playerId
          ? { ...p, isOn: true, lastSubTime: gameTime }
          : p
        )
      }
    })
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatMins = (mins: number) => {
    if (mins < 1) return '0m'
    return `${Math.floor(mins)}m`
  }

  const onPlayers = players.filter(p => p.isOn)
  const offPlayers = players.filter(p => !p.isOn)
  const tc = team?.color ?? '#1A56DB'
  const totalMins = players.reduce((sum, p) => sum + p.minutes, 0)
  const fairShare = players.length > 0 ? totalMins / players.length : 0

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#1A56DB" size="large" /></View>
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: tc }]}>Huddle</Text>
        <Text style={styles.headerTitle}>Substitutions</Text>
      </View>

      {/* Game timer */}
      <View style={[styles.timerCard, { backgroundColor: tc }]}>
        <View style={styles.timerRow}>
          <View>
            <Text style={styles.timerLabel}>Period {period}</Text>
            <Text style={styles.timerTime}>{formatTime(gameTime)}</Text>
          </View>
          <View style={styles.timerActions}>
            <TouchableOpacity
              style={[styles.timerBtn, { backgroundColor: gameRunning ? '#E24B4A' : '#fff' }]}
              onPress={toggleTimer}
            >
              <Text style={[styles.timerBtnText, { color: gameRunning ? '#fff' : tc }]}>
                {gameRunning ? 'Pause' : 'Start'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timerBtnOutline}
              onPress={() => setPeriod(p => p === 1 ? 2 : 1)}
            >
              <Text style={styles.timerBtnOutlineText}>P{period === 1 ? 2 : 1} →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timerBtnOutline} onPress={resetGame}>
              <Text style={styles.timerBtnOutlineText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.timerSub}>{onPlayers.length} on · {offPlayers.length} on bench · {team?.age_group} · 7v7</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* On the field */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>On the field · {onPlayers.length}</Text>
          {onPlayers.map(player => {
            const isBelowFair = player.minutes < fairShare * 0.7
            return (
              <TouchableOpacity
                key={player.id}
                style={[styles.playerRow, styles.playerOn]}
                onPress={() => subPlayer(player.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.numBadge, { backgroundColor: tc + '20' }]}>
                  <Text style={[styles.numText, { color: tc }]}>{player.number ?? '—'}</Text>
                </View>
                <Text style={styles.playerName}>{player.name}</Text>
                <View style={styles.playerRight}>
                  <Text style={[styles.playerMins, { color: isBelowFair && gameTime > 60 ? '#E24B4A' : '#888' }]}>
                    {formatMins(player.minutes)}
                  </Text>
                  <View style={[styles.subOffBtn, { backgroundColor: '#E24B4A20' }]}>
                    <Text style={styles.subOffText}>Sub off</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Bench */}
        {offPlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bench · {offPlayers.length}</Text>
            {offPlayers.map(player => {
              const isBelowFair = player.minutes < fairShare * 0.7
              return (
                <TouchableOpacity
                  key={player.id}
                  style={[styles.playerRow, styles.playerOff]}
                  onPress={() => subPlayer(player.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.numBadge, { backgroundColor: '#f0f0f0' }]}>
                    <Text style={[styles.numText, { color: '#aaa' }]}>{player.number ?? '—'}</Text>
                  </View>
                  <Text style={[styles.playerName, { color: '#888' }]}>{player.name}</Text>
                  <View style={styles.playerRight}>
                    <Text style={[styles.playerMins, { color: isBelowFair && gameTime > 60 ? '#E24B4A' : '#bbb' }]}>
                      {formatMins(player.minutes)}
                    </Text>
                    <View style={[styles.subOnBtn, { backgroundColor: tc + '20' }]}>
                      <Text style={[styles.subOnText, { color: tc }]}>Sub in</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Equal time indicator */}
        {gameTime > 60 && (
          <View style={styles.fairPlayCard}>
            <Text style={styles.fairPlayTitle}>Equal play time</Text>
            <Text style={styles.fairPlaySub}>Fair share: {formatMins(fairShare)} per player</Text>
            {players.filter(p => p.minutes < fairShare * 0.7).map(p => (
              <Text key={p.id} style={styles.fairPlayAlert}>
                ⚠ {p.name} needs more time ({formatMins(p.minutes)} vs {formatMins(fairShare)} avg)
              </Text>
            ))}
            {players.every(p => p.minutes >= fairShare * 0.7) && (
              <Text style={styles.fairPlayGood}>All players on track</Text>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  timerCard: { padding: 18, marginHorizontal: 0 },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  timerLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  timerTime: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  timerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  timerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  timerBtnText: { fontSize: 14, fontWeight: '700' },
  timerBtnOutline: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  timerBtnOutlineText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  timerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  content: { padding: 16 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6 },
  playerOn: { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#eee' },
  playerOff: { backgroundColor: '#F7F7F5', borderWidth: 0.5, borderColor: '#eee' },
  numBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '800' },
  playerName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  playerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerMins: { fontSize: 13, fontWeight: '600', minWidth: 28, textAlign: 'right' },
  subOffBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  subOffText: { fontSize: 12, fontWeight: '700', color: '#E24B4A' },
  subOnBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  subOnText: { fontSize: 12, fontWeight: '700' },
  fairPlayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#eee' },
  fairPlayTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  fairPlaySub: { fontSize: 13, color: '#888', marginBottom: 8 },
  fairPlayAlert: { fontSize: 13, color: '#E24B4A', marginBottom: 4 },
  fairPlayGood: { fontSize: 13, color: '#1A56DB', fontWeight: '600' },
})
