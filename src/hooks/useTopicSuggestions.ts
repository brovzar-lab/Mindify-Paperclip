import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TopicSuggestionDoc } from '@/types/models';
import { useAuth } from './useAuth';

/**
 * Pending topic suggestions created by processRecording. The banner in
 * BrainScreen reads this and offers the user an approve / reject choice.
 *
 * Queried on userId + createdAt (existing composite shape) with status
 * filtered client-side — there are only ever a handful of pending
 * suggestions so in-memory filtering is cheaper than another index.
 */
export function useTopicSuggestions(): {
  suggestions: TopicSuggestionDoc[];
  loading: boolean;
} {
  const user = useAuth();
  const [suggestions, setSuggestions] = useState<TopicSuggestionDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, 'topicSuggestions'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        setSuggestions(
          snap.docs
            .map(
              (d) => ({
                id: d.id,
                ...(d.data() as Omit<TopicSuggestionDoc, 'id'>),
              }),
            )
            .filter((s) => s.status === 'pending'),
        );
        setLoading(false);
      },
      (err) => {
        console.warn('useTopicSuggestions snapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { suggestions, loading };
}
