import { BaseWindow, shell } from "electron";
import { Tab } from "./Tab";
import { TopBar } from "./TopBar";
import { SideBar } from "./SideBar";
import { Onboarding } from "./Onboarding";
import { ProfileStore } from "./ProfileStore";
import {
  getSlidingSidebarBoundsForVisibleWidth,
  getTabBoundsForSidebarWidth,
  SIDEBAR_WIDTH,
} from "./Layout";
import type { Bookmark } from "../shared/profile";

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
  private _onboarding: Onboarding;
  private _profileStore: ProfileStore;
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

    this._profileStore = new ProfileStore();
    this.sidebarTargetVisible =
      this._profileStore.getSettings().sidebarDefaultOpen;
    this.currentSidebarWidth = this.sidebarTargetVisible ? SIDEBAR_WIDTH : 0;

    this._topBar = new TopBar(this._baseWindow);
    this._sideBar = new SideBar(this._baseWindow);
    this._onboarding = new Onboarding(this._baseWindow);

    // Set the window reference on the LLM client to avoid circular dependency
    this._sideBar.client.setWindow(this);
    this.applySidebarLayout(this.currentSidebarWidth);

    // Create the first tab
    this.createTab();

    // Set up window resize handler
    this._baseWindow.on("resize", () => {
      this.updateAllBounds();
      this._topBar.updateBounds();
      this._onboarding.updateBounds();
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
    const tab = new Tab(tabId, url ?? this._profileStore.getNewTabUrl(), () =>
      this.getStartPageHtml(),
    );
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

  showOnboardingIfNeeded(): void {
    if (!this._profileStore.getData().onboarding.completed) {
      this._onboarding.show();
    }
  }

  hideOnboarding(): void {
    this._onboarding.hide();
  }

  applySettings(): void {
    const settings = this._profileStore.getSettings();
    this.setSidebarVisible(settings.sidebarDefaultOpen);
  }

  // Public method to update all bounds when sidebar is toggled
  updateAllBounds(): void {
    this.applySidebarLayout(this.currentSidebarWidth);
  }

  // Getter for sidebar to access from main process
  get sidebar(): SideBar {
    return this._sideBar;
  }

  get onboarding(): Onboarding {
    return this._onboarding;
  }

  get profileStore(): ProfileStore {
    return this._profileStore;
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

  private getStartPageHtml(): string {
    const settings = this._profileStore.getSettings();
    const bookmarks = this._profileStore.getBookmarks().slice(0, 48);
    const densityPadding =
      settings.density === "compact"
        ? "18px"
        : settings.density === "comfortable"
          ? "34px"
          : "26px";
    const accent = this.getAccentColor(settings.accent);
    const bookmarkCards = bookmarks
      .map((bookmark) => this.renderStartBookmark(bookmark))
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Blueberry Start</title>
    <style>
      :root {
        color-scheme: ${settings.theme === "dark" ? "dark" : "light"};
        --brand: ${accent};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: ${settings.theme === "dark" ? "#f8fafc" : "#141414"};
        background:
          radial-gradient(circle at top left, color-mix(in srgb, var(--brand) 22%, transparent), transparent 34rem),
          linear-gradient(135deg, ${settings.theme === "dark" ? "#141414" : "#ffffff"} 0%, ${settings.theme === "dark" ? "#202020" : "#f6f8fb"} 100%);
      }
      main {
        width: min(960px, calc(100vw - 48px));
        margin: 0 auto;
        padding: ${densityPadding} 0 48px;
      }
      .hero {
        padding: 42px 0 28px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(2.3rem, 5vw, 5rem);
        letter-spacing: 0;
        line-height: .95;
      }
      p {
        margin: 0;
        color: ${settings.theme === "dark" ? "#b7bcc5" : "#5f6673"};
        font-size: 1rem;
      }
      form {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 28px;
        max-width: 680px;
      }
      input {
        flex: 1;
        height: 48px;
        border: 1px solid ${settings.theme === "dark" ? "#34383f" : "#dfe3ea"};
        border-radius: 8px;
        padding: 0 16px;
        font-size: 1rem;
        color: inherit;
        background: ${settings.theme === "dark" ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.86)"};
        outline: none;
      }
      input:focus {
        border-color: var(--brand);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
      }
      button {
        height: 48px;
        border: 0;
        border-radius: 8px;
        padding: 0 18px;
        color: white;
        background: var(--brand);
        font-weight: 650;
        cursor: pointer;
      }
      .section-title {
        margin: 18px 0 14px;
        font-size: .76rem;
        font-weight: 750;
        letter-spacing: .08em;
        text-transform: uppercase;
        color: ${settings.theme === "dark" ? "#8f96a3" : "#697181"};
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 10px;
      }
      a.bookmark {
        display: block;
        min-height: 84px;
        border: 1px solid ${settings.theme === "dark" ? "rgba(255,255,255,.09)" : "rgba(20,20,20,.08)"};
        border-radius: 8px;
        padding: 13px;
        color: inherit;
        text-decoration: none;
        background: ${settings.theme === "dark" ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.72)"};
      }
      a.bookmark:hover {
        border-color: color-mix(in srgb, var(--brand) 45%, transparent);
        transform: translateY(-1px);
      }
      .bookmark strong, .bookmark span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bookmark strong { font-size: .92rem; }
      .bookmark span {
        margin-top: 8px;
        color: ${settings.theme === "dark" ? "#9ca3af" : "#697181"};
        font-size: .77rem;
      }
      .empty {
        border: 1px dashed ${settings.theme === "dark" ? "#3f454f" : "#cfd5df"};
        border-radius: 8px;
        padding: 22px;
        color: ${settings.theme === "dark" ? "#9ca3af" : "#697181"};
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Blueberry</h1>
        <p>Your imported bookmarks and favorite places are ready when you are.</p>
        <form id="search">
          <input id="query" aria-label="Search or enter address" placeholder="Search or enter address" autofocus />
          <button type="submit">Go</button>
        </form>
      </section>
      <section>
        <div class="section-title">Bookmarks</div>
        ${
          bookmarkCards
            ? `<div class="grid">${bookmarkCards}</div>`
            : `<div class="empty">Import bookmarks during onboarding to fill this space.</div>`
        }
      </section>
    </main>
    <script>
      document.getElementById("search").addEventListener("submit", function (event) {
        event.preventDefault();
        var value = document.getElementById("query").value.trim();
        if (!value) return;
        var target = value;
        if (!/^https?:\\/\\//i.test(target)) {
          target = target.indexOf(".") > -1 && target.indexOf(" ") === -1
            ? "https://" + target
            : "https://www.google.com/search?q=" + encodeURIComponent(target);
        }
        window.location.href = target;
      });
    </script>
  </body>
</html>`;
  }

  private renderStartBookmark(bookmark: Bookmark): string {
    const host = this.getBookmarkHost(bookmark.url);
    return `<a class="bookmark" href="${this.escapeAttribute(bookmark.url)}">
      <strong>${this.escapeHtml(bookmark.title)}</strong>
      <span>${this.escapeHtml(host)}</span>
    </a>`;
  }

  private getBookmarkHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  private getAccentColor(accent: string): string {
    switch (accent) {
      case "grape":
        return "#8b5cf6";
      case "mint":
        return "#0f9f7f";
      case "sunset":
        return "#f97316";
      case "blueberry":
      default:
        return "#4f46e5";
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }
}
