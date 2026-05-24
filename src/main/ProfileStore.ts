import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  BLUEBERRY_START_URL,
  DEFAULT_BROWSER_SETTINGS,
  DEFAULT_PROFILE_DATA,
  type Bookmark,
  type BookmarkImportResult,
  type BookmarkSource,
  type BrowserSettings,
  type ProfileData,
} from "../shared/profile";

type ChromiumBrowser = {
  browser: "chrome" | "edge";
  browserName: string;
  userDataPath: string;
};

type ChromiumBookmarkNode = {
  type?: string;
  name?: string;
  url?: string;
  children?: ChromiumBookmarkNode[];
};

type ChromiumBookmarkFile = {
  roots?: Record<string, ChromiumBookmarkNode | undefined>;
};

const PROFILE_FILE_NAME = "blueberry-profile.json";

function cloneProfileData(data: ProfileData): ProfileData {
  return JSON.parse(JSON.stringify(data)) as ProfileData;
}

function normalizeUrl(url: string): string {
  return url.trim();
}

function safeReadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function countBookmarks(node?: ChromiumBookmarkNode): number {
  if (!node) return 0;
  if (node.type === "url" && node.url) return 1;
  return (node.children ?? []).reduce(
    (total, child) => total + countBookmarks(child),
    0,
  );
}

function getProfileDisplayName(profileDirectory: string): string {
  return profileDirectory === "Default" ? "Default profile" : profileDirectory;
}

export class ProfileStore {
  private readonly profilePath: string;
  private data: ProfileData;

  constructor() {
    this.profilePath = join(app.getPath("userData"), PROFILE_FILE_NAME);
    this.data = this.load();
  }

  get filePath(): string {
    return this.profilePath;
  }

  getData(): ProfileData {
    return cloneProfileData(this.data);
  }

  getSettings(): BrowserSettings {
    return { ...this.data.settings };
  }

  saveSettings(settings: Partial<BrowserSettings>): BrowserSettings {
    this.data.settings = {
      ...this.data.settings,
      ...settings,
    };

    this.save();
    return this.getSettings();
  }

  completeOnboarding(settings?: Partial<BrowserSettings>): ProfileData {
    if (settings) {
      this.data.settings = {
        ...this.data.settings,
        ...settings,
      };
    }

    this.data.onboarding.completed = true;
    this.save();
    return this.getData();
  }

  getBookmarks(): Bookmark[] {
    return [...this.data.bookmarks];
  }

  getNewTabUrl(): string {
    const settings = this.data.settings;
    if (settings.startBehavior === "homepage") {
      return this.normalizeNavigationUrl(
        settings.customHomepage || DEFAULT_BROWSER_SETTINGS.customHomepage,
      );
    }

    return BLUEBERRY_START_URL;
  }

  scanBookmarkSources(): BookmarkSource[] {
    const browsers = this.getChromiumBrowsers();
    const sources: BookmarkSource[] = [];

    for (const browser of browsers) {
      if (!existsSync(browser.userDataPath)) continue;

      const profiles = this.getChromiumProfileDirectories(browser.userDataPath);
      for (const profilePath of profiles) {
        const profileName = profilePath.split(/[\\/]/).pop() ?? "Default";
        const bookmarksPath = join(profilePath, "Bookmarks");
        const id = `${browser.browser}:${profileName}`;

        if (!existsSync(bookmarksPath)) {
          sources.push({
            id,
            browser: browser.browser,
            browserName: browser.browserName,
            profileName: getProfileDisplayName(profileName),
            profilePath,
            bookmarksPath,
            bookmarkCount: 0,
            error: "No bookmarks file found",
          });
          continue;
        }

        try {
          const bookmarksFile =
            safeReadJson<ChromiumBookmarkFile>(bookmarksPath);
          const bookmarkCount = Object.values(bookmarksFile.roots ?? {}).reduce(
            (total, root) => total + countBookmarks(root),
            0,
          );

          sources.push({
            id,
            browser: browser.browser,
            browserName: browser.browserName,
            profileName: getProfileDisplayName(profileName),
            profilePath,
            bookmarksPath,
            bookmarkCount,
          });
        } catch (error) {
          sources.push({
            id,
            browser: browser.browser,
            browserName: browser.browserName,
            profileName: getProfileDisplayName(profileName),
            profilePath,
            bookmarksPath,
            bookmarkCount: 0,
            error:
              error instanceof Error
                ? error.message
                : "Could not read bookmarks",
          });
        }
      }
    }

    return sources;
  }

