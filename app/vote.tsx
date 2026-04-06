import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '../lib/header'

const INITIAL_OPTIONS = [
  { id: '1', label: "Let's go Cheetahs!", votes: 12 },
  { id: '2', label: 'Cheetahs on three!', votes: 8 },
  { id: '3', label: 'We are the Cheetahs!', votes: 5 },
]

export default function VoteScreen() {
  const [options, setOptions] = useState(INITIAL_OPTIONS)
  const [votedId, setVotedId] = useState<string | null>(null)

  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0)

  const castVote = (id: string) => {
    if (votedId === id) return
    setOptions(prev => prev.map(o => ({
      ...o,
      votes: o.id === id ? o.votes + 1 : (votedId === o.id ? o.votes - 1 : o.votes),
    })))
    setVotedId(id)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor="#1A56DB" teamName="Team Vote" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Active poll</Text>
          <Text style={styles.pollQuestion}>What should our team cheer be?</Text>
          <Text style={styles.pollMeta}>{totalVotes} votes</Text>

          {options.map(option => {
            const pct = totalVotes > 0 ? option.votes / totalVotes : 0
            const isVoted = votedId === option.id
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionCard, isVoted && styles.optionCardVoted]}
                onPress={() => castVote(option.id)}
                activeOpacity={0.8}
              >
                <View style={styles.optionTop}>
                  <Text style={[styles.optionLabel, isVoted && styles.optionLabelVoted]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionPct, isVoted && styles.optionPctVoted]}>
                    {Math.round(pct * 100)}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: isVoted ? '#1A56DB' : '#1A56DB60' }]} />
                </View>
                <Text style={styles.optionCount}>{option.votes} vote{option.votes !== 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity style={styles.newPollBtn}>
          <Text style={styles.newPollText}>+ Create new poll</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  content: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6 },
  pollQuestion: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  pollMeta: { fontSize: 12, color: '#888', marginBottom: 16 },
  optionCard: { borderRadius: 12, borderWidth: 1.5, borderColor: '#eee', padding: 12, marginBottom: 10 },
  optionCardVoted: { borderColor: '#1A56DB', backgroundColor: '#1A56DB08' },
  optionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  optionLabelVoted: { color: '#1A56DB', fontWeight: '700' },
  optionPct: { fontSize: 14, fontWeight: '700', color: '#888' },
  optionPctVoted: { color: '#1A56DB' },
  barTrack: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  optionCount: { fontSize: 11, color: '#aaa' },
  newPollBtn: { backgroundColor: '#1A56DB', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  newPollText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
