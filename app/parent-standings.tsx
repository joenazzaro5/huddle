import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'

const tc = '#1A56DB'

const STANDINGS = [
  { team: 'Marin Cheetahs', w: 4, l: 1, d: 1, pts: 13, isUs: true },
  { team: 'Tiburon FC',     w: 3, l: 2, d: 1, pts: 10 },
  { team: 'Mill Valley SC', w: 3, l: 2, d: 0, pts: 9  },
  { team: 'Novato United',  w: 2, l: 2, d: 2, pts: 8  },
  { team: 'San Anselmo FC', w: 1, l: 4, d: 1, pts: 4  },
  { team: 'Fairfax FC',     w: 0, l: 5, d: 1, pts: 1  },
]

const SEASON_STATS = [
  { label: 'Goals',        value: '12' },
  { label: 'Against',      value: '6'  },
  { label: 'Clean sheets', value: '2'  },
  { label: 'Win rate',     value: '67%'},
]

const RECENT = ['W', 'W', 'L', 'W', 'W']

export default function ParentStandingsScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName="Marin Cheetahs" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Standings table */}
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={styles.cardHeaderYellow}>
            <Text style={styles.cardLabel}>Division standings 🏆</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHdrCell, { flex: 1, textAlign: 'left' }]}>Team</Text>
              <Text style={styles.tableHdrCell}>W</Text>
              <Text style={styles.tableHdrCell}>L</Text>
              <Text style={styles.tableHdrCell}>D</Text>
              <Text style={[styles.tableHdrCell, { color: tc }]}>Pts</Text>
            </View>
            {STANDINGS.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.tableRow,
                  row.isUs && styles.usRow,
                  i < STANDINGS.length - 1 && !row.isUs && styles.rowBorder,
                ]}
              >
                <Text style={[styles.teamName, row.isUs && styles.usTeamName]} numberOfLines={1}>
                  {row.isUs ? '⭐ ' : ''}{row.team}
                </Text>
                <Text style={[styles.tableVal, row.isUs && styles.usVal]}>{row.w}</Text>
                <Text style={[styles.tableVal, row.isUs && styles.usVal]}>{row.l}</Text>
                <Text style={[styles.tableVal, row.isUs && styles.usVal]}>{row.d}</Text>
                <Text style={[styles.tableVal, row.isUs && { fontWeight: '800', color: tc }]}>{row.pts}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Season stats */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Season stats</Text>
          <View style={styles.statsGrid}>
            {SEASON_STATS.map((stat) => (
              <View key={stat.label} style={styles.statBox}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent results */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recent results</Text>
          <View style={styles.resultsRow}>
            {RECENT.map((result, i) => (
              <View
                key={i}
                style={[
                  styles.resultDot,
                  { backgroundColor: result === 'W' ? '#10B981' : result === 'L' ? '#EF4444' : '#F59E0B' },
                ]}
              >
                <Text style={styles.resultText}>{result}</Text>
              </View>
            ))}
          </View>
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
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardHeaderYellow: { backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 0 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 4 },
  tableHdrCell: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#aaa' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  usRow: { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 6, marginHorizontal: -6 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  teamName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  usTeamName: { fontWeight: '800', color: tc },
  tableVal: { width: 36, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#444' },
  usVal: { fontWeight: '700', color: tc },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#F7F7F5', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', color: '#1a1a1a', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  resultsRow: { flexDirection: 'row', gap: 8 },
  resultDot: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resultText: { fontSize: 14, fontWeight: '800', color: '#fff' },
})
