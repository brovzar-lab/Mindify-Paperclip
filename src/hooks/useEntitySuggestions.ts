import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EntitySuggestionDoc } from '@/types/models';
import { useAuth } from './useAuth';
import { scheduleEntityConfirmationNotification } from '@/lib/notifications';

/**
 * Pending entity suggestions. Each newly-added pending suggestion also
 * fires a local notification so the user gets prompted even if the app
 * is backgrounded.
 *
 * We query only on userId + createdAt (existing composite index) and
 * filter by status client-side — there are at most a handful of pending
 * suggestions at any time, and avoiding a second where-clause keeps us
 * off the composite-index dependency list.
 *
 * Notifications dedupe on suggestion id — we track ids we've already
 * notified about in a ref so re-mounting the hook doesn't re-fire.
 */
export function useEntitySuggestions(): {
  suggestions: EntitySuggestionDoc[];
  loading: boolean;
} {
  const user = useAuth();
  const [suggestions, setSuggestions] = useState<EntitySuggestionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, 'entitySuggestions'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        const pending = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<EntitySuggestionDoc, 'id'>),
          }))
          .filter((s) => s.status === 'pending');
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const id = change.doc.id;
          if (notifiedIds.current.has(id)) return;
          const data = change.doc.data() as Omit<EntitySuggestionDoc, 'id'>;
          if (data.status !== 'pending') return;
          notifiedIds.current.add(id);
          scheduleEntityConfirmationNotification({
            suggestionId: id,
            name: data.name,
            relationship: data.relationship ?? undefined,
          });
        });
        setSuggestions(pending);
        setLoading(false);
      },
      (err) => {
        console.warn('useEntitySuggestions snapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  return { suggestions, loading };
}
