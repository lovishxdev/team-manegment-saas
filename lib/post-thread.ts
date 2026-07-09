export type ThreadMessageView = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorLabel: string;
  parentMessageId: string | null;
  mentionedLabels: string[];
  saved: boolean;
  isAgentGenerated: boolean;
  isAgentPrivate: boolean;
  agentTriggeredByLabel: string | null;
  depth: number;
  replyToLabel: string | null;
};

/** Build display metadata for threaded messages (2-level visual cap in UI). */
export function buildThreadMessageViews(
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorId: string;
    authorLabel: string;
    parentMessageId: string | null | undefined;
    mentionedLabels: string[];
    saved: boolean;
    isAgentGenerated?: boolean;
    isAgentPrivate?: boolean;
    agentTriggeredByLabel?: string | null;
  }>
): ThreadMessageView[] {
  const byId = new Map(messages.map((m) => [m.id, m]));

  function depthFor(id: string): number {
    let depth = 0;
    let current = byId.get(id);
    while (current?.parentMessageId) {
      depth++;
      current = byId.get(current.parentMessageId);
    }
    return depth;
  }

  return messages.map((message) => {
    const parent = message.parentMessageId
      ? byId.get(message.parentMessageId)
      : null;
    return {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      authorId: message.authorId,
      authorLabel: message.authorLabel,
      parentMessageId: message.parentMessageId ?? null,
      mentionedLabels: message.mentionedLabels,
      saved: message.saved,
      isAgentGenerated: message.isAgentGenerated ?? false,
      isAgentPrivate: message.isAgentPrivate ?? false,
      agentTriggeredByLabel: message.agentTriggeredByLabel ?? null,
      depth: depthFor(message.id),
      replyToLabel: parent?.authorLabel ?? null,
    };
  });
}

/** Visual indent level — cap at 2 for layout. */
export function threadVisualLevel(depth: number): number {
  return Math.min(depth, 2);
}
