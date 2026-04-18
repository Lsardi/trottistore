/**
 * Import CATALOGUE VOLT 2026 — 48 trottinettes électriques
 *
 * Usage:
 *   npx tsx scripts/import-catalogue-volt.ts
 *
 * Env vars:
 *   API_BASE_URL  — default https://trottistore.fr
 *   ADMIN_EMAIL   — admin login email
 *   ADMIN_PASSWORD — admin login password
 */

const API_BASE = process.env.API_BASE_URL || "https://trottistore.fr";

// ─── Product data extracted from CATALOGUE VOLT 2026.pdf ────────

interface ProductData {
  brand: string;
  name: string;
  sku: string;
  battery: string;
  range: string;
  powerNominal: string;
  powerMax: string;
  weight: string;
  brakes: string;
  wheels: string;
  suspension: string;
  waterproof: string;
  priceTTC: number;
  features?: string[];
  variants?: { suffix: string; battery: string; range: string; weight: string; priceTTC: number }[];
}

const products: ProductData[] = [
  // ═══════════════ DUALTRON ═══════════════
  {
    brand: "Dualtron",
    name: "Sonic",
    sku: "DT-SONIC",
    battery: "36V 10Ah + 4Ah",
    range: "25 km",
    powerNominal: "2 x 350W",
    powerMax: "700W",
    weight: "14,1 kg",
    brakes: "À patins",
    wheels: "9 pouces",
    suspension: "/",
    waterproof: "IPX5",
    priceTTC: 799,
  },
  {
    brand: "Dualtron",
    name: "Togo",
    sku: "DT-TOGO",
    battery: "48V 12Ah",
    range: "45 km",
    powerNominal: "650W",
    powerMax: "800W",
    weight: "24 kg",
    brakes: "Tambours AV + AR",
    wheels: "9 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 599,
  },
  {
    brand: "Dualtron",
    name: "Togo Pro",
    sku: "DT-TOGO-PRO",
    battery: "48V 13,5Ah",
    range: "50 km",
    powerNominal: "650W",
    powerMax: "800W",
    weight: "24 kg",
    brakes: "Tambours AV + AR",
    wheels: "9 pouces tubeless anti-crevaison",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 699,
  },
  {
    brand: "Dualtron",
    name: "Togo LTD",
    sku: "DT-TOGO-LTD",
    battery: "60V 15Ah",
    range: "50 km",
    powerNominal: "900W",
    powerMax: "1200W",
    weight: "25 kg",
    brakes: "Disques AV + AR",
    wheels: "10 pouces chambre à air",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 899,
  },
  {
    brand: "Dualtron",
    name: "Togo Max",
    sku: "DT-TOGO-MAX",
    battery: "60V 15,9Ah",
    range: "60 km",
    powerNominal: "900W",
    powerMax: "1200W",
    weight: "25 kg",
    brakes: "Disques AV + AR",
    wheels: "10 pouces chambre à air",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 999,
  },
  {
    brand: "Dualtron",
    name: "Aminia",
    sku: "DT-AMINIA-13",
    battery: "52V 13Ah",
    range: "45 km",
    powerNominal: "1000W",
    powerMax: "1450W",
    weight: "25 kg",
    brakes: "Tambours AV + AR",
    wheels: "9 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 749,
    variants: [
      { suffix: "17", battery: "52V 17,5Ah", range: "55 km", weight: "25,5 kg", priceTTC: 999 },
    ],
  },
  {
    brand: "Dualtron",
    name: "Aminia Dual",
    sku: "DT-AMINIA-DUAL-15",
    battery: "52V 15,6Ah",
    range: "50 km",
    powerNominal: "2x 1000W",
    powerMax: "2x 1450W",
    weight: "30 kg",
    brakes: "Tambours AV + AR",
    wheels: "9 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 999,
    variants: [
      { suffix: "21", battery: "52V 21Ah", range: "65 km", weight: "30,5 kg", priceTTC: 1499 },
    ],
  },
  {
    brand: "Dualtron",
    name: "Forever",
    sku: "DT-FOREVER",
    battery: "60V 18,2Ah",
    range: "50 km",
    powerNominal: "2 x 900W",
    powerMax: "2 x 1450W",
    weight: "24,9 kg",
    brakes: "Disques AV + AR",
    wheels: "10 pouces chambre à air",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 799,
  },
  {
    brand: "Dualtron",
    name: "Forever LTD",
    sku: "DT-FOREVER-LTD-18",
    battery: "60V 18,2Ah",
    range: "50 km",
    powerNominal: "2 x 900W",
    powerMax: "2 x 1450W",
    weight: "24,9 kg",
    brakes: "Disques AV + AR",
    wheels: "10 pouces chambre à air",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1199,
    features: ["Display Ey4", "Fast charger"],
    variants: [
      { suffix: "24", battery: "60V 24Ah", range: "60 km", weight: "25 kg", priceTTC: 1299 },
    ],
  },
  {
    brand: "Dualtron",
    name: "Victor",
    sku: "DT-VICTOR",
    battery: "60V 27Ah",
    range: "80 km",
    powerNominal: "2 x 1200W",
    powerMax: "4000W",
    weight: "34 kg",
    brakes: "Hydraulique disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1699,
    features: ["Display Ey4", "Fast charger"],
  },
  {
    brand: "Dualtron",
    name: "Victor Luxury",
    sku: "DT-VICTOR-LUX",
    battery: "60V 30Ah",
    range: "100 km",
    powerNominal: "2 x 1200W",
    powerMax: "4000W",
    weight: "34,8 kg",
    brakes: "Hydraulique disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1799,
    features: ["Display Ey4", "Fast charger"],
  },
  {
    brand: "Dualtron",
    name: "Victor Luxury+",
    sku: "DT-VICTOR-LUXP-31",
    battery: "60V 31,5Ah",
    range: "100 km",
    powerNominal: "2 x 1300W",
    powerMax: "4400W",
    weight: "37,4 kg",
    brakes: "Hydraulique disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1999,
    features: ["Display Ey4", "Fast charger"],
    variants: [
      { suffix: "35", battery: "60V 35Ah", range: "120 km", weight: "37,4 kg", priceTTC: 2199 },
    ],
  },
  {
    brand: "Dualtron",
    name: "Victor Limited",
    sku: "DT-VICTOR-LTD-31",
    battery: "60V 31Ah",
    range: "90 km",
    powerNominal: "2 x 1300W",
    powerMax: "4000W",
    weight: "39,1 kg",
    brakes: "Hydraulique NUTT AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2099,
    features: ["Display Ey4", "Fast charger"],
    variants: [
      { suffix: "35", battery: "60V 35Ah", range: "110 km", weight: "39,5 kg", priceTTC: 2499 },
    ],
  },
  {
    brand: "Dualtron",
    name: "City",
    sku: "DT-CITY-22",
    battery: "60V 22,5Ah",
    range: "60 km",
    powerNominal: "2 x 1200W",
    powerMax: "4000W",
    weight: "41,2 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "15 pouces chambre à air",
    suspension: "AV + AR",
    waterproof: "IP54",
    priceTTC: 1999,
    features: ["Display Ey", "Fast charger"],
    variants: [
      { suffix: "25", battery: "60V 25Ah", range: "70 km", weight: "41,6 kg", priceTTC: 2099 },
    ],
  },
  {
    brand: "Dualtron",
    name: "Achilleus",
    sku: "DT-ACHILLEUS",
    battery: "60V 35Ah LG",
    range: "120 km",
    powerNominal: "2650W",
    powerMax: "4648W",
    weight: "41,7 kg",
    brakes: "Hydraulique disques AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2499,
    features: ["Display Ey4", "Fast charger"],
  },
  {
    brand: "Dualtron",
    name: "Thunder 3",
    sku: "DT-THUNDER3",
    battery: "72V 40Ah LG",
    range: "125 km",
    powerNominal: "2 x 2500W",
    powerMax: "10080W",
    weight: "53 kg",
    brakes: "Hydraulique NUTT disques AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 3299,
    features: ["Display Ey4", "Fast charger"],
  },
  {
    brand: "Dualtron",
    name: "Thunder 3 DGT",
    sku: "DT-THUNDER3-DGT",
    battery: "72V 40Ah LG",
    range: "125 km",
    powerNominal: "2 x 500W",
    powerMax: "1000W",
    weight: "49,65 kg",
    brakes: "Hydraulique NUTT disques AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2799,
    features: ["Display Ey4", "Fast charger"],
  },
  {
    brand: "Dualtron",
    name: "Sonic Alien",
    sku: "DT-SONIC-ALIEN",
    battery: "72V 40Ah LG",
    range: "125 km",
    powerNominal: "2 x 2000W",
    powerMax: "8000W",
    weight: "47 kg",
    brakes: "Hydraulique NUTT disques AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 3499,
  },
  {
    brand: "Dualtron",
    name: "Storm LTD",
    sku: "DT-STORM-LTD",
    battery: "84V 45Ah",
    range: "120 km",
    powerNominal: "8000W",
    powerMax: "11500W",
    weight: "55,6 kg",
    brakes: "Hydraulique disques AV + AR",
    wheels: "12 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 4299,
    features: ["Display Ey4", "Fast charger"],
  },
  {
    brand: "Dualtron",
    name: "X LTD",
    sku: "DT-X-LTD",
    battery: "84V 60Ah",
    range: "170 km",
    powerNominal: "8300W",
    powerMax: "13300W",
    weight: "82,9 kg",
    brakes: "Hydraulique disques AV + AR",
    wheels: "13 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 5499,
    features: ["Display Ey4", "Fast charger"],
  },

  // ═══════════════ ROVORON ═══════════════
  {
    brand: "Rovoron",
    name: "R7",
    sku: "RV-R7",
    battery: "60V 28,6Ah",
    range: "90 km",
    powerNominal: "2 x 900W",
    powerMax: "3000W",
    weight: "47 kg",
    brakes: "Disques AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX6",
    priceTTC: 999,
  },
  {
    brand: "Rovoron",
    name: "R7 Pro",
    sku: "RV-R7-PRO",
    battery: "60V 42Ah",
    range: "90 km",
    powerNominal: "2 x 900W",
    powerMax: "3000W",
    weight: "49 kg",
    brakes: "Hydraulique AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX6",
    priceTTC: 1499,
  },
  {
    brand: "Rovoron",
    name: "S7 Pro",
    sku: "RV-S7-PRO",
    battery: "84V 37Ah",
    range: "125 km",
    powerNominal: "2 x 2500W",
    powerMax: "7600W",
    weight: "49 kg",
    brakes: "Hydraulique AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2499,
  },

  // ═══════════════ TEVERUN ═══════════════
  {
    brand: "Teverun",
    name: "Fighter Q",
    sku: "TV-FIGHTER-Q",
    battery: "52V 13Ah",
    range: "40 km",
    powerNominal: "2 x 500W",
    powerMax: "2469W",
    weight: "28 kg",
    brakes: "Disques",
    wheels: "8,5 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 799,
    features: ["Disponible en version off road"],
  },
  {
    brand: "Teverun",
    name: "Fighter Q Pro",
    sku: "TV-FIGHTER-Q-PRO",
    battery: "52V 15Ah",
    range: "60 km",
    powerNominal: "2 x 1000W",
    powerMax: "3000W",
    weight: "29 kg",
    brakes: "Disques",
    wheels: "8,5 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 899,
  },
  {
    brand: "Teverun",
    name: "Fighter Q Pro+",
    sku: "TV-FIGHTER-Q-PROP",
    battery: "52V 15Ah",
    range: "60 km",
    powerNominal: "2 x 1000W",
    powerMax: "3000W",
    weight: "29 kg",
    brakes: "Disques",
    wheels: "8,5 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1049,
  },
  {
    brand: "Teverun",
    name: "Space",
    sku: "TV-SPACE",
    battery: "52V 18Ah",
    range: "60 km",
    powerNominal: "2 x 800W",
    powerMax: "2000W",
    weight: "30 kg",
    brakes: "Disques hydrauliques",
    wheels: "10 pouces tubeless anti-crevaison",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1099,
  },
  {
    brand: "Teverun",
    name: "Blade Mini",
    sku: "TV-BLADE-MINI",
    battery: "60V 27Ah",
    range: "100 km",
    powerNominal: "2 x 1000W",
    powerMax: "2950W",
    weight: "35 kg",
    brakes: "Disques hydrauliques",
    wheels: "10 pouces tubeless anti-crevaison",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1499,
  },
  {
    brand: "Teverun",
    name: "Fighter Mini Eco",
    sku: "TV-FIGHTER-MINI-ECO",
    battery: "52V 20,8Ah",
    range: "60 km",
    powerNominal: "2 x 1000W",
    powerMax: "2950W",
    weight: "32 kg",
    brakes: "Hydraulique Zoom disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1399,
  },
  {
    brand: "Teverun",
    name: "Fighter Mini",
    sku: "TV-FIGHTER-MINI",
    battery: "52V 25Ah",
    range: "80 km",
    powerNominal: "2 x 1000W",
    powerMax: "2950W",
    weight: "34,4 kg",
    brakes: "Hydraulique Zoom disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1599,
  },
  {
    brand: "Teverun",
    name: "Fighter Mini Pro",
    sku: "TV-FIGHTER-MINI-PRO",
    battery: "60V 25Ah",
    range: "80 km",
    powerNominal: "2 x 1000W",
    powerMax: "2950W",
    weight: "35,5 kg",
    brakes: "Hydraulique Zoom disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1899,
  },
  {
    brand: "Teverun",
    name: "Fighter 7260R 2025",
    sku: "TV-FIGHTER-7260R",
    battery: "72V 60Ah",
    range: "200 km",
    powerNominal: "2 x 2500W",
    powerMax: "8000W",
    weight: "63 kg",
    brakes: "Hydraulique NUTT 4 pistons",
    wheels: "13 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 4799,
  },

  // ═══════════════ KUICKWHEEL ═══════════════
  {
    brand: "Kuickwheel",
    name: "Booster ES",
    sku: "KW-BOOSTER-ES",
    battery: "36V 7,8Ah",
    range: "30 km",
    powerNominal: "500W",
    powerMax: "1000W",
    weight: "11 kg",
    brakes: "E-ABS",
    wheels: "8 pouces plein",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 699,
  },
  {
    brand: "Kuickwheel",
    name: "Booster GT SL",
    sku: "KW-BOOSTER-GT-SL",
    battery: "48V 7,8Ah",
    range: "30 km",
    powerNominal: "500W",
    powerMax: "1000W",
    weight: "13 kg",
    brakes: "Tambour AV + E-ABS",
    wheels: "8 pouces plein",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 899,
  },
  {
    brand: "Kuickwheel",
    name: "Booster GT Sport",
    sku: "KW-BOOSTER-GT-SPORT",
    battery: "48V 10,5Ah",
    range: "35 km",
    powerNominal: "500W",
    powerMax: "1000W",
    weight: "13,5 kg",
    brakes: "Tambour AV + E-ABS",
    wheels: "8 pouces plein",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 999,
  },
  {
    brand: "Kuickwheel",
    name: "Climber",
    sku: "KW-CLIMBER",
    battery: "36V 14,7Ah",
    range: "40 km",
    powerNominal: "2 x 450W",
    powerMax: "2 x 900W",
    weight: "20,8 kg",
    brakes: "Disque AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 699,
  },
  {
    brand: "Kuickwheel",
    name: "S1F",
    sku: "KW-S1F",
    battery: "54V 12,5Ah",
    range: "40 km",
    powerNominal: "500W",
    powerMax: "1000W",
    weight: "24 kg",
    brakes: "Tambour AV",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 799,
  },
  {
    brand: "Kuickwheel",
    name: "F1",
    sku: "KW-F1",
    battery: "36V 7,8Ah",
    range: "25 km",
    powerNominal: "350W",
    powerMax: "650W",
    weight: "16 kg",
    brakes: "Tambour AV + E-ABS AR",
    wheels: "10 pouces chambre à air",
    suspension: "/",
    waterproof: "IPX5",
    priceTTC: 399,
  },
  {
    brand: "Kuickwheel",
    name: "M16 Pro",
    sku: "KW-M16-PRO",
    battery: "36V 10,4Ah",
    range: "40 km",
    powerNominal: "350W",
    powerMax: "500W",
    weight: "18 kg",
    brakes: "Disque AR",
    wheels: "10 pouces chambre à air",
    suspension: "/",
    waterproof: "IPX5",
    priceTTC: 499,
  },
  {
    brand: "Kuickwheel",
    name: "S1-C Pro",
    sku: "KW-S1C-PRO",
    battery: "36V 13Ah",
    range: "50 km",
    powerNominal: "350W",
    powerMax: "500W",
    weight: "22 kg",
    brakes: "Tambour AV + E-ABS AR",
    wheels: "10 pouces chambre à air",
    suspension: "AV",
    waterproof: "IPX7",
    priceTTC: 699,
  },
  {
    brand: "Kuickwheel",
    name: "S9",
    sku: "KW-S9",
    battery: "36V 15,6Ah",
    range: "65 km",
    powerNominal: "500W",
    powerMax: "750W",
    weight: "25 kg",
    brakes: "Disques AV + Tambour AR",
    wheels: "10 pouces chambre à air",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 799,
  },
  {
    brand: "Kuickwheel",
    name: "Coupé",
    sku: "KW-COUPE",
    battery: "48V 15,6Ah",
    range: "45 km",
    powerNominal: "2 x 800W",
    powerMax: "2 x 1000W",
    weight: "35 kg",
    brakes: "Disques AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 999,
  },
  {
    brand: "Kuickwheel",
    name: "GT2 Mini",
    sku: "KW-GT2-MINI",
    battery: "48V 18,2Ah",
    range: "60 km",
    powerNominal: "2 x 1200W",
    powerMax: "2 x 2400W",
    weight: "32 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 1399,
  },
  {
    brand: "Kuickwheel",
    name: "C5 Dual",
    sku: "KW-C5-DUAL",
    battery: "60V 27Ah",
    range: "70 km",
    powerNominal: "2 x 1500W",
    powerMax: "2 x 3000W",
    weight: "37 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "10 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2299,
  },
  {
    brand: "Kuickwheel",
    name: "C1 Dual",
    sku: "KW-C1-DUAL",
    battery: "60V 36Ah",
    range: "100 km",
    powerNominal: "2 x 2000W",
    powerMax: "2 x 4000W",
    weight: "45 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2499,
  },
  {
    brand: "Kuickwheel",
    name: "H1 Dual",
    sku: "KW-H1-DUAL",
    battery: "72V 35Ah",
    range: "120 km",
    powerNominal: "2 x 2000W",
    powerMax: "2 x 4000W",
    weight: "53 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "11 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 2999,
  },
  {
    brand: "Kuickwheel",
    name: "H2 Dual",
    sku: "KW-H2-DUAL",
    battery: "72V 40Ah",
    range: "140 km",
    powerNominal: "2 x 2000W",
    powerMax: "2 x 4000W",
    weight: "63 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "12 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 3999,
  },
  {
    brand: "Kuickwheel",
    name: "GT2 RS",
    sku: "KW-GT2-RS",
    battery: "84V 50Ah",
    range: "170 km",
    powerNominal: "2 x 4000W",
    powerMax: "2 x 8000W",
    weight: "97 kg",
    brakes: "Disques hydraulique AV + AR",
    wheels: "13 pouces tubeless",
    suspension: "AV + AR",
    waterproof: "IPX5",
    priceTTC: 5999,
  },
];

