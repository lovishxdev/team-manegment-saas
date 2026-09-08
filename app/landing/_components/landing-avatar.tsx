import Image from "next/image";
import aarav from "@/public/avatars/aarav.jpg";
import lina from "@/public/avatars/lina.jpg";
import maya from "@/public/avatars/maya.jpg";
import sam from "@/public/avatars/sam.jpg";

const AVATARS = {
  aarav,
  lina,
  maya,
  sam,
} as const;

export type LandingAvatarId = keyof typeof AVATARS;

/**
 * Landing-page portrait. Static import + blur placeholder so the circle is
 * painted immediately (no empty hole while the JPG arrives). Use `priority`
 * for avatars in the first viewport.
 */
export function LandingAvatar({
  id,
  size = 36,
  className = "",
  priority = false,
}: {
  id: LandingAvatarId;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={AVATARS[id]}
      alt=""
      width={size}
      height={size}
      placeholder="blur"
      priority={priority}
      sizes={`${size}px`}
      className={`shrink-0 rounded-full object-cover ring-1 ring-line/70 ${className}`}
    />
  );
}
