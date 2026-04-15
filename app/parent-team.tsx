import { useEffect, useState, useCallback } from 'react'
import { useLocalSearchParams, useFocusEffect } from 'expo-router'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '../lib/header'
import { supabase } from '../lib/supabase'
import { SEASON_SCHEDULE } from '../lib/season'
import { useRole } from '../lib/roleStore'
import AsyncStorage from '@react-native-async-storage/async-storage'

const tc = '#1A56DB'

const STANDINGS = [
  { team: 'Marin Cheetahs', w: 4, l: 1, d: 1, pts: 13, isUs: true },
  { team: 'Tiburon FC',     w: 3, l: 2, d: 1, pts: 10 },
  { team: 'Mill Valley SC', w: 3, l: 2, d: 0, pts: 9  },
  { team: 'Novato United',  w: 2, l: 2, d: 2, pts: 8  },
  { team: 'San Anselmo FC', w: 1, l: 4, d: 1, pts: 4  },
  { team: 'Fairfax FC',     w: 0, l: 5, d: 1, pts: 1  },
]

const TIGERS_ROSTER = [
  { number: 1,  name: 'Luna Santos',      position: 'GK'         },
  { number: 2,  name: 'Maya Johnson',     position: 'Defender'   },
  { number: 3,  name: 'Chloe Williams',   position: 'Midfielder' },
  { number: 4,  name: 'Lily Brown',       position: 'Forward'    },
  { number: 5,  name: 'Zoe Davis',        position: 'Midfielder' },
  { number: 6,  name: 'Aria Miller',      position: 'Defender'   },
  { number: 7,  name: 'Nora Wilson',      position: 'Forward'    },
  { number: 8,  name: 'Elena Moore',      position: 'Defender'   },
  { number: 9,  name: 'Stella Taylor',    position: 'Midfielder' },
  { number: 10, name: 'Violet Anderson',  position: 'Forward'    },
  { number: 11, name: 'Aurora Thomas',    position: 'GK'         },
]

const PLAYER_STATS = [
  { name: 'Sofia',    goals: 0, assists: 0, pos: 'GK'  },
  { name: 'Emma',     goals: 4, assists: 1, pos: 'MID' },
  { name: 'Olivia',   goals: 2, assists: 5, pos: 'MID' },
  { name: 'Isabella', goals: 3, assists: 2, pos: 'FWD' },
]

