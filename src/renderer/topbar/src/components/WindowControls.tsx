import React, { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { cn } from "@common/lib/utils";

interface WindowControlButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}

const WindowControlButton: React.FC<WindowControlButtonProps> = ({
  label,
  onClick,
  className,
  children,
}) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "app-region-no-drag h-10 w-11 inline-flex items-center justify-center",
        "text-primary outline-none transition-colors duration-150",
        "hover:bg-primary/10 active:bg-primary/15",
        "focus-visible:bg-primary/10",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.topBarAPI.platform === "darwin") return;

    window.topBarAPI
      .getWindowState()
      .then((state) => setIsMaximized(state.isMaximized));
    window.topBarAPI.onWindowStateChanged((state) =>
      setIsMaximized(state.isMaximized),
    );

    return () => {
      window.topBarAPI.removeWindowStateChangedListener();
    };
  }, []);

  if (window.topBarAPI.platform === "darwin") {
    return null;
  }

  return (
    <div className="ml-auto flex h-10 shrink-0 items-center">
      <WindowControlButton
        label="Minimize"
        onClick={() => window.topBarAPI.minimizeWindow()}
      >
        <Minus className="size-4" strokeWidth={1.8} />
      </WindowControlButton>

      <WindowControlButton
        label={isMaximized ? "Restore" : "Maximize"}
        onClick={() =>
          window.topBarAPI
            .toggleMaximizeWindow()
            .then((state) => setIsMaximized(state.isMaximized))
        }
      >
        {isMaximized ? (
          <Copy className="size-3.5" strokeWidth={1.8} />
        ) : (
          <Square className="size-3.5" strokeWidth={1.8} />
        )}
      </WindowControlButton>

      <WindowControlButton
        label="Close"
        className="hover:bg-destructive hover:text-destructive-foreground active:bg-destructive/90 focus-visible:bg-destructive focus-visible:text-destructive-foreground"
        onClick={() => window.topBarAPI.closeWindow()}
      >
        <X className="size-4" strokeWidth={1.8} />
      </WindowControlButton>
    </div>
  );
};
