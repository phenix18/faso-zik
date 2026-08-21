import { formatCfa } from "@/lib/format";

/** Ce que l'artiste a encaisse, et ce qui lui revient apres la part du site. */
export default function RevenusArtiste({ revenus, paiements }) {
  const cartes = [
    ["Encaisse", formatCfa(revenus.brut)],
    ["Ventes de titres", formatCfa(revenus.achats)],
    ["Soutiens recus", formatCfa(revenus.pourboires)],
    [`Part du site (${revenus.tauxCommission} %)`, formatCfa(revenus.commission)],
    ["A vous reverser", formatCfa(revenus.net)],
    ["Operations", String(revenus.operations)],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cartes.map(([libelle, valeur], index) => (
          <div
            key={libelle}
            className={`card !p-3 ${index === 4 ? "border-faso-green/40 bg-faso-green/5" : ""}`}
          >
            <p className="text-[11px] uppercase tracking-wide text-white/40">{libelle}</p>
            <p className={`mt-1 font-black ${index === 4 ? "text-faso-green" : "text-white"} text-lg`}>
              {valeur}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-faso-line bg-black/30 p-3 text-xs text-white/50">
        Les sommes sont encaissees par la plateforme puis reversees sur votre compte mobile money.
        Le montant « a vous reverser » est net de la part du site.
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-white">Dernieres operations</h2>
        {paiements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-faso-line p-6 text-sm text-white/40">
            Aucun paiement pour l&apos;instant. Fixez un prix sur un titre, ou laissez vos auditeurs
            vous soutenir depuis votre page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-faso-line text-[11px] uppercase tracking-wide text-white/40">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Nature</th>
                  <th className="py-2 pr-3 font-semibold">Titre</th>
                  <th className="py-2 pr-3 font-semibold">Auditeur</th>
                  <th className="py-2 text-right font-semibold">Montant</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((paiement) => (
                  <tr key={paiement.id} className="border-b border-faso-line/50">
                    <td className="py-2 pr-3 text-white/50">{paiement.paid_at?.slice(0, 10)}</td>
                    <td className="py-2 pr-3 text-white/70">
                      {paiement.type === "achat" ? "Vente" : "Soutien"}
                    </td>
                    <td className="py-2 pr-3 text-white/70">{paiement.track_title || "—"}</td>
                    <td className="py-2 pr-3 text-white/50">{paiement.acheteur || "—"}</td>
                    <td className="py-2 text-right font-semibold text-white">
                      {formatCfa(paiement.amount_cfa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
