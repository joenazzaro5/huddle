import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'

export default function RosterScreen() {
  const [team, setTeam] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [saving, setSaving] = useState(false)

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

  const addPlayer = async () => {
    if (!newName.trim() || !team) return
    setSaving(true)

    const { data, error } = await supabase
      .from('players')
      .insert({
        team_id: team.id,
        name: newName.trim(),
        number: newNumber ? parseInt(newNumber) : null,
        positions: [],
        is_starter: false,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setPlayers(prev => [...prev, data].sort((a, b) => (a.number ?? 99) - (b.number ?? 99)))
      setNewName('')
      setNewNumber('')
      setShowAddForm(false)
    }
    setSaving(false)
  }

  const removePlayer = async (playerId: string) => {
    Alert.alert('Remove player', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('players').update({ is_active: false }).eq('id', playerId)
          setPlayers(prev => prev.filter(p => p.id !== playerId))
        }
      }
    ])
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
        <Text style={styles.headerTitle}>Roster</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Team info */}
        <View style={[styles.teamCard, { backgroundColor: teamColor }]}>
          <Text style={styles.teamName}>{team?.name}</Text>
          <Text style={styles.teamSub}>{team?.age_group} · {team?.gender} · {players.length} players</Text>
          <Text style={styles.teamCode}>Invite code: {team?.invite_code}</Text>
        </View>

        {/* Add player button */}
        {!showAddForm && (
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: teamColor }]}
            onPress={() => setShowAddForm(true)}
          >
            <Text style={[styles.addBtnText, { color: teamColor }]}>+ Add player</Text>
          </TouchableOpacity>
        )}

        {/* Add player form */}
        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>New player</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Player name"
              placeholderTextColor="#bbb"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TextInput
              style={styles.formInput}
              placeholder="Jersey number (optional)"
              placeholderTextColor="#bbb"
              value={newNumber}
              onChangeText={setNewNumber}
              keyboardType="number-pad"
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: teamColor }]}
                onPress={addPlayer}
                disabled={saving || !newName.trim()}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Add to roster</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowAddForm(false); setNewName(''); setNewNumber('') }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Player list */}
        {players.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No players yet</Text>
            <Text style={styles.emptySub}>Tap "Add player" to build your roster</Text>
          </View>
        ) : (
          <View style={styles.playerList}>
            <Text style={styles.listLabel}>Players · {players.length}</Text>
            {players.map((player, i) => (
              <TouchableOpacity
                key={player.id}
                style={[styles.playerRow, i < players.length - 1 && styles.playerBorder]}
                onLongPress={() => removePlayer(player.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.numberBadge, { backgroundColor: teamColor + '20' }]}>
                  <Text style={[styles.numberText, { color: teamColor }]}>
                    {player.number ?? '—'}
                  </Text>
                </View>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerHint}>hold to remove</Text>
              </TouchableOpacity>
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
  addBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, marginBottom: 14, backgroundColor: '#fff' },
  addBtnText: { fontSize: 15, fontWeight: '700' },
  addForm: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  formInput: { backgroundColor: '#F7F7F5', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  formButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#F0F0EE' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#888' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#888' },
  playerList: { backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 0.5, borderColor: '#eee' },
  listLabel: { fontSize: 11, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  playerBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  numberBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '800' },
  playerName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  playerHint: { fontSize: 11, color: '#ccc' },
})
