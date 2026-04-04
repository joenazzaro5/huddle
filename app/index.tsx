import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/home')
      } else {
        setChecking(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/home')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) Alert.alert('Error', error.message)
  }

  // Show loading spinner while checking session
  if (checking) {
    return (
      <View style={styles.checkingContainer}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.wordmark}>Huddle</Text>
        <ActivityIndicator color="#1A56DB" size="small" style={{ marginTop: 24 }} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>C</Text>
        </View>
        <Text style={styles.title}>Huddle</Text>
        <Text style={styles.subtitle}>Your AI coaching companion</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.buttonText}>Sign in</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  checkingContainer: { flex: 1, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  wordmark: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  container: { flex: 1, backgroundColor: '#1A56DB' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#1A56DB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoText: { fontSize: 36, fontWeight: '900', color: '#fff' },
  title: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -2, marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 48, letterSpacing: 1 },
  input: { width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, fontSize: 16, color: '#fff', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  button: { width: '100%', backgroundColor: '#1A56DB', borderRadius: 14, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
