import Link from "next/link";
import { ui } from "@/components/ui/ui";

type MarketingArticleProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

/** Shared layout shell for indexable guide and comparison pages. */
export function MarketingArticle({
  title,
  description,
  children,
}: MarketingArticleProps) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="text-[15px] font-semibold text-ink">
            Euclis
          </Link>
          <Link
            href="/signup"
            className={`text-sm ${ui.btnPrimary} px-4 py-2`}
          >
            Start free →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <article>
          <header className="mb-10 border-b border-line pb-8">
            <h1 className="font-serif text-[2.2rem] leading-tight tracking-tight text-ink sm:text-[2.8rem]">
              {title}
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">
              {description}
            </p>
          </header>
          <div className="prose-euclis space-y-6 text-[15px] leading-relaxed text-ink-soft [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-[1.6rem] [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:text-[1.15rem] [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ol]:space-y-2 [&_p]:text-ink-soft [&_strong]:font-medium [&_strong]:text-ink [&_ul]:space-y-2">
            {children}
          </div>
        </article>

        <aside className="mt-14 rounded-xl border border-line bg-paper-deep/50 p-6 text-center">
          <p className="font-serif text-[1.4rem] text-ink">
            Try Euclis free — no credit card
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Web kanban, WhatsApp assistant, and Claude MCP on one board.
          </p>
          <Link href="/signup" className={`mt-4 inline-flex ${ui.btnPrimary}`}>
            Create your workspace →
          </Link>
        </aside>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-ink-soft">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <Link href="/guides/manage-tasks-from-whatsapp" className="hover:text-ink">
            WhatsApp guide
          </Link>
          <Link href="/guides/claude-mcp-task-board" className="hover:text-ink">
            Claude MCP
          </Link>
          <Link href="/compare/trello" className="hover:text-ink">
            vs Trello
          </Link>
          <Link href="/compare/notion" className="hover:text-ink">
            vs Notion
          </Link>
          <Link href="/compare/clickup" className="hover:text-ink">
            vs ClickUp
          </Link>
          <Link href="/compare/spreadsheets" className="hover:text-ink">
            vs Spreadsheets
          </Link>
          <Link href="/compare/taskrio" className="hover:text-ink">
            vs TaskRio
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </nav>
      </footer>
    </div>
  );
}
