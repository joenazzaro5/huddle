import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'

const tc = '#1A56DB'

const POSITION_COLORS: Record<string, string> = {
  GK: '#F59E0B',
  Defender: '#1A56DB',
  Midfielder: '#10B981',
  Forward: '#FF6B35',
}

const PLAYERS = [
  { number: 1, name: 'Sofia',     position: 'GK' },
  { number: 2, name: 'Emma',      position: 'Defender' },
  { number: 3, name: 'Olivia',    position: 'Midfielder' },
  { number: 4, name: 'Mia',       position: 'Forward' },
  { number: 5, name: 'Ava',       position: 'Midfielder' },
  { number: 6, name: 'Isabella',  position: 'Defender' },
  { number: 7, name: 'Charlotte', position: 'Forward' },
]

export default function ParentRosterScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName="Marin Cheetahs" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={[styles.recordBanner, { backgroundColor: tc }]}>
          <Text style={styles.recordLabel}>Season Record 🏆</Text>
          <Text style={styles.recordValue}>4W 1L 1D</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Roster</Text>
          {PLAYERS.map((player, i) => {
            const posColor = POSITION_COLORS[player.position] ?? '#888'
            return (
              <View key={player.number} style={[styles.playerRow, i < PLAYERS.length - 1 && styles.playerBorder]}>
                <View style={[styles.numberBadge, { backgroundColor: tc + '18' }]}>
                  <Text style={[styles.numberText, { color: tc }]}>{player.number}</Text>
                </View>
                <Text style={styles.playerName}>
                  {player.name}{i === 0 ? '  ⭐' : ''}
                </Text>
                <View style={[styles.positionBadge, { backgroundColor: posColor + '20' }]}>
                  <Text style={[styles.positionText, { color: posColor }]}>{player.position}</Text>
                </View>
              </View>
            )
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  content: { padding: 14 },
  backRow: { marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: '700', color: tc },
  recordBanner: { borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center' },
  recordLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  recordValue: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  playerBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  numberBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontWeight: '800' },
  playerName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  positionBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  positionText: { fontSize: 12, fontWeight: '700' },
})
