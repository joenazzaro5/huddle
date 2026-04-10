import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'

type Props = {
  teamColor?: string
  teamName?: string
  onTeamPress?: () => void
  showTeamSwitch?: boolean
  allTeams?: any[]
  onTeamSelect?: (team: any) => void
}

export function AppHeader({ teamColor = '#1A56DB', teamName, onTeamPress, showTeamSwitch, allTeams, onTeamSelect }: Props) {
  const hasMultiple = (allTeams?.length ?? 0) > 1

  const handleTeamPress = () => {
    if (onTeamPress) { onTeamPress(); return }
    if (hasMultiple && onTeamSelect && allTeams) {
      Alert.alert(
        'Switch team',
        undefined,
        [
          ...allTeams.map(m => ({
            text: `${m.team.name} · ${m.team.age_group}`,
            onPress: () => onTeamSelect(m.team),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      )
    }
  }

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.left} onPress={handleTeamPress} disabled={!onTeamPress && !hasMultiple}>
        <View style={[styles.dot, { backgroundColor: teamColor }]} />
        <View>
          <Text style={styles.teamName} numberOfLines={1}>{teamName ?? 'My Team'}</Text>
          {(showTeamSwitch || hasMultiple) && <Text style={styles.switch}>Switch ↓</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.ball}>⚽</Text>
        <Text style={[styles.wordmark, { color: '#1A56DB' }]}>Huddle</Text>
        <Text style={styles.ball}>⚽</Text>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={[styles.roleChip, { backgroundColor: teamColor + '20' }]}
          onPress={() => {
            Alert.alert('Switch role', 'You are viewing as Coach.', [
              {
                text: 'Switch to Parent view',
                onPress: () => Alert.alert('Coming soon', 'Parent view coming soon — stay tuned!'),
              },
              { text: 'Stay as Coach', style: 'cancel' },
            ])
          }}
        >
          <Text style={[styles.roleText, { color: teamColor }]}>Coach</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { height: 50, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  teamName: { fontSize: 12, fontWeight: '700', color: '#1a1a1a', maxWidth: 120 },
  switch: { fontSize: 10, color: '#aaa' },
  center: { position: 'absolute', left: 0, right: 0, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  ball: { fontSize: 12, opacity: 0.4 },
  wordmark: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  right: { flex: 1, alignItems: 'flex-end' },
  roleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700' },
})
