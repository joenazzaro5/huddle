import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Dimensions, ScrollView, Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const { width } = Dimensions.get('window')
const BLUE = '#1A56DB'

const AGE_GROUPS = ['U6', 'U8', 'U10', 'U12', 'U14', 'U16']

const ONBOARDING = {
  coach: [
    {
      emoji: '⚡',
      title: 'AI practice plans in seconds',
      desc: 'Pick your focus, tap generate. Huddle builds a full plan tailored to your team and age group.',
      nextLabel: 'Next: Game day',
    },
    {
      emoji: '📋',
      title: 'Game day, your way',
      desc: 'Build your starting lineup, plan substitutions, and track playing time — all in one place.',
      nextLabel: 'Next: Your team',
    },
    {
      emoji: '💬',
      title: 'Your whole team, connected',
      desc: 'Message parents, track RSVPs, and share the schedule. No more group texts.',
      nextLabel: null,
    },
  ],
  parent: [
    {
      emoji: '📅',
      title: 'Always in the loop',
      desc: 'See the full schedule, get reminders, and know exactly what your team needs.',
      nextLabel: 'Next: Easy RSVPs',
    },
    {
      emoji: '✅',
      title: 'RSVP in one tap',
      desc: "Confirm attendance for any game or practice in seconds. Your coach always knows who's coming.",
      nextLabel: 'Next: Train at home',
    },
    {
      emoji: '🔥',
      title: 'Practice at home, build streaks',
      desc: 'Follow drill tips and build a practice streak together. Progress you can see.',
      nextLabel: null,
    },
  ],
}

