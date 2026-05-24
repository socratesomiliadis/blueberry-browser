import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_BROWSER_SETTINGS,
  type BrowserSettings,
} from "../../../shared/profile";
import { applyAppearance } from "../lib/appearance";

export function useBrowserSettings(): {
  settings: BrowserSettings;
  saveSettings: (settings: Partial<BrowserSettings>) => Promise<void>;
} {
  const [settings, setSettings] = useState<BrowserSettings>(
    DEFAULT_BROWSER_SETTINGS,
  );
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let isMounted = true;

    window.electron.ipcRenderer
      .invoke("profile-get-settings")
      .then((loadedSettings) => {
        if (!isMounted) return;

        const nextSettings = {
          ...DEFAULT_BROWSER_SETTINGS,
          ...(loadedSettings as BrowserSettings),
        };
        setSettings(nextSettings);
        applyAppearance(nextSettings);
      })
      .catch((error) => {
        console.error("Failed to load browser settings:", error);
        applyAppearance(DEFAULT_BROWSER_SETTINGS);
      });

    const handleSettingsUpdated = (
      _event: unknown,
      nextSettings: BrowserSettings,
    ): void => {
      setSettings(nextSettings);
      applyAppearance(nextSettings);
    };
    const handleSystemThemeChange = (): void =>
      applyAppearance(settingsRef.current);

    window.electron.ipcRenderer.on("settings-updated", handleSettingsUpdated);
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", handleSystemThemeChange);

    return () => {
      isMounted = false;
      window.electron.ipcRenderer.removeListener(
        "settings-updated",
        handleSettingsUpdated,
      );
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const saveSettings = useCallback(
    async (settingsPatch: Partial<BrowserSettings>): Promise<void> => {
      const savedSettings = (await window.electron.ipcRenderer.invoke(
        "profile-save-settings",
        settingsPatch,
      )) as BrowserSettings;
      setSettings(savedSettings);
      applyAppearance(savedSettings);
    },
    [],
  );

  return { settings, saveSettings };
}
