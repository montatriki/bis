"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { findModule } from "@/lib/erp-modules";

export default function ModuleLanding({ params }: { params: Promise<{ module: string }> }) {
  const { module } = use(params);
  const router = useRouter();
  const mod = findModule(module);
  useEffect(() => {
    if (mod && mod.subs[0]) router.replace(`/admin/modules/${module}/${mod.subs[0].slug}`);
  }, [mod, module, router]);
  return <div className="p-8 text-slate-400 text-sm">Chargement du module…</div>;
}
