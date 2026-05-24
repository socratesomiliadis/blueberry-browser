import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type { Bookmark, BrowserSettings } from "../shared/profile";

// TopBar specific APIs
const topBarAPI = {
  platform: process.platform,

  // Tab management
  createTab: (url?: string) =>
    electronAPI.ipcRenderer.invoke("create-tab", url),
  closeTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("close-tab", tabId),
  switchTab: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("switch-tab", tabId),
  getTabs: () => electronAPI.ipcRenderer.invoke("get-tabs"),

  // Tab navigation
  navigateTab: (tabId: string, url: string) =>
    electronAPI.ipcRenderer.invoke("navigate-tab", tabId, url),
  goBack: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-back", tabId),
  goForward: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-go-forward", tabId),
  reload: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-reload", tabId),

  // Tab actions
  tabScreenshot: (tabId: string) =>
    electronAPI.ipcRenderer.invoke("tab-screenshot", tabId),
  tabRunJs: (tabId: string, code: string) =>
    electronAPI.ipcRenderer.invoke("tab-run-js", tabId, code),

  // Sidebar
  toggleSidebar: () => electronAPI.ipcRenderer.invoke("toggle-sidebar"),
  onSidebarVisibilityChanged: (
    callback: (state: { isVisible: boolean }) => void,
  ) => {
    electronAPI.ipcRenderer.on("sidebar-visibility-changed", (_, state) =>
      callback(state),
    );
  },
  removeSidebarVisibilityChangedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("sidebar-visibility-changed");
  },

  // Window controls
  minimizeWindow: () => electronAPI.ipcRenderer.invoke("window-minimize"),
  toggleMaximizeWindow: () =>
    electronAPI.ipcRenderer.invoke("window-toggle-maximize"),
  closeWindow: () => electronAPI.ipcRenderer.invoke("window-close"),
  getWindowState: () => electronAPI.ipcRenderer.invoke("window-get-state"),
  onWindowStateChanged: (
    callback: (state: { isMaximized: boolean }) => void,
  ) => {
    electronAPI.ipcRenderer.on("window-state-changed", (_, state) =>
      callback(state),
    );
  },
  removeWindowStateChangedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("window-state-changed");
  },

  // Profile
  getSettings: () => electronAPI.ipcRenderer.invoke("profile-get-settings"),
  saveSettings: (settings: Partial<BrowserSettings>) =>
    electronAPI.ipcRenderer.invoke("profile-save-settings", settings),
  getBookmarks: () => electronAPI.ipcRenderer.invoke("profile-get-bookmarks"),
  onSettingsUpdated: (callback: (settings: BrowserSettings) => void) => {
    electronAPI.ipcRenderer.on("settings-updated", (_, settings) =>
      callback(settings),
    );
  },
  removeSettingsUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("settings-updated");
  },
  onBookmarksUpdated: (callback: (bookmarks: Bookmark[]) => void) => {
    electronAPI.ipcRenderer.on("bookmarks-updated", (_, bookmarks) =>
      callback(bookmarks),
    );
  },
  removeBookmarksUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("bookmarks-updated");
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("topBarAPI", topBarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.topBarAPI = topBarAPI;
}
