export const THEME_STORAGE_KEY = "trottistore-theme";

export const THEME_PROFILES = [
  {
    id: "atelier",
    label: "Atelier Neon",
    short: "Tech noir",
    description: "Style atelier électrique, contrasté et technique.",
  },
  {
    id: "editorial",
    label: "Editorial Light",
    short: "Magazine clair",
    description: "Style premium éditorial, doux et aéré.",
  },
  {
    id: "brutalist",
    label: "Brutalist Chrome",
    short: "Impact brut",
    description: "Style retail agressif, formes franches et contrastes forts.",
  },
  {
    id: "contraste",
    label: "Haute Lisibilité",
    short: "Contraste max",
    description: "Textes pur blanc sur noir profond, contrastes maximisés pour lecture facilitée.",
  },
] as const;

export type ThemeId = (typeof THEME_PROFILES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "atelier";

const THEME_ID_SET: ReadonlySet<string> = new Set(THEME_PROFILES.map((theme) => theme.id));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_ID_SET.has(value);
}
