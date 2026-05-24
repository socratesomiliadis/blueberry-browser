import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type {
  BookmarkImportResult,
  BookmarkSource,
  BrowserSettings,
  OnboardingState,
  ProfileData,
} from "../shared/profile";

const onboardingAPI = {
  getOnboardingState: (): Promise<OnboardingState> =>
    electronAPI.ipcRenderer.invoke("profile-get-onboarding-state"),
  scanBookmarkSources: (): Promise<BookmarkSource[]> =>
    electronAPI.ipcRenderer.invoke("profile-scan-bookmark-sources"),
  importBookmarks: (sourceIds: string[]): Promise<BookmarkImportResult> =>
    electronAPI.ipcRenderer.invoke("profile-import-bookmarks", sourceIds),
  getSettings: (): Promise<BrowserSettings> =>
    electronAPI.ipcRenderer.invoke("profile-get-settings"),
  saveSettings: (
    settings: Partial<BrowserSettings>,
  ): Promise<BrowserSettings> =>
    electronAPI.ipcRenderer.invoke("profile-save-settings", settings),
  completeOnboarding: (
    settings?: Partial<BrowserSettings>,
  ): Promise<ProfileData> =>
    electronAPI.ipcRenderer.invoke("profile-complete-onboarding", settings),
  minimizeWindow: (): Promise<void> =>
    electronAPI.ipcRenderer.invoke("window-minimize"),
  toggleMaximizeWindow: (): Promise<{ isMaximized: boolean }> =>
    electronAPI.ipcRenderer.invoke("window-toggle-maximize"),
  closeWindow: (): Promise<void> =>
    electronAPI.ipcRenderer.invoke("window-close"),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("onboardingAPI", onboardingAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.onboardingAPI = onboardingAPI;
}
