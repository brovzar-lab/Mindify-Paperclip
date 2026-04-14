import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Bucket, ItemDoc } from '@/types/models';
import { useAuth } from './useAuth';

export interface UseItemsOptions {
  bucket?: Bucket;
  /** Default false — completed items are hidden from The Brain. */
  includeCompleted?: boolean;
}

/**
 * Real-time subscription to the current user's items, optionally filtered
 * by bucket. Returns ItemDoc[] sorted by createdAt desc; the consumer is
 * expected to bucket / sub-sort for display.
 *
 * Note: createdAt is a Firestore Timestamp on the wire — typed as number
 * in the model for ergonomic reasons. Any code that needs a real Date
 * should call `.toMillis()` / `.toDate()` after fetch.
 */
export function useItems({
  bucket,
  includeCompleted = false,
}: UseItemsOptions = {}): { items: ItemDoc[]; loading: boolean } {
  const user = useAuth();
  const [items, setItems] = useState<ItemDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const constraints: QueryConstraint[] = [where('userId', '==', user.uid)];
    if (bucket) constraints.push(where('bucket', '==', bucket));
    if (!includeCompleted) constraints.push(where('completedAt', '==', null));
    constraints.push(orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      query(collection(db, 'items'), ...constraints),
      (snap) => {
        setItems(
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
  }, [user, bucket, includeCompleted]);

  return { items, loading };
}
