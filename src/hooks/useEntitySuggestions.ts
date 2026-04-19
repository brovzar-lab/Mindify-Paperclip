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
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const id = change.doc.id;
          if (notifiedIds.current.has(id)) return;
          notifiedIds.current.add(id);
          const data = change.doc.data() as Omit<EntitySuggestionDoc, 'id'>;
          // Fire a local push so the user gets reminded even if they
          // switched away from the app after recording. The handler is
          // a no-op if notification permission was not granted.
          scheduleEntityConfirmationNotification({
            suggestionId: id,
            name: data.name,
            relationship: data.relationship ?? undefined,
          });
        });
        setSuggestions(
          snap.docs.map(
            (d) => ({
              id: d.id,
              ...(d.data() as Omit<EntitySuggestionDoc, 'id'>),
            }),
          ),
        );
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
