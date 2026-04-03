import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function PracticeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Cue</Text>
        <Text style={styles.title}>Practice</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.emoji}>📋</Text>
        <Text style={styles.heading}>Practice Planner</Text>
        <Text style={styles.sub}>Full drill library and plan management coming soon</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: '#1D9E75' },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emoji: { fontSize: 48, marginBottom: 16 },
  heading: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
})
