import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { BLUEBERRY_START_URL, type BrowserSettings } from "../shared/profile";
import { AgentOrchestrator } from "./agent/AgentOrchestrator";
import type { PilotExportRequest } from "../shared/agent";

export class EventManager {
  private mainWindow: Window;
  private pilot: AgentOrchestrator;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.pilot = new AgentOrchestrator(
      mainWindow,
      mainWindow.sidebar.view.webContents,
    );
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Pilot events
    this.handlePilotEvents();

    // Page content events
    this.handlePageContentEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Window chrome events
    this.handleWindowEvents();

    // Profile, onboarding, and settings events
    this.handleProfileEvents();

    // Debug events
    this.handleDebugEvents();
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      const activeTabId = this.mainWindow.activeTab?.id;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: activeTabId === tab.id,
      }));
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      return this.mainWindow.toggleSidebar();
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient now handles getting the screenshot and context directly
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });
  }

  private handlePilotEvents(): void {
    ipcMain.handle("pilot-start-run", (_, goal: string) => {
      return this.pilot.startRun(goal);
    });

    ipcMain.handle("pilot-pause-run", () => {
      return this.pilot.pauseRun();
    });

    ipcMain.handle("pilot-resume-run", () => {
      return this.pilot.resumeRun();
    });

    ipcMain.handle("pilot-stop-run", () => {
      return this.pilot.stopRun();
    });

    ipcMain.handle("pilot-approve-action", () => {
      return this.pilot.approveAction();
    });

    ipcMain.handle("pilot-reject-action", () => {
      return this.pilot.rejectAction();
    });

    ipcMain.handle("pilot-get-current-run", () => {
      return this.pilot.getCurrentRun();
    });

    ipcMain.handle(
      "pilot-export-artifact",
      (_, request: PilotExportRequest) => {
        return this.pilot.exportArtifact(request);
      },
    );
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleWindowEvents(): void {
    ipcMain.handle("window-minimize", () => {
      this.mainWindow.minimize();
    });

    ipcMain.handle("window-toggle-maximize", () => {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }

      return this.getWindowState();
    });

    ipcMain.handle("window-close", () => {
      this.mainWindow.close();
    });

    ipcMain.handle("window-get-state", () => this.getWindowState());

    this.mainWindow.baseWindow.on("maximize", () =>
      this.broadcastWindowState(),
    );
    this.mainWindow.baseWindow.on("unmaximize", () =>
      this.broadcastWindowState(),
    );
    this.mainWindow.baseWindow.on("restore", () => this.broadcastWindowState());
  }

  private handleProfileEvents(): void {
    ipcMain.handle("profile-get-onboarding-state", () => {
      return this.mainWindow.profileStore.getData().onboarding;
    });

    ipcMain.handle("profile-scan-bookmark-sources", () => {
      return this.mainWindow.profileStore.scanBookmarkSources();
    });

    ipcMain.handle("profile-import-bookmarks", (_, sourceIds: string[]) => {
      const result = this.mainWindow.profileStore.importBookmarks(sourceIds);
      this.broadcastBookmarks();
      this.reloadStartPageIfActive();
      return result;
    });

    ipcMain.handle("profile-get-settings", () => {
      return this.mainWindow.profileStore.getSettings();
    });

    ipcMain.handle(
      "profile-save-settings",
      (_, settings: Partial<BrowserSettings>) => {
        const savedSettings =
          this.mainWindow.profileStore.saveSettings(settings);
        this.mainWindow.applySettings();
        this.broadcastSettings(savedSettings);
        this.reloadStartPageIfActive();
        return savedSettings;
      },
    );

    ipcMain.handle(
      "profile-complete-onboarding",
      (_, settings?: Partial<BrowserSettings>) => {
        const profileData =
          this.mainWindow.profileStore.completeOnboarding(settings);
        this.mainWindow.applySettings();
        this.mainWindow.hideOnboarding();
        this.broadcastSettings(profileData.settings);
        this.broadcastBookmarks();
        this.reloadStartPageIfActive();
        return profileData;
      },
    );

    ipcMain.handle("profile-get-bookmarks", () => {
      return this.mainWindow.profileStore.getBookmarks();
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => console.log("pong"));
  }

  private getWindowState(): { isMaximized: boolean } {
    return {
      isMaximized: this.mainWindow.isMaximized(),
    };
  }

  private broadcastWindowState(): void {
    this.mainWindow.topBar.view.webContents.send(
      "window-state-changed",
      this.getWindowState(),
    );
  }

  private broadcastSettings(settings: BrowserSettings): void {
    this.broadcastToChrome("settings-updated", settings);
  }

  private broadcastBookmarks(): void {
    this.broadcastToChrome(
      "bookmarks-updated",
      this.mainWindow.profileStore.getBookmarks(),
    );
  }

  private broadcastToChrome(channel: string, payload: unknown): void {
    const webContents = [
      this.mainWindow.topBar.view.webContents,
      this.mainWindow.sidebar.view.webContents,
      this.mainWindow.onboarding.view.webContents,
    ];

    for (const contents of webContents) {
      if (!contents.isDestroyed()) {
        contents.send(channel, payload);
      }
    }
  }

  private reloadStartPageIfActive(): void {
    const activeTab = this.mainWindow.activeTab;
    if (activeTab?.url === BLUEBERRY_START_URL) {
      activeTab.loadURL(BLUEBERRY_START_URL).catch((error) => {
        console.error("Failed to refresh start page:", error);
      });
    }
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode,
      );
    }

    // Send to all tabs
    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    this.pilot.stopRun();
    ipcMain.removeAllListeners();
  }
}
