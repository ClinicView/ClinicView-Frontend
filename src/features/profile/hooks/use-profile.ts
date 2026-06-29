'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/shared/services/api-client';
import { getCurrentUserProfile } from '../services/profile.service';
import type { ProfileUser } from '../types/profile';

export function useProfile() {
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getCurrentUserProfile()
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el perfil.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { profile, isLoading, error };
}
