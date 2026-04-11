import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14']
const GENDERS = ['Boys', 'Girls', 'Coed']
const COLORS = ['#1A56DB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777']

type Team = {
  id: string
  name: string
  age_group: string
  gender: string
  color: string
  player_count?: number
  coach_name?: string
}

const blank = { name: '', age_group: 'U10', gender: 'Coed', color: '#1A56DB' }

const S = {
  h1:    { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  sub:   { fontSize: 13, color: '#6B7280', marginBottom: 24 } as React.CSSProperties,
  card:  { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 24 } as React.CSSProperties,
  th:    { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' },
  td:    { padding: '14px 16px', fontSize: 14, color: '#111827', borderBottom: '1px solid #F3F4F6' } as React.CSSProperties,
  input: { padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#111827', width: '100%', outline: 'none' } as React.CSSProperties,
  btn:   (bg: string, color = '#fff') => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }) as React.CSSProperties,
}

export default function TeamsManager() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadTeams() }, [])

  const loadTeams = async () => {
    setLoading(true)
    const { data: teamData } = await supabase.from('teams').select('*').order('name')
    if (!teamData) { setLoading(false); return }

    const enriched = await Promise.all(teamData.map(async (t) => {
      const [{ count: pc }, { data: coaches }] = await Promise.all([
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', t.id).eq('is_active', true),
        supabase.from('team_members').select('user:users(display_name, email)').eq('team_id', t.id).eq('role', 'coach').limit(1),
      ])
      const coachUser = (coaches?.[0] as any)?.user
      return {
        ...t,
        player_count: pc ?? 0,
        coach_name: coachUser?.display_name || coachUser?.email?.split('@')[0] || '—',
      }
    }))
    setTeams(enriched)
    setLoading(false)
  }

  const addTeam = async () => {
    if (!form.name.trim()) { setError('Team name is required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('teams').insert({
      name: form.name.trim(),
      age_group: form.age_group,
      gender: form.gender,
      color: form.color,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setForm(blank); setShowAdd(false)
    await loadTeams()
    setSaving(false)
  }

  const saveEdit = async () => {
    if (!editId || !editForm.name.trim()) { setError('Team name is required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('teams').update({
      name: editForm.name.trim(),
      age_group: editForm.age_group,
      gender: editForm.gender,
      color: editForm.color,
    }).eq('id', editId)
    if (err) { setError(err.message); setSaving(false); return }
    setEditId(null)
    await loadTeams()
    setSaving(false)
  }

  const deleteTeam = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('teams').delete().eq('id', id)
    await loadTeams()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={S.h1}>Teams</h1>
          <p style={S.sub}>{teams.length} team{teams.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { setShowAdd(v => !v); setError('') }} style={S.btn('#1A56DB')}>
          {showAdd ? 'Cancel' : '+ Add team'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
          {error}
        </div>
      )}

      {showAdd && (
        <div style={{ ...S.card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>New team</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>Team name</label>
              <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="FC Example" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>Age group</label>
              <select style={{ ...S.input }} value={form.age_group} onChange={e => setForm(f => ({ ...f, age_group: e.target.value }))}>
                {AGE_GROUPS.map(ag => <option key={ag}>{ag}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>Gender</label>
              <select style={{ ...S.input }} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                    width: 24, height: 24, borderRadius: '50%', border: form.color === c ? '3px solid #111827' : '2px solid transparent',
                    background: c, cursor: 'pointer',
                  }} />
                ))}
              </div>
            </div>
            <button onClick={addTeam} disabled={saving} style={S.btn('#1A56DB')}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>Loading teams…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Age group', 'Gender', 'Players', 'Coach', 'Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#6B7280', padding: 40 }}>No teams yet</td></tr>
              ) : teams.map(team => (
                editId === team.id ? (
                  <tr key={team.id}>
                    <td style={S.td}><input style={S.input} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
                    <td style={S.td}>
                      <select style={S.input} value={editForm.age_group} onChange={e => setEditForm(f => ({ ...f, age_group: e.target.value }))}>
                        {AGE_GROUPS.map(ag => <option key={ag}>{ag}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>
                      <select style={S.input} value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                        {GENDERS.map(g => <option key={g}>{g}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>{team.player_count}</td>
                    <td style={S.td}>{team.coach_name}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={saveEdit} disabled={saving} style={S.btn('#1A56DB')}>Save</button>
                        <button onClick={() => setEditId(null)} style={S.btn('#F3F4F6', '#374151')}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={team.id}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{team.name}</span>
                      </div>
                    </td>
                    <td style={S.td}>{team.age_group}</td>
                    <td style={S.td}>{team.gender}</td>
                    <td style={S.td}>{team.player_count}</td>
                    <td style={S.td}>{team.coach_name}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setEditId(team.id); setEditForm({ name: team.name, age_group: team.age_group, gender: team.gender, color: team.color }) }} style={S.btn('#F3F4F6', '#374151')}>Edit</button>
                        <button onClick={() => deleteTeam(team.id, team.name)} style={S.btn('#FEF2F2', '#DC2626')}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
