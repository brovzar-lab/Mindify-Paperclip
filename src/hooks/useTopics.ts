import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TopicDoc } from '@/types/models';
import { useAuth } from './useAuth';

/**
 * Real-time subscription to the user's persistent topics. Sorted by
 * lastUpdatedAt desc so the most recently touched topic renders first —
 * it's almost always the one the user is thinking about.
 */
export function useTopics(): { topics: TopicDoc[]; loading: boolean } {
  const user = useAuth();
  const [topics, setTopics] = useState<TopicDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTopics([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, 'topics'),
        where('userId', '==', user.uid),
        orderBy('lastUpdatedAt', 'desc'),
      ),
      (snap) => {
        setTopics(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<TopicDoc, 'id'>) }),
          ),
        );
        setLoading(false);
      },
      (err) => {
        console.warn('useTopics snapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { topics, loading };
}
