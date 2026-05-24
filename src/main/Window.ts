import { BaseWindow, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import {
  getSlidingSidebarBoundsForVisibleWidth,
  getTabBoundsForSidebarWidth,
  SIDEBAR_WIDTH,
} from "./Layout";

const SIDEBAR_ANIMATION_DURATION_MS = 180;
const SIDEBAR_ANIMATION_FRAME_MS = 1000 / 60;

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function easeInCubic(progress: number): number {
  return progress * progress * progress;
}

export class Window {
  private _baseWindow: BaseWindow;
  private tabsMap: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 0;
  private _topBar: TopBar;
  private _sideBar: SideBar;
  private sidebarAnimationTimer: ReturnType<typeof setTimeout> | null = null;
  private sidebarTargetVisible: boolean = true;
  private currentSidebarWidth: number = SIDEBAR_WIDTH;

  constructor() {
    const platformWindowOptions =
      process.platform === "darwin"
        ? {
            titleBarStyle: "hidden" as const,
            trafficLightPosition: { x: 15, y: 13 },
          }
        : {
            frame: false,
          };

    // Create the browser window.
    this._baseWindow = new BaseWindow({
      width: 1000,
      height: 800,
      show: true,
      autoHideMenuBar: false,
      ...platformWindowOptions,
    });

    this._baseWindow.setMinimumSize(1000, 800);

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);

    // Set the window reference on the LLM client to avoid circular dependency
    this._sideBar.client.setWindow(this);

    // Create the first tab
    this.createTab();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateAllBounds();
      this._topBar.updateBounds();
      // Notify renderer of resize through active tab
      const bounds = this._baseWindow.getBounds();
      if (this.activeTab) {
        this.activeTab.webContents.send("window-resized", {
          width: bounds.width,
          height: bounds.height,
        });
      }
    });

    this.setupEventListeners();
  }

  private configureTabWebContents(tab: Tab): void {
    tab.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: "deny" };
    });
  }

  private setupEventListeners(): void {
    this._baseWindow.on("closed", () => {
      this.clearSidebarAnimation();

      // Clean up all tabs when window is closed
      this.tabsMap.forEach((tab) => tab.destroy());
      this.tabsMap.clear();
    });
  }

  // Getters
  get window(): BaseWindow {
    return this._baseWindow;
  }

  get activeTab(): Tab | null {
    if (this.activeTabId) {
      return this.tabsMap.get(this.activeTabId) || null;
    }
    return null;
  }

  get allTabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  get tabCount(): number {
    return this.tabsMap.size;
  }

  // Tab management methods
  createTab(url?: string): Tab {
    const tabId = `tab-${++this.tabCounter}`;
    const tab = new Tab(tabId, url);
    this.configureTabWebContents(tab);

    // Add the tab's WebContentsView to the window
    this._baseWindow.contentView.addChildView(tab.view);

    // Set the bounds to fill the content area below the topbar.
    tab.view.setBounds(
      getTabBoundsForSidebarWidth(this._baseWindow, this.currentSidebarWidth),
    );

    // Store the tab
    this.tabsMap.set(tabId, tab);

    // If this is the first tab, make it active
    if (this.tabsMap.size === 1) {
      this.switchActiveTab(tabId);
    } else {
      // Hide the tab initially if it's not the first one
      tab.hide();
    }

    return tab;
  }

  closeTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // Remove the WebContentsView from the window
    this._baseWindow.contentView.removeChildView(tab.view);

    // Destroy the tab
    tab.destroy();

    // Remove from our tabs map
    this.tabsMap.delete(tabId);

    // If this was the active tab, switch to another tab
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
      const remainingTabs = Array.from(this.tabsMap.keys());
      if (remainingTabs.length > 0) {
        this.switchActiveTab(remainingTabs[0]);
      }
    }

    // If no tabs left, close the window
    if (this.tabsMap.size === 0) {
      this._baseWindow.close();
    }

    return true;
  }

  switchActiveTab(tabId: string): boolean {
    const tab = this.tabsMap.get(tabId);
    if (!tab) {
      return false;
    }

    // Hide the currently active tab
    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabsMap.get(this.activeTabId);
      if (currentTab) {
        currentTab.hide();
      }
    }

    // Show the new active tab
    tab.view.setBounds(
      getTabBoundsForSidebarWidth(this._baseWindow, this.currentSidebarWidth),
    );
    tab.show();
    this.activeTabId = tabId;

    // Update the window title to match the tab title
    this._baseWindow.setTitle(tab.title || "Blueberry Browser");

    return true;
  }

  getTab(tabId: string): Tab | null {
    return this.tabsMap.get(tabId) || null;
  }

  // Window methods
  show(): void {
    this._baseWindow.show();
  }

  hide(): void {
    this._baseWindow.hide();
  }

  close(): void {
    this._baseWindow.close();
  }

  focus(): void {
    this._baseWindow.focus();
  }

  minimize(): void {
    this._baseWindow.minimize();
  }

  maximize(): void {
    this._baseWindow.maximize();
  }

  unmaximize(): void {
    this._baseWindow.unmaximize();
  }

  isMaximized(): boolean {
    return this._baseWindow.isMaximized();
  }

  setTitle(title: string): void {
    this._baseWindow.setTitle(title);
  }

  setBounds(bounds: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }): void {
    this._baseWindow.setBounds(bounds);
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return this._baseWindow.getBounds();
  }

  // Handle window resize to update tab bounds
  private updateTabBounds(
    sidebarWidth: number = this.currentSidebarWidth,
    updateAllTabs: boolean = true,
  ): void {
    const bounds = getTabBoundsForSidebarWidth(this._baseWindow, sidebarWidth);
    const tabsToUpdate =
      updateAllTabs || !this.activeTab
        ? this.tabsMap.values()
        : [this.activeTab];

    Array.from(tabsToUpdate).forEach((tab) => {
      tab.view.setBounds(bounds);
    });
  }

  private applySidebarLayout(
    sidebarWidth: number,
    updateAllTabs: boolean = true,
  ): void {
    const clampedSidebarWidth = Math.min(
      Math.max(0, sidebarWidth),
      SIDEBAR_WIDTH,
    );

    this.currentSidebarWidth = clampedSidebarWidth;
    this.updateTabBounds(clampedSidebarWidth, updateAllTabs);

    if (clampedSidebarWidth > 0 || this.sidebarTargetVisible) {
      this._sideBar.prepareToShow();
      this._sideBar.setAnimatedBounds(
        getSlidingSidebarBoundsForVisibleWidth(
          this._baseWindow,
          clampedSidebarWidth,
        ),
      );
    } else {
      this._sideBar.finishHide();
    }
  }

  private clearSidebarAnimation(): void {
    if (!this.sidebarAnimationTimer) return;

    clearTimeout(this.sidebarAnimationTimer);
    this.sidebarAnimationTimer = null;
  }

  private broadcastSidebarVisibility(): void {
    this._topBar.view.webContents.send("sidebar-visibility-changed", {
      isVisible: this.sidebarTargetVisible,
    });
  }

  setSidebarVisible(visible: boolean): boolean {
    this.clearSidebarAnimation();
    this.sidebarTargetVisible = visible;
    this.broadcastSidebarVisibility();

    const startWidth = this.currentSidebarWidth;
    const endWidth = visible ? SIDEBAR_WIDTH : 0;

    if (startWidth === endWidth) {
      this.applySidebarLayout(endWidth);
      return visible;
    }

    if (visible) {
      this._sideBar.prepareToShow();
      this._sideBar.setAnimatedBounds(
        getSlidingSidebarBoundsForVisibleWidth(this._baseWindow, 0),
      );
    }

    const startedAt = Date.now();

    const tick = (): void => {
      const progress = Math.min(
        (Date.now() - startedAt) / SIDEBAR_ANIMATION_DURATION_MS,
        1,
      );
      const easedProgress = visible
        ? easeOutCubic(progress)
        : easeInCubic(progress);
      const nextWidth = Math.round(
        startWidth + (endWidth - startWidth) * easedProgress,
      );

      this.applySidebarLayout(nextWidth, false);

      if (progress < 1) {
        this.sidebarAnimationTimer = setTimeout(
          tick,
          SIDEBAR_ANIMATION_FRAME_MS,
        );
        return;
      }

      this.applySidebarLayout(endWidth);
      this.sidebarAnimationTimer = null;
    };

    tick();

    return visible;
  }

  toggleSidebar(): boolean {
    return this.setSidebarVisible(!this.sidebarTargetVisible);
  }

  // Public method to update all bounds when sidebar is toggled
  updateAllBounds(): void {
    this.applySidebarLayout(this.currentSidebarWidth);
  }

  // Getter for sidebar to access from main process
  get sidebar(): SideBar {
    return this._sideBar;
  }

  // Getter for topBar to access from main process
  get topBar(): TopBar {
    return this._topBar;
  }

  // Getter for all tabs as array
  get tabs(): Tab[] {
    return Array.from(this.tabsMap.values());
  }

  // Getter for baseWindow to access from Menu
  get baseWindow(): BaseWindow {
    return this._baseWindow;
  }
}
