import AppLayout from "@/components/layout/AppLayout";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout requiredRole="MANAGER">{children}</AppLayout>;
}
