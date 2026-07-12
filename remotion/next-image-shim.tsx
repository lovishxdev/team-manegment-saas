import type { CSSProperties } from "react";
import { staticFile } from "remotion";

/**
 * Minimal stand-in for `next/image`, aliased in only for the Remotion CLI
 * bundle (see remotion.config.ts). The Next app / Player uses the real
 * component. Renders a plain <img>; `public/` is served at the site root in
 * both environments so absolute `src` paths resolve.
 */
type ImgProps = {
  src: string | { src: string };
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
};

export default function Image({
  src,
  alt = "",
  width,
  height,
  className,
  style,
}: ImgProps) {
  const raw = typeof src === "string" ? src : src?.src ?? "";
  // Remotion serves public/ via staticFile(), not at the bare site root.
  const resolved = raw.startsWith("/") ? staticFile(raw) : raw;
  return (
    <img
      src={resolved}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "cover", ...style }}
    />
  );
}
