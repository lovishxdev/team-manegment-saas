"use client";

import { useEffect } from "react";
import { ErrorContent } from "@/components/errors/error-content";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorContent reset={reset} digest={error.digest} />;
}
