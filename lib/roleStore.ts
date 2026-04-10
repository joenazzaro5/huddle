import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type Role = 'coach' | 'parent'

type RoleContextType = {
  currentRole: Role
  setRole: (role: Role) => void
}

export const RoleContext = createContext<RoleContextType>({
  currentRole: 'coach',
  setRole: () => {},
})

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setRole] = useState<Role>('coach')
  return (
    <RoleContext.Provider value={{ currentRole, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
