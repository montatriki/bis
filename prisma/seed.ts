import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🌱 Seeding database...");

  // Users
  const adminUser = await prisma.user.upsert({
    where: { login: "admin" },
    update: {},
    create: {
      name: "Admin Système",
      email: "admin@bis.tn",
      login: "admin",
      password: await bcrypt.hash("admin123", 10),
      role: "ADMIN",
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { login: "manager" },
    update: {},
    create: {
      name: "Rachid Mansouri",
      email: "manager@bis.tn",
      login: "manager",
      password: await bcrypt.hash("manager123", 10),
      role: "MANAGER",
    },
  });

  await prisma.manager.upsert({
    where: { userId: managerUser.id },
    update: {},
    create: { userId: managerUser.id, department: "Commercial" },
  });

  const commUser = await prisma.user.upsert({
    where: { login: "mokhtar" },
    update: {},
    create: {
      name: "Mokhtar Trabelsi",
      email: "mokhtar@bis.tn",
      login: "mokhtar",
      password: await bcrypt.hash("007", 10),
      role: "COMMERCIAL",
      phone: "+216 20 000 000",
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { login: "client" },
    update: {},
    create: {
      name: "AGIL BEJA SUD",
      email: "agil@beja.tn",
      login: "client",
      password: await bcrypt.hash("client123", 10),
      role: "CLIENT",
    },
  });

  // Vehicles
  const vehicle1 = await prisma.vehicle.upsert({
    where: { plate: "206TU7140" },
    update: {},
    create: {
      plate: "206TU7140", brand: "Peugeot", model: "206", year: 2021,
      currentLat: 36.7257, currentLng: 9.1817,
      insuranceExpiry: new Date("2026-12-27"),
      controlExpiry: new Date("2027-03-15"),
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { plate: "238TU1019" },
    update: {},
    create: {
      plate: "238TU1019", brand: "Renault", model: "Express", year: 2022,
      currentLat: 36.8190, currentLng: 10.1658,
      insuranceExpiry: new Date("2026-08-10"),
    },
  });

  await prisma.vehicle.upsert({
    where: { plate: "243TU3251" },
    update: {},
    create: {
      plate: "243TU3251", brand: "Citroën", model: "Berlingo", year: 2020,
      currentLat: 35.8254, currentLng: 10.6360,
    },
  });

  // Commercial
  const commercial = await prisma.commercial.upsert({
    where: { userId: commUser.id },
    update: {},
    create: {
      userId: commUser.id,
      vehicleId: vehicle1.id,
      zone: "Nord",
      targetCA: 5000,
      missionCode: "2548",
      currentLat: 36.7257,
      currentLng: 9.1817,
    },
  });

  // Products
  const products = [
    { reference: "P001", barcode: "6192207300848", name: "coffret echec 2025", family: "Jeux", subFamily: "Jeux de société", stock: 10, price: 12.5, priceTTC: 14.875 },
    { reference: "P002", barcode: "6192207300250", name: "Conte hikayeti 2026", family: "Livres", subFamily: "Conte", stock: 20, price: 8.0, priceTTC: 9.52 },
    { reference: "P003", barcode: "6192207300541", name: "BALLON 6PSC 2026", family: "Sports", subFamily: "Ballons", stock: 22, price: 5.5, priceTTC: 6.545 },
    { reference: "P004", barcode: "6192207300817", name: "coffret scrable 2025", family: "Jeux", subFamily: "Jeux de société", stock: 10, price: 15.0, priceTTC: 17.85 },
    { reference: "P005", barcode: "6192207300121", name: "Echec bois 2023", family: "Jeux", subFamily: "Jeux classiques", stock: 15, price: 18.0, priceTTC: 21.42 },
    { reference: "P006", barcode: "6192207300084", name: "jeux ludo bois", family: "Jeux", subFamily: "Jeux classiques", stock: 9, price: 10.0, priceTTC: 11.9 },
    { reference: "P007", barcode: "6192207300326", name: "mini box 9pcs 2026", family: "Jouets", subFamily: "Mini jeux", stock: 19, price: 7.5, priceTTC: 8.925 },
    { reference: "P008", barcode: "6192207300015", name: "mini puzzel 2 en 1 70 pcs", family: "Jeux", subFamily: "Puzzles", stock: 13, price: 9.0, priceTTC: 10.71 },
    { reference: "P009", barcode: "6192107903026", name: "Surprise DouDou 12 pcs", family: "Jouets", subFamily: "Peluches", stock: 14, price: 22.0, priceTTC: 26.18 },
    { reference: "P010", barcode: "6192207300503", name: "surprise rolly poly", family: "Jouets", subFamily: "Mini jouets", stock: 12, price: 4.5, priceTTC: 5.355 },
    { reference: "P011", barcode: "6192207300600", name: "jeux de bois 4 en 1", family: "Jeux", subFamily: "Jeux classiques", stock: 25, price: 16.0, priceTTC: 19.04 },
    { reference: "P012", barcode: "6192207300700", name: "Domino bois 28pcs", family: "Jeux", subFamily: "Jeux classiques", stock: 30, price: 11.0, priceTTC: 13.09 },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { reference: p.reference }, update: {}, create: p });
  }

  // Clients
  const clientsData = [
    { name: "AGIL BEJA SUD", city: "Beja", governorate: "Béja", lat: 36.7257, lng: 9.1817, balance: 4428.262, riskScore: 72, category: "GMS", taxId: "1400127Z/P/E/004", isPlanned: true },
    { name: "AGIL BEJA NORD", city: "Beja", governorate: "Béja", lat: 36.7357, lng: 9.1917, balance: 4291.121, riskScore: 68, category: "GMS", isPlanned: true },
    { name: "AGIL SIDI KHLIFA", city: "Sfax", governorate: "Sfax", lat: 34.7606, lng: 10.7803, balance: 3659.434, riskScore: 61, category: "GMS", isPlanned: false },
    { name: "AGIL MAHDIA", city: "Mahdia", governorate: "Mahdia", lat: 35.5047, lng: 11.0622, balance: 3408.199, riskScore: 58, category: "GMS", isPlanned: false },
    { name: "librairie Synotec sarl", city: "Ariana", governorate: "Ariana", lat: 36.8625, lng: 10.1956, balance: 0, riskScore: 5, category: "librairie", isPlanned: true },
    { name: "ste medinart", city: "Tunis", governorate: "Tunis", lat: 36.8190, lng: 10.1658, balance: 0, riskScore: 8, category: "librairie", isPlanned: true },
    { name: "librairie saphir", city: "Tunis", governorate: "Tunis", lat: 36.8100, lng: 10.1800, balance: 2738.102, riskScore: 45, category: "librairie", isPlanned: true },
    { name: "société Orchid trading", city: "Tunis", governorate: "Tunis", lat: 36.8220, lng: 10.1720, balance: 630.499, riskScore: 22, category: "magasin", isPlanned: false },
    { name: "ola agereb", city: "Sfax", governorate: "Sfax", lat: 34.7600, lng: 10.7800, balance: 2765.625, riskScore: 48, category: "magasin", isPlanned: false },
    { name: "SOCIÉTÉ SPICE LAND", city: "Sfax", governorate: "Sfax", lat: 34.7500, lng: 10.7500, balance: 0, riskScore: 10, category: "vente en gros", isPlanned: true },
    { name: "Ste Anouar express bareka", city: "Hammamet", governorate: "Nabeul", lat: 36.4000, lng: 10.6167, balance: 418.05, riskScore: 18, category: "gros alimentaire", isPlanned: true },
    { name: "Ste anouar express wed baten", city: "Hammamet", governorate: "Nabeul", lat: 36.4100, lng: 10.6267, balance: 363.55, riskScore: 16, category: "vente en gros", isPlanned: true },
    { name: "Librairie Al Thaqafa", city: "Sousse", governorate: "Sousse", lat: 35.8254, lng: 10.6360, balance: 1200.0, riskScore: 35, category: "librairie", isPlanned: false },
    { name: "Jouets Mégastore", city: "Sfax", governorate: "Sfax", lat: 34.7450, lng: 10.7610, balance: 340.0, riskScore: 15, category: "magasin jouets", isPlanned: true },
    { name: "Grossiste El Wafa", city: "Monastir", governorate: "Monastir", lat: 35.7643, lng: 10.8113, balance: 1560.75, riskScore: 40, category: "vente en gros", isPlanned: false },
  ];

  let firstClientId = "";
  for (const c of clientsData) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } });
    if (!existing) {
      const created = await prisma.client.create({
        data: { ...c, commercialId: commercial.id },
      });
      if (!firstClientId) firstClientId = created.id;
    } else {
      if (!firstClientId) firstClientId = existing.id;
    }
  }

  // Link client user to first client
  if (firstClientId) {
    await prisma.client.update({
      where: { id: firstClientId },
      data: { userId: clientUser.id },
    });
  }

  // Create some documents
  const clientRecord = await prisma.client.findFirst({ where: { commercialId: commercial.id } });
  if (clientRecord) {
    const product = await prisma.product.findFirst();
    if (product) {
      const doc = await prisma.document.upsert({
        where: { reference: "TIC252816" },
        update: {},
        create: {
          type: "TIC",
          reference: "TIC252816",
          clientId: clientRecord.id,
          commercialId: commercial.id,
          totalHT: 0,
          totalTTC: 0,
          totalTVA: 0,
          status: "VALIDATED",
          isValidated: true,
        },
      });

      await prisma.documentLine.upsert({
        where: { id: doc.id + "_line1" },
        update: {},
        create: {
          id: doc.id + "_line1",
          documentId: doc.id,
          productId: product.id,
          qty: 1,
          unitPrice: 0,
          discount: 100,
          totalHT: 0,
          totalTTC: 0,
        },
      });

      // Order
      await prisma.order.upsert({
        where: { reference: "CMD243001" },
        update: {},
        create: {
          reference: "CMD243001",
          clientId: clientRecord.id,
          status: "IN_ROUTE",
          totalTTC: 1840.0,
          deliveryDate: new Date("2026-05-20"),
          notes: "Livraison prioritaire",
        },
      });
    }
  }

  // ===== Sales documents (Vente) =====
  const clientsForDocs = await prisma.client.findMany({ take: 6 });
  const salesDocs = [
    { type: "BL" as const, reference: "BL-2026-0087", totalHT: 2004.62, totalTVA: 380.88, totalTTC: 2385.5, status: "PAID" },
    { type: "BL" as const, reference: "BL-2026-0086", totalHT: 1554.62, totalTVA: 295.37, totalTTC: 1849.99, status: "PENDING" },
    { type: "FAC" as const, reference: "FAC-2026-042", totalHT: 2004.62, totalTVA: 380.88, totalTTC: 2385.5, status: "PAID" },
    { type: "BL" as const, reference: "BL-2026-0085", totalHT: 2857.31, totalTVA: 542.89, totalTTC: 3400.2, status: "PARTIAL" },
    { type: "BC" as const, reference: "BC-2026-0089", totalHT: 362.18, totalTVA: 68.81, totalTTC: 430.99, status: "PENDING" },
    { type: "AV" as const, reference: "AV-2026-008", totalHT: -201.68, totalTVA: -38.32, totalTTC: -240.0, status: "VALIDATED" },
    { type: "DEV" as const, reference: "DEV-2026-015", totalHT: 1680.0, totalTVA: 319.2, totalTTC: 1999.2, status: "PENDING" },
  ];
  if (clientsForDocs.length && commercial) {
    for (let i = 0; i < salesDocs.length; i++) {
      const d = salesDocs[i];
      const cl = clientsForDocs[i % clientsForDocs.length];
      await prisma.document.upsert({
        where: { reference: d.reference },
        update: {},
        create: {
          type: d.type, reference: d.reference, clientId: cl.id, commercialId: commercial.id,
          totalHT: d.totalHT, totalTVA: d.totalTVA, totalTTC: d.totalTTC,
          status: d.status, isValidated: d.status !== "PENDING",
        },
      });
    }
  }

  // GPS positions
  const gpsPoints = [
    { lat: 36.7257, lng: 9.1817, speed: 0 },
    { lat: 36.7300, lng: 9.1850, speed: 45 },
    { lat: 36.7350, lng: 9.1900, speed: 52 },
  ];
  for (const pt of gpsPoints) {
    await prisma.gpsPosition.create({
      data: { commercialId: commercial.id, vehicleId: vehicle1.id, ...pt },
    });
  }

  // Pas de notifications en dur : `/api/notifications` recalcule les alertes
  // système (ruptures, échéances véhicules, impayés, documents à valider) à
  // partir des données réelles à chaque appel. Des lignes semées faisaient
  // double emploi avec ces alertes et affichaient des chiffres faux — « 3 bons
  // de commande en attente » quand la base en comptait 1 015, « 1 chèque de
  // 2500 TND » quand aucun n'était échu.
  //
  // La table `notifications` reste alimentée à l'exécution, pour les messages
  // adressés à un utilisateur précis.

  // Visit
  if (clientRecord) {
    await prisma.visit.create({
      data: {
        commercialId: commercial.id,
        clientId: clientRecord.id,
        checkedIn: true,
        checkInTime: new Date("2026-05-15T11:22:00"),
        checkOutTime: new Date("2026-05-15T11:45:00"),
        duration: 23,
        caVisit: 1840,
        tags: ["Paiement effectué", "Commande passée"],
      },
    });
  }

  // ===== Depots =====
  const depotPrincipal = await prisma.depot.upsert({
    where: { code: "DEP01" },
    update: {},
    create: { code: "DEP01", name: "Dépôt Principal", address: "Z.I. Béja", isMain: true },
  });
  const depotVehicule = await prisma.depot.upsert({
    where: { code: "DEP02" },
    update: {},
    create: { code: "DEP02", name: "Stock Véhicule 206TU7140", address: "Mobile" },
  });

  // ===== Suppliers =====
  const suppliersData = [
    { code: "FRS001", name: "SOUHA SA", contact: "Mehdi Ben Salah", phone: "+216 71 000 111", city: "Tunis", taxId: "0011222Z/A/M/000", balance: 12450.5, category: "Local" },
    { code: "FRS002", name: "JOUETS IMPORT TUNISIE", contact: "Sami Khelifi", phone: "+216 74 555 222", city: "Sfax", taxId: "0034567Z/A/M/000", balance: 8300.0, category: "Import" },
    { code: "FRS003", name: "PAPETERIE DU SUD", contact: "Olfa Trabelsi", phone: "+216 73 333 444", city: "Sousse", balance: 0, category: "Local" },
    { code: "FRS004", name: "GLOBAL TOYS LTD", contact: "Import Dept", phone: "+86 755 0000", city: "Shenzhen", balance: 45200.75, category: "Import" },
  ];
  const supplierMap: Record<string, string> = {};
  for (const s of suppliersData) {
    const sup = await prisma.supplier.upsert({ where: { code: s.code }, update: {}, create: s });
    supplierMap[s.code] = sup.id;
  }

  // Attach products to main depot + a supplier
  const allProducts = await prisma.product.findMany();
  for (const p of allProducts) {
    await prisma.product.update({
      where: { id: p.id },
      data: {
        depotId: depotPrincipal.id,
        supplierId: supplierMap["FRS001"],
        minStock: 5,
        purchasePrice: Number((p.price * 0.7).toFixed(3)),
      },
    });
  }

  // ===== Stock movements =====
  let mvtN = 1;
  for (const p of allProducts.slice(0, 8)) {
    const inQty = 50;
    await prisma.stockMovement.upsert({
      where: { reference: `MVT${String(mvtN).padStart(4, "0")}` },
      update: {},
      create: {
        reference: `MVT${String(mvtN++).padStart(4, "0")}`,
        type: "IN", productId: p.id, depotId: depotPrincipal.id,
        qty: inQty, qtyBefore: p.stock, qtyAfter: p.stock + inQty,
        unitCost: Number((p.price * 0.7).toFixed(3)), reason: "Réception fournisseur SOUHA SA", documentRef: "BC-2026-0080",
      },
    });
  }

  // ===== Purchase documents =====
  const purchasesData = [
    { type: "BC" as const, reference: "BC-2026-0080", supplierId: supplierMap["FRS001"], totalHT: 4200, totalTVA: 798, totalTTC: 4998, paid: 4998, status: "PAID" },
    { type: "FAC" as const, reference: "FACA-2026-031", supplierId: supplierMap["FRS002"], totalHT: 8300, totalTVA: 1577, totalTTC: 9877, paid: 5000, status: "PARTIAL" },
    { type: "BC" as const, reference: "BC-2026-0081", supplierId: supplierMap["FRS004"], totalHT: 45200.75, totalTVA: 0, totalTTC: 45200.75, paid: 0, status: "PENDING", notes: "Import - hors TVA" },
  ];
  for (const pd of purchasesData) {
    await prisma.purchaseDocument.upsert({ where: { reference: pd.reference }, update: {}, create: pd });
  }

  // ===== Plan comptable (Tunisian standard, simplified) =====
  const accountsData = [
    { number: "1011", label: "Capital social", class: "CLASSE_1" as const },
    { number: "2154", label: "Matériel industriel", class: "CLASSE_2" as const },
    { number: "3111", label: "Marchandises", class: "CLASSE_3" as const },
    { number: "4011", label: "Fournisseurs", class: "CLASSE_4" as const },
    { number: "4111", label: "Clients", class: "CLASSE_4" as const },
    { number: "43666", label: "TVA collectée", class: "CLASSE_4" as const },
    { number: "43667", label: "TVA déductible", class: "CLASSE_4" as const },
    { number: "532", label: "Caisse", class: "CLASSE_5" as const },
    { number: "5321", label: "Banque BIAT", class: "CLASSE_5" as const },
    { number: "607", label: "Achats de marchandises", class: "CLASSE_6" as const },
    { number: "626", label: "Frais postaux et télécom", class: "CLASSE_6" as const },
    { number: "707", label: "Ventes de marchandises", class: "CLASSE_7" as const },
  ];
  const accountMap: Record<string, string> = {};
  for (const a of accountsData) {
    const acc = await prisma.account.upsert({ where: { number: a.number }, update: {}, create: { ...a, isStandard: true } });
    accountMap[a.number] = acc.id;
  }

  // ===== Journal entries (écritures) =====
  const je1 = await prisma.journalEntry.upsert({
    where: { reference: "OD-2026-001" },
    update: {},
    create: {
      reference: "OD-2026-001", journal: "VT", label: "Facture vente FAC-2026-042 AGIL BEJA SUD",
      totalDebit: 2385.5, totalCredit: 2385.5,
      lines: {
        create: [
          { accountId: accountMap["4111"], label: "AGIL BEJA SUD", debit: 2385.5, credit: 0 },
          { accountId: accountMap["707"], label: "Vente marchandises", debit: 0, credit: 2004.62 },
          { accountId: accountMap["43666"], label: "TVA 19%", debit: 0, credit: 380.88 },
        ],
      },
    },
  });
  void je1;
  const je2 = await prisma.journalEntry.upsert({
    where: { reference: "OD-2026-002" },
    update: {},
    create: {
      reference: "OD-2026-002", journal: "AC", label: "Achat marchandises BC-2026-0080 SOUHA SA",
      totalDebit: 4998, totalCredit: 4998,
      lines: {
        create: [
          { accountId: accountMap["607"], label: "Achat marchandises", debit: 4200, credit: 0 },
          { accountId: accountMap["43667"], label: "TVA déductible", debit: 798, credit: 0 },
          { accountId: accountMap["4011"], label: "SOUHA SA", debit: 0, credit: 4998 },
        ],
      },
    },
  });
  void je2;

  // ===== Bank accounts =====
  const banque = await prisma.bankAccount.upsert({
    where: { code: "BNK01" },
    update: {},
    create: { code: "BNK01", bank: "BIAT", label: "Compte courant BIAT", rib: "08 123 0001234567890 12", balance: 84200.5, type: "BANQUE" },
  });
  const caisse = await prisma.bankAccount.upsert({
    where: { code: "CAI01" },
    update: {},
    create: { code: "CAI01", bank: "Caisse", label: "Caisse principale", balance: 3506.0, type: "CAISSE" },
  });

  // ===== Reglements =====
  const firstClient = await prisma.client.findFirst({ where: { balance: { gt: 0 } } });
  if (firstClient) {
    await prisma.reglement.upsert({
      where: { reference: "REG-CLI-001" },
      update: {},
      create: {
        reference: "REG-CLI-001", sens: "CLIENT", mode: "CHEQUE", amount: 2385.5,
        clientId: firstClient.id, bankAccountId: banque.id, chequeNumber: "5847123", status: "ENCAISSE",
        notes: "Règlement FAC-2026-042",
      },
    });
    await prisma.reglement.upsert({
      where: { reference: "REG-CLI-002" },
      update: {},
      create: {
        reference: "REG-CLI-002", sens: "CLIENT", mode: "ESPECES", amount: 1000,
        clientId: firstClient.id, bankAccountId: caisse.id, status: "ENCAISSE",
        notes: "Acompte BL-2026-0085",
      },
    });
  }
  await prisma.reglement.upsert({
    where: { reference: "REG-FRS-001" },
    update: {},
    create: {
      reference: "REG-FRS-001", sens: "FOURNISSEUR", mode: "VIREMENT", amount: 4998,
      supplierId: supplierMap["FRS001"], bankAccountId: banque.id, status: "PAYE",
      notes: "Règlement BC-2026-0080",
    },
  });

  console.log("✅ Seed complete!");
  console.log("\n📋 Demo login credentials:");
  console.log("  Admin:      admin / admin123");
  console.log("  Manager:    manager / manager123");
  console.log("  Commercial: mokhtar / 007");
  console.log("  Client:     client / client123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
