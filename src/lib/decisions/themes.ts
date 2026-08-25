export interface ThemeDef {
  id: string;
  name: string;
  premium: boolean;
  cost: number;
  dark: boolean;
  bg: string;
  card: string;
  cardSolid: string;
  text: string;
  sub: string;
  accent: string;
  accentText: string;
  timer: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: "sunset",
    name: "Sunset Rush",
    premium: false,
    cost: 0,
    dark: false,
    bg: "linear-gradient(160deg,#ff9a3d 0%,#ff5f6d 55%,#c2418f 100%)",
    card: "rgba(255,255,255,0.22)",
    cardSolid: "#fff7ef",
    text: "#2b0a18",
    sub: "rgba(43,10,24,0.72)",
    accent: "#7c2ae8",
    accentText: "#ffffff",
    timer: "#ffe066",
  },
  {
    id: "ocean",
    name: "Ocean Bounce",
    premium: false,
    cost: 0,
    dark: false,
    bg: "linear-gradient(160deg,#36d1dc 0%,#5b86e5 60%,#3b4bd8 100%)",
    card: "rgba(255,255,255,0.22)",
    cardSolid: "#effaff",
    text: "#04263b",
    sub: "rgba(4,38,59,0.72)",
    accent: "#ffcf3f",
    accentText: "#3b2b00",
    timer: "#b3ffab",
  },
  {
    id: "lime",
    name: "Lime Fizz",
    premium: false,
    cost: 0,
    dark: false,
    bg: "linear-gradient(160deg,#a8e063 0%,#56ab2f 100%)",
    card: "rgba(255,255,255,0.26)",
    cardSolid: "#f7ffee",
    text: "#12300b",
    sub: "rgba(18,48,11,0.72)",
    accent: "#ff7043",
    accentText: "#ffffff",
    timer: "#fff176",
  },
  {
    id: "candy",
    name: "Candy Pop",
    premium: false,
    cost: 0,
    dark: false,
    bg: "linear-gradient(160deg,#fbc2eb 0%,#a18cd1 55%,#6a5ae0 100%)",
    card: "rgba(255,255,255,0.28)",
    cardSolid: "#fdf6ff",
    text: "#2a1147",
    sub: "rgba(42,17,71,0.72)",
    accent: "#ff4d8d",
    accentText: "#ffffff",
    timer: "#ffe066",
  },
  {
    id: "neon",
    name: "Neon Night",
    premium: true,
    cost: 150,
    dark: true,
    bg: "linear-gradient(165deg,#0f0c29 0%,#302b63 55%,#24243e 100%)",
    card: "rgba(255,255,255,0.09)",
    cardSolid: "#191633",
    text: "#f3f1ff",
    sub: "rgba(243,241,255,0.65)",
    accent: "#00e5ff",
    accentText: "#00232a",
    timer: "#ff2fb3",
  },
  {
    id: "lava",
    name: "Lava Core",
    premium: true,
    cost: 180,
    dark: true,
    bg: "linear-gradient(165deg,#200122 0%,#6f0000 100%)",
    card: "rgba(255,255,255,0.09)",
    cardSolid: "#2a0710",
    text: "#fff1ec",
    sub: "rgba(255,241,236,0.65)",
    accent: "#ff9100",
    accentText: "#331c00",
    timer: "#ffd166",
  },
  {
    id: "matrix",
    name: "Matrix Mint",
    premium: true,
    cost: 180,
    dark: true,
    bg: "linear-gradient(165deg,#000f0a 0%,#05281c 60%,#0b3d2c 100%)",
    card: "rgba(0,255,170,0.08)",
    cardSolid: "#032018",
    text: "#d8ffef",
    sub: "rgba(216,255,239,0.62)",
    accent: "#00ffa3",
    accentText: "#00291b",
    timer: "#eaff00",
  },
  {
    id: "gold",
    name: "Royal Gold",
    premium: true,
    cost: 250,
    dark: true,
    bg: "linear-gradient(165deg,#0d0d0d 0%,#1f1a09 60%,#33270d 100%)",
    card: "rgba(255,215,64,0.10)",
    cardSolid: "#211b0a",
    text: "#fff8e1",
    sub: "rgba(255,248,225,0.66)",
    accent: "#ffd54f",
    accentText: "#332600",
    timer: "#ffd54f",
  },
];

export const DEFAULT_THEMES = THEMES.filter((t) => !t.premium).map((t) => t.id);

export function getTheme(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}
