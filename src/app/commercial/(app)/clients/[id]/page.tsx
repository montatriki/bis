"use client";
import { useParams, useRouter } from "next/navigation";
import FicheClient, { type ClientFiche } from "@/components/clients/FicheClient";
import { useClientActif } from "@/lib/client-actif";

// Fiche client, vue commercial : « Passer commande » sélectionne le client
// actif et ouvre le catalogue.

export default function FicheClientCommercialPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { choisir } = useClientActif();

  const commander = (c: ClientFiche) => {
    choisir({
      id: c.id, raisonSocial: c.raisonSocial ?? "", ville: c.ville, gouvernorat: c.gouvernorat, tel: c.tel,
      famille: c.famille, latitude: c.latitude, longitude: c.longitude, soldeFin: c.soldeFin, distance: null,
    }, "manuel");
    router.push("/commercial/catalogue");
  };

  return <FicheClient id={Number(id)} retourHref="/commercial/clients" retourLabel="Mes clients" onCommander={commander} />;
}
