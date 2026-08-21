/**
 * Donnees structurees (schema.org) pour les moteurs de recherche.
 *
 * Le JSON est insere dans une balise script, donc echappe a la main : un titre
 * de morceau contenant la sequence de fermeture terminerait le script et
 * laisserait le reste s'executer comme du balisage.
 */
export default function DonneesStructurees({ donnees }) {
  const json = JSON.stringify(donnees)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
