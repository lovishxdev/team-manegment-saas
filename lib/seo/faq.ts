export type FaqItem = {
  question: string;
  answer: string;
};

/** Homepage FAQ — used for on-page content and FAQPage JSON-LD. */
export const HOME_FAQ: FaqItem[] = [
  {
    question: "Can I manage tasks from WhatsApp?",
    answer:
      "Yes. Link your number in Euclis settings, then message the Euclis bot in a private WhatsApp chat. Use plain English — for example, “add task: fix login bug, high priority, due Friday.” Changes sync to the same kanban board on the web instantly.",
  },
  {
    question: "Is Euclis free?",
    answer:
      "Yes. Euclis is free to start — email signup only, no credit card required. Create a workspace, invite your team, and use the web dashboard, WhatsApp bot, and Claude MCP connector on the free tier.",
  },
  {
    question: "Does Euclis work in WhatsApp groups?",
    answer:
      "Euclis works through a private 1:1 chat with the bot. Each teammate links their own number and updates the shared workspace board from their phone. Everyone sees the same kanban on the web — unlike group bots, your WhatsApp group chat stays human.",
  },
  {
    question: "Can Claude manage my team's tasks?",
    answer:
      "Yes. Connect Euclis as an MCP connector in Claude Desktop or claude.ai. Claude can create, update, and review tasks on the same board your team uses on the web and WhatsApp — no tab switching.",
  },
  {
    question: "Do I need to install a new app?",
    answer:
      "No new app is required for WhatsApp users — just message the bot. The web dashboard runs in any browser. Claude users connect via MCP. Email is enough to sign up; a phone number is optional until you want WhatsApp.",
  },
  {
    question: "What are task short IDs like #42?",
    answer:
      "Each task in a workspace gets a short number (e.g. #42). Reference it in WhatsApp or Claude — “close 42” or “make #42 high priority” — and the bot knows exactly which card you mean.",
  },
  {
    question: "Who is Euclis built for?",
    answer:
      "Small teams: hackathons, side projects, study groups, hostel fests, weekend events, and any group that already coordinates in chat. It is intentionally lighter than Trello or Asana, with WhatsApp and Claude built in.",
  },
  {
    question: "How is Euclis different from TaskRio?",
    answer:
      "TaskRio is a bot you add to WhatsApp groups and @mention. Euclis gives each person a private WhatsApp assistant plus a full web kanban (whiteboard, assets, live sync) and a Claude MCP connector — three doors to one board. Euclis is free to start with no group admin approval step.",
  },
];
