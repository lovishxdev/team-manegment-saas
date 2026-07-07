/** Shared chat message shape for task updates and workspace discussion. */
export type ChatMessageView = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorLabel: string;
  mentionedLabels: string[];
  saved: boolean;
};
