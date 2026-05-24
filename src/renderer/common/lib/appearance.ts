import {
  DEFAULT_BROWSER_SETTINGS,
  type AccentColor,
  type BrowserSettings,
} from "../../../shared/profile";

const ACCENTS: Record<AccentColor, { brand: string; brandSoft: string }> = {
  blueberry: { brand: "79 70 229", brandSoft: "238 242 255" },
  grape: { brand: "139 92 246", brandSoft: "245 243 255" },
  mint: { brand: "15 159 127", brandSoft: "236 253 245" },
  sunset: { brand: "249 115 22", brandSoft: "255 247 237" },
};

export function getSystemDarkMode(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveDarkMode(settings: BrowserSettings): boolean {
  return settings.theme === "system"
    ? getSystemDarkMode()
    : settings.theme === "dark";
}

export function applyAppearance(settings: BrowserSettings): void {
  const normalizedSettings = {
    ...DEFAULT_BROWSER_SETTINGS,
    ...settings,
  };
  const accent = ACCENTS[normalizedSettings.accent];
  const root = document.documentElement;

  root.classList.toggle("dark", resolveDarkMode(normalizedSettings));
  root.dataset.density = normalizedSettings.density;
  root.dataset.accent = normalizedSettings.accent;
  root.style.setProperty("--brand", accent.brand);
  root.style.setProperty("--brand-soft", accent.brandSoft);
}
