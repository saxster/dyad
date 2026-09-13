interface TaggedThought {
  id: string;
  tags: string[];
}

export interface ConstellationOptions {
  /** Minimum members for a qualifying subset to count as a constellation. */
  minSize?: number;
  /** Minimum |shared tags| for every pair inside a constellation. */
  minSharedTags?: number;
  /** Minimum pair Jaccard similarity |∩| / |∪|. */
  threshold?: number;
}

export interface Constellation {
  thoughtIds: string[];
  dominantTags: string[];
}

function pairQualifies(
  a: TaggedThought,
  b: TaggedThought,
  minSharedTags: number,
  threshold: number,
): boolean {
  const shared = a.tags.filter((tag) => b.tags.includes(tag));
  if (shared.length < minSharedTags) {
    return false;
  }
  const union = new Set([...a.tags, ...b.tags]);
  return shared.length / union.size >= threshold;
}

/**
 * Detects constellations: maximal groups of thoughts where EVERY pair shares
 * at least `minSharedTags` tags with Jaccard similarity ≥ `threshold`. Tags
 * present in at least half the members become dominant tags, ordered by
 * member count descending then alphabetically. O(n³)-ish clique search is
 * fine at thought-capture scale.
 */
export function detectConstellations(
  thoughts: TaggedThought[],
  {
    minSize = 3,
    minSharedTags = 2,
    threshold = 0.5,
  }: ConstellationOptions = {},
): Constellation[] {
  const qualifies = (i: number, j: number): boolean =>
    pairQualifies(thoughts[i], thoughts[j], minSharedTags, threshold);

  const cliques: number[][] = [];
  const grow = (current: number[], candidates: number[]): void => {
    if (candidates.length === 0) {
      if (current.length >= minSize) {
        cliques.push([...current]);
      }
      return;
    }
    for (const candidate of candidates) {
      if (current.some((member) => !qualifies(member, candidate))) {
        continue;
      }
      const next = candidates.filter(
        (other) => other > candidate && qualifies(candidate, other),
      );
      grow([...current, candidate], next);
    }
  };
  grow(
    [],
    thoughts.map((_, index) => index),
  );

  return cliques.map((clique) => {
    const members = clique.map((index) => thoughts[index]);
    const tagCounts = new Map<string, number>();
    for (const member of members) {
      for (const tag of member.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const half = members.length / 2;
    const dominantTags = [...tagCounts.entries()]
      .filter(([, count]) => count >= half)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
    return {
      thoughtIds: clique.map((index) => thoughts[index].id),
      dominantTags,
    };
  });
}
