import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { echeancesAVenir, prochaineEcheance, joursAvant } from "@/lib/echeances-vehicules";

// Parc roulant — entretien et échéances.
//
// GET    /api/vehicules?vue=echeances            -> tout ce qui arrive à terme
// GET    /api/vehicules?vue=operations&id=<veh>  -> plan d'entretien d'un véhicule
// POST   /api/vehicules?vue=operations           -> ajoute une opération périodique
// POST   /api/vehicules?vue=execution            -> marque une opération faite
// PUT    /api/vehicules?vue=operations           -> modifie une opération
// PUT    /api/vehicules?vue=kilometrage          -> met à jour le compteur
// DELETE /api/vehicules?vue=operations&id=<op>   -> retire une opération

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const entierOuNull = (v: unknown) => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
};
const dateOuNull = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const sp = req.nextUrl.searchParams;
  const vue = sp.get("vue") ?? "echeances";

  if (vue === "echeances") {
    const fenetre = Number(sp.get("fenetre") ?? 30);
    const rows = await echeancesAVenir(Number.isFinite(fenetre) ? fenetre : 30);
    return NextResponse.json({
      rows,
      total: rows.length,
      expirees: rows.filter((r) => r.gravite === "expire").length,
      urgentes: rows.filter((r) => r.gravite === "urgent").length,
    });
  }

  if (vue === "operations") {
    const vehicleId = s(sp.get("id"));
    const operations = await prisma.vehiculeOperation.findMany({
      where: vehicleId ? { vehicleId } : undefined,
      orderBy: [{ actif: "desc" }, { prochaineDate: "asc" }],
      include: { vehicle: { select: { plate: true, kilometrage: true } } },
    });

    return NextResponse.json({
      rows: operations.map((op) => ({
        ...op,
        plaque: op.vehicle.plate,
        joursRestants: joursAvant(op.prochaineDate),
        kmRestants:
          op.prochainKm != null && op.vehicle.kilometrage != null
            ? op.prochainKm - op.vehicle.kilometrage
            : null,
      })),
      total: operations.length,
    });
  }

  return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const vue = req.nextUrl.searchParams.get("vue") ?? "operations";
  const body = await req.json();

  try {
    if (vue === "operations") {
      const vehicleId = s(body.vehicleId);
      const libelle = s(body.libelle);
      if (!vehicleId) return NextResponse.json({ error: "Véhicule requis" }, { status: 400 });
      if (!libelle) return NextResponse.json({ error: "Libellé de l'opération requis" }, { status: 400 });

      const intervalleKm = entierOuNull(body.intervalleKm);
      const intervalleJours = entierOuNull(body.intervalleJours);
      // Sans périodicité, l'opération ne pourrait jamais devenir exigible :
      // elle n'alerterait de rien et n'aurait donc aucune utilité.
      if (intervalleKm == null && intervalleJours == null) {
        return NextResponse.json(
          { error: "Indiquez une périodicité : en kilomètres, en jours, ou les deux" },
          { status: 400 },
        );
      }

      const vehicule = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicule) return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });

      // Point de départ : la dernière exécution si elle est connue, sinon
      // aujourd'hui — la première échéance court à partir de la mise en place.
      const derniereDate = dateOuNull(body.derniereDate) ?? new Date();
      const dernierKm = entierOuNull(body.dernierKm) ?? vehicule.kilometrage;
      const suite = prochaineEcheance({ intervalleKm, intervalleJours }, derniereDate, dernierKm);

      const row = await prisma.vehiculeOperation.create({
        data: {
          vehicleId, libelle, intervalleKm, intervalleJours,
          derniereDate, dernierKm, notes: s(body.notes) || null,
          ...suite,
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    // Exécution : l'opération vient d'être faite, on la replanifie.
    if (vue === "execution") {
      const id = Number(body.id);
      const op = await prisma.vehiculeOperation.findUnique({
        where: { id }, include: { vehicle: true },
      });
      if (!op) return NextResponse.json({ error: "Opération introuvable" }, { status: 404 });

      const faitLe = dateOuNull(body.date) ?? new Date();
      const kmActuel = entierOuNull(body.kilometrage) ?? op.vehicle.kilometrage;
      const suite = prochaineEcheance(op, faitLe, kmActuel);

      const [row] = await prisma.$transaction([
        prisma.vehiculeOperation.update({
          where: { id },
          data: { derniereDate: faitLe, dernierKm: kmActuel, ...suite },
        }),
        // Le compteur relevé pendant l'entretien fait foi pour le véhicule.
        ...(kmActuel != null && kmActuel !== op.vehicle.kilometrage
          ? [prisma.vehicle.update({ where: { id: op.vehicleId }, data: { kilometrage: kmActuel } })]
          : []),
      ]);

      return NextResponse.json({
        ok: true, row,
        message: `${op.libelle} enregistrée — prochaine ${
          suite.prochaineDate ? `le ${suite.prochaineDate.toLocaleDateString("fr-FR")}` : ""
        }${suite.prochainKm != null ? ` à ${suite.prochainKm} km` : ""}`.trim(),
      });
    }

    return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const vue = req.nextUrl.searchParams.get("vue") ?? "operations";
  const body = await req.json();

  try {
    if (vue === "kilometrage") {
      const km = entierOuNull(body.kilometrage);
      if (km == null || km < 0) {
        return NextResponse.json({ error: "Kilométrage invalide" }, { status: 400 });
      }
      const row = await prisma.vehicle.update({
        where: { id: s(body.id) }, data: { kilometrage: km },
      });
      return NextResponse.json({ ok: true, row });
    }

    if (vue === "operations") {
      const id = Number(body.id);
      const op = await prisma.vehiculeOperation.findUnique({ where: { id } });
      if (!op) return NextResponse.json({ error: "Opération introuvable" }, { status: 404 });

      const intervalleKm =
        body.intervalleKm !== undefined ? entierOuNull(body.intervalleKm) : op.intervalleKm;
      const intervalleJours =
        body.intervalleJours !== undefined ? entierOuNull(body.intervalleJours) : op.intervalleJours;
      if (intervalleKm == null && intervalleJours == null) {
        return NextResponse.json(
          { error: "Indiquez une périodicité : en kilomètres, en jours, ou les deux" },
          { status: 400 },
        );
      }

      // Changer la périodicité doit décaler l'échéance, sinon la modification
      // resterait sans effet jusqu'au prochain entretien.
      const suite = prochaineEcheance(
        { intervalleKm, intervalleJours },
        op.derniereDate ?? new Date(),
        op.dernierKm,
      );

      const row = await prisma.vehiculeOperation.update({
        where: { id },
        data: {
          libelle: s(body.libelle) || op.libelle,
          intervalleKm, intervalleJours,
          actif: body.actif !== undefined ? Boolean(body.actif) : op.actif,
          notes: body.notes !== undefined ? s(body.notes) || null : op.notes,
          ...suite,
        },
      });
      return NextResponse.json({ ok: true, row });
    }

    return NextResponse.json({ error: "vue inconnue" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id requis" }, { status: 400 });
  try {
    await prisma.vehiculeOperation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
