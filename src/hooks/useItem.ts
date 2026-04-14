import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ItemDoc } from '@/types/models';

/** Real-time subscription to a single item by id. */
export function useItem(itemId: string): {
  item: ItemDoc | null;
  loading: boolean;
} {
  const [item, setItem] = useState<ItemDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'items', itemId),
      (snap) => {
        if (snap.exists()) {
          setItem({ id: snap.id, ...(snap.data() as Omit<ItemDoc, 'id'>) });
        } else {
          setItem(null);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [itemId]);

  return { item, loading };
}
