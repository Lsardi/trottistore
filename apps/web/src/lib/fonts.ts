import { Syne, Space_Mono, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif, Manrope } from "next/font/google";

// Atelier theme (default) — loaded eagerly
export const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-syne",
});

export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-space-mono",
});

// Editorial + Brutalist themes — loaded eagerly too (small overhead, avoids CLS on theme switch)
export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-ibm-plex-mono",
});

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
});

export const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-serif",
});

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

/** All font CSS variable classes combined */
export const fontVariables = [
  syne.variable,
  spaceMono.variable,
  ibmPlexMono.variable,
  ibmPlexSans.variable,
  ibmPlexSerif.variable,
  manrope.variable,
].join(" ");
