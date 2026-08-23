import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { derniersTitres, listeArtistes, vueEnsemble } from "@/lib/repo/admin";
import { derniersCommentaires } from "@/lib/repo/comments";
import { listeComptes } from "@/lib/repo/admin";
import { COOKIE_PIN, jetonPinValide, pinConfigure } from "@/lib/adminPin";
import PortePin from "@/components/admin/PortePin";
import AdminClient from "@/components/admin/AdminClient";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration", robots: { index: false } };

export default async function AdminPage() {
  const user = await currentUser();

  if (!user || user.role !== "admin") {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="section-title">Administration</h1>
        <p className="max-w-md text-sm text-white/45">
          Cette page est reservee a l&apos;administration du site, et aucun compte ne peut s&apos;y
          promouvoir lui-meme.
        </p>
        <div className="max-w-md rounded-lg border border-faso-line bg-black/30 p-4 text-left text-xs leading-relaxed text-white/50">
          <p className="mb-2 font-semibold text-white/70">Pour obtenir le role :</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              inscrire l&apos;adresse du compte dans la variable{" "}
              <code className="text-faso-gold">ADMIN_EMAILS</code> de l&apos;hebergement, puis
              redeployer ;
            </li>
            <li>ouvrir cette page a nouveau — le role s&apos;applique sans se reconnecter ;</li>
            <li>
              saisir le code de <code className="text-faso-gold">ADMIN_PIN</code> s&apos;il est
              configure.
            </li>
          </ol>
          <p className="mt-2">
            Sur un serveur a soi, <code className="text-faso-gold">npm run admin -- adresse</code>{" "}
            fait la meme chose.
          </p>
        </div>
        <Link href="/" className="btn-ghost">
          Retour a l&apos;accueil
        </Link>
      </div>
    );
  }

  // Le role ouvre la page, le code ouvre la console. Les deux sont exiges par
  // la route serveur : cet ecran ne fait que le rendre visible.
  if (pinConfigure() && !jetonPinValide(cookies().get(COOKIE_PIN)?.value, user.id)) {
    return <PortePin />;
  }

  return (
    <AdminClient
      resume={await vueEnsemble()}
      artistes={await listeArtistes()}
      titres={await derniersTitres(40)}
      commentaires={await derniersCommentaires(30)}
      comptes={await listeComptes(60)}
    />
  );
}
