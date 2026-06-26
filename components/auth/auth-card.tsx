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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-5 inline-block">
            <Image
              src="/euclis-logo.png"
              alt="Euclis"
              width={48}
              height={48}
              className="rounded-lg ring-1 ring-line"
            />
          </Link>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-6">
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
