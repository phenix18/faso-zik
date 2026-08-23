import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { derniersTitres, listeArtistes, vueEnsemble } from "@/lib/repo/admin";
import { derniersCommentaires } from "@/lib/repo/comments";
import AdminClient from "@/components/admin/AdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration", robots: { index: false } };

export default async function AdminPage() {
  const user = await currentUser();

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Administration</h1>
        <p className="max-w-md text-sm text-white/45">
          Cette page est reservee a l&apos;administration du site. Aucun compte ne peut s&apos;y
          promouvoir : le role s&apos;accorde en ligne de commande —{" "}
          <code className="text-faso-gold">npm run admin -- adresse@exemple.bf</code> — ou en
          inscrivant l&apos;adresse dans la variable{" "}
          <code className="text-faso-gold">ADMIN_EMAILS</code> de l&apos;hebergement.
        </p>
        <Link href="/" className="btn-ghost">
          Retour a l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <AdminClient
      resume={await vueEnsemble()}
      artistes={await listeArtistes()}
      titres={await derniersTitres(40)}
      commentaires={await derniersCommentaires(30)}
    />
  );
}
