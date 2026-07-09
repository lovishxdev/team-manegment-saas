"use client";

type DiscussionTab = "discussions" | "saved";

export function DiscussionTabs({
  active,
  onChange,
  savedCount,
}: {
  active: DiscussionTab;
  onChange: (tab: DiscussionTab) => void;
  savedCount: number;
}) {
  const tabCls = (tab: DiscussionTab) =>
    `relative pb-3 text-[15px] font-semibold transition-colors ${
      active === tab
        ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink"
        : "text-ink-faint hover:text-ink-soft"
    }`;

  return (
    <div className="mb-4 flex gap-6 border-b border-line">
      <button
        type="button"
        onClick={() => onChange("discussions")}
        className={tabCls("discussions")}
      >
        Discussions
      </button>
      <button
        type="button"
        onClick={() => onChange("saved")}
        className={tabCls("saved")}
      >
        Saved{savedCount > 0 ? ` (${savedCount})` : ""}
      </button>
    </div>
  );
}
