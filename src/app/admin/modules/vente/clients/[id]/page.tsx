"use client";
import { useParams } from "next/navigation";
import FicheClient from "@/components/clients/FicheClient";

// Fiche client, vue administrateur (module Vente › Clients) : consultation —
// pas de « Passer commande », la vente se fait sur le terrain.

export default function FicheClientAdminPage() {
  const { id } = useParams<{ id: string }>();
  return <FicheClient id={Number(id)} retourHref="/admin/modules/vente/clients" retourLabel="Clients — module Vente" />;
}
