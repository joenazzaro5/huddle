import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { AppHeader } from '../lib/header'

const ALL_POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Winger', 'Striker', 'Sweeper']

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [player, setPlayer] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [positions, setPositions] = useState<string[]>([])
  const [isStarter, setIsStarter] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => { loadData() }, [id])

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
    if (membership?.team) setTeam(membership.team)

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single()

    if (playerData) {
      setPlayer(playerData)
      setName(playerData.name)
      setNumber(playerData.number?.toString() ?? '')
      setPositions(playerData.positions ?? [])
      setIsStarter(playerData.is_starter ?? false)
      setNotes(playerData.notes ?? '')
    }
    setLoading(false)
  }

  const togglePosition = (pos: string) => {
    setPositions(prev =>
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    )
  }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)

    const { error } = await supabase
      .from('players')
      .update({
        name: name.trim(),
        number: number ? parseInt(number) : null,
        positions,
        is_starter: isStarter,
        notes: notes.trim(),
      })
      .eq('id', id)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      router.back()
    }
    setSaving(false)
  }

  const tc = team?.color ?? '#1D9E75'

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#1D9E75" size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName={team?.name} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/games')}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Player details</Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color={tc} size="small" />
            : <Text style={[styles.saveBtn, { color: tc }]}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Avatar */}
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: tc }]}>
            <Text style={styles.avatarNum}>{number || '?'}</Text>
          </View>
          <View>
            <Text style={styles.avatarName}>{name}</Text>
            <View style={[styles.starterBadge, { backgroundColor: isStarter ? tc + '20' : '#f0f0f0' }]}>
              <Text style={[styles.starterText, { color: isStarter ? tc : '#aaa' }]}>
                {isStarter ? 'Starter' : 'Sub'}
              </Text>
            </View>
          </View>
        </View>

        {/* Basic info */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Basic info</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Player name"
              placeholderTextColor="#bbb"
            />
          </View>
          <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.fieldLabel}>Jersey #</Text>
            <TextInput
              style={styles.fieldInput}
              value={number}
              onChangeText={setNumber}
              placeholder="e.g. 7"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Starter toggle */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isStarter && { backgroundColor: tc, borderColor: tc }]}
              onPress={() => setIsStarter(true)}
            >
              <Text style={[styles.toggleText, isStarter && { color: '#fff' }]}>Starter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isStarter && { backgroundColor: tc, borderColor: tc }]}
              onPress={() => setIsStarter(false)}
            >
              <Text style={[styles.toggleText, !isStarter && { color: '#fff' }]}>Sub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Positions */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Positions · tap to select</Text>
          <View style={styles.posGrid}>
            {ALL_POSITIONS.map(pos => {
              const selected = positions.includes(pos)
              return (
                <TouchableOpacity
                  key={pos}
                  style={[styles.posChip, selected && { backgroundColor: tc, borderColor: tc }]}
                  onPress={() => togglePosition(pos)}
                >
                  <Text style={[styles.posChipText, selected && { color: '#fff' }]}>{pos}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Coach notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Strong left foot, works well as a winger..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={3}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  back: { fontSize: 14, color: '#888', fontWeight: '500' },
  topBarTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  content: { padding: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarNum: { fontSize: 24, fontWeight: '900', color: '#fff' },
  avatarName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  starterBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  starterText: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  fieldLabel: { fontSize: 14, color: '#888', width: 80 },
  fieldInput: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#ddd' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  posGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  posChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff' },
  posChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  notesInput: { fontSize: 14, color: '#1a1a1a', lineHeight: 22, minHeight: 80, textAlignVertical: 'top' },
})
