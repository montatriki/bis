export const DUMMY_CLIENTS = [
  { name: "AGIL BEJA SUD", city: "Beja", governorate: "Béja", lat: 36.7257, lng: 9.1817, balance: 4428.262, riskScore: 72, category: "GMS" },
  { name: "AGIL BEJA NORD", city: "Beja", governorate: "Béja", lat: 36.7357, lng: 9.1917, balance: 4291.121, riskScore: 68, category: "GMS" },
  { name: "AGIL SIDI KHLIFA", city: "Sfax", governorate: "Sfax", lat: 34.7406, lng: 10.7603, balance: 3659.434, riskScore: 61, category: "GMS" },
  { name: "AGIL MAHDIA", city: "Mahdia", governorate: "Mahdia", lat: 35.5047, lng: 11.0622, balance: 3408.199, riskScore: 58, category: "GMS" },
  { name: "librairie Synotec sarl", city: "Ariana", governorate: "Ariana", lat: 36.8625, lng: 10.1956, balance: 0, riskScore: 5, category: "librairie" },
  { name: "ste medinart", city: "Tunis", governorate: "Tunis", lat: 36.8190, lng: 10.1658, balance: 0, riskScore: 8, category: "librairie" },
  { name: "librairie saphir", city: "Tunis", governorate: "Tunis", lat: 36.8100, lng: 10.1800, balance: 2738.102, riskScore: 45, category: "librairie" },
  { name: "société Orchid trading", city: "Tunis", governorate: "Tunis", lat: 36.8220, lng: 10.1720, balance: 630.499, riskScore: 22, category: "magasin" },
  { name: "ola agereb", city: "Sfax", governorate: "Sfax", lat: 34.7600, lng: 10.7800, balance: 2765.625, riskScore: 48, category: "magasin" },
  { name: "SOCIÉTÉ SPICE LAND", city: "Sfax", governorate: "Sfax", lat: 34.7500, lng: 10.7500, balance: 0, riskScore: 10, category: "vente en gros" },
  { name: "Ste Anouar express", city: "Hammamet", governorate: "Nabeul", lat: 36.4000, lng: 10.6167, balance: 418.05, riskScore: 18, category: "gros alimentaire" },
  { name: "superette El Amel", city: "Nabeul", governorate: "Nabeul", lat: 36.4512, lng: 10.7345, balance: 892.3, riskScore: 28, category: "superette" },
  { name: "Librairie Al Thaqafa", city: "Sousse", governorate: "Sousse", lat: 35.8254, lng: 10.6360, balance: 1200.0, riskScore: 35, category: "librairie" },
  { name: "Jouets Mégastore", city: "Sfax", governorate: "Sfax", lat: 34.7450, lng: 10.7610, balance: 340.0, riskScore: 15, category: "magasin jouets" },
  { name: "Grossiste El Wafa", city: "Monastir", governorate: "Monastir", lat: 35.7643, lng: 10.8113, balance: 1560.75, riskScore: 40, category: "vente en gros" },
];

export const DUMMY_PRODUCTS = [
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

export const DEMO_USERS = [
  { name: "Admin Système", email: "admin@bis.tn", login: "admin", password: "admin123", role: "ADMIN" },
  { name: "Rachid Mansouri", email: "manager@bis.tn", login: "manager", password: "manager123", role: "MANAGER" },
  { name: "Mokhtar Trabelsi", email: "mokhtar@bis.tn", login: "mokhtar", password: "007", role: "COMMERCIAL" },
  { name: "AGIL BEJA SUD", email: "agil@beja.tn", login: "client", password: "client123", role: "CLIENT" },
];

export const DEMO_VEHICLES = [
  { plate: "206TU7140", driver: "Mokhtar Trabelsi", brand: "Peugeot", model: "206", year: 2021, currentLat: 36.7257, currentLng: 9.1817, status: "active", speed: 0, visited: 14, total: 17, ca: 3506, lastAction: "Visite AGIL BEJA SUD" },
  { plate: "238TU1019", driver: "HICHEM", brand: "Renault", model: "Express", year: 2022, currentLat: 36.8190, currentLng: 10.1658, status: "offline", speed: 0, visited: 8, total: 14, ca: 2100, lastAction: "Hors ligne depuis 2h" },
  { plate: "243TU3251", driver: "FOUED", brand: "Citroën", model: "Berlingo", year: 2020, currentLat: 35.8254, currentLng: 10.6360, status: "moving", speed: 62, visited: 11, total: 15, ca: 4200, lastAction: "En déplacement vers Monastir" },
  { plate: "1075149", driver: "Anis Ben Salem", brand: "LTSB", model: "Transit", year: 2018, currentLat: 34.7406, currentLng: 10.7603, status: "stopped", speed: 0, visited: 6, total: 12, ca: 1800, lastAction: "Pause — arrêté 18 min" },
  { plate: "TN07649", driver: "Karim Riahi", brand: "Peugeot", model: "Partner", year: 2021, currentLat: 35.5047, currentLng: 11.0622, status: "moving", speed: 45, visited: 9, total: 13, ca: 2840, lastAction: "En route vers Mahdia" },
];

export const MONTHLY_CA = [
  { month: "Jan", ca: 18200, objectif: 20000, encaissement: 14500 },
  { month: "Fév", ca: 22400, objectif: 20000, encaissement: 18200 },
  { month: "Mar", ca: 19800, objectif: 22000, encaissement: 15600 },
  { month: "Avr", ca: 25600, objectif: 22000, encaissement: 21000 },
  { month: "Mai", ca: 23100, objectif: 25000, encaissement: 19200 },
  { month: "Juin", ca: 28400, objectif: 25000, encaissement: 24100 },
  { month: "Juil", ca: 31200, objectif: 28000, encaissement: 26800 },
  { month: "Août", ca: 27900, objectif: 28000, encaissement: 23400 },
  { month: "Sep", ca: 24600, objectif: 26000, encaissement: 20500 },
  { month: "Oct", ca: 29300, objectif: 26000, encaissement: 25100 },
  { month: "Nov", ca: 32100, objectif: 30000, encaissement: 27900 },
  { month: "Déc", ca: 36400, objectif: 30000, encaissement: 31200 },
];

export const PRODUCT_FAMILIES = [
  { name: "Jeux", value: 45, color: "#1e40af" },
  { name: "Jouets", value: 25, color: "#0ea5e9" },
  { name: "Livres", value: 15, color: "#10b981" },
  { name: "Sports", value: 15, color: "#f59e0b" },
];

export const COMMERCIAL_PERFORMANCE = [
  { name: "Mokhtar", ca: 62400, objectif: 60000, clients: 111, visites: 287, taux: 104 },
  { name: "HICHEM", ca: 54200, objectif: 60000, clients: 87, visites: 241, taux: 90 },
  { name: "FOUED", ca: 71300, objectif: 60000, clients: 98, visites: 312, taux: 119 },
  { name: "Anis", ca: 48900, objectif: 55000, clients: 75, visites: 198, taux: 89 },
];
