import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserDoc } from '@/types/models';
import { useAuth } from './useAuth';

/**
 * Real-time subscription to the current user's profile doc. Returns the
 * parsed doc (or null while loading / when not signed in).
 *
 * The doc may not exist yet for first-time users — we expose
 * `exists: false` so callers can decide whether to show defaults or
 * prompt the user to complete onboarding.
 */
export function useUser(): {
  user: UserDoc | null;
  exists: boolean;
  loading: boolean;
} {
  const auth = useAuth();
  const [user, setUser] = useState<UserDoc | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setExists(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', auth.uid),
      (snap) => {
        if (snap.exists()) {
          setUser({ uid: snap.id, ...(snap.data() as Omit<UserDoc, 'uid'>) });
          setExists(true);
        } else {
          setUser(null);
          setExists(false);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('useUser snapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [auth]);

  return { user, exists, loading };
}
