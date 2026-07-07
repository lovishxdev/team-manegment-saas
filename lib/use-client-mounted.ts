import { useSyncExternalStore } from "react";

/** True after client hydration — use before `createPortal` to avoid SSR mismatch. */
export function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
