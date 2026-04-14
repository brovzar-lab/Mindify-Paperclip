import type { ClassifiedItem } from './types';

/**
 * Smart-grouping heuristic (runs inside processRecording before we write to
 * Firestore). Clusters items from a single recording that share both a
 * category AND at least one non-stopword token in their titles. Only
 * clusters of size >= 2 are promoted to groups; singletons are left alone.
 *
 * This is intentionally simple for MVP. WS4 can upgrade to embeddings or
 * run grouping cross-session once we see real usage patterns.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
  'have', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'will', 'with', 'i', 'my', 'me', 'you', 'your', 'need', 'needs',
]);

export interface ProposedGroup {
  title: string;
  category: string;
  itemIndices: number[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function proposeGroups(items: ClassifiedItem[]): ProposedGroup[] {
  // Bucket items by category first — grouping never crosses categories.
  const byCategory = new Map<string, number[]>();
  items.forEach((item, index) => {
    const arr = byCategory.get(item.category) ?? [];
    arr.push(index);
    byCategory.set(item.category, arr);
  });

  const groups: ProposedGroup[] = [];

  for (const [category, indices] of byCategory) {
    if (indices.length < 2) continue;

    // Union-find across items in this category: connect pairs that share
    // any non-stopword token in their titles.
    const parent = new Map<number, number>(indices.map((i) => [i, i]));
    const find = (i: number): number => {
      const p = parent.get(i)!;
      if (p === i) return i;
      const root = find(p);
      parent.set(i, root);
      return root;
    };
    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    const tokens = indices.map((i) => tokenize(items[i].title));
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const overlap = [...tokens[a]].some((t) => tokens[b].has(t));
        if (overlap) union(indices[a], indices[b]);
      }
    }

    // Collect connected components of size >= 2.
    const components = new Map<number, number[]>();
    for (const i of indices) {
      const root = find(i);
      const arr = components.get(root) ?? [];
      arr.push(i);
      components.set(root, arr);
    }

    for (const members of components.values()) {
      if (members.length < 2) continue;
      // Title = most frequent non-stopword across the members' titles;
      // falls back to just the category name if nothing lines up.
      const freq = new Map<string, number>();
      for (const i of members) {
        for (const t of tokenize(items[i].title)) {
          freq.set(t, (freq.get(t) ?? 0) + 1);
        }
      }
      const [topWord] = [...freq.entries()].sort((a, b) => b[1] - a[1]);
      const title = topWord
        ? `${topWord[0][0].toUpperCase()}${topWord[0].slice(1)} (${category})`
        : `${category} cluster`;
      groups.push({ title, category, itemIndices: members });
    }
  }

  return groups;
}
