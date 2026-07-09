import Image from "next/image";

export function AgentAvatar({
  size = "md",
}: {
  size?: "sm" | "md";
}) {
  const shell = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const logo = size === "sm" ? 20 : 24;
  return (
    <div
      className={`flex ${shell} shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white shadow-sm`}
      aria-hidden
    >
      <Image
        src="/euclis-logo-64.webp"
        alt=""
        width={logo}
        height={logo}
        className="object-contain"
      />
    </div>
  );
}
