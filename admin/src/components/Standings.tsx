import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

type Row = { team_id: string; team_name: string; w: number; l: number; d: number; saving: boolean; saved: boolean }

const S = {
  h1:    { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 4 } as React.CSSProperties,
  sub:   { fontSize: 13, color: '#6B7280', marginBottom: 24 } as React.CSSProperties,
  card:  { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 24 } as React.CSSProperties,
  th:    { padding: '12px 16px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' },
  td:    { padding: '12px 16px', fontSize: 14, color: '#111827', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' } as React.CSSProperties,
  input: { padding: '6px 10px', border: '1.5px solid #E5E7EB', borderRadius: 6, fontSize: 13, color: '#111827', width: 56, textAlign: 'center' as const, outline: 'none' },
  btn:   (bg: string, color = '#fff') => ({ padding: '7px 14px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }) as React.CSSProperties,
}

export default function Standings() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: teams } = await supabase.from('teams').select('id, name').order('name')
    if (!teams) { setLoading(false); return }

    const { data: standing } = await supabase.from('standings').select('*')
    const standingMap: Record<string, any> = {}
    standing?.forEach(s => { standingMap[s.team_id] = s })

    setRows(teams.map(t => ({
      team_id: t.id,
      team_name: t.name,
      w: standingMap[t.id]?.w ?? 0,
      l: standingMap[t.id]?.l ?? 0,
      d: standingMap[t.id]?.d ?? 0,
      saving: false,
      saved: false,
    })))
    setLoading(false)
  }

  const update = (team_id: string, field: 'w' | 'l' | 'd', val: string) => {
    setRows(prev => prev.map(r => r.team_id === team_id ? { ...r, [field]: Math.max(0, Number(val) || 0), saved: false } : r))
  }

  const save = async (row: Row) => {
    setRows(prev => prev.map(r => r.team_id === row.team_id ? { ...r, saving: true } : r))
    await supabase.from('standings').upsert(
      { team_id: row.team_id, w: row.w, l: row.l, d: row.d },
      { onConflict: 'team_id' }
    )
    setRows(prev => prev.map(r => r.team_id === row.team_id ? { ...r, saving: false, saved: true } : r))
    setTimeout(() => setRows(prev => prev.map(r => r.team_id === row.team_id ? { ...r, saved: false } : r)), 2000)
  }

  const pts = (r: Row) => r.w * 3 + r.d
  const sorted = [...rows].sort((a, b) => pts(b) - pts(a) || b.w - a.w)

  return (
    <div>
      <h1 style={S.h1}>Standings</h1>
      <p style={S.sub}>Edit W/L/D — points auto-calculate (W×3 + D)</p>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Edit records</div>
      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Team', 'W', 'L', 'D', 'Pts', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#6B7280', padding: 40 }}>No teams yet</td></tr>
              ) : rows.map(row => (
                <tr key={row.team_id}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{row.team_name}</td>
                  <td style={S.td}><input style={S.input} type="number" min="0" value={row.w} onChange={e => update(row.team_id, 'w', e.target.value)} /></td>
                  <td style={S.td}><input style={S.input} type="number" min="0" value={row.l} onChange={e => update(row.team_id, 'l', e.target.value)} /></td>
                  <td style={S.td}><input style={S.input} type="number" min="0" value={row.d} onChange={e => update(row.team_id, 'd', e.target.value)} /></td>
                  <td style={{ ...S.td, fontWeight: 800, color: '#1A56DB' }}>{pts(row)}</td>
                  <td style={S.td}>
                    {row.saved ? (
                      <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>Saved ✓</span>
                    ) : (
                      <button onClick={() => save(row)} disabled={row.saving} style={S.btn(row.saving ? '#93C5FD' : '#1A56DB')}>
                        {row.saving ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>League table</div>
      <div style={S.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Team', 'W', 'L', 'D', 'Pts'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.team_id} style={{ background: i === 0 ? '#EFF6FF' : undefined }}>
                <td style={{ ...S.td, color: '#6B7280', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ ...S.td, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? '#1A56DB' : '#111827' }}>{row.team_name}</td>
                <td style={S.td}>{row.w}</td>
                <td style={S.td}>{row.l}</td>
                <td style={S.td}>{row.d}</td>
                <td style={{ ...S.td, fontWeight: 800, color: i === 0 ? '#1A56DB' : '#111827' }}>{pts(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
