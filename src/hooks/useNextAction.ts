import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ItemDoc } from '@/types/models';
import { useAuth } from './useAuth';

/**
 * The single item the user is most likely to do right now. We query only
 * on userId + bucket='today' + createdAt (reuses the existing items
 * composite index) and pick the lowest-energy, highest-urgency uncompleted
 * one client-side — keeps us off a 5-field composite index the SDK would
 * otherwise demand.
 *
 * One round-trip, one index, one result. The ADHD brain does better with
 * "one thing" than "a list".
 */
export function useNextAction(): { nextItem: ItemDoc | null; loading: boolean } {
  const user = useAuth();
  const [nextItem, setNextItem] = useState<ItemDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNextItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, 'items'),
        where('userId', '==', user.uid),
        where('bucket', '==', 'today'),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        const candidates = snap.docs
          .map(
            (d) => ({ id: d.id, ...(d.data() as Omit<ItemDoc, 'id'>) }),
          )
          .filter((i) => i.completedAt == null);
        const urgencyRank = { high: 0, medium: 1, low: 2 } as const;
        candidates.sort((a, b) => {
          const u = urgencyRank[a.urgency] - urgencyRank[b.urgency];
          if (u !== 0) return u;
          return a.energyLevel - b.energyLevel; // lower energy first
        });
        setNextItem(candidates[0] ?? null);
        setLoading(false);
      },
      (err) => {
        console.warn('useNextAction snapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { nextItem, loading };
}
