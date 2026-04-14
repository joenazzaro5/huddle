import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type Role = 'coach' | 'parent'

type RoleContextType = {
  currentRole: Role
  setRole: (role: Role) => void
  activeTeamId: string | null
  setActiveTeamId: (teamId: string | null) => void
}

export const RoleContext = createContext<RoleContextType>({
  currentRole: 'coach',
  setRole: () => {},
  activeTeamId: null,
  setActiveTeamId: () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setRole] = useState<Role>('coach')
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  return (
    <RoleContext.Provider value={{ currentRole, setRole, activeTeamId, setActiveTeamId }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  try {
    return useContext(RoleContext)
  } catch {
    return { currentRole: 'coach' as const, setRole: (_role: Role) => {} }
  }
}
