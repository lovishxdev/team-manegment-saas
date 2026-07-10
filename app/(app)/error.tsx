"use client";

import { useEffect } from "react";
import { ErrorContent } from "@/components/errors/error-content";

/** Error boundary inside the authenticated app shell (sidebar stays visible). */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorContent reset={reset} digest={error.digest} compact />;
}
