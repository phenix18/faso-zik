import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { findUserByEmail, findUserById, verifyPassword } from "@/lib/repo/users";
import { getArtistByUserId } from "@/lib/repo/artists";

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
        const user = findUserByEmail(credentials?.email);
        if (!user || !verifyPassword(user, credentials?.password || "")) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      if (token.uid) {
        // Le role et la fiche artiste peuvent changer en cours de session
        // (passage auditeur -> artiste) : on les relit a chaque rafraichissement.
        const fresh = findUserById(token.uid);
        token.role = fresh?.role || "auditeur";
        token.artistId = getArtistByUserId(token.uid)?.id || null;
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
  return getArtistByUserId(user.id) || null;
}
