import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ensureAnonymousAuth } from '@/lib/firebase';
import { Loading } from './Loading';

/**
 * Blocks rendering until the user is signed in. MVP is anonymous-only —
 * users get a Firebase anon UID on first launch and reuse it across
 * sessions thanks to AsyncStorage persistence in lib/firebase. Apple/
 * Google social auth is deferred (see TECHNICAL_PLAN.md).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      ensureAnonymousAuth().catch((err: Error) => setError(err.message));
    }
  }, [user]);

  if (error) return <Loading message={`Sign-in failed: ${error}`} />;
  if (!user) return <Loading message="Signing in..." />;
  return <>{children}</>;
}
