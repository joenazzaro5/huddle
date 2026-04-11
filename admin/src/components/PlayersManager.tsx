import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const POSITIONS = ['GK', 'Defender', 'Midfielder', 'Forward']

type Team = { id: string; name: string; color: string }
type Player = {
  id: string
  team_id: string
  jersey_number: number | null
  first_name: string
  last_name: string
  position: string
  is_active: boolean
}

const blankForm = { jersey_number: '', first_name: '', last_name: '', position: 'Midfielder', is_active: true }

const S = {
  h1:    { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  sub:   { fontSize: 13, color: '#6B7280', marginBottom: 24 } as React.CSSProperties,
  card:  { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 24 } as React.CSSProperties,
  th:    { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' },
  td:    { padding: '14px 16px', fontSize: 14, color: '#111827', borderBottom: '1px solid #F3F4F6' } as React.CSSProperties,
  input: { padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#111827', width: '100%', outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  btn:   (bg: string, color = '#fff') => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }) as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 } as React.CSSProperties,
}

export default function PlayersManager() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('teams').select('id, name, color').order('name').then(({ data }) => {
      setTeams(data ?? [])
      setLoadingTeams(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedTeamId) { setPlayers([]); return }
    setLoadingPlayers(true)
    supabase
      .from('players')
      .select('*')
      .eq('team_id', selectedTeamId)
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setPlayers(data ?? [])
        setLoadingPlayers(false)
      })
  }, [selectedTeamId])

  const selectedTeam = teams.find(t => t.id === selectedTeamId)

  const addPlayer = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name are required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('players').insert({
      team_id: selectedTeamId,
      jersey_number: form.jersey_number !== '' ? Number(form.jersey_number) : null,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      position: form.position,
      is_active: form.is_active,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setForm(blankForm); setShowAdd(false)
    setLoadingPlayers(true)
    const { data } = await supabase.from('players').select('*').eq('team_id', selectedTeamId).order('jersey_number', { ascending: true, nullsFirst: false })
    setPlayers(data ?? [])
    setLoadingPlayers(false)
    setSaving(false)
  }

  const saveEdit = async () => {
    if (!editId || !editForm.first_name.trim() || !editForm.last_name.trim()) { setError('First and last name are required'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('players').update({
      jersey_number: editForm.jersey_number !== '' ? Number(editForm.jersey_number) : null,
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      position: editForm.position,
      is_active: editForm.is_active,
    }).eq('id', editId)
    if (err) { setError(err.message); setSaving(false); return }
    setEditId(null)
    const { data } = await supabase.from('players').select('*').eq('team_id', selectedTeamId).order('jersey_number', { ascending: true, nullsFirst: false })
    setPlayers(data ?? [])
    setSaving(false)
  }

  const deletePlayer = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('players').delete().eq('id', id)
    setPlayers(ps => ps.filter(p => p.id !== id))
  }

  const startEdit = (p: Player) => {
    setEditId(p.id)
    setEditForm({
      jersey_number: p.jersey_number != null ? String(p.jersey_number) : '',
      first_name: p.first_name,
      last_name: p.last_name,
      position: p.position,
      is_active: p.is_active,
    })
    setShowAdd(false)
    setError('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={S.h1}>Players</h1>
          <p style={S.sub}>Manage players by team</p>
        </div>
        {selectedTeamId && (
          <button
            onClick={() => { setShowAdd(v => !v); setEditId(null); setError('') }}
            style={S.btn('#1A56DB')}
          >
            {showAdd ? 'Cancel' : '+ Add player'}
          </button>
        )}
      </div>

      {/* Team selector */}
      <div style={{ ...S.card, padding: 20, marginBottom: 20 }}>
        <label style={S.label}>Select team</label>
        {loadingTeams ? (
          <div style={{ fontSize: 13, color: '#6B7280' }}>Loading teams…</div>
        ) : (
          <select
            style={{ ...S.input, maxWidth: 320 }}
            value={selectedTeamId}
            onChange={e => { setSelectedTeamId(e.target.value); setShowAdd(false); setEditId(null); setError('') }}
          >
            <option value="">— Choose a team —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Add player form */}
      {showAdd && selectedTeamId && (
        <div style={{ ...S.card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>New player</div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 140px 100px auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={S.label}>#</label>
              <input style={S.input} type="number" min={0} max={99} value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} placeholder="—" />
            </div>
            <div>
              <label style={S.label}>First name</label>
              <input style={S.input} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Alex" />
            </div>
            <div>
              <label style={S.label}>Last name</label>
              <input style={S.input} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Smith" />
            </div>
            <div>
              <label style={S.label}>Position</label>
              <select style={S.input} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                {POSITIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Active</label>
              <div style={{ display: 'flex', alignItems: 'center', height: 36 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </div>
            </div>
            <button onClick={addPlayer} disabled={saving} style={{ ...S.btn('#1A56DB'), alignSelf: 'flex-end' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Players table */}
      {selectedTeamId && (
        <div style={S.card}>
          {loadingPlayers ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>Loading players…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'First Name', 'Last Name', 'Position', 'Active', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#6B7280', padding: 40 }}>
                      No players on {selectedTeam?.name ?? 'this team'} yet
                    </td>
                  </tr>
                ) : players.map(player => (
                  editId === player.id ? (
                    <tr key={player.id}>
                      <td style={S.td}>
                        <input style={{ ...S.input, width: 60 }} type="number" min={0} max={99} value={editForm.jersey_number} onChange={e => setEditForm(f => ({ ...f, jersey_number: e.target.value }))} />
                      </td>
                      <td style={S.td}>
                        <input style={S.input} value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                      </td>
                      <td style={S.td}>
                        <input style={S.input} value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                      </td>
                      <td style={S.td}>
                        <select style={S.input} value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}>
                          {POSITIONS.map(p => <option key={p}>{p}</option>)}
                        </select>
                      </td>
                      <td style={S.td}>
                        <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={saveEdit} disabled={saving} style={S.btn('#1A56DB')}>Save</button>
                          <button onClick={() => setEditId(null)} style={S.btn('#F3F4F6', '#374151')}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={player.id}>
                      <td style={{ ...S.td, color: '#6B7280', fontWeight: 600 }}>
                        {player.jersey_number != null ? player.jersey_number : '—'}
                      </td>
                      <td style={S.td}>{player.first_name}</td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{player.last_name}</td>
                      <td style={S.td}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                          background: player.position === 'GK' ? '#FEF3C7' : player.position === 'Defender' ? '#DBEAFE' : player.position === 'Midfielder' ? '#D1FAE5' : '#FCE7F3',
                          color: player.position === 'GK' ? '#92400E' : player.position === 'Defender' ? '#1E40AF' : player.position === 'Midfielder' ? '#065F46' : '#9D174D',
                        }}>
                          {player.position}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                          background: player.is_active ? '#D1FAE5' : '#F3F4F6',
                          color: player.is_active ? '#065F46' : '#6B7280',
                        }}>
                          {player.is_active ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startEdit(player)} style={S.btn('#F3F4F6', '#374151')}>Edit</button>
                          <button onClick={() => deletePlayer(player.id, `${player.first_name} ${player.last_name}`)} style={S.btn('#FEF2F2', '#DC2626')}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
