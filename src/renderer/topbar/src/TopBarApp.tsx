import React from "react";
import { BrowserProvider } from "./contexts/BrowserContext";
import { TabBar } from "./components/TabBar";
import { AddressBar } from "./components/AddressBar";
import { WindowControls } from "./components/WindowControls";
import { BookmarkBar } from "./components/BookmarkBar";
import { useBrowserSettings } from "@common/hooks/useBrowserSettings";

const TopBarContent: React.FC = () => {
  useBrowserSettings();

  return (
    <div className="flex h-full flex-col bg-background select-none">
      {/* Tab Bar */}
      <div className="w-full h-10 flex items-center app-region-drag bg-muted dark:bg-muted">
        <TabBar />
        <WindowControls />
      </div>

      {/* Toolbar */}
      <div className="flex h-12 items-center px-2 py-1 gap-2 app-region-drag bg-background shadow-subtle z-10 dark:shadow-[0_0_6px_rgba(0,0,0,0.2)]">
        <AddressBar />
      </div>

      <BookmarkBar />
    </div>
  );
};

export const TopBarApp: React.FC = () => {
  return (
    <BrowserProvider>
      <TopBarContent />
    </BrowserProvider>
  );
};
