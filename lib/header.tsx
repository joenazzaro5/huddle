import { useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { useRole } from './roleStore.tsx'

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
  const { currentRole, setRole } = useRole()
  const isParent = currentRole === 'parent'
  const fadeAnim = useRef(new Animated.Value(1)).current
  const router = useRouter()

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

  const switchRoleWithAnimation = (newRole: 'coach' | 'parent') => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      try {
        setRole(newRole)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start()
        router.replace(newRole === 'parent' ? '/parent-home' : '/home')
      } catch {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start()
      }
    })
  }

  const handleRolePress = () => {
    if (isParent) {
      Alert.alert('Switch role', 'You are viewing as Parent.', [
        {
          text: 'Switch to Coach view',
          onPress: () => switchRoleWithAnimation('coach'),
        },
        { text: 'Stay as Parent', style: 'cancel' },
      ])
    } else {
      Alert.alert('Switch role', 'You are viewing as Coach.', [
        {
          text: 'Switch to Parent view',
          onPress: () => switchRoleWithAnimation('parent'),
        },
        { text: 'Stay as Coach', style: 'cancel' },
      ])
    }
  }

  const chipBg = isParent ? '#F0FDF4' : teamColor + '20'
  const chipText = isParent ? '#059669' : teamColor
  const chipLabel = isParent ? 'Parent' : 'Coach'

  return (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <TouchableOpacity style={styles.left} onPress={handleTeamPress} disabled={!onTeamPress && !hasMultiple}>
        <View style={[styles.dot, { backgroundColor: teamColor }]} />
        <View>
          <Text style={styles.teamName} numberOfLines={1}>{teamName ?? 'My Team'}</Text>
          {(showTeamSwitch || hasMultiple) && <Text style={styles.switch}>Switch ↓</Text>}
        </View>
      </TouchableOpacity>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.ball}>⚽</Text>
        <Text style={[styles.wordmark, { color: '#1A56DB' }]}>Huddle</Text>
        <Text style={styles.ball}>⚽</Text>
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          style={[styles.roleChip, { backgroundColor: chipBg }, isParent && { borderWidth: 1, borderColor: '#059669' }]}
          onPress={handleRolePress}
        >
          <Text style={[styles.roleText, { color: chipText }]}>{chipLabel}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
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
  right: { flex: 1, alignItems: 'flex-end', zIndex: 10 },
  roleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700' },
})
