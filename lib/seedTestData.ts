import { supabase } from './supabase'

export async function seedMultiTeamData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  // Upsert Marin Cheetahs (coach)
  const { data: team1, error: e1 } = await supabase
    .from('teams')
    .upsert({ name: 'Marin Cheetahs', age_group: 'U10', gender: 'Girls', color: '#1A56DB' }, { onConflict: 'name' })
    .select()
    .single()
  if (e1) throw e1

  // Upsert San Rafael Tigers (parent)
  const { data: team2, error: e2 } = await supabase
    .from('teams')
    .upsert({ name: 'San Rafael Tigers', age_group: 'U8', gender: 'Girls', color: '#DC2626' }, { onConflict: 'name' })
    .select()
    .single()
  if (e2) throw e2

  // Add coach membership for Marin Cheetahs
  const { error: e3 } = await supabase
    .from('team_members')
    .upsert({ user_id: user.id, team_id: team1.id, role: 'coach' }, { onConflict: 'user_id,team_id' })
  if (e3) throw e3

  // Add parent membership for San Rafael Tigers
  const { error: e4 } = await supabase
    .from('team_members')
    .upsert({ user_id: user.id, team_id: team2.id, role: 'parent' }, { onConflict: 'user_id,team_id' })
  if (e4) throw e4

  return { team1, team2 }
}
