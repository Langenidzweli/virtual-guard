// frontend/src/services/cameraService.ts

import type { StoreCamera } from '@/types';
import { api } from './apiClient';

export interface CameraInput {
  id: string;
  label: string;
  x: number;
  y: number;
  monitored: boolean;
  siteId?: string;
  streamUrl?: string;
}

function normalizeCamera(camera: Omit<StoreCamera, 'status'> & { status: string }): StoreCamera {
  return { ...camera, status: camera.status.toLowerCase() as StoreCamera['status'] };
}

export const cameraService = {
  async getCameras(): Promise<StoreCamera[]> {
    const cameras = await api.get<Array<Omit<StoreCamera, 'status'> & { status: string }>>('/api/cameras');
    return cameras.map(normalizeCamera);
  },

  async create(input: CameraInput): Promise<StoreCamera> {
    return normalizeCamera(await api.post<Omit<StoreCamera, 'status'> & { status: string }>('/api/cameras', input));
  },

  async update(id: string, input: CameraInput): Promise<StoreCamera> {
    return normalizeCamera(await api.put<Omit<StoreCamera, 'status'> & { status: string }>(`/api/cameras/${encodeURIComponent(id)}`, input));
  },
};
