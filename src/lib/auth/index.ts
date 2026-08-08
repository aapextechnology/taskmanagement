import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeUser } from "./authorize";

// Auth.js v5 (protected path). JWT sessions carry only id + global role;
// division memberships are ALWAYS fetched fresh by the permission module —
// never trusted from a token that may outlive a role change.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true, // behind nginx in the compose stack
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) =>
        authorizeUser(credentials?.email, credentials?.password),
    }),
    // Magic-link redemption for external guests (EPIC-007). The token maps
    // to an invite; scope/revocation are re-checked on every request, so
    // this only ever mints a session for a currently-valid invite.
    Credentials({
      id: "guest-token",
      credentials: { token: { label: "Token", type: "text" } },
      authorize: async (credentials) => {
        const { redeemToken } = await import("@/lib/external/service");
        return redeemToken(credentials?.token);
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      if (user?.id) {
        const { logActivity } = await import("@/lib/activity");
        await logActivity({
          actorId: user.id,
          action: "auth.signin",
          entity: `profile:${user.id}`,
        });
      }
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as
        | "owner"
        | "admin"
        | "member"
        | "external";
      return session;
    },
  },
});