type Screen = 'checking' | 'splash' | 'role' | 'context' | 'onboarding' | 'auth'
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
  const [teamName, setTeamName] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [teamCode, setTeamCode] = useState('')

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current
  const coachScale = useRef(new Animated.Value(1)).current
  const parentScale = useRef(new Animated.Value(1)).current
  const emojiAnim = useRef(new Animated.Value(1)).current
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null)

  // Pulse loop while splash is showing
  useEffect(() => {
    if (screen === 'splash') {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
        ])
      )
      pulseLoopRef.current.start()
    } else {
      pulseLoopRef.current?.stop()
      pulseAnim.setValue(1)
    }
  }, [screen])

  // Emoji bounce on each slide mount
  useEffect(() => {
    if (screen === 'onboarding') {
      emojiAnim.setValue(0.55)
      Animated.spring(emojiAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 7,
        stiffness: 200,
      }).start()
    }
  }, [screen, onboardingStep])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/home')
      else setScreen('splash')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) router.replace('/home')
    })
    return () => subscription.unsubscribe()
  }, [])

  const selectRole = (r: Role) => {
    setRole(r)
    Animated.spring(r === 'coach' ? coachScale : parentScale, {
      toValue: 1.02, useNativeDriver: true, damping: 10, stiffness: 200,
    }).start()
    Animated.spring(r === 'coach' ? parentScale : coachScale, {
      toValue: 1, useNativeDriver: true, damping: 10,
    }).start()
  }

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

  // ── Checking session ────────────────────────────────────────────
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

  // ── Splash ──────────────────────────────────────────────────────
  if (screen === 'splash') {
    return (
      <View style={styles.splash}>
        <View style={styles.splashTop}>
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.iconEmoji}>🤝</Text>
          </Animated.View>
          <Text style={styles.wordmark}>Huddle</Text>
          <Text style={styles.splashTagline}>Your team. Your season. All in one place.</Text>
        </View>

        <View style={styles.splashFeatures}>
          {[
            { emoji: '⚡', title: 'AI practice plans in seconds',              desc: 'Pick your focus, tap generate. A full session, done.' },
            { emoji: '📅', title: 'Schedules, RSVPs, and game day tools',      desc: 'Everything your team needs, all in one place.' },
            { emoji: '💬', title: 'Connect coaches, parents, and players',     desc: 'No more group texts. One app for everyone.' },
          ].map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.splashButtons}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('role')}>
            <Text style={styles.splashBtnText}>Get started — it's free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => { setAuthMode('signin'); setScreen('auth') }}>
            <Text style={styles.ghostBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── Role selection ──────────────────────────────────────────────
  if (screen === 'role') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('splash')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.roleHeading}>I am a...</Text>
        <Text style={styles.roleSub}>Choose your role to get the right experience</Text>

        <Animated.View style={{ transform: [{ scale: coachScale }] }}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'coach' && styles.roleCardActive]}
            onPress={() => selectRole('coach')}
            activeOpacity={0.9}
          >
            <Text style={styles.roleCardBigEmoji}>📋⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>Coach</Text>
              <Text style={styles.roleCardPayoff}>Build plans in seconds. Run game day like a pro.</Text>
              <Text style={styles.roleCardDesc}>Practice plans · Lineup builder · Schedule & RSVPs</Text>
            </View>
            <View style={[styles.roleRadio, role === 'coach' && styles.roleRadioActive]}>
              {role === 'coach' && <View style={styles.roleRadioDot} />}
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: parentScale }] }}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'parent' && styles.roleCardActive]}
            onPress={() => selectRole('parent')}
            activeOpacity={0.9}
          >
            <Text style={styles.roleCardBigEmoji}>📅❤️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>Parent</Text>
              <Text style={styles.roleCardPayoff}>Never miss a thing. Always know what's next.</Text>
              <Text style={styles.roleCardDesc}>Schedule · RSVPs · Team updates · Chat</Text>
            </View>
            <View style={[styles.roleRadio, role === 'parent' && styles.roleRadioActive]}>
              {role === 'parent' && <View style={styles.roleRadioDot} />}
            </View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[styles.primaryBtnDark, !role && { opacity: 0.4 }]}
          onPress={() => { if (role) setScreen('context') }}
          disabled={!role}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Context step ────────────────────────────────────────────────
  if (screen === 'context') {

    // Coach context: team name + age group
    if (role === 'coach') {
      return (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('role')}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={styles.contextHeading}>Tell us about your team</Text>
            <Text style={styles.contextSub}>We'll personalize your experience right from the start.</Text>

            <Text style={styles.contextLabel}>Team name</Text>
            <TextInput
              style={styles.contextInput}
              placeholder="e.g. Marin Cheetahs"
              placeholderTextColor="#bbb"
              value={teamName}
              onChangeText={setTeamName}
              autoCapitalize="words"
            />

            <Text style={[styles.contextLabel, { marginTop: 20 }]}>Age group</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 36 }}
              contentContainerStyle={{ paddingVertical: 4, gap: 8, flexDirection: 'row' }}
            >
              {AGE_GROUPS.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.agePill, ageGroup === g && styles.agePillActive]}
                  onPress={() => setAgeGroup(g)}
                >
                  <Text style={[styles.agePillText, ageGroup === g && styles.agePillTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtnDark, (!teamName.trim() || !ageGroup) && { opacity: 0.4 }]}
              onPress={() => {
                if (teamName.trim() && ageGroup) { setOnboardingStep(0); setScreen('onboarding') }
              }}
              disabled={!teamName.trim() || !ageGroup}
            >
              <Text style={styles.primaryBtnText}>Let's go →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostBtnDark}
              onPress={() => { setOnboardingStep(0); setScreen('onboarding') }}
            >
              <Text style={styles.ghostBtnDarkText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )
    }

    // Parent context: team code
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => setScreen('role')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={styles.contextHeading}>Join your team</Text>
          <Text style={styles.contextSub}>Enter the code your coach shared with you.</Text>

          <Text style={styles.contextLabel}>Team code</Text>
          <TextInput
            style={[styles.contextInput, styles.codeInput]}
            placeholder="ABC123"
            placeholderTextColor="#bbb"
            value={teamCode}
            onChangeText={t => setTeamCode(t.toUpperCase().slice(0, 6))}
            autoCapitalize="characters"
            maxLength={6}
          />
          <Text style={styles.contextNote}>Get this code from your coach</Text>

          <TouchableOpacity
            style={[styles.primaryBtnDark, { marginTop: 24 }, teamCode.length < 6 && { opacity: 0.4 }]}
            onPress={() => {
              if (teamCode.length === 6) { setOnboardingStep(0); setScreen('onboarding') }
            }}
            disabled={teamCode.length < 6}
          >
            <Text style={styles.primaryBtnText}>Join team →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtnDark}
            onPress={() => { setOnboardingStep(0); setScreen('onboarding') }}
          >
            <Text style={styles.ghostBtnDarkText}>I don't have a code yet</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Onboarding slides ───────────────────────────────────────────
  if (screen === 'onboarding' && role) {
    const slides = ONBOARDING[role]
    const slide = slides[onboardingStep]
    const isLast = onboardingStep === slides.length - 1
    const slideBg = onboardingStep % 2 === 1 ? '#F8F9FF' : '#fff'

    return (
      <View style={[styles.container, { backgroundColor: slideBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (onboardingStep > 0) setOnboardingStep(onboardingStep - 1)
          else setScreen('context')
        }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.onboardingDots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === onboardingStep && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.onboardingContent}>
          <Animated.View style={{ transform: [{ scale: emojiAnim }] }}>
            <Text style={styles.onboardingEmoji}>{slide.emoji}</Text>
          </Animated.View>
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
            <Text style={styles.primaryBtnText}>
              {isLast ? 'Create account' : `${slide.nextLabel} →`}
            </Text>
          </TouchableOpacity>
          {!isLast && (
            <TouchableOpacity style={styles.ghostBtnDark} onPress={() => { setAuthMode('signup'); setScreen('auth') }}>
              <Text style={styles.ghostBtnDarkText}>Skip to create account</Text>
            </TouchableOpacity>
          )}
          {isLast && (
            <TouchableOpacity style={styles.ghostBtnDark} onPress={() => { setAuthMode('signin'); setScreen('auth') }}>
              <Text style={styles.ghostBtnDarkText}>I already have an account</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // ── Auth ────────────────────────────────────────────────────────
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
  // ── Splash ──────────────────────────────────────────────────────
  splash: {
    flex: 1, backgroundColor: BLUE,
    paddingHorizontal: 28, paddingTop: 80, paddingBottom: 48,
    justifyContent: 'space-between',
  },
  splashTop: { alignItems: 'center' },
  iconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconEmoji: { fontSize: 42 },
  wordmark: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2, marginBottom: 8 },
  splashTagline: { fontSize: 15, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3, textAlign: 'center', lineHeight: 22 },
  splashFeatures: { gap: 12 },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14,
  },
  featureEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  featureTitle: { fontSize: 15, color: '#fff', fontWeight: '700', marginBottom: 2 },
  featureDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
  splashButtons: { gap: 12 },
  primaryBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  splashBtnText: { fontSize: 16, fontWeight: '700', color: BLUE },
  ghostBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },

  // ── Shared container ─────────────────────────────────────────────
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: BLUE, fontWeight: '600' },
  primaryBtnDark: { backgroundColor: BLUE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  ghostBtnDark: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ghostBtnDarkText: { fontSize: 15, color: '#888', fontWeight: '500' },

  // ── Role ──────────────────────────────────────────────────────────
  roleHeading: { fontSize: 30, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 6 },
  roleSub: { fontSize: 14, color: '#888', marginBottom: 28 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 24,
    borderRadius: 18, borderWidth: 1.5, borderColor: '#E5E7EB',
    marginBottom: 14, backgroundColor: '#fff',
  },
  roleCardActive: { borderColor: BLUE, backgroundColor: '#EEF4FF' },
  roleCardBigEmoji: { fontSize: 32, lineHeight: 40 },
  roleCardTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 3 },
  roleCardPayoff: { fontSize: 13, fontWeight: '600', color: BLUE, marginBottom: 4, lineHeight: 18 },
  roleCardDesc: { fontSize: 12, color: '#999', lineHeight: 17 },
  roleRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
  },
  roleRadioActive: { borderColor: BLUE },
  roleRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },

  // ── Context ───────────────────────────────────────────────────────
  contextHeading: { fontSize: 28, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 8 },
  contextSub: { fontSize: 15, color: '#888', marginBottom: 32, lineHeight: 22 },
  contextLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8 },
  contextInput: {
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111827',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  codeInput: {
    textTransform: 'uppercase', letterSpacing: 6,
    fontSize: 24, textAlign: 'center', fontWeight: '700',
  },
  contextNote: { fontSize: 12, color: '#aaa', marginTop: 8, marginBottom: 4 },
  agePill: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  agePillActive: { backgroundColor: BLUE, borderColor: BLUE },
  agePillText: { fontSize: 14, fontWeight: '700', color: '#555' },
  agePillTextActive: { color: '#fff' },

  // ── Onboarding ───────────────────────────────────────────────────
  onboardingDots: { flexDirection: 'row', gap: 6, marginBottom: 48 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { width: 24, backgroundColor: BLUE, borderRadius: 3 },
  onboardingContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  onboardingEmoji: { fontSize: 64, marginBottom: 28, textAlign: 'center' },
  onboardingTitle: { fontSize: 26, fontWeight: '900', color: '#111827', textAlign: 'center', letterSpacing: -0.5, marginBottom: 14 },
  onboardingDesc: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 24 },
  onboardingButtons: { gap: 12 },

  // ── Auth ──────────────────────────────────────────────────────────
  authContent: { flex: 1, justifyContent: 'center' },
  authTitle: { fontSize: 30, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 6 },
  authSub: { fontSize: 14, color: '#888', marginBottom: 32 },
  authInput: {
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111827', marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  authToggle: { fontSize: 14, color: BLUE, textAlign: 'center', marginTop: 20, fontWeight: '500' },
})
