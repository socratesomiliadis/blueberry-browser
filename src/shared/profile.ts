export type ThemeMode = "system" | "light" | "dark";
export type AccentColor = "blueberry" | "grape" | "mint" | "sunset";
export type Density = "compact" | "cozy" | "comfortable";
export type StartBehavior = "startPage" | "homepage";

export interface BrowserSettings {
  theme: ThemeMode;
  accent: AccentColor;
  density: Density;
  sidebarDefaultOpen: boolean;
  startBehavior: StartBehavior;
  customHomepage: string;
}

export interface OnboardingState {
  completed: boolean;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  sourceBrowser: "chrome" | "edge" | "manual";
  sourceProfile: string;
  folderPath: string[];
  importedAt: string;
}

export interface BookmarkSource {
  id: string;
  browser: "chrome" | "edge";
  browserName: string;
  profileName: string;
  profilePath: string;
  bookmarksPath: string;
  bookmarkCount: number;
  error?: string;
}

export interface BookmarkImportResult {
  importedCount: number;
  skippedCount: number;
  errors: Array<{
    sourceId: string;
    message: string;
  }>;
  bookmarks: Bookmark[];
}

export interface ProfileData {
  onboarding: OnboardingState;
  settings: BrowserSettings;
  bookmarks: Bookmark[];
}

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  theme: "system",
  accent: "blueberry",
  density: "cozy",
  sidebarDefaultOpen: true,
  startBehavior: "startPage",
  customHomepage: "https://www.google.com",
};

export const DEFAULT_PROFILE_DATA: ProfileData = {
  onboarding: {
    completed: false,
  },
  settings: DEFAULT_BROWSER_SETTINGS,
  bookmarks: [],
};

export const BLUEBERRY_START_URL = "blueberry://start";
