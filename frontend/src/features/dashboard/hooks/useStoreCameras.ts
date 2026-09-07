// frontend/src/features/dashboard/hooks/useStoreCameras.ts

import { useEffect, useState } from 'react';
import { cameraService } from '@/services/cameraService';
import type { StoreCamera } from '@/types';

interface UseStoreCamerasResult {
  cameras: StoreCamera[];
  setCameras: React.Dispatch<React.SetStateAction<StoreCamera[]>>;
  isLoading: boolean;
  error: string | null;
}

export function useStoreCameras(): UseStoreCamerasResult {
  const [cameras, setCameras] = useState<StoreCamera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCameras() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await cameraService.getCameras();
        if (!cancelled) {
          setCameras(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load cameras');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCameras();

    return () => {
      cancelled = true;
    };
  }, []);

  return { cameras, setCameras, isLoading, error };
}