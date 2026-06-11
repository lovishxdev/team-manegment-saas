"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { ServiceError } from "@/lib/services/project";
import {
  regenerateMcpToken,
  updateUserPhone,
} from "@/lib/services/workspace";

export type SettingsState = { error?: string; message?: string };

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
