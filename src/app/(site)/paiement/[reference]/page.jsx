import SuiviPaiement from "@/components/SuiviPaiement";

export const metadata = { title: "Paiement" };

export default function PaiementPage({ params }) {
  return <SuiviPaiement reference={params.reference} />;
}
