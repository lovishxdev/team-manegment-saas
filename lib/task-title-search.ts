/** Tokenize a task title or search phrase into comparable words. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-/.,]+/)
    .filter((w) => w.length >= 2);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function wordMatchScore(queryWord: string, candidate: string): number {
  const q = queryWord.toLowerCase();
  const c = candidate.toLowerCase();
  if (c.includes(q) || q.includes(c)) return 1;
  if (q.length < 4 || c.length < 4) return 0;
  const dist = levenshtein(q, c);
  const threshold = Math.max(1, Math.floor(Math.min(q.length, c.length) / 5));
  if (dist <= threshold) return 1 - dist * 0.2;
  return 0;
}

/** 0–1 score for how well a task title/description matches a free-text query. */
export function scoreTaskTitleQuery(
  query: string,
  title: string,
  description?: string | null
): number {
  const queryWords = tokenize(query);
  if (queryWords.length === 0) return 0;

  const titleText = title.toLowerCase();
  const titleWords = tokenize(title);
  const descWords = description ? tokenize(description) : [];
  const pool = [...new Set([...titleWords, ...descWords])];

  let total = 0;
  for (const qw of queryWords) {
    let best = 0;
    for (const tw of pool) {
      best = Math.max(best, wordMatchScore(qw, tw));
    }
    if (best === 0 && qw.length >= 4 && titleText.includes(qw.slice(0, 4))) {
      best = 0.35;
    }
    total += best;
  }

  return total / queryWords.length;
}

export function rankTasksByTitleQuery<
  T extends { title: string; description: string | null },
>(query: string, tasks: T[], minScore = 0.45): T[] {
  return tasks
    .map((task) => ({
      task,
      score: scoreTaskTitleQuery(query, task.title, task.description),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.task);
}
