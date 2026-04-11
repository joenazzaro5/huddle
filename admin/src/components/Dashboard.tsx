import { useState } from 'react'
import TeamsManager from './TeamsManager'
import PlayersManager from './PlayersManager'
import ScheduleBuilder from './ScheduleBuilder'
import Standings from './Standings'
import Announcements from './Announcements'

type Section = 'teams' | 'players' | 'schedule' | 'standings' | 'announcements'

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'teams',         label: 'Teams',         icon: '👥' },
  { key: 'players',       label: 'Players',       icon: '⚽' },
  { key: 'schedule',      label: 'Schedule',      icon: '📅' },
  { key: 'standings',     label: 'Standings',     icon: '🏆' },
  { key: 'announcements', label: 'Announcements', icon: '📢' },
]

export default function Dashboard({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  const [active, setActive] = useState<Section>('teams')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#111827', display: 'flex', flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{ padding: '28px 20px 20px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>
            ⚽ Huddle Admin
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
            {user?.email}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {NAV.map(item => {
            const isActive = active === item.key
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isActive ? '#1A56DB' : 'transparent',
                  color: isActive ? '#fff' : '#9CA3AF',
                  fontSize: 14, fontWeight: isActive ? 700 : 500,
                  textAlign: 'left', marginBottom: 2,
                  transition: 'background 0.15s',
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '16px 12px 24px' }}>
          <button
            onClick={onSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#6B7280',
              fontSize: 14, fontWeight: 500,
            }}
          >
            <span>↩</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#F9FAFB' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 28px' }}>
          {active === 'teams'         && <TeamsManager />}
          {active === 'players'       && <PlayersManager />}
          {active === 'schedule'      && <ScheduleBuilder />}
          {active === 'standings'     && <Standings />}
          {active === 'announcements' && <Announcements />}
        </div>
      </main>
    </div>
  )
}
