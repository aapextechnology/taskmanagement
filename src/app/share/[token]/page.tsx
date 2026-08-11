import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Download, FileText } from "lucide-react";
import { getBranding } from "@/lib/org/branding";
import { resolveShare } from "@/lib/dataroom/share-service";
import { readSharePass, SHARE_COOKIE } from "@/lib/dataroom/share-session";
import { GateForm } from "./gate-form";

// A document shared with someone who has no account (EPIC-018 T-181).
// Outside the (app) group: no sidebar, no session, nothing of the workspace.
export const metadata: Metadata = {
  title: "Shared document",
  // a shared contract must never end up in a search index
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const branding = await getBranding();
  const jar = await cookies();
  const pass = readSharePass(token, jar.get(SHARE_COOKIE)?.value);

  const resolution = await resolveShare(token, {
    email: pass?.email ?? undefined,
    passcodeVerified: pass?.passcodeOk,
  });

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <FileText className="size-6 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          {resolution.ok ? resolution.share.fileName : "Shared document"}
        </h1>
        <p className="text-xs text-muted-foreground">
          Shared securely by {branding.orgName}
        </p>
      </div>

      {resolution.ok ? (
        <div className="flex w-full max-w-4xl flex-col gap-3">
          <iframe
            src={`/api/share/${token}`}
            title={resolution.share.fileName}
            className="h-[70svh] w-full rounded-md border bg-card"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {resolution.share.allowDownload ? (
              <a
                href={`/api/share/${token}?download=1`}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-accent/40"
              >
                <Download className="size-4" /> Download
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                Downloading is turned off for this link. You can read it here.
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              This link expires, and the sender can withdraw it at any time.
              Opens are recorded.
            </span>
          </div>
        </div>
      ) : (
        <GateForm
          token={token}
          needsPasscode={resolution.needsPasscode}
          needsEmail={resolution.needsEmail}
          message={
            resolution.needsEmail || resolution.needsPasscode
              ? null
              : resolution.message
          }
        />
      )}
    </main>
  );
}
