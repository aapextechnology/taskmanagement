import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Ops tool, no public landing: straight to work (or sign-in).
export default async function Home() {
  const session = await auth();
  redirect(session?.user ? "/my-tasks" : "/login");
}
