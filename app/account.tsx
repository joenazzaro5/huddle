import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'

export default function AccountScreen() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)

    const { data: profileData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

    const { data: membership } = await supabase
      .from('team_members')
      .select('team:teams(*)')
      .eq('user_id', user.id)
      .eq('role', 'coach')
      .limit(1)
      .single()
    if (membership?.team) setTeam(membership.team)

    setLoading(false)
  }

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/')
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
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: teamColor }]}>
            <Text style={styles.avatarText}>
              {(profile?.display_name ?? user?.email ?? 'C')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile?.display_name ?? 'Coach'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: teamColor + '20' }]}>
            <Text style={[styles.roleText, { color: teamColor }]}>
              {profile?.coach_level ? `${profile.coach_level.charAt(0).toUpperCase() + profile.coach_level.slice(1)} Coach` : 'Coach'}
            </Text>
          </View>
        </View>

        {/* Team info */}
        {team && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Your team</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Team</Text>
              <Text style={styles.infoVal}>{team.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Age group</Text>
              <Text style={styles.infoVal}>{team.age_group}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Gender</Text>
              <Text style={styles.infoVal}>{team.gender}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoKey}>Invite code</Text>
              <Text style={[styles.infoVal, { color: teamColor, fontWeight: '700' }]}>{team.invite_code}</Text>
            </View>
          </View>
        )}

        {/* App info */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>App</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Version</Text>
            <Text style={styles.infoVal}>0.1.0 (dev)</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoKey}>Build</Text>
            <Text style={styles.infoVal}>Expo Go</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

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
  profileCard: { backgroundColor: '#fff', borderRadius: 18, padding: 24, marginBottom: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#eee' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  displayName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  email: { fontSize: 14, color: '#888', marginBottom: 10 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontSize: 13, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  infoKey: { fontSize: 14, color: '#888' },
  infoVal: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
  signOutBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: '#ffcccc' },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#E24B4A' },
})
