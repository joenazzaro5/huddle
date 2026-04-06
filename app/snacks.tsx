import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '../lib/header'

const SNACK_DATA = [
  { id: '1', date: 'Sat, Apr 12', event: 'Practice', parent: 'Sarah M' },
  { id: '2', date: 'Tue, Apr 15', event: 'Game', parent: 'Tom K' },
  { id: '3', date: 'Sat, Apr 19', event: 'Practice', parent: 'Lisa R' },
  { id: '4', date: 'Tue, Apr 22', event: 'Game', parent: 'Coach Joe' },
]

export default function SnacksScreen() {
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())

  const toggleConfirm = (id: string) => {
    setConfirmed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor="#1A56DB" teamName="Snack Schedule" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>Tap a row to mark as confirmed.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Upcoming snack duties</Text>
          {SNACK_DATA.map((item, i) => {
            const isConfirmed = confirmed.has(item.id)
            const isGame = item.event === 'Game'
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.row,
                  i < SNACK_DATA.length - 1 && styles.rowBorder,
                  isConfirmed && styles.rowConfirmed,
                ]}
                onPress={() => toggleConfirm(item.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.eventBadge, { backgroundColor: isGame ? '#FF6B3520' : '#1A56DB20' }]}>
                  <Text style={[styles.eventBadgeText, { color: isGame ? '#FF6B35' : '#1A56DB' }]}>
                    {item.event}
                  </Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowDate}>{item.date}</Text>
                  <Text style={styles.rowParent}>🥤 {item.parent}</Text>
                </View>
                {isConfirmed && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  content: { padding: 16 },
  noteBox: { backgroundColor: '#1A56DB15', borderRadius: 12, padding: 12, marginBottom: 14 },
  noteText: { fontSize: 13, color: '#1A56DB', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  rowConfirmed: { backgroundColor: '#E8F5E9', borderRadius: 10, paddingHorizontal: 8 },
  eventBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  eventBadgeText: { fontSize: 11, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowDate: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  rowParent: { fontSize: 13, color: '#555', marginTop: 2 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '800' },
})
