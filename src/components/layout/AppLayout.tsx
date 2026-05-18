import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BISAssistant from "@/components/ui/BISAssistant";

export default async function AppLayout({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: string | string[];
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(session.role)) redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={session} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar user={session} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
      <BISAssistant />
    </div>
  );
}
