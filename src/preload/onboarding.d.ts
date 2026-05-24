import { ElectronAPI } from "@electron-toolkit/preload";
import type {
  BookmarkImportResult,
  BookmarkSource,
  BrowserSettings,
  OnboardingState,
  ProfileData,
} from "../shared/profile";

interface OnboardingAPI {
  getOnboardingState: () => Promise<OnboardingState>;
  scanBookmarkSources: () => Promise<BookmarkSource[]>;
  importBookmarks: (sourceIds: string[]) => Promise<BookmarkImportResult>;
  getSettings: () => Promise<BrowserSettings>;
  saveSettings: (
    settings: Partial<BrowserSettings>,
  ) => Promise<BrowserSettings>;
  completeOnboarding: (
    settings?: Partial<BrowserSettings>,
  ) => Promise<ProfileData>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<{ isMaximized: boolean }>;
  closeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    onboardingAPI: OnboardingAPI;
  }
}
