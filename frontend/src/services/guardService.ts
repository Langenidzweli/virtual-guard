// frontend/src/services/guardService.ts

import type { Guard, GuardStatus } from '@/types';
import { api } from './apiClient';

export type GuardInput = Omit<Guard, 'id' | 'status' | 'dateJoined'>;

export const guardService = {
  async list(): Promise<Guard[]> {
    return api.get<Guard[]>('/api/guards');
  },

  async add(values: GuardInput): Promise<Guard> {
    return api.post<Guard>('/api/guards', values);
  },

  async update(id: string, values: GuardInput): Promise<Guard> {
    return api.put<Guard>(`/api/guards/${id}`, values);
  },

  async setStatus(id: string, status: GuardStatus): Promise<Guard> {
    return api.patch<Guard>(`/api/guards/${id}/status?status=${status}`);
  },
};