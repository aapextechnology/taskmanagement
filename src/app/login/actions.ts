"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/my-tasks",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // same message for every auth failure — no user enumeration
      return { error: "Invalid email or password." };
    }
    throw error; // NEXT_REDIRECT on success must propagate
  }
}
