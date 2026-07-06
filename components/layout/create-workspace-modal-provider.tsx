"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CreateWorkspaceModal } from "@/components/workspace/create-workspace-modal";

type CreateWorkspaceModalContextValue = {
  open: () => void;
};

const CreateWorkspaceModalContext =
  createContext<CreateWorkspaceModalContextValue | null>(null);

export function CreateWorkspaceModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <CreateWorkspaceModalContext.Provider value={value}>
      {children}
      {isOpen ? <CreateWorkspaceModal onClose={close} /> : null}
    </CreateWorkspaceModalContext.Provider>
  );
}

export function useCreateWorkspaceModal() {
  const ctx = useContext(CreateWorkspaceModalContext);
  if (!ctx) {
    throw new Error(
      "useCreateWorkspaceModal must be used within CreateWorkspaceModalProvider"
    );
  }
  return ctx;
}
