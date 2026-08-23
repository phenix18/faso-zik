import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { findUserByEmail, verifyPassword } from "@/lib/repo/users";
import { getArtistByUserId } from "@/lib/repo/artists";
import { rafraichirJeton, roleALaConnexion } from "@/lib/session";

export const authOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  pages: { signIn: "/connexion", error: "/connexion" },
  providers: [
    CredentialsProvider({
      name: "FASO-ZIK",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const user = await findUserByEmail(credentials?.email);
        if (!user || !verifyPassword(user, credentials?.password || "")) return null;

        const role = await roleALaConnexion(user);
        return { id: user.id, name: user.name, email: user.email, role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      if (token.uid) {
        Object.assign(token, await rafraichirJeton(token.uid));
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid;
        session.user.role = token.role || "auditeur";
        session.user.artistId = token.artistId || null;
      }
      return session;
    },
  },
};

/** Session cote serveur (route handlers et composants serveur). */
export async function currentUser() {
  const session = await getServerSession(authOptions);
  return session?.user || null;
}

/** Artiste connecte, ou null si le compte n'est pas un compte artiste. */
export async function currentArtist() {
  const user = await currentUser();
  if (!user) return null;
  return await getArtistByUserId(user.id) || null;
}
