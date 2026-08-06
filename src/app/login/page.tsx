import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/my-tasks");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-10">
        <div className="flex flex-col gap-3">
          <Logo className="text-sm" />
          <h1 className="text-2xl font-semibold uppercase tracking-tight">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground">
            Staff access. External collaborators receive a magic link by email.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
