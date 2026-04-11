import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const S = {
  h1:    { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  sub:   { fontSize: 13, color: '#6B7280', marginBottom: 24 } as React.CSSProperties,
  card:  { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24 } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 } as React.CSSProperties,
  input: { padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#111827', width: '100%', outline: 'none' } as React.CSSProperties,
  btn:   (bg: string, color = '#fff') => ({ padding: '9px 20px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 13, fontWeight: 700, cursor: 'pointer' }) as React.CSSProperties,
}

type Announcement = { id: string; title: string; message: string; team_id: string | null; created_at: string; team?: { name: string } | null }

export default function Announcements() {
  const [teams, setTeams] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [form, setForm] = useState({ title: '', message: '', team_id: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [{ data: teamData }, { data: annData }] = await Promise.all([
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('announcements').select('*, team:teams(name)').order('created_at', { ascending: false }).limit(30),
    ])
    setTeams(teamData ?? [])
    setAnnouncements((annData ?? []) as Announcement[])
    setLoading(false)
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.message.trim()) { setError('Message is required'); return }
    setSending(true); setError(''); setSuccess('')

    const { error: err } = await supabase.from('announcements').insert({
      title: form.title.trim(),
      message: form.message.trim(),
      team_id: form.team_id || null,
    })

    if (err) { setError(err.message); setSending(false); return }
    setSuccess('Announcement sent!')
    setForm({ title: '', message: '', team_id: '' })
    await loadAll()
    setSending(false)
    setTimeout(() => setSuccess(''), 4000)
  }

  const deleteAnn = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div>
      <h1 style={S.h1}>Announcements</h1>
      <p style={S.sub}>Send messages to one team or all teams</p>

      <div style={S.card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 20 }}>New announcement</div>
        <form onSubmit={send}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>Title</label>
              <input type="text" style={S.input} value={form.title} placeholder="e.g. Game cancelled" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Send to</label>
              <select style={S.input} value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
                <option value="">All teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={5}
              placeholder="Write your announcement here…"
              style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>{error}</div>}
          {success && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16A34A' }}>{success}</div>}

          <button type="submit" disabled={sending} style={S.btn(sending ? '#93C5FD' : '#1A56DB')}>
            {sending ? 'Sending…' : '📢 Send announcement'}
          </button>
        </form>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Past announcements</div>
      {loading ? (
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading…</div>
      ) : announcements.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
          No announcements yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {announcements.map(ann => (
            <div key={ann.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{ann.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {ann.team ? `→ ${(ann.team as any).name}` : '→ All teams'} · {fmtDate(ann.created_at)}
                  </div>
                </div>
                <button onClick={() => deleteAnn(ann.id)} style={S.btn('#FEF2F2', '#DC2626')}>Delete</button>
              </div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{ann.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
