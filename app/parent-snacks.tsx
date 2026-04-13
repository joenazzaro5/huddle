import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AppHeader } from '../lib/header'

const tc = '#1A56DB'

const SNACK_SCHEDULE = [
  { id: '1', date: 'Apr 19', eventType: 'Game',     claimedBy: 'Jordan F.' },
  { id: '2', date: 'Apr 26', eventType: 'Practice', claimedBy: null },
  { id: '3', date: 'May 3',  eventType: 'Game',     claimedBy: null },
  { id: '4', date: 'May 10', eventType: 'Practice', claimedBy: 'Alex M.' },
  { id: '5', date: 'May 17', eventType: 'Game',     claimedBy: null },
  { id: '6', date: 'May 24', eventType: 'Practice', claimedBy: null },
]

export default function ParentSnacksScreen() {
  const router = useRouter()
  const [claimed, setClaimed] = useState<Record<string, boolean>>({})

  const handleClaim = (id: string, date: string) => {
    setClaimed(prev => ({ ...prev, [id]: true }))
    Alert.alert('Claimed! 🍊', `You signed up for snacks on ${date}. The team will be notified!`)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName="Marin Cheetahs" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Fun header */}
        <View style={styles.funHeader}>
          <Text style={styles.funEmoji}>🍊</Text>
          <Text style={styles.funTitle}>Snack duty</Text>
          <Text style={styles.funSub}>Who's bringing the goods?</Text>
        </View>

        {/* Snack list */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Snack schedule</Text>
          {SNACK_SCHEDULE.map((item, i) => {
            const isClaimed = !!item.claimedBy || claimed[item.id]
            const claimedName = item.claimedBy ?? (claimed[item.id] ? 'You' : null)
            return (
              <View key={item.id} style={[styles.snackRow, i < SNACK_SCHEDULE.length - 1 && styles.snackBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.snackDate}>{item.date} · {item.eventType}</Text>
                  <Text style={[styles.snackStatus, { color: isClaimed ? '#059669' : '#aaa' }]}>
                    {isClaimed ? `✓ ${claimedName}` : 'Nobody signed up yet'}
                  </Text>
                </View>
                {!isClaimed && (
                  <TouchableOpacity
                    style={styles.claimBtn}
                    onPress={() => handleClaim(item.id, item.date)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.claimBtnText}>Claim it!</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Remember: orange slices > juice boxes 🍊</Text>
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
  funHeader: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#FDE68A' },
  funEmoji: { fontSize: 40, marginBottom: 6 },
  funTitle: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', letterSpacing: -0.5, marginBottom: 4 },
  funSub: { fontSize: 14, fontWeight: '600', color: '#888' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  snackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  snackBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  snackDate: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  snackStatus: { fontSize: 12, fontWeight: '500' },
  claimBtn: { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  claimBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  footer: { backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#FDE68A', marginBottom: 8 },
  footerText: { fontSize: 14, fontWeight: '700', color: '#D97706', textAlign: 'center' },
})