export default function ParentTeamScreen() {
  const { currentRole } = useRole()
  const isCoach = currentRole === 'coach'

  const [team, setTeam] = useState<any>(null)
  const [allTeams, setAllTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const params = useLocalSearchParams()
  const [activeTab, setActiveTab] = useState<'schedule' | 'roster' | 'standings' | 'snacks'>((params.tab as any) || 'schedule')
  const [rsvpMap, setRsvpMap] = useState<Record<string, 'yes' | 'no' | 'maybe'>>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [snackData, setSnackData] = useState(() =>
    SEASON_SCHEDULE
      .filter(e => e.type === 'game' && new Date(e.starts_at) >= new Date())
      .map(e => ({
        date: new Date(e.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Game' as string,
        name: null as string | null,
        claimed: false,
      }))
  )


  useFocusEffect(
    useCallback(() => {
      const tab = params.tab as string
      if (tab === 'roster' || tab === 'schedule' || tab === 'standings' || tab === 'snacks') {
        setActiveTab(tab as 'schedule' | 'roster' | 'standings' | 'snacks')
      }
    }, [params.tab])
  )

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUser(user)

    const { data: memberships } = await supabase
      .from('team_members')
      .select('team:teams(*), role')
      .eq('user_id', user.id)

    setAllTeams(memberships ?? [])
    const membership = memberships?.find(m => m.role === 'parent') ?? memberships?.[0]
    if (!membership?.team) { setLoading(false); return }

    const teamData = membership.team
    setTeam(teamData)

    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamData.id)
      .eq('is_active', true)
      .order('number', { ascending: true })
    setPlayers(playerData ?? [])

    const snackKey = `huddle_snacks_${teamData.id}`
    const stored = await AsyncStorage.getItem(snackKey)
    if (stored) setSnackData(JSON.parse(stored))

    setLoading(false)
  }

  const submitRsvp = async (eventId: string, status: 'yes' | 'no' | 'maybe') => {
    setRsvpMap(prev => ({ ...prev, [eventId]: status }))
    if (!currentUser || eventId.startsWith('ss-')) return
    await supabase.from('rsvps').upsert(
      { user_id: currentUser.id, event_id: eventId, status },
      { onConflict: 'user_id,event_id' }
    )
  }

  const groupByMonth = (events: typeof SEASON_SCHEDULE) => {
    const groups: { month: string; events: typeof SEASON_SCHEDULE }[] = []
    events.forEach(evt => {
      const month = new Date(evt.starts_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const existing = groups.find(g => g.month === month)
      if (existing) existing.events.push(evt)
      else groups.push({ month, events: [evt] })
    })
    return groups
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={tc} size="large" /></View>

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader teamColor={tc} teamName={team?.name} allTeams={allTeams} onTeamSelect={() => {}} />

      {/* Sub-tab bar */}
      <View style={{ height: 44, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#eee' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 0 }}>
          {(['schedule', 'roster', 'standings', 'snacks'] as const).map(tab => {
            const labels = { schedule: 'Schedule', roster: 'Roster', standings: 'Standings', snacks: 'Snacks' }
            const isActive = activeTab === tab
            return (
              <TouchableOpacity
                key={tab}
                style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={{ fontSize: 13, color: isActive ? tc : '#999', fontWeight: isActive ? '700' : '500' }}>
                  {labels[tab]}
                </Text>
                {isActive && <View style={{ height: 2.5, backgroundColor: tc, borderRadius: 2, marginTop: 4 }} />}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* ── Schedule ─────────────────────────────────────────────── */}
      {activeTab === 'schedule' && (
        <ScrollView contentContainerStyle={styles.content}>
          {groupByMonth(SEASON_SCHEDULE).map(({ month, events }) => (
            <View key={month}>
              <Text style={styles.monthHeader}>{month}</Text>
              <View style={styles.card}>
                {events.map((event, i) => {
                  const d = new Date(event.starts_at)
                  const isGame = event.type === 'game'
                  const isPictureDay = event.type === 'picture_day'
                  const isParty = event.type === 'party'
                  const typeColor = isGame ? '#FF8C42' : isPictureDay ? '#9C27B0' : isParty ? '#7C3AED' : tc
                  const typeLabel = isGame ? '⚽ Game' : isPictureDay ? '📸 Picture Day' : isParty ? '🎉 Party' : '🏃 Practice'
                  const rsvp = rsvpMap[event.id]
                  const rsvpColors: Record<string, string> = { yes: '#22C55E', no: '#EF4444', maybe: '#F59E0B' }
                  const rsvpLabels: Record<string, string> = { yes: 'Going', no: 'Out', maybe: 'Maybe' }
                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.scheduleRow,
                        i % 2 === 1 && styles.scheduleRowAlt,
                        i < events.length - 1 && styles.scheduleBorder,
                      ]}
                    >
                      <View style={styles.scheduleDateCol}>
                        <Text style={styles.scheduleDay}>{d.getDate()}</Text>
                        <Text style={styles.scheduleDOW}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scheduleType, { color: typeColor }]}>{typeLabel}</Text>
                        <Text style={styles.scheduleTitle}>
                          {isGame
                            ? `vs ${event.opponent}${event.home != null ? (event.home ? ' · Home' : ' · Away') : ''}`
                            : (event.focus ?? event.title ?? event.location ?? '')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.scheduleTime}>
                          {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.rsvpChip,
                            rsvp && { backgroundColor: rsvpColors[rsvp] + '22', borderColor: rsvpColors[rsvp] },
                          ]}
                          onPress={() => {
                            const next: 'yes' | 'no' | 'maybe' = rsvp === 'yes' ? 'no' : rsvp === 'no' ? 'maybe' : 'yes'
                            submitRsvp(event.id, next)
                          }}
                        >
                          <Text style={[styles.rsvpChipText, rsvp && { color: rsvpColors[rsvp] }]}>
                            {rsvp ? rsvpLabels[rsvp] : 'RSVP'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Roster ───────────────────────────────────────────────── */}
      {activeTab === 'roster' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.teamCard, { backgroundColor: tc }]}>
            <Text style={styles.teamCardName}>{team?.name}</Text>
            <Text style={styles.teamCardSub}>{team?.age_group} · {team?.gender} · {players.length > 0 ? players.length : TIGERS_ROSTER.length} players</Text>
          </View>

          <View style={{ backgroundColor: '#EEF4FF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: '#eee' }}>
            <Text style={{ fontSize: 18 }}>🏆</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: tc }}>Team record:</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>4W · 1L · 1D</Text>
          </View>

          <View style={styles.card}>
            {(() => {
              const displayPlayers = players.length > 0 ? players : TIGERS_ROSTER
              return (
                <>
                  <Text style={styles.cardLabel}>Players · {displayPlayers.length}</Text>
                  {displayPlayers.map((player, i) => {
                    const pos = (player.position ?? player.positions?.[0] ?? '').toUpperCase()
                    const posColor = pos === 'GK' ? '#F59E0B'
                      : pos === 'DEFENDER' || ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos) ? tc
                      : pos === 'MIDFIELDER' || ['CM', 'LM', 'RM', 'DM', 'AM', 'CAM', 'CDM'].includes(pos) ? '#10B981'
                      : pos === 'FORWARD' || pos ? '#FF6B35' : null
                    const posLabel = player.position ?? player.positions?.[0] ?? ''
                    return (
                      <View
                        key={player.id ?? player.number}
                        style={[styles.rosterRow, i < displayPlayers.length - 1 && styles.rosterBorder]}
                      >
                        <View style={[styles.numBadge, { backgroundColor: tc + '20' }]}>
                          <Text style={[styles.numText, { color: tc }]}>{player.number ?? '—'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rosterName}>{player.name}</Text>
                          {posLabel ? (
                            <Text style={styles.rosterPos}>{posLabel}</Text>
                          ) : null}
                        </View>
                        {posColor ? (
                          <View style={{ backgroundColor: posColor + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: posColor }}>{posLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    )
                  })}
                </>
              )
            })()}
          </View>
        </ScrollView>
      )}

      {/* ── Standings ────────────────────────────────────────────── */}
      {activeTab === 'standings' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>League standings</Text>
            <View style={styles.standingsHeaderRow}>
              <Text style={[styles.standingsCell, { flex: 1 }]}>Team</Text>
              <Text style={styles.standingsColHdr}>W</Text>
              <Text style={styles.standingsColHdr}>L</Text>
              <Text style={styles.standingsColHdr}>D</Text>
              <Text style={[styles.standingsColHdr, { color: tc }]}>Pts</Text>
            </View>
            {STANDINGS.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.standingsRow,
                  row.isUs && styles.standingsRowUs,
                  i < STANDINGS.length - 1 && styles.standingsBorder,
                ]}
              >
                <Text style={[styles.standingsTeamName, row.isUs && { fontWeight: '800', color: tc }]} numberOfLines={1}>
                  {row.isUs ? '⭐ ' : ''}{row.team}
                </Text>
                <Text style={styles.standingsVal}>{row.w}</Text>
                <Text style={styles.standingsVal}>{row.l}</Text>
                <Text style={styles.standingsVal}>{row.d}</Text>
                <Text style={[styles.standingsVal, { fontWeight: '800', color: tc }]}>{row.pts}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.cardLabel, { marginBottom: 8, marginLeft: 2 }]}>Season stats</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Goals',        value: '12',  color: tc        },
              { label: 'Against',      value: '6',   color: '#EF4444' },
              { label: 'Clean sheets', value: '2',   color: '#10B981' },
              { label: 'Win rate',     value: '67%', color: '#F59E0B' },
            ].map((stat, i) => (
              <View key={i} style={[styles.statCard, { borderTopColor: stat.color, width: '48%', flexShrink: 1 }]}>
                <Text style={[styles.statCardValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statCardLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { paddingVertical: 12 }]}>
            <Text style={[styles.cardLabel, { marginBottom: 10 }]}>Recent results</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {['W', 'W', 'L', 'W', 'W'].map((r, i) => (
                <View key={i} style={[styles.resultDot, { backgroundColor: r === 'W' ? '#10B981' : '#EF4444' }]}>
                  <Text style={styles.resultDotText}>{r}</Text>
                </View>
              ))}
              <Text style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>4W · 1L this season</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 2 }}>
              <Text style={[styles.cardLabel, { flex: 1, marginBottom: 0 }]}>Player stats</Text>
              <Text style={[styles.standingsColHdr, { color: tc }]}>G</Text>
              <Text style={styles.standingsColHdr}>A</Text>
              <Text style={styles.standingsColHdr}>POS</Text>
            </View>
            {PLAYER_STATS.map((p, i) => (
              <View key={i} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, i < PLAYER_STATS.length - 1 && styles.standingsBorder]}>
                <Text style={[styles.standingsTeamName]}>{p.name}</Text>
                <Text style={[styles.standingsVal, { color: tc, fontWeight: '700' }]}>{p.goals}</Text>
                <Text style={[styles.standingsVal, { color: '#10B981', fontWeight: '700' }]}>{p.assists}</Text>
                <Text style={[styles.standingsVal, { color: '#888', fontWeight: '600', fontSize: 11 }]}>{p.pos}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Snacks ───────────────────────────────────────────────── */}
      {activeTab === 'snacks' && (
        <ScrollView contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16 }}>
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: 0, overflow: 'hidden' }]}>
            <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#92400E', marginBottom: 2 }}>🍊 Snack duty</Text>
              <Text style={{ fontSize: 13, color: '#B45309', fontWeight: '500' }}>Who's bringing the goods?</Text>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              {snackData.map((item, i) => (
                <View key={i} style={[styles.snackListRow, i < snackData.length - 1 && styles.snackListBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.snackListDate}>{item.date} · {item.type}</Text>
                    {item.claimed ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>✓ {item.name}</Text>
                        <Text style={{ fontSize: 14 }}>🎉</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Nobody yet…</Text>
                    )}
                  </View>
                  {!item.claimed && (
                    <TouchableOpacity
                      style={styles.snackClaimBtn}
                      onPress={async () => {
                        const snackKey = `huddle_snacks_${team?.id}`
                        const stored = await AsyncStorage.getItem(snackKey)
                        const freshSnacks = stored ? JSON.parse(stored) : snackData
                        if (freshSnacks[i]?.claimed) { if (stored) setSnackData(freshSnacks); return }
                        const claimerName = currentUser?.email?.split('@')[0] ?? 'Parent'
                        const updated = freshSnacks.map((s: any, idx: number) =>
                          idx === i ? { ...s, claimed: true, name: claimerName } : s
                        )
                        setSnackData(updated)
                        await AsyncStorage.setItem(snackKey, JSON.stringify(updated))
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.snackClaimBtnText}>Claim it! →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: '#FDE68A' }}>
              <Text style={{ fontSize: 13, color: '#92400E', fontWeight: '600', textAlign: 'center' }}>
                Remember: orange slices &gt; juice boxes 🍊
              </Text>
            </View>
          </View>
        </ScrollView>
      )}


    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F5' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F7F5' },
  content: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 32 },
  monthHeader: { fontSize: 12, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#eee' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  // Schedule
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  scheduleRowAlt: { backgroundColor: '#FAFAFA' },
  scheduleBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  scheduleDateCol: { width: 32, alignItems: 'center' },
  scheduleDay: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  scheduleDOW: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },
  scheduleType: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  scheduleTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  scheduleTime: { fontSize: 12, fontWeight: '600', color: '#555' },
  rsvpChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f5f5f5' },
  rsvpChipText: { fontSize: 11, fontWeight: '700', color: '#aaa' },
  // Roster
  teamCard: { borderRadius: 20, padding: 18, marginBottom: 12 },
  teamCardName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  teamCardSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rosterBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  rosterName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rosterPos: { fontSize: 12, color: '#888', marginTop: 1 },
  numBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '800' },
  // Standings
  standingsHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 2 },
  standingsColHdr: { fontSize: 11, fontWeight: '700', color: '#aaa', width: 30, textAlign: 'center' },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  standingsRowUs: { backgroundColor: '#EEF4FF', borderRadius: 8, paddingHorizontal: 6, marginHorizontal: -6 },
  standingsBorder: { borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  standingsTeamName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  standingsCell: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  standingsVal: { width: 30, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#555' },
  statCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#eee', borderTopWidth: 3, alignItems: 'center' },
  statCardValue: { fontSize: 30, fontWeight: '900', marginBottom: 4 },
  statCardLabel: { fontSize: 11, fontWeight: '600', color: '#888', textAlign: 'center' },
  resultDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultDotText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  // Snacks
  snackListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  snackListBorder: { borderBottomWidth: 0.5, borderBottomColor: '#FDE68A' },
  snackListDate: { fontSize: 11, color: '#aaa', fontWeight: '600', marginBottom: 1 },
  snackClaimBtn: { backgroundColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  snackClaimBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
})
