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

  // Notifications
  const notifs = [
    { userId: adminUser.id, title: "Stock minimum atteint", message: "2 articles sous le seuil minimum", type: "STOCK" },
    { userId: adminUser.id, title: "Chèque échu", message: "1 chèque de 2500 TND arrivé à échéance", type: "FINANCE" },
    { userId: adminUser.id, title: "Véhicule hors ligne", message: "238TU1019 — HICHEM — hors ligne depuis 2h", type: "GPS" },
    { userId: managerUser.id, title: "Document à valider", message: "3 bons de commande en attente", type: "VALIDATION" },
  ];
  for (const n of notifs) {
    await prisma.notification.create({ data: n });
  }

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
