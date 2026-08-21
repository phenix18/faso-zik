import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Connexion" };

export default function ConnexionPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
