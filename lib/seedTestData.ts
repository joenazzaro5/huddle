import { supabase } from './supabase'

export async function seedMultiTeamData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  console.log('[seed] Seeding multi-team data for user:', user.id)

  // --- Marin Cheetahs (coach) ---
  let team1: any
  const { data: existing1 } = await supabase
    .from('teams')
    .select('*')
    .eq('name', 'Marin Cheetahs')
    .single()

  if (existing1) {
    team1 = existing1
    console.log('[seed] Marin Cheetahs already exists:', team1.id)
  } else {
    const { data: created1, error: e1 } = await supabase
      .from('teams')
      .insert({ name: 'Marin Cheetahs', age_group: 'U10', gender: 'Girls', color: '#1A56DB' })
      .select()
      .single()
    if (e1) throw e1
    team1 = created1
    console.log('[seed] Created Marin Cheetahs:', team1.id)
  }

  // --- San Rafael Tigers (parent) ---
  let team2: any
  const { data: existing2 } = await supabase
    .from('teams')
    .select('*')
    .eq('name', 'San Rafael Tigers')
    .single()

  if (existing2) {
    team2 = existing2
    console.log('[seed] San Rafael Tigers already exists:', team2.id)
  } else {
    const { data: created2, error: e2 } = await supabase
      .from('teams')
      .insert({ name: 'San Rafael Tigers', age_group: 'U8', gender: 'Girls', color: '#DC2626' })
      .select()
      .single()
    if (e2) throw e2
    team2 = created2
    console.log('[seed] Created San Rafael Tigers:', team2.id)
  }

  // --- Coach membership for Marin Cheetahs ---
  const { error: e3 } = await supabase
    .from('team_members')
    .upsert({ user_id: user.id, team_id: team1.id, role: 'coach' }, { onConflict: 'user_id,team_id' })
  if (e3) throw e3
  console.log('[seed] Upserted coach membership for Marin Cheetahs')

  // --- Parent membership for San Rafael Tigers ---
  const { error: e4 } = await supabase
    .from('team_members')
    .upsert({ user_id: user.id, team_id: team2.id, role: 'parent' }, { onConflict: 'user_id,team_id' })
  if (e4) throw e4
  console.log('[seed] Upserted parent membership for San Rafael Tigers')

  console.log('[seed] Done. team1:', team1.id, 'team2:', team2.id)
  return { team1, team2 }
}
