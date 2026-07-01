import type { FaqItem } from "@/lib/seo/faq";
import { Reveal } from "@/app/landing/_components/scroll-reveal";

type FaqSectionProps = {
  items: FaqItem[];
  id?: string;
};

export function FaqSection({ items, id = "faq" }: FaqSectionProps) {
  return (
    <section
      id={id}
      className="relative border-b border-line bg-paper/80"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="mt-3 font-serif text-[2rem] leading-[1.08] tracking-tight text-ink sm:text-[2.6rem]"
          >
            Common questions
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] text-ink-soft">
            Straight answers for teams evaluating a free task board that works
            in WhatsApp and Claude.
          </p>
        </Reveal>

        <dl className="mt-12 space-y-3">
          {items.map((item, index) => (
            <Reveal key={item.question} delay={index * 40}>
              <details
                className="group overflow-hidden rounded-xl border border-line bg-paper shadow-sm transition-[box-shadow,border-color] open:border-line-strong open:shadow-md"
                {...(index === 0 ? { open: true } : {})}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left marker:content-none select-none [&::-webkit-details-marker]:hidden">
                  <dt className="pr-2 text-[16px] font-semibold tracking-tight text-ink">
                    {item.question}
                  </dt>
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden
                    className="h-5 w-5 shrink-0 text-ink-soft transition-transform duration-200 group-open:rotate-180"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <dd className="border-t border-line/80 px-5 pb-5 pt-4 text-[14px] leading-relaxed text-ink-soft">
                  {item.answer}
                </dd>
              </details>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
