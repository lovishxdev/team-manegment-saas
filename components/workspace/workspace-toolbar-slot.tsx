"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Lets a streamed tab page (e.g. the board) render its toolbar actions into the
 * persistent tab row that lives in {@link WorkspaceTabsLayout}, so tabs sit on
 * the left and page actions on the right of the same line.
 */
const WorkspaceToolbarSlotContext = createContext<HTMLElement | null>(null);

export function WorkspaceToolbarSlotProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <WorkspaceToolbarSlotContext.Provider value={slot}>
      {children}
    </WorkspaceToolbarSlotContext.Provider>
  );
}

/** Renders its children into the workspace tab row's right-side slot. */
export function WorkspaceToolbarPortal({ children }: { children: ReactNode }) {
  const slot = useContext(WorkspaceToolbarSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}
