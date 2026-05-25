import React, { useEffect, useState } from "react";
import { ChatProvider } from "./contexts/ChatContext";
import { PilotProvider } from "./contexts/PilotContext";
import { Chat } from "./components/Chat";
import {
  AutomatePanel,
  PilotPanel,
  TracePanel,
} from "./components/PilotWorkspace";
import { useDarkMode } from "@common/hooks/useDarkMode";
import { Bot, Code2, MessageSquare, Route } from "lucide-react";
import { cn } from "@common/lib/utils";

type SidebarMode = "ask" | "pilot" | "trace" | "automate";

const modes: Array<{
  id: SidebarMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "ask", label: "Ask", icon: <MessageSquare className="size-4" /> },
  { id: "pilot", label: "Pilot", icon: <Bot className="size-4" /> },
  { id: "trace", label: "Trace", icon: <Route className="size-4" /> },
  { id: "automate", label: "Automate", icon: <Code2 className="size-4" /> },
];

const SidebarContent: React.FC = () => {
  const { isDarkMode } = useDarkMode();
  const [mode, setMode] = useState<SidebarMode>("pilot");

  // Apply dark mode class to the document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  return (
    <div className="h-screen w-full flex flex-col bg-background border-l border-border">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
        {modes.map((item) => (
          <button
            key={item.id}
            onClick={() => setMode(item.id)}
            className={cn(
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs transition-colors",
              mode === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {mode === "ask" && <Chat isDarkMode={isDarkMode} />}
        {mode === "pilot" && <PilotPanel />}
        {mode === "trace" && <TracePanel />}
        {mode === "automate" && <AutomatePanel />}
      </div>
    </div>
  );
};

export const SidebarApp: React.FC = () => {
  return (
    <ChatProvider>
      <PilotProvider>
        <SidebarContent />
      </PilotProvider>
    </ChatProvider>
  );
};
