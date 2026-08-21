import Link from "next/link";
import { CONTACT_RIGHTS, DELAY_TAKEDOWN_HOURS, SITE_NAME } from "@/lib/siteConfig";

export const metadata = {
  title: "Droits et retrait d'un enregistrement",
  description:
    "Comment FASO-ZIK traite les droits des artistes : declaration au depot, autorisations par morceau, et procedure de retrait d'un enregistrement.",
};

const STEPS = [
  {
    title: "Ecrire a l'adresse dediee",
    body: `Envoyez votre demande a ${CONTACT_RIGHTS}. Un message depuis une autre adresse du site sera redirige, ce qui rallonge le delai.`,
  },
  {
    title: "Identifier precisement l'enregistrement",
    body: "Donnez le lien de la page du titre (l'adresse qui commence par /titre/), le nom affiche de l'artiste et le titre exact. Une demande visant « toutes mes chansons » sans liste ne peut pas etre traitee.",
  },
  {
    title: "Etablir votre qualite",
    body: "Indiquez a quel titre vous agissez : artiste-interprete, auteur, producteur, editeur, ou mandataire. Joignez ce qui l'atteste (contrat, depot, attestation de societe de gestion).",
  },
  {
    title: "Declarer votre bonne foi",
    body: "Confirmez que vous estimez de bonne foi que la diffusion n'est pas autorisee, et que les informations fournies sont exactes.",
  },
];

export default function DroitsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-2">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-faso-gold">
          {SITE_NAME}
        </p>
        <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
          Droits et retrait d&apos;un enregistrement
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Le catalogue de {SITE_NAME} est depose par les artistes eux-memes. Le site n&apos;achete
          ni ne collecte de musique ailleurs : chaque fichier presente ici a ete televerse par le
          titulaire d&apos;un compte artiste, qui a declare en detenir les droits.
        </p>
      </header>

      <section className="card">
        <h2 className="text-lg font-bold text-white">Ce que l&apos;artiste controle</h2>
        <p className="mt-2 text-sm text-white/60">
          Trois droits distincts sont attaches a chaque morceau, tous refuses par defaut sauf
          l&apos;ecoute. L&apos;artiste les ouvre et les retire quand il veut depuis son studio,
          et le serveur refuse ce qui n&apos;est pas coche — masquer un bouton ne suffirait pas.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            ["Ecoute en ligne", "Le titre est lisible dans le lecteur du site."],
            ["Telechargement", "Le fichier peut etre enregistre par l'auditeur."],
            ["Usage en platine", "Le titre apparait dans le bac a disques de la platine DJ."],
          ].map(([label, hint]) => (
            <li key={label} className="rounded-lg border border-faso-line bg-black/30 p-3">
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="mt-1 text-xs text-white/45">{hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-white">Ce que le deposant s&apos;engage a respecter</h2>
        <p className="mt-2 text-sm text-white/60">
          Aucun fichier n&apos;entre au catalogue sans que son deposant ait declare detenir les
          droits sur l&apos;enregistrement, ou l&apos;autorisation ecrite de ceux qui les
          detiennent. Cette declaration est enregistree avec le morceau. Un depot fait sans droits
          expose son auteur a la suppression de son compte et aux suites prevues par la loi.
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-white">Demander le retrait d&apos;un enregistrement</h2>
        <p className="mt-2 text-sm text-white/60">
          Si un titre a ete publie sans votre accord, voici comment obtenir son retrait. Les
          demandes completes sont traitees sous {DELAY_TAKEDOWN_HOURS} heures.
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-faso-gold text-xs font-black text-black">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-0.5 text-sm text-white/55">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg border border-faso-line bg-black/30 p-3 text-xs text-white/50">
          Pendant l&apos;examen, un titre visiblement litigieux est retire de la diffusion. Le
          deposant en est informe et peut repondre ; si sa reponse etablit ses droits, le titre est
          remis en ligne.
        </p>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold text-white">Nous ecrire</h2>
        <p className="mt-2 text-sm text-white/60">
          Questions de droits et demandes de retrait :{" "}
          <a href={`mailto:${CONTACT_RIGHTS}`} className="font-semibold text-faso-gold hover:underline">
            {CONTACT_RIGHTS}
          </a>
        </p>
      </section>

      <Link href="/" className="text-sm font-semibold text-faso-gold hover:underline">
        ← Retour a l&apos;accueil
      </Link>
    </div>
  );
}
