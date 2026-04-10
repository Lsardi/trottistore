/**
 * Scooter brands and models for the compatibility checker.
 *
 * This is a curated reference list of the most common models we service.
 * The product search results come from the real product database — only
 * the brand/model selection here is static.
 *
 * To add a new brand or model, simply add it to this list.
 */
export const SCOOTER_BRANDS = [
  { name: "Dualtron", models: ["Thunder 2", "Mini", "Victor", "Storm", "Eagle Pro", "Spider 2", "Compact", "Ultra 2"] },
  { name: "Xiaomi", models: ["M365", "M365 Pro", "Pro 2", "Essential", "Mi 4", "Mi 4 Pro"] },
  { name: "Ninebot", models: ["Max G30", "Max G30LP", "Max G2", "E2", "F2", "F2 Plus", "F2 Pro"] },
  { name: "Kaabo", models: ["Mantis 10", "Mantis King GT", "Wolf Warrior 11", "Wolf King GT Pro"] },
  { name: "Segway", models: ["Ninebot P65", "Ninebot P100S", "Ninebot GT2"] },
  { name: "Vsett", models: ["8", "9+", "10+", "11+"] },
  { name: "Inokim", models: ["OX", "OXO", "Quick 4", "Light 2"] },
  { name: "Minimotors", models: ["Speedway 5", "Speedway Leger", "Dualtron"] },
  { name: "Teverun", models: ["Fighter 11+", "Fighter Supreme 7260R", "Blade GT"] },
  { name: "Kuickwheel", models: ["S1-C Pro", "S1-C Pro+"] },
] as const;

export type ScooterBrand = (typeof SCOOTER_BRANDS)[number];
