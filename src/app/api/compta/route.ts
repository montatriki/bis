import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// GET /api/compta?resource=plan|ecritures|balance|bilan|resultat
export async function GET(req: NextRequest) {
  const auth = await requireSession(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.res;
  const resource = req.nextUrl.searchParams.get("resource") ?? "plan";

  if (resource === "plan") {
    const accounts = await prisma.account.findMany({ orderBy: { number: "asc" } });
    return NextResponse.json({ accounts });
  }

  if (resource === "ecritures") {
    const ecritures = await prisma.journalEntry.findMany({
      include: { lines: { include: { account: true } } },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ ecritures });
  }

  if (resource === "balance") {
    const accounts = await prisma.account.findMany({
      include: { entries: true },
      orderBy: { number: "asc" },
    });
    const balance = accounts
      .map((a) => {
        const debit = a.entries.reduce((s, e) => s + e.debit, 0);
        const credit = a.entries.reduce((s, e) => s + e.credit, 0);
        return {
          number: a.number,
          label: a.label,
          class: a.class,
          debit,
          credit,
          soldeDebiteur: Math.max(0, debit - credit),
          soldeCrediteur: Math.max(0, credit - debit),
        };
      })
      .filter((b) => b.debit !== 0 || b.credit !== 0);
    return NextResponse.json({ balance });
  }

  if (resource === "resultat" || resource === "bilan") {
    const accounts = await prisma.account.findMany({ include: { entries: true } });
    const sumClass = (cls: string) =>
      accounts
        .filter((a) => a.class === cls)
        .reduce(
          (acc, a) => {
            acc.debit += a.entries.reduce((s, e) => s + e.debit, 0);
            acc.credit += a.entries.reduce((s, e) => s + e.credit, 0);
            return acc;
          },
          { debit: 0, credit: 0 }
        );
    const charges = sumClass("CLASSE_6");
    const produits = sumClass("CLASSE_7");
    const resultat = produits.credit - produits.debit - (charges.debit - charges.credit);
    if (resource === "resultat") {
      return NextResponse.json({
        produits: produits.credit - produits.debit,
        charges: charges.debit - charges.credit,
        resultat,
      });
    }
    // bilan (simplified)
    const actif = sumClass("CLASSE_2").debit + sumClass("CLASSE_3").debit + sumClass("CLASSE_5").debit;
    const passif = sumClass("CLASSE_1").credit + sumClass("CLASSE_4").credit;
    return NextResponse.json({ actif, passif, resultat });
  }

  return NextResponse.json({ error: "Unknown resource" }, { status: 400 });
}
