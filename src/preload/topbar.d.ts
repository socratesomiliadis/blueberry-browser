import { ElectronAPI } from "@electron-toolkit/preload";
import type { Bookmark, BrowserSettings } from "../shared/profile";

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface TopBarAPI {
  platform: NodeJS.Platform;

  // Tab management
  createTab: (
    url?: string,
  ) => Promise<{ id: string; title: string; url: string } | null>;
  closeTab: (tabId: string) => Promise<boolean>;
  switchTab: (tabId: string) => Promise<boolean>;
  getTabs: () => Promise<TabInfo[]>;

  // Tab navigation
  navigateTab: (tabId: string, url: string) => Promise<void>;
  goBack: (tabId: string) => Promise<void>;
  goForward: (tabId: string) => Promise<void>;
  reload: (tabId: string) => Promise<void>;

  // Tab actions
  tabScreenshot: (tabId: string) => Promise<string | null>;
  tabRunJs: (tabId: string, code: string) => Promise<unknown>;

  // Sidebar
  toggleSidebar: () => Promise<boolean>;
  onSidebarVisibilityChanged: (
    callback: (state: { isVisible: boolean }) => void,
  ) => void;
  removeSidebarVisibilityChangedListener: () => void;

  // Window controls
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<{ isMaximized: boolean }>;
  closeWindow: () => Promise<void>;
  getWindowState: () => Promise<{ isMaximized: boolean }>;
  onWindowStateChanged: (
    callback: (state: { isMaximized: boolean }) => void,
  ) => void;
  removeWindowStateChangedListener: () => void;

  // Profile
  getSettings: () => Promise<BrowserSettings>;
  saveSettings: (
    settings: Partial<BrowserSettings>,
  ) => Promise<BrowserSettings>;
  getBookmarks: () => Promise<Bookmark[]>;
  onSettingsUpdated: (callback: (settings: BrowserSettings) => void) => void;
  removeSettingsUpdatedListener: () => void;
  onBookmarksUpdated: (callback: (bookmarks: Bookmark[]) => void) => void;
  removeBookmarksUpdatedListener: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    topBarAPI: TopBarAPI;
  }
}
