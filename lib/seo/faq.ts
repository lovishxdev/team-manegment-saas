export type FaqItem = {
  question: string;
  answer: string;
};

/** Homepage FAQ — used for on-page content and FAQPage JSON-LD. */
export const HOME_FAQ: FaqItem[] = [
  {
    question: "What is Euclis?",
    answer:
      "Euclis is shared project memory for your team and your AI agents. It captures decisions, blockers, and milestones from WhatsApp, Claude, Cursor, and the web — then keeps that context current so nobody starts from zero.",
  },
  {
    question: "What is Dreaming?",
    answer:
      "Dreaming is how Euclis maintains memory while you're away. On a schedule it merges duplicates, reconciles decisions that contradict, surfaces patterns, and files away what's gone stale. Capture records moments; Dreaming tends the whole store. Nothing is deleted — older events can be hidden from recall by plan retention, but they stay.",
  },
  {
    question: "How do AI agents use Euclis?",
    answer:
      "Connect Euclis via MCP (Claude Desktop, Claude Code, Cursor, and similar tools). Agents call get_project_context to load the same brief your teammates see — decisions, open blockers, and recent memory — instead of re-reading chat scrollback.",
  },
  {
    question: "Can I manage tasks from WhatsApp?",
    answer:
      "Yes. Link your number in settings, then message the Euclis bot in a private 1:1 chat. Use plain English — for example, “add task: fix login bug, due Friday.” Changes sync to the shared workspace board. Euclis is not a WhatsApp group @mention bot.",
  },
  {
    question: "Is Euclis free?",
    answer:
      "Yes. Hobby is free forever for small teams — email signup, no credit card. WhatsApp and baseline MCP context access are included. Team adds curated Dreaming memory, more seats, and collaboration features; you can try Team with a free trial from the pricing page.",
  },
  {
    question: "How is Euclis different from Notion or Trello?",
    answer:
      "Notion and Trello are places you go to write things down. Euclis captures context from where work already happens (chat, editors, agents) and keeps a living project brief. You still get a kanban board and discussions — but the core product is memory that humans and agents share.",
  },
  {
    question: "Do I need to install a new app?",
    answer:
      "No. The web app runs in the browser. WhatsApp is optional (message the bot after linking your number). Coding agents connect via MCP. Email is enough to sign up.",
  },
  {
    question: "Who is Euclis built for?",
    answer:
      "Small teams that ship with AI in the loop — hackathons, side projects, indie startups, study groups — anyone tired of re-explaining context to new teammates or new agent sessions.",
  },
  {
    question: "Can SIH / Smart India Hackathon teams use Euclis?",
    answer:
      "Yes. SIH teams of 6 fit on free Hobby, including WhatsApp. Create a workspace, invite teammates, link numbers so people can add tasks from campus chat, and optionally connect MCP so agents share the same brief. See euclis.dev/sih.",
  },
];
