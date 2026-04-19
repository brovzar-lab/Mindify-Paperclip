import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ItemDoc } from '@/types/models';
import { useAuth } from './useAuth';

/**
 * The single item the user is most likely to actually do right now:
 * bucket=today, high urgency, not completed, lowest energy first so we
 * surface the fastest win. The ADHD brain does better with "one thing"
 * than "a list".
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
        where('completedAt', '==', null),
        where('bucket', '==', 'today'),
        where('urgency', '==', 'high'),
        orderBy('energyLevel', 'asc'),
        orderBy('createdAt', 'desc'),
        limit(1),
      ),
      (snap) => {
        const d = snap.docs[0];
        setNextItem(
          d ? { id: d.id, ...(d.data() as Omit<ItemDoc, 'id'>) } : null,
        );
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
