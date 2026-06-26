import { Avatar } from "@/components/ui";

export type MemberAvatar = {
  id: string;
  label: string | null;
};

export function MemberAvatarStack({
  members,
  max = 4,
  size = "h-9 w-9 text-xs",
  ringClass = "ring-paper",
  overlap = 10,
}: {
  members: MemberAvatar[];
  max?: number;
  size?: string;
  ringClass?: string;
  overlap?: number;
}) {
  if (members.length === 0) return null;

  const shown = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <div className="flex items-center">
      {shown.map((member, index) => (
        <span
          key={member.id}
          className={`relative rounded-full ring-2 ${ringClass}`}
          style={{
            marginLeft: index === 0 ? 0 : -overlap,
            zIndex: shown.length - index,
          }}
        >
          <Avatar seed={member.id} label={member.label} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-paper text-[10px] font-medium text-ink-soft ring-2 ${ringClass} ${size}`}
          style={{ marginLeft: shown.length > 0 ? -overlap : 0, zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
