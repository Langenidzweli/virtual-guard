import type { Incident, ReviewStatus } from '@/types'
import { api } from './apiClient'

export const incidentService = {
  addNote(id: string, text: string, noteId: string): Promise<Incident> {
    return api.post<Incident>(`/api/incidents/${id}/notes`, { id: noteId, text })
  },
  list(status?: ReviewStatus): Promise<Incident[]> {
    const query = status ? `?status=${status}` : ''
    return api.get<Incident[]>(`/api/incidents${query}`)
  },

  review(id: string, status: Exclude<ReviewStatus, 'PENDING_REVIEW'>): Promise<Incident> {
    const params = new URLSearchParams({ status })
    return api.patch<Incident>(`/api/incidents/${id}/review?${params.toString()}`)
  },
}
