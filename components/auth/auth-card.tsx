import Image from "next/image";
import Link from "next/link";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-scope app-canvas flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-5 inline-block">
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={44}
              height={44}
              className="rounded-lg ring-1 ring-line/80 shadow-sm"
            />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>
        </div>
        <div className="content-panel shadow-[0_8px_32px_rgba(26,26,26,0.06)]">
          {children}
        </div>
      </div>
    </main>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
      <div className="h-px flex-1 bg-line" />
      or
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}
