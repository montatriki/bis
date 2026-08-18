"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import ModuleView from "@/components/erp/ModuleView";

// Sous-menus disposant d'un écran dédié plutôt que du tableau générique.
const PAGES_DEDIEES: Record<string, string> = {
  "stock/etat-stock": "/admin/etat-stock",
};

export default function ErpSubPage({ params }: { params: Promise<{ module: string; sub: string }> }) {
  const { module, sub } = use(params);
  const router = useRouter();
  const dediee = PAGES_DEDIEES[`${module}/${sub}`];

  useEffect(() => {
    if (dediee) router.replace(dediee);
  }, [dediee, router]);

  if (dediee) return <div className="p-8 text-[var(--text-secondary)] text-sm">Chargement…</div>;

  return <ModuleView key={`${module}/${sub}`} moduleSlug={module} subSlug={sub} />;
}
