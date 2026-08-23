import ReinitialisationForm from "@/components/compte/ReinitialisationForm";

export const metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default function ReinitialisationPage({ params }) {
  return <ReinitialisationForm jeton={params.jeton} />;
}
