import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const EVENT_TYPES = ['practice', 'game', 'other']

const S = {
  h1:    { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  sub:   { fontSize: 13, color: '#6B7280', marginBottom: 24 } as React.CSSProperties,
  card:  { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24 } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 } as React.CSSProperties,
  input: { padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#111827', width: '100%', outline: 'none' } as React.CSSProperties,
  th:    { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' },
  td:    { padding: '13px 16px', fontSize: 14, color: '#111827', borderBottom: '1px solid #F3F4F6' } as React.CSSProperties,
  btn:   (bg: string, color = '#fff') => ({ padding: '9px 18px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 13, fontWeight: 600, cursor: 'pointer' }) as React.CSSProperties,
}

const today = new Date().toISOString().split('T')[0]

const blankForm = { team_id: '', type: 'practice', date: today, time: '16:00', duration_min: 60, location: '', opponent: '', focus: '' }

export default function ScheduleBuilder() {
  const [teams, setTeams] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [form, setForm] = useState({ ...blankForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: teamData }, { data: eventData }] = await Promise.all([
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('events').select('*, team:teams(name)').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(50),
    ])
    setTeams(teamData ?? [])
    setEvents(eventData ?? [])
    if (teamData && teamData.length > 0 && !form.team_id) {
      setForm(f => ({ ...f, team_id: teamData[0].id }))
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.team_id) { setError('Please select a team'); return }
    setSaving(true); setError(''); setSuccess('')

    const starts_at = new Date(`${form.date}T${form.time}:00`).toISOString()
    const payload: any = {
      team_id: form.team_id,
      type: form.type,
      starts_at,
      duration_min: Number(form.duration_min),
      location: form.location || null,
    }
    if (form.type === 'game') payload.opponent = form.opponent || null
    if (form.type === 'practice') payload.focus = form.focus || null

    const { error: err } = await supabase.from('events').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }

    setSuccess('Event added!')
    setForm(f => ({ ...blankForm, team_id: f.team_id }))
    await loadAll()
    setSaving(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return
    await supabase.from('events').delete().eq('id', id)
    await loadAll()
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const typeColor: Record<string, string> = { practice: '#1A56DB', game: '#F97316', other: '#6B7280' }

  return (
    <div>
      <h1 style={S.h1}>Schedule</h1>
      <p style={S.sub}>Add and manage upcoming events</p>

      <div style={S.card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Add event</div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Team</label>
              <select style={S.input} value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Type</label>
              <select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Duration (min)</label>
              <input type="number" style={S.input} value={form.duration_min} min={15} max={180} onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Date</label>
              <input type="date" style={S.input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Time</label>
              <input type="time" style={S.input} value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={S.label}>Location</label>
              <input type="text" style={S.input} value={form.location} placeholder="Field name or address" onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            {form.type === 'game' ? (
              <div>
                <label style={S.label}>Opponent</label>
                <input type="text" style={S.input} value={form.opponent} placeholder="vs. Team Name" onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} />
              </div>
            ) : form.type === 'practice' ? (
              <div>
                <label style={S.label}>Focus (optional)</label>
                <input type="text" style={S.input} value={form.focus} placeholder="e.g. Dribbling" onChange={e => setForm(f => ({ ...f, focus: e.target.value }))} />
              </div>
            ) : <div />}
          </div>

          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>{error}</div>}
          {success && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16A34A' }}>{success}</div>}

          <button type="submit" disabled={saving} style={S.btn(saving ? '#93C5FD' : '#1A56DB')}>
            {saving ? 'Saving…' : 'Add event'}
          </button>
        </form>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
        Upcoming events
      </div>
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Time', 'Type', 'Team', 'Details', 'Location', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#6B7280', padding: 40 }}>No upcoming events</td></tr>
              ) : events.map(ev => (
                <tr key={ev.id}>
                  <td style={S.td}>{fmtDate(ev.starts_at)}</td>
                  <td style={S.td}>{fmtTime(ev.starts_at)}</td>
                  <td style={S.td}>
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: (typeColor[ev.type] ?? '#6B7280') + '18', color: typeColor[ev.type] ?? '#6B7280' }}>
                      {ev.type}
                    </span>
                  </td>
                  <td style={S.td}>{(ev.team as any)?.name ?? '—'}</td>
                  <td style={S.td}>{ev.type === 'game' ? `vs ${ev.opponent ?? 'TBD'}` : ev.focus ?? '—'}</td>
                  <td style={S.td}>{ev.location ?? '—'}</td>
                  <td style={S.td}>
                    <button onClick={() => deleteEvent(ev.id)} style={S.btn('#FEF2F2', '#DC2626')}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
