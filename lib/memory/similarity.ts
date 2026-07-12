/** Token-overlap guard shared by live capture, candidates, and Dreaming. */
const NEAR_DUPLICATE_JACCARD = 0.5;

function summaryTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

export function isNearDuplicate(a: string, b: string): boolean {
  const left = summaryTokens(a);
  const right = summaryTokens(b);
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  const union = left.size + right.size - shared;
  return shared / union >= NEAR_DUPLICATE_JACCARD;
}
