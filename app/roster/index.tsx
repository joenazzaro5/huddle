import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

export default function RosterScreen() {
  const [team, setTeam] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
      const { data: playerData } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', membership.team.id)
        .eq('is_active', true)
        .order('number', { ascending: true })
      setPlayers(playerData ?? [])
    }
    setLoading(false)
  }

  const teamColor = team?.color ?? '#1D9E75'

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={teamColor} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.wordmark, { color: teamColor }]}>Cue</Text>
        <Text style={styles.headerTitle}>Team</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={[styles.teamCard, { backgroundColor: teamColor }]}>
          <Text style={styles.teamName}>{team?.name}</Text>
          <Text style={styles.teamSub}>{team?.age_group} · {team?.gender} · {players.length} players</Text>
          <Text style={styles.teamCode}>Invite code: {team?.invite_code}</Text>
        </View>

        {players.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No players yet</Text>
            <Text style={styles.emptySub}>Players are added by your league administrator</Text>
          </View>
        ) : (
          <View style={styles.playerList}>
            <Text style={styles.listLabel}>Players · {players.length}</Text>
            {players.map((player, i) => (
              <View
                key={player.id}
                style={[styles.playerRow, i < players.length - 1 && styles.playerBorder]}
              >
                <View style={[styles.numberBadge, { backgroundColor: teamColor + '20' }]}>
                  <Text style={[styles.numberText, { color: teamColor }]}>
                    {player.number ?? '—'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  {player.positions?.length > 0 && (
                    <Text style={styles.playerPos}>{player.positions.join(', ')}</Text>
                  )}
                </View>
                {player.is_starter && (
                  <View style={[styles.starterBadge, { backgroundColor: teamColor + '20' }]}>
                    <Text style={[styles.starterText, { color: teamColor }]}>Starter</Text>
                  </View>
                )}
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
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 20 },
  teamCard: { borderRadius: 20, padding: 20, marginBottom: 14 },
  teamName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  teamSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  teamCode: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888', textAlign: 'center' },
  playerList: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 0.5, borderColor: '#eee' },
  listLabel: { fontSize: 11, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  playerBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  numberBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '800' },
  playerName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  playerPos: { fontSize: 12, color: '#888', marginTop: 2 },
  starterBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  starterText: { fontSize: 11, fontWeight: '700' },
})
