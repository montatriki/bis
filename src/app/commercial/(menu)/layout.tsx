import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

// Le menu d'accueil s'affiche en plein écran, sans barre latérale ni barre du
// haut : c'est le point d'entrée de la tournée, sur tablette. Il ne peut donc
// pas passer par `AppLayout`, mais il doit reprendre son contrôle d'accès.

export default async function CommercialMenuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "COMMERCIAL") redirect("/login");

  return <>{children}</>;
}
