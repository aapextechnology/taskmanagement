"use server";

import { cookies } from "next/headers";
import { resolveShare } from "@/lib/dataroom/share-service";
import { issueSharePass, SHARE_COOKIE } from "@/lib/dataroom/share-session";

export interface GateState {
  error?: string;
  needsPasscode?: boolean;
  needsEmail?: boolean;
  ok?: boolean;
}

/** Verifies what the visitor typed and, on success, issues the short-lived
 *  pass that saves re-typing the passcode. It grants nothing on its own. */
export async function openShareAction(
  _prev: GateState,
  formData: FormData,
): Promise<GateState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const passcode = String(formData.get("passcode") ?? "");

  const resolution = await resolveShare(token, {
    email: email || undefined,
    passcode: passcode || undefined,
  });
  if (!resolution.ok) {
    return {
      error: resolution.message,
      needsPasscode: resolution.needsPasscode,
      needsEmail: resolution.needsEmail,
    };
  }

  const jar = await cookies();
  jar.set(
    SHARE_COOKIE,
    issueSharePass(token, resolution.share.viewerEmail, resolution.share.passcodeOk),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // the pass is bound to its token by the signature, not by the path
      path: `/`,
      maxAge: 2 * 60 * 60,
    },
  );
  return { ok: true };
}
