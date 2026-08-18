import AppLayout from "@/components/layout/AppLayout";
import { ClientActifProvider } from "@/lib/client-actif";
import ClientActifBar from "@/components/commercial/ClientActifBar";

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout requiredRole="COMMERCIAL">
      {/* Le client en cours est partagé par tous les écrans de la tournée. */}
      <ClientActifProvider>
        <ClientActifBar />
        {children}
      </ClientActifProvider>
    </AppLayout>
  );
}
