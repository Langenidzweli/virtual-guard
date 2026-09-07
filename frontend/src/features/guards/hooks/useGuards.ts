// frontend/src/features/guards/hooks/useGuards.ts

import { useState, useEffect, useCallback } from 'react';
import { guardService, type GuardInput } from '@/services/guardService';
import type { Guard, GuardStatus } from '@/types';

interface UseGuardsResult {
  guards: Guard[];
  isLoading: boolean;
  error: string | null;
  addGuard: (values: GuardInput) => Promise<void>;
  editGuard: (id: string, values: GuardInput) => Promise<void>;
  setGuardStatus: (id: string, status: GuardStatus) => Promise<void>;
}

export function useGuards(): UseGuardsResult {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGuards = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await guardService.list();
      setGuards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGuards();
  }, [loadGuards]);

  const addGuard = useCallback(async (values: GuardInput) => {
    const created = await guardService.add(values);
    setGuards((prev) => [...prev, created]);
  }, []);

  const editGuard = useCallback(async (id: string, values: GuardInput) => {
    const updated = await guardService.update(id, values);
    setGuards((prev) => prev.map((g) => (g.id === id ? updated : g)));
  }, []);

  const setGuardStatus = useCallback(async (id: string, status: GuardStatus) => {
    const updated = await guardService.setStatus(id, status);
    setGuards((prev) => prev.map((g) => (g.id === id ? updated : g)));
  }, []);

  return { guards, isLoading, error, addGuard, editGuard, setGuardStatus };
}