// ─── Helpers ────────────────────────────────────────────────

function ttcToHt(priceTTC: number): number {
  return Math.round((priceTTC / 1.2) * 100) / 100;
}

function parseWeight(w: string): number | null {
  const m = w.match(/([\d,]+)/);
  if (!m) return null;
  return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
}

function buildDescription(p: ProductData): string {
  const parts: string[] = [];

  parts.push(`Trottinette électrique ${p.brand} ${p.name}.`);

  const specs: string[] = [];
  specs.push(`Moteur ${p.powerNominal} (${p.powerMax} max)`);
  specs.push(`batterie ${p.battery}`);
  specs.push(`autonomie ${p.range}`);
  parts.push(specs.join(", ") + ".");

  parts.push(`Freinage ${p.brakes.toLowerCase()}, roues ${p.wheels}.`);

  if (p.suspension && p.suspension !== "/") {
    parts.push(`Suspensions ${p.suspension}.`);
  }

  parts.push(`Poids ${p.weight}, étanchéité ${p.waterproof}.`);

  if (p.features && p.features.length > 0) {
    parts.push(p.features.join(". ") + ".");
  }

  parts.push("Disponible chez TrottiStore à L'Île-Saint-Denis — garantie 2 ans, atelier de réparation sur place.");

  return parts.join(" ");
}

