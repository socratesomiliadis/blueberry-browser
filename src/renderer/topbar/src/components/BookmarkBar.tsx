import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, MoreHorizontal } from "lucide-react";
import { motion } from "motion/react";
import type { Bookmark as BookmarkItem } from "../../../../shared/profile";
import { useBrowser } from "../contexts/BrowserContext";
import { cn } from "@common/lib/utils";

function getBookmarkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const BookmarkBar: React.FC = () => {
  const { navigateToUrl, createTab } = useBrowser();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  useEffect(() => {
    window.topBarAPI
      .getBookmarks()
      .then(setBookmarks)
      .catch((error) => console.error("Failed to load bookmarks:", error));

    window.topBarAPI.onBookmarksUpdated(setBookmarks);
    return () => window.topBarAPI.removeBookmarksUpdatedListener();
  }, []);

  const visibleBookmarks = useMemo(() => bookmarks.slice(0, 18), [bookmarks]);
  const hiddenCount = Math.max(0, bookmarks.length - visibleBookmarks.length);

  const openBookmark = useCallback(
    (url: string, openInNewTab: boolean): void => {
      if (openInNewTab) {
        createTab(url);
        return;
      }

      navigateToUrl(url);
    },
    [createTab, navigateToUrl],
  );

  return (
    <div className="h-8 border-t border-border/60 bg-background/95 px-2 app-region-drag">
      <div className="flex h-full items-center gap-1 overflow-x-auto overflow-y-hidden app-region-no-drag">
        {visibleBookmarks.length === 0 ? (
          <div className="flex items-center gap-2 text-[0.72rem] text-muted-foreground px-2">
            <Bookmark className="size-3.5" />
            <span>Imported bookmarks will appear here</span>
          </div>
        ) : (
          visibleBookmarks.map((bookmark) => (
            <motion.button
              key={bookmark.id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              title={`${bookmark.title}\n${bookmark.url}`}
              onClick={() => openBookmark(bookmark.url, false)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  openBookmark(bookmark.url, true);
                }
              }}
              className={cn(
                "flex h-6 max-w-40 shrink-0 items-center gap-1.5 rounded-md px-2 text-[0.72rem]",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand))]/30",
              )}
            >
              <Bookmark className="size-3.5 text-[rgb(var(--brand))]" />
              <span className="truncate">{bookmark.title}</span>
              <span className="hidden text-muted-foreground/60 lg:inline">
                {getBookmarkHost(bookmark.url)}
              </span>
            </motion.button>
          ))
        )}

        {hiddenCount > 0 && (
          <div className="ml-auto flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[0.72rem] text-muted-foreground">
            <MoreHorizontal className="size-3.5" />
            {hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
};
