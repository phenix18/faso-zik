import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listPlaylists } from "@/lib/repo/library";
import PlaylistManager from "@/components/PlaylistManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes playlists" };

export default async function PlaylistsPage() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Mes playlists</h1>
        <p className="text-sm text-white/45">Connectez-vous pour creer vos playlists.</p>
        <Link href="/connexion?callbackUrl=/playlists" className="btn-primary">
          Se connecter
        </Link>
      </div>
    );
  }

  return <PlaylistManager initialPlaylists={listPlaylists(user.id)} />;
}
