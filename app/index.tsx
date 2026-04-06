import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Dimensions, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const { width } = Dimensions.get('window')
const BLUE = '#1A56DB'

const ONBOARDING = {
  coach: [
    { emoji: '⚡', title: 'AI practice plans in seconds', desc: 'Pick your focus, tap generate. Huddle builds a full Play-Practice-Play session tailored to your team and age group.' },
    { emoji: '📋', title: 'Manage your lineup', desc: 'Build your starting lineup, plan substitutions, and track playing time — all in one place on game day.' },
    { emoji: '💬', title: 'Keep everyone in the loop', desc: 'Message parents directly, track RSVPs, and share the schedule. No more group texts.' },
  ],
  parent: [
    { emoji: '📅', title: 'Never miss a game or practice', desc: 'See the full schedule, get reminders, and RSVP in one tap. Your coach always knows who is coming.' },
    { emoji: '💬', title: 'Direct line to the coach', desc: 'Message the coach, get updates, and stay connected with the team without digging through group chats.' },
    { emoji: '🥤', title: 'Snack schedule and team votes', desc: 'Know whose week it is for snacks and weigh in on team decisions — all in the app.' },
  ],
}

type Screen = 'checking' | 'splash' | 'role' | 'onboarding' | 'auth'
type Role = 'coach' | 'parent' | null
type AuthMode = 'signin' | 'signup'

