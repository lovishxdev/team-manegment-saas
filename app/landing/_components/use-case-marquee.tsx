/**
 * Infinite-marquee strip of use-case phrases — server-rendered, pure CSS
 * animation (no JS). Doubled inline so the loop is seamless.
 */
const PHRASES = [
  "For hackathons",
  "For side projects",
  "For hostel fest crews",
  "For weekend events",
  "For indie startups",
  "For study groups",
  "For society committees",
  "For conferences & meetups",
  "For design sprints",
  "For game-jam squads",
  "For two-person side hustles",
  "For the team you ship with at 3 AM",
];

const SEPARATOR_CLS = ["text-rose-500", "text-orange-500", "text-violet-500"];

export function UseCaseMarquee() {
  return (
    <div className="lp-marquee py-2">
      <div className="lp-marquee-track">
        {[...PHRASES, ...PHRASES].map((p, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 whitespace-nowrap font-serif text-2xl text-ink-soft sm:text-3xl"
          >
            <span>{p}</span>
            <span className={SEPARATOR_CLS[i % SEPARATOR_CLS.length]} aria-hidden>
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
