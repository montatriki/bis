import AppLayout from "@/components/layout/AppLayout";

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout requiredRole="COMMERCIAL">{children}</AppLayout>;
}
