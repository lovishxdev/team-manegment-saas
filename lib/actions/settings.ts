"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import {
  regenerateMcpToken,
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

  try {
    await updateUsername(user.id, raw === "" ? null : raw);
  } catch (err) {
    return {
      error:
        err instanceof ServiceError ? err.message : "Failed to update username",
    };
  }
  revalidatePath("/settings");
  return { message: raw === "" ? "Username removed" : "Username saved" };
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

export async function regenerateMcpTokenAction(): Promise<SettingsState> {
  const user = await requireUser();
  await regenerateMcpToken(user.id);
  revalidatePath("/settings");
  return {
    message:
      "New token generated. Update it anywhere the old one was configured (Claude, etc.).",
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
