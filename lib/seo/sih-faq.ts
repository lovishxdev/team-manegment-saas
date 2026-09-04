export type FaqItem = {
  question: string;
  answer: string;
};

/** SIH landing FAQ: on-page + FAQPage JSON-LD. */
export const SIH_FAQ: FaqItem[] = [
  {
    question: "Can SIH teams manage tasks from WhatsApp?",
    answer:
      "Yes, and that is usually how SIH teams work. Each member links their number and messages the Euclis bot in a private 1:1 chat (not a group @mention bot). Add tasks, log decisions, or send a photo with a caption in plain English; updates land on the shared board and feed project memory for the whole team of 6.",
  },
  {
    question: "Is Euclis free for Smart India Hackathon teams?",
    answer:
      "Yes. Hobby is free forever: email signup, no credit card. A full SIH team of 6 fits on Hobby. WhatsApp and baseline MCP context access are included. For curated Dreaming memory during the finale, you can start a free 14-day Team trial from the pricing page.",
  },
  {
    question: "Why do SIH teams lose so much time without project memory?",
    answer:
      "Problem-statement interpretation shifts, tech choices flip at 3 a.m., and teammates (or new Claude/Cursor sessions) join mid-way with zero context. Scrolling a 200-message WhatsApp thread costs hours. Euclis keeps one living brief (decisions, blockers, milestones) that humans and agents share.",
  },
  {
    question: "Can our coding agents use Euclis during SIH?",
    answer:
      "Yes. Connect Claude Desktop, Claude Code, or Cursor via MCP. Agents call get_project_context and load the same brief your teammates see, including what was logged from WhatsApp overnight, instead of you pasting last night's chat into every new session.",
  },
  {
    question: "When should we create our SIH workspace?",
    answer:
      "As soon as you lock the problem statement, ideally before the internal college hackathon or idea PPT grind. Name the workspace after your SIH problem ID or team name, invite all six members, then connect WhatsApp and MCP.",
  },
  {
    question: "Is Euclis an official SIH partner?",
    answer:
      "No. Euclis is an independent tool built for small teams shipping under time pressure with AI in the loop. It is not affiliated with AICTE, MIC, or sih.gov.in. Just a free workspace that fits how SIH teams actually work (WhatsApp + laptops + agents).",
  },
];
