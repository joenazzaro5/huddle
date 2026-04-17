import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Animated,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const BLUE = '#1A56DB'
const NAVY = '#0D1B2A'
const GREEN = '#1A7A4A'

const ONBOARDING = {
  coach: [
    {
      emoji: '⚡',
      title: 'Your practice, ready to go',
      desc: 'Answer a few questions and get a full session plan built for your team. Then make it yours.',
      nextLabel: 'Next: Game day',
    },
    {
      emoji: '📋',
      title: 'Game day, simplified',
      desc: 'Lineup, substitutions, and playing time. Everything you need on the sideline.',
      nextLabel: 'Next: Team communication',
    },
    {
      emoji: '🏆',
      title: 'One place for your whole team',
      desc: 'Schedules, RSVPs, chat, and updates. Coaches and parents always on the same page.',
      nextLabel: null,
    },
  ],
  parent: [
    {
      emoji: '📅',
      title: 'Always in the loop',
      desc: 'See the schedule, get reminders, and let the coach know you\'re coming. All in one tap.',
      nextLabel: 'Next: Stay connected',
    },
    {
      emoji: '💬',
      title: 'Stay connected',
      desc: 'Chat with the team, get updates, and know what\'s happening before it happens.',
      nextLabel: 'Next: Build momentum',
    },
    {
      emoji: '🔥',
      title: 'Practice doesn\'t stop at the field',
      desc: 'Your coach sends a daily drill. Do it at home, build a streak, get better every day.',
      nextLabel: null,
    },
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

  // Animations
  const coachScale = useRef(new Animated.Value(1)).current
  const parentScale = useRef(new Animated.Value(1)).current
  const emojiAnim = useRef(new Animated.Value(1)).current

  // Splash animations
  const splashBallScale = useRef(new Animated.Value(0.3)).current
  const splashBallTranslate = useRef(new Animated.Value(-60)).current
  const splashWordmark = useRef(new Animated.Value(0)).current
  const splashTagline = useRef(new Animated.Value(0)).current
  const splashBenefits = useRef(new Animated.Value(0)).current
  const splashButton = useRef(new Animated.Value(0)).current
  const splashButtonPulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (screen !== 'splash') return
    // Ball bounces in immediately
    Animated.parallel([
      Animated.spring(splashBallScale, {
        toValue: 1, useNativeDriver: true, damping: 6, stiffness: 180,
      }),
      Animated.spring(splashBallTranslate, {
        toValue: 0, useNativeDriver: true, damping: 6, stiffness: 180,
      }),
    ]).start()
    // Wordmark after 300ms
    setTimeout(() => Animated.timing(splashWordmark, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 300)
    // Tagline after 600ms
    setTimeout(() => Animated.timing(splashTagline, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 600)
    // Benefits after 900ms
    setTimeout(() => Animated.timing(splashBenefits, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 900)
    // Button after 1200ms
    setTimeout(() => {
      Animated.timing(splashButton, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(splashButtonPulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
            Animated.timing(splashButtonPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          ])
        ).start()
      })
    }, 1200)
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
    const init = async () => {
      const seen = await AsyncStorage.getItem('huddle_onboarding_complete')
      const { data: { session } } = await supabase.auth.getSession()
      if (!seen) {
        setScreen('splash')
      } else if (session) {
        router.replace('/home')
      } else {
        setAuthMode('signin')
        setScreen('auth')
      }
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const seen = await AsyncStorage.getItem('huddle_onboarding_complete')
        if (seen) router.replace('/home')
      }
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

  const goToAuth = async (mode: AuthMode) => {
    await AsyncStorage.setItem('huddle_onboarding_complete', 'true')
    setAuthMode(mode)
    setScreen('auth')
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

  // ── Splash screen ───────────────────────────────────────────────
  if (screen === 'splash') {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.splashCenter}>
          <Animated.Text style={[
            styles.splashBall,
            { transform: [{ scale: splashBallScale }, { translateY: splashBallTranslate }] },
          ]}>
            ⚽
          </Animated.Text>

          <Animated.Text style={[styles.splashWordmark, { opacity: splashWordmark }]}>
            HUDDLE
          </Animated.Text>

          <Animated.Text style={[styles.splashTagline, { opacity: splashTagline }]}>
            Your team. Your season.
          </Animated.Text>

          <Animated.View style={[styles.splashBenefitsWrap, { opacity: splashBenefits }]}>
            <Text style={styles.splashBenefit}>⚡ Practice plans built for your team</Text>
            <Text style={styles.splashBenefit}>📋 Game day tools for the sideline</Text>
            <Text style={styles.splashBenefit}>💬 Keep everyone connected</Text>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: splashButton, transform: [{ scale: splashButtonPulse }] }}>
          <TouchableOpacity style={styles.splashBtn} onPress={() => setScreen('role')} activeOpacity={0.85}>
            <Text style={styles.splashBtnText}>Get started →</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    )
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

  // ── Role selection ──────────────────────────────────────────────
  if (screen === 'role') {
    return (
      <View style={styles.container}>
        <Text style={styles.roleHeading}>Welcome to Huddle</Text>
        <Text style={styles.roleSub}>How will you be using Huddle?</Text>

        <Animated.View style={{ transform: [{ scale: coachScale }] }}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'coach' && styles.roleCardActive]}
            onPress={() => selectRole('coach')}
            activeOpacity={0.9}
          >
            <Text style={styles.roleCardBigEmoji}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>Coach</Text>
              <Text style={styles.roleCardDesc}>Build your practice, run game day, keep your team connected.</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: parentScale }] }}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'parent' && styles.roleCardActive]}
            onPress={() => selectRole('parent')}
            activeOpacity={0.9}
          >
            <Text style={styles.roleCardBigEmoji}>👨‍👧</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roleCardTitle}>Parent / Guardian</Text>
              <Text style={styles.roleCardDesc}>Stay in the loop, support your kid, and never miss a thing.</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[styles.primaryBtnDark, !role && { opacity: 0.4 }]}
          onPress={() => { if (role) { setOnboardingStep(0); setScreen('onboarding') } }}
          disabled={!role}
        >
          <Text style={styles.primaryBtnText}>Continue →</Text>
        </TouchableOpacity>
      </View>
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
              if (isLast) { goToAuth('signup') }
              else setOnboardingStep(onboardingStep + 1)
            }}
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? 'Create account' : `${slide.nextLabel} →`}
            </Text>
          </TouchableOpacity>
          {!isLast && (
            <TouchableOpacity style={styles.ghostBtnDark} onPress={() => goToAuth('signup')}>
              <Text style={styles.ghostBtnDarkText}>Skip to create account</Text>
            </TouchableOpacity>
          )}
          {isLast && (
            <TouchableOpacity style={styles.ghostBtnDark} onPress={() => goToAuth('signin')}>
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
      <TouchableOpacity style={styles.backBtn} onPress={() => setScreen(role ? 'onboarding' : 'role')}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.authContent}>
        <Text style={styles.authTitle}>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
        <Text style={styles.authSub}>{authMode === 'signin' ? 'Sign in to continue' : 'Start your free account'}</Text>

        <Text style={styles.authLabel}>Email</Text>
        <TextInput
          style={styles.authInput}
          placeholder="you@example.com"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.authLabel}>Password</Text>
        <TextInput
          style={styles.authInput}
          placeholder="••••••••"
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
  // ── Splash / Loading ─────────────────────────────────────────────
  splash: {
    flex: 1, backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconEmoji: { fontSize: 42 },
  wordmark: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2, marginBottom: 8 },

  // ── Intro Splash ──────────────────────────────────────────────────
  splashContainer: {
    flex: 1, backgroundColor: NAVY,
    paddingHorizontal: 32, paddingTop: 80, paddingBottom: 48,
    justifyContent: 'space-between',
  },
  splashCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  splashBall: { fontSize: 72, marginBottom: 24 },
  splashWordmark: {
    fontSize: 52, fontWeight: '900', color: '#fff',
    letterSpacing: 4, marginBottom: 12,
  },
  splashTagline: {
    fontSize: 17, color: GREEN, fontWeight: '600',
    marginBottom: 40, textAlign: 'center',
  },
  splashBenefitsWrap: { gap: 14, alignItems: 'flex-start' },
  splashBenefit: {
    fontSize: 15, color: 'rgba(255,255,255,0.75)',
    fontWeight: '500', lineHeight: 22,
  },
  splashBtn: {
    backgroundColor: GREEN, borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
  },
  splashBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  // ── Shared container ─────────────────────────────────────────────
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 15, color: BLUE, fontWeight: '600' },
  primaryBtnDark: { backgroundColor: BLUE, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  ghostBtnDark: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ghostBtnDarkText: { fontSize: 15, color: '#888', fontWeight: '500' },

  // ── Role ──────────────────────────────────────────────────────────
  roleHeading: { fontSize: 30, fontWeight: '900', color: '#111827', letterSpacing: -0.5, marginBottom: 6, marginTop: 24 },
  roleSub: { fontSize: 14, color: '#888', marginBottom: 28 },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 24,
    borderRadius: 18, borderWidth: 1.5, borderColor: '#E5E7EB',
    marginBottom: 14, backgroundColor: '#fff',
  },
  roleCardActive: { borderColor: BLUE, backgroundColor: '#EEF4FF' },
  roleCardBigEmoji: { fontSize: 32, lineHeight: 40 },
  roleCardTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  roleCardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

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
  authLabel: { fontSize: 14, fontWeight: '500', color: '#6B7280', marginBottom: 6 },
  authInput: {
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: '#111827', marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  authToggle: { fontSize: 14, color: BLUE, textAlign: 'center', marginTop: 20, fontWeight: '500' },
})
