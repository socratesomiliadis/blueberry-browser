import { resolveDarkMode } from "../lib/appearance";
import { useBrowserSettings } from "./useBrowserSettings";

interface UseDarkModeResult {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const useDarkMode = (): UseDarkModeResult => {
  const { settings, saveSettings } = useBrowserSettings();
  const isDarkMode = resolveDarkMode(settings);

  const toggleDarkMode = (): void => {
    saveSettings({ theme: isDarkMode ? "light" : "dark" }).catch((error) => {
      console.error("Failed to toggle dark mode:", error);
    });
  };

  return { isDarkMode, toggleDarkMode };
};
