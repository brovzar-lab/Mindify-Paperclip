import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Bucket, EnergyLevel, ItemDoc } from '@/types/models';
import { useAuth } from './useAuth';

export interface UseItemsOptions {
  bucket?: Bucket;
  /** Default false — completed items are hidden from The Brain. */
  includeCompleted?: boolean;
  /**
   * Client-side energy filter. Applied after fetch so toggling doesn't
   * rebuild the Firestore listener (Firestore `in` queries are limited
   * to 10 values, but we only have 3 anyway — keeping this client-side
   * is simpler and cheaper).
   */
  energyLevels?: EnergyLevel[];
  /** Show only items assigned to this topic (for TopicDetailScreen). */
  topicId?: string;
}

/**
 * Real-time subscription to the current user's items, optionally filtered
 * by bucket and topic. Returns ItemDoc[] sorted by createdAt desc; the
 * consumer is expected to bucket / sub-sort for display.
 *
 * Note: createdAt is a Firestore Timestamp on the wire — typed as number
 * in the model for ergonomic reasons. Any code that needs a real Date
 * should call `.toMillis()` / `.toDate()` after fetch.
 */
export function useItems({
  bucket,
  includeCompleted = false,
  energyLevels,
  topicId,
}: UseItemsOptions = {}): { items: ItemDoc[]; loading: boolean } {
  const user = useAuth();
  const [raw, setRaw] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Memoize the energy-filter set key so the effect doesn't treat every
  // array-identity change as a resubscription trigger.
  const energyKey = energyLevels?.slice().sort().join(',') ?? '';

  useEffect(() => {
    if (!user) {
      setRaw([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const constraints: QueryConstraint[] = [where('userId', '==', user.uid)];
    if (bucket) constraints.push(where('bucket', '==', bucket));
    if (topicId) constraints.push(where('topicId', '==', topicId));
    if (!includeCompleted) constraints.push(where('completedAt', '==', null));
    constraints.push(orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      query(collection(db, 'items'), ...constraints),
      (snap) => {
        setRaw(
          snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<ItemDoc, 'id'>) }),
          ),
        );
        setLoading(false);
      },
      (err) => {
        console.warn('useItems snapshot error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user, bucket, includeCompleted, topicId]);

  const items = useMemo(() => {
    if (!energyLevels || energyLevels.length === 0) return raw;
    const set = new Set(energyLevels);
    return raw.filter((i) => set.has(i.energyLevel));
  }, [raw, energyKey]);

  return { items, loading };
}