  importBookmarks(sourceIds: string[]): BookmarkImportResult {
    const requestedSourceIds = new Set(sourceIds);
    const sources = this.scanBookmarkSources().filter((source) =>
      requestedSourceIds.has(source.id),
    );
    const existingUrls = new Set(
      this.data.bookmarks.map((bookmark) => normalizeUrl(bookmark.url)),
    );
    const importedAt = new Date().toISOString();
    const importedBookmarks: Bookmark[] = [];
    const errors: BookmarkImportResult["errors"] = [];
    let skippedCount = 0;

    for (const source of sources) {
      if (source.error) {
        errors.push({ sourceId: source.id, message: source.error });
        continue;
      }

      try {
        const bookmarksFile = safeReadJson<ChromiumBookmarkFile>(
          source.bookmarksPath,
        );
        const sourceBookmarks = this.extractBookmarks(
          bookmarksFile,
          source,
          importedAt,
        );

        for (const bookmark of sourceBookmarks) {
          const normalizedUrl = normalizeUrl(bookmark.url);
          if (existingUrls.has(normalizedUrl)) {
            skippedCount += 1;
            continue;
          }

          existingUrls.add(normalizedUrl);
          importedBookmarks.push(bookmark);
        }
      } catch (error) {
        errors.push({
          sourceId: source.id,
          message:
            error instanceof Error ? error.message : "Could not import source",
        });
      }
    }

    this.data.bookmarks = [...this.data.bookmarks, ...importedBookmarks];
    this.save();

    return {
      importedCount: importedBookmarks.length,
      skippedCount,
      errors,
      bookmarks: this.getBookmarks(),
    };
  }

  private load(): ProfileData {
    if (!existsSync(this.profilePath)) {
      return cloneProfileData(DEFAULT_PROFILE_DATA);
    }

    try {
      const loadedData = safeReadJson<Partial<ProfileData>>(this.profilePath);
      return {
        onboarding: {
          ...DEFAULT_PROFILE_DATA.onboarding,
          ...loadedData.onboarding,
        },
        settings: {
          ...DEFAULT_BROWSER_SETTINGS,
          ...loadedData.settings,
        },
        bookmarks: loadedData.bookmarks ?? [],
      };
    } catch (error) {
      console.error("Failed to load profile data:", error);
      return cloneProfileData(DEFAULT_PROFILE_DATA);
    }
  }

  private save(): void {
    mkdirSync(dirname(this.profilePath), { recursive: true });
    writeFileSync(this.profilePath, JSON.stringify(this.data, null, 2));
  }

  private getChromiumBrowsers(): ChromiumBrowser[] {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData || process.platform !== "win32") return [];

    return [
      {
        browser: "chrome",
        browserName: "Google Chrome",
        userDataPath: join(localAppData, "Google", "Chrome", "User Data"),
      },
      {
        browser: "edge",
        browserName: "Microsoft Edge",
        userDataPath: join(localAppData, "Microsoft", "Edge", "User Data"),
      },
    ];
  }

  private normalizeNavigationUrl(url: string): string {
    const trimmedUrl = url.trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl)) {
      return trimmedUrl;
    }

    return `https://${trimmedUrl}`;
  }

  private getChromiumProfileDirectories(userDataPath: string): string[] {
    const profileCandidates = [
      join(userDataPath, "Default"),
      ...Array.from({ length: 12 }, (_, index) =>
        join(userDataPath, `Profile ${index + 1}`),
      ),
    ];

    return profileCandidates.filter((profilePath) => existsSync(profilePath));
  }

  private extractBookmarks(
    bookmarksFile: ChromiumBookmarkFile,
    source: BookmarkSource,
    importedAt: string,
  ): Bookmark[] {
    const bookmarks: Bookmark[] = [];
    const roots = bookmarksFile.roots ?? {};

    for (const [rootName, root] of Object.entries(roots)) {
      this.walkBookmarkNode(root, [rootName], source, importedAt, bookmarks);
    }

    return bookmarks;
  }

  private walkBookmarkNode(
    node: ChromiumBookmarkNode | undefined,
    folderPath: string[],
    source: BookmarkSource,
    importedAt: string,
    bookmarks: Bookmark[],
  ): void {
    if (!node) return;

    if (node.type === "url" && node.url) {
      bookmarks.push({
        id: `${source.id}:${bookmarks.length}:${Buffer.from(node.url).toString("base64url")}`,
        title: node.name || node.url,
        url: node.url,
        sourceBrowser: source.browser,
        sourceProfile: source.profileName,
        folderPath: folderPath.filter(Boolean),
        importedAt,
      });
      return;
    }

    const nextFolderPath =
      node.name && node.name !== "root"
        ? [...folderPath, node.name]
        : folderPath;
    for (const child of node.children ?? []) {
      this.walkBookmarkNode(
        child,
        nextFolderPath,
        source,
        importedAt,
        bookmarks,
      );
    }
  }
}