function buildShortDescription(p: ProductData): string {
  return `${p.brand} ${p.name} — ${p.powerMax} max, ${p.range} d'autonomie, ${p.weight}`;
}

// ─── API calls ──────────────────────────────────────────────

let accessToken = "";

async function api(method: string, path: string, body?: unknown) {
  const url = `${API_BASE}/api/v1${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok && res.status !== 409) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function login() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars");
  }

  const res = await api("POST", "/auth/login", { email, password });
  accessToken = res.data.accessToken;
  console.log("✓ Logged in as admin");
}

async function createBrand(name: string): Promise<string> {
  const res = await api("POST", "/admin/brands", { name });
  console.log(`  Brand: ${name} → ${res.data.id}`);
  return res.data.id;
}

async function createCategory(name: string): Promise<string> {
  const res = await api("POST", "/admin/categories", { name, isActive: true });
  console.log(`  Category: ${name} → ${res.data.id}`);
  return res.data.id;
}

async function createProduct(
  p: ProductData,
  brandId: string,
  categoryId: string,
  skuSuffix?: string,
  overrides?: { battery?: string; range?: string; weight?: string; priceTTC?: number },
) {
  const effectivePriceTTC = overrides?.priceTTC ?? p.priceTTC;
  const effectiveBattery = overrides?.battery ?? p.battery;
  const effectiveRange = overrides?.range ?? p.range;
  const effectiveWeight = overrides?.weight ?? p.weight;
  const effectiveSku = skuSuffix ? `${p.sku}-${skuSuffix}` : p.sku;
  const effectiveName = skuSuffix ? `${p.brand} ${p.name} (${effectiveBattery})` : `${p.brand} ${p.name}`;

  const effectiveProduct = {
    ...p,
    battery: effectiveBattery,
    range: effectiveRange,
    weight: effectiveWeight,
    priceTTC: effectivePriceTTC,
  };

  const body = {
    name: effectiveName,
    sku: effectiveSku,
    description: buildDescription(effectiveProduct),
    shortDescription: buildShortDescription(effectiveProduct),
    brandId,
    priceHt: ttcToHt(effectivePriceTTC),
    tvaRate: 20,
    weightGrams: parseWeight(effectiveWeight),
    status: "ACTIVE",
    isFeatured: effectivePriceTTC >= 2000,
    metaTitle: `${effectiveName} | TrottiStore`,
    metaDesc: `${effectiveName} — ${effectiveProduct.powerMax} max, ${effectiveRange} d'autonomie. Achat, réparation et pièces détachées chez TrottiStore à L'Île-Saint-Denis.`,
    categories: [categoryId],
  };

  try {
    const res = await api("POST", "/admin/products", body);
    console.log(`  ✓ ${effectiveName} (${effectiveSku}) → ${res.data?.id || "created"}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("409") || msg.includes("DUPLICATE")) {
      console.log(`  ⊘ ${effectiveName} (${effectiveSku}) — already exists, skipped`);
      return true;
    }
    console.error(`  ✗ ${effectiveName} (${effectiveSku}): ${msg}`);
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log(`\n🛴 Import CATALOGUE VOLT 2026 → ${API_BASE}\n`);

  await login();

  // 1. Create brands
  console.log("\n── Brands ──");
  const brandIds: Record<string, string> = {};
  for (const name of ["Dualtron", "Rovoron", "Teverun", "Kuickwheel"]) {
    brandIds[name] = await createBrand(name);
  }

  // 2. Create category
  console.log("\n── Categories ──");
  const categoryId = await createCategory("Trottinettes électriques");

  // 3. Import products
  console.log(`\n── Products (${products.length} base + variants) ──`);
  let created = 0;
  let failed = 0;

  for (const p of products) {
    const brandId = brandIds[p.brand];
    if (!brandId) {
      console.error(`  ✗ Unknown brand: ${p.brand}`);
      failed++;
      continue;
    }

    // Main product
    const ok = await createProduct(p, brandId, categoryId);
    if (ok) created++;
    else failed++;

    // Variants (different battery sizes)
    if (p.variants) {
      for (const v of p.variants) {
        const vok = await createProduct(p, brandId, categoryId, v.suffix, {
          battery: v.battery,
          range: v.range,
          weight: v.weight,
          priceTTC: v.priceTTC,
        });
        if (vok) created++;
        else failed++;
      }
    }
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`  Created: ${created}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Total:   ${created + failed}`);
  console.log(`═══════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
