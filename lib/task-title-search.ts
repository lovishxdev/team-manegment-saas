import { markdownToPlainText } from "@/lib/markdown/parse";

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
  if (q === c) return 1;
  if (q.length < 3 || c.length < 3) return 0;

  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  const threshold = Math.max(1, Math.floor(maxLen / 4));
  if (dist <= threshold) {
    return 1 - dist / maxLen;
  }
  return 0;
}

/**
 * Title-centric score: map an LLM-provided task_ref onto a board title.
 * Tolerates typos; does not parse task names out of raw chat text.
 */
export function scoreTaskTitleDirect(query: string, title: string): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase().trim();
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (q.includes(t)) return 0.98;
  if (t.includes(q) && q.length >= Math.min(t.length * 0.6, 12)) return 0.92;

  const titleTokens = tokenize(title);
  if (titleTokens.length === 0) return 0;

  let matched = 0;
  for (const tt of titleTokens) {
    let best = 0;
    if (q.includes(tt)) {
      best = 1;
    } else {
      for (const qt of tokenize(query)) {
        best = Math.max(best, wordMatchScore(tt, qt));
      }
    }
    matched += best;
  }
  const coverage = matched / titleTokens.length;

  const tCompact = t.replace(/\s+/g, "");
  const qCompact = q.replace(/\s+/g, "");
  let fuzzyBest = 0;
  if (tCompact.length >= 6 && qCompact.includes(tCompact)) {
    fuzzyBest = 0.95;
  } else if (tCompact.length >= 6) {
    const windowLen = tCompact.length;
    for (let i = 0; i <= qCompact.length - windowLen + 2; i++) {
      const slice = qCompact.slice(i, i + windowLen + 1);
      const dist = levenshtein(tCompact, slice.slice(0, windowLen));
      const ratio = 1 - dist / windowLen;
      fuzzyBest = Math.max(fuzzyBest, ratio);
    }
  }

  return Math.max(coverage, fuzzyBest);
}

function combinedTaskScore(
  query: string,
  title: string,
  description?: string | null
): number {
  const direct = scoreTaskTitleDirect(query, title);
  const legacy = scoreTaskTitleQuery(query, title, description);
  return Math.max(direct, legacy);
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
  const plainDescription = description ? markdownToPlainText(description) : null;
  const descWords = plainDescription ? tokenize(plainDescription) : [];
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

export type TaskMatchRow = {
  shortId: number;
  title: string;
  description: string | null;
};

export type TaskMatchResult =
  | { kind: "one"; shortId: number; title: string; score: number }
  | { kind: "ambiguous"; tasks: { title: string }[] }
  | { kind: "none"; tasks: { title: string }[] };

/**
 * Map LLM task_ref (or tool input) onto a board row — typo tolerant, no NL parsing.
 */
export function resolveTaskFromBoard(
  board: TaskMatchRow[],
  titleQuery: string,
  options?: { minScore?: number }
): TaskMatchResult {
  if (board.length === 0) {
    return { kind: "none", tasks: [] };
  }

  const q = titleQuery.trim();
  if (q.length < 2) {
    return { kind: "none", tasks: board.map((t) => ({ title: t.title })) };
  }

  const minScore = options?.minScore ?? 0.45;

  const ranked = board
    .map((task) => ({
      ...task,
      score: combinedTaskScore(q, task.title, task.description),
    }))
    .filter((row) => row.score >= minScore - 0.05)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return { kind: "none", tasks: board.map((t) => ({ title: t.title })) };
  }

  const top = ranked[0];
  const runner = ranked[1];

  if (top.score >= 0.72) {
    return {
      kind: "one",
      shortId: top.shortId,
      title: top.title,
      score: top.score,
    };
  }

  if (
    runner &&
    top.score - runner.score < 0.1 &&
    runner.score >= minScore
  ) {
    return {
      kind: "ambiguous",
      tasks: ranked.slice(0, 3).map((t) => ({ title: t.title })),
    };
  }

  return {
    kind: "one",
    shortId: top.shortId,
    title: top.title,
    score: top.score,
  };
}

export function rankTasksByTitleQuery<
  T extends { title: string; description: string | null },
>(query: string, tasks: T[], minScore = 0.45): T[] {
  return tasks
    .map((task) => ({
      task,
      score: combinedTaskScore(query, task.title, task.description),
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.task);
}
