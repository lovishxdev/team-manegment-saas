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
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
          {children}
        </div>
      </div>
    </main>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
      <div className="h-px flex-1 bg-zinc-800" />
      or
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}