export default function EntryScreen() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('checking')
  const [role, setRole] = useState<Role>(null)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home')
      } else {
        setScreen('splash')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) router.replace('/home')
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async () => {
    if (!email || !password) return
    setLoading(true)
    if (authMode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { Alert.alert('Error', error.message); setLoading(false) }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { Alert.alert('Error', error.message); setLoading(false) }
      else Alert.alert('Check your email', 'We sent you a confirmation link.')
      setLoading(false)
    }
  }

  // Checking session
  if (screen === 'checking') {
    return (
      <View style={styles.splash}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>🤝</Text>
        </View>
        <Text style={styles.wordmark}>Huddle</Text>
        <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" style={{ marginTop: 32 }} />
      </View>
    )
  }

  // Splash screen
  if (screen === 'splash') {
    return (
      <View style={styles.splash}>
        <View style={styles.splashTop}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconEmoji}>🤝</Text>
          </View>
          <Text style={styles.wordmark}>Huddle</Text>
          <Text style={styles.splashTagline}>Your AI coaching assistant</Text>
        </View>

        <View style={styles.splashFeatures}>
          {[
            { emoji: '⚡', text: 'AI practice plans in seconds' },
            { emoji: '📅', text: 'Schedules, RSVPs, and updates' },
            { emoji: '📋', text: 'Lineup builder and game day tools' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.splashButtons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('role')}>
            <Text style={styles.primaryBtnText}>Get started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => { setAuthMode('signin'); setScreen('auth') }}>
            <Text style={styles.ghostBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Role selection
  if (screen === 'role') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('splash')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.roleHeading}>I am a...</Text>
        <Text style={styles.roleSub}>Choose your role to get the right experience</Text>

        <TouchableOpacity
          style={[styles.roleCard, role === 'coach' && styles.roleCardActive]}
          onPress={() => setRole('coach')}
        >
          <Text style={styles.roleCardEmoji}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>Coach</Text>
            <Text style={styles.roleCardDesc}>Build practice plans, manage your roster, and run game day</Text>
          </View>
          <View style={[styles.roleRadio, role === 'coach' && styles.roleRadioActive]}>
            {role === 'coach' && <View style={styles.roleRadioDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleCard, role === 'parent' && styles.roleCardActive]}
          onPress={() => setRole('parent')}
        >
          <Text style={styles.roleCardEmoji}>👨‍👧</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleCardTitle}>Parent</Text>
            <Text style={styles.roleCardDesc}>Stay on top of the schedule, RSVP, and connect with the coach</Text>
          </View>
          <View style={[styles.roleRadio, role === 'parent' && styles.roleRadioActive]}>
            {role === 'parent' && <View style={styles.roleRadioDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtnDark, !role && { opacity: 0.4 }]}
          onPress={() => { if (role) { setOnboardingStep(0); setScreen('onboarding') } }}
          disabled={!role}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Onboarding slides
  if (screen === 'onboarding' && role) {
    const slides = ONBOARDING[role]
    const slide = slides[onboardingStep]
    const isLast = onboardingStep === slides.length - 1

    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (onboardingStep > 0) setOnboardingStep(onboardingStep - 1)
          else setScreen('role')
        }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.onboardingDots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === onboardingStep && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.onboardingContent}>
          <Text style={styles.onboardingEmoji}>{slide.emoji}</Text>
          <Text style={styles.onboardingTitle}>{slide.title}</Text>
          <Text style={styles.onboardingDesc}>{slide.desc}</Text>
        </View>

        <View style={styles.onboardingButtons}>
          <TouchableOpacity
            style={styles.primaryBtnDark}
            onPress={() => {
              if (isLast) { setAuthMode('signup'); setScreen('auth') }
              else setOnboardingStep(onboardingStep + 1)
            }}
          >
            <Text style={styles.primaryBtnText}>{isLast ? 'Create account' : 'Next'}</Text>
          </TouchableOpacity>
          {isLast && (
            <TouchableOpacity style={styles.ghostBtnDark} onPress={() => { setAuthMode('signin'); setScreen('auth') }}>
              <Text style={styles.ghostBtnDarkText}>I already have an account</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // Auth screen
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setScreen(role ? 'onboarding' : 'splash')}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.authContent}>
        <Text style={styles.authTitle}>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
        <Text style={styles.authSub}>{authMode === 'signin' ? 'Sign in to continue' : 'Start your free account'}</Text>

        <TextInput
          style={styles.authInput}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.authInput}
          placeholder="Password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.primaryBtnDark, loading && { opacity: 0.6 }]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.primaryBtnText}>{authMode === 'signin' ? 'Sign in' : 'Create account'}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
          <Text style={styles.authToggle}>
            {authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: BLUE, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 48, justifyContent: 'space-between' },
  splashTop: { alignItems: 'center' },
  iconWrap: { width: 88, height: 88, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconEmoji: { fontSize: 42 },
  wordmark: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2, marginBottom: 8 },
  splashTagline: { fontSize: 15, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 },
  splashFeatures: { gap: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  featureText: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  splashButtons: { gap: 12 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: BLUE },
  ghostBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: BLUE, fontWeight: '600' },
  roleHeading: { fontSize: 30, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 6 },
  roleSub: { fontSize: 14, color: '#888', marginBottom: 28 },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 14, backgroundColor: '#fff' },
  roleCardActive: { borderColor: BLUE, backgroundColor: '#EEF4FF' },
  roleCardEmoji: { fontSize: 28 },
  roleCardTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 2 },
  roleCardDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  roleRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  roleRadioActive: { borderColor: BLUE },
  roleRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },
  primaryBtnDark: { backgroundColor: BLUE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  onboardingDots: { flexDirection: 'row', gap: 6, marginBottom: 48 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { width: 20, backgroundColor: BLUE },
  onboardingContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  onboardingEmoji: { fontSize: 64, marginBottom: 28 },
  onboardingTitle: { fontSize: 26, fontWeight: '900', color: '#111827', textAlign: 'center', letterSpacing: -0.5, marginBottom: 14 },
  onboardingDesc: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 24 },
  onboardingButtons: { gap: 12 },
  ghostBtnDark: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ghostBtnDarkText: { fontSize: 15, color: '#888', fontWeight: '500' },
  authContent: { flex: 1, justifyContent: 'center' },
  authTitle: { fontSize: 30, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 6 },
  authSub: { fontSize: 14, color: '#888', marginBottom: 32 },
  authInput: { backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  authToggle: { fontSize: 14, color: BLUE, textAlign: 'center', marginTop: 20, fontWeight: '500' },
})
