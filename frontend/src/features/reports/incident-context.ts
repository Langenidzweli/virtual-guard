import { createContext, useContext, type Dispatch, type SetStateAction } from 'react'
import type { Incident } from '@/types'
export const IncidentContext = createContext<{
  incidents: Incident[]
  setIncidents: Dispatch<SetStateAction<Incident[]>>
} | null>(null)

export function useIncidentRecords() {
  const context = useContext(IncidentContext)
  if (!context) throw new Error('Incident views must be inside IncidentWorkspace')
  return context
}
