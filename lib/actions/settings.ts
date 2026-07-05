"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import {
  updateUserPhone,
  updateUsername,
  deleteUserAccount,
} from "@/lib/services/workspace";
import { createSupabaseServer } from "@/lib/supabase-server";

export type SettingsState = { error?: string; message?: string };

export async function updateUsernameAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireUser();
  const raw = String(formData.get("username") ?? "").trim();
  if (!raw) return { error: "Username is required" };

  try {
    await updateUsername(user.id, raw);
  } catch (err) {
    return {
      error:
        err instanceof ServiceError ? err.message : "Failed to update username",
    };
  }
  revalidatePath("/settings");
  return { message: "Username saved" };
}

export async function updatePhoneAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireUser();
  const raw = String(formData.get("phone") ?? "").trim();

  try {
    await updateUserPhone(user.id, raw === "" ? null : raw);
  } catch (err) {
    return {
      error:
        err instanceof ServiceError ? err.message : "Failed to update phone",
    };
  }
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { message: raw === "" ? "Phone number removed" : "Phone number saved" };
}

export async function updateMcpScopeAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireUser();
  const raw = String(formData.get("scope") ?? "").trim();
  if (raw !== "context" && raw !== "full") {
    return { error: "Invalid scope" };
  }

  const { prisma } = await import("@/lib/prisma");
  const { invalidateMcpToken } = await import("@/lib/identity-cache");
  // Only governs the personal-token connection; OAuth connections chose
  // their own scope on the consent screen and keep it.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { mcpScope: raw },
    select: { mcpToken: true },
  });
  invalidateMcpToken(updated.mcpToken);

  revalidatePath("/settings");
  return {
    message:
      raw === "full"
        ? "Personal token scope set to full."
        : "Personal token scope set to context (read, memory, updates only).",
  };
}

export async function updateMcpWorkspaceAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireUser();
  const raw = String(formData.get("workspaceId") ?? "").trim();

  const { prisma } = await import("@/lib/prisma");
  const { invalidateMcpToken } = await import("@/lib/identity-cache");

  if (raw !== "") {
    const membership = await prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: raw } },
    });
    if (!membership) return { error: "You're not a member of that workspace" };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { mcpWorkspaceId: raw === "" ? null : raw },
    select: { mcpToken: true },
  });
  invalidateMcpToken(updated.mcpToken);

  revalidatePath("/settings");
  return {
    message:
      raw === ""
        ? "Pin removed — the personal-token connection can access all workspaces."
        : "Pinned. The personal-token connection is confined to that workspace.",
  };
}

export async function deleteAccountAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const user = await requireUser();
  const confirm = String(formData.get("confirm") ?? "").trim();
  const expected = user.email ?? "DELETE";

  if (confirm !== expected) {
    return {
      error: user.email
        ? `Type your email (${expected}) to confirm.`
        : 'Type DELETE to confirm.',
    };
  }

  try {
    await deleteUserAccount(user.id);
  } catch (err) {
    return {
      error:
        err instanceof ServiceError ? err.message : "Failed to delete account",
    };
  }

  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
