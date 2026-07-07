import Image from "next/image";
import { KeyRound } from "lucide-react";
import { ClaudeIcon } from "@/components/brand/claude-icon";
import { CursorIcon } from "@/components/brand/cursor-icon";

export type ConnectorLogoId =
  | "cursor"
  | "claude"
  | "claude-code"
  | "euclis"
  | "manual";

export function ConnectorLogo({ id }: { id: ConnectorLogoId }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
      {id === "euclis" ? (
        <Image
          src="/euclis-logo-64.webp"
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 rounded object-contain"
        />
      ) : id === "cursor" ? (
        <CursorIcon className="h-5 w-5" />
      ) : id === "claude" || id === "claude-code" ? (
        <ClaudeIcon className="h-5 w-5 text-claude" />
      ) : (
        <KeyRound className="h-4 w-4 text-ink-soft" strokeWidth={1.75} />
      )}
    </span>
  );
}
