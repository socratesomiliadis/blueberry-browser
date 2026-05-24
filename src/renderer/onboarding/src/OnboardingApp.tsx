import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Chrome,
  Gauge,
  Home,
  Import,
  Minus,
  Monitor,
  Moon,
  Palette,
  PanelRight,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@common/components/Button";
import { applyAppearance } from "@common/lib/appearance";
import {
  DEFAULT_BROWSER_SETTINGS,
  type AccentColor,
  type BookmarkImportResult,
  type BookmarkSource,
  type BrowserSettings,
  type Density,
  type ThemeMode,
} from "../../../shared/profile";
import { cn } from "@common/lib/utils";

const STEPS = ["Welcome", "Import", "Customize", "Finish"];

const ACCENT_OPTIONS: Array<{
  value: AccentColor;
  label: string;
  className: string;
}> = [
  { value: "blueberry", label: "Blueberry", className: "bg-indigo-600" },
  { value: "grape", label: "Grape", className: "bg-violet-500" },
  { value: "mint", label: "Mint", className: "bg-emerald-600" },
  { value: "sunset", label: "Sunset", className: "bg-orange-500" },
];

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
  { value: "comfortable", label: "Roomy" },
];

function getSourceIcon(source: BookmarkSource): React.ReactNode {
  return source.browser === "chrome" ? (
    <Chrome className="size-4 text-[rgb(var(--brand))]" />
  ) : (
    <div className="size-4 rounded-full bg-[rgb(var(--brand))]" />
  );
}

export const OnboardingApp: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<BrowserSettings>(
    DEFAULT_BROWSER_SETTINGS,
  );
  const [sources, setSources] = useState<BookmarkSource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const [isScanning, setIsScanning] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<BookmarkImportResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const importableSources = useMemo(
    () => sources.filter((source) => !source.error && source.bookmarkCount > 0),
    [sources],
  );
  const selectedCount = selectedSources.size;

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    applyAppearance(settings);
  }, [settings]);

  const initialize = async (): Promise<void> => {
    setIsScanning(true);
    try {
      const [loadedSettings, loadedSources] = await Promise.all([
        window.onboardingAPI.getSettings(),
        window.onboardingAPI.scanBookmarkSources(),
      ]);
      setSettings({ ...DEFAULT_BROWSER_SETTINGS, ...loadedSettings });
      setSources(loadedSources);
      setSelectedSources(
        new Set(
          loadedSources
            .filter((source) => !source.error && source.bookmarkCount > 0)
            .map((source) => source.id),
        ),
      );
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Could not prepare onboarding",
      );
    } finally {
      setIsScanning(false);
    }
  };

  const updateSettings = (settingsPatch: Partial<BrowserSettings>): void => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...settingsPatch,
    }));
  };

  const importSelectedBookmarks = async (): Promise<void> => {
    if (selectedSources.size === 0) {
      setStep(2);
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const result = await window.onboardingAPI.importBookmarks([
        ...selectedSources,
      ]);
      setImportResult(result);
      setStep(2);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import bookmarks",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const complete = async (): Promise<void> => {
    await window.onboardingAPI.completeOnboarding(settings);
  };

  const skip = async (): Promise<void> => {
    await window.onboardingAPI.completeOnboarding(DEFAULT_BROWSER_SETTINGS);
  };

  const variants = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, x: 36, scale: 0.98 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: reduceMotion ? { opacity: 0 } : { opacity: 0, x: -36, scale: 0.98 },
  };

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(var(--brand)/0.18),transparent_32rem)]" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-12 items-center justify-between px-4 app-region-drag">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <div className="grid size-7 place-items-center rounded-md bg-[rgb(var(--brand))] text-white">
              <Sparkles className="size-4" />
            </div>
            Blueberry setup
          </div>

          <div className="flex items-center gap-1 app-region-no-drag">
            <button
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => window.onboardingAPI.minimizeWindow()}
              type="button"
              aria-label="Minimize"
            >
              <Minus className="size-4" />
            </button>
            <button
              className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => window.onboardingAPI.closeWindow()}
              type="button"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[260px_minmax(0,1fr)] gap-8 px-8 pb-8">
          <aside className="flex flex-col justify-center">
            <div className="space-y-3">
              {STEPS.map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    index === step
                      ? "bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand))] dark:bg-white/10 dark:text-white"
                      : "text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs font-semibold",
                      index <= step
                        ? "bg-[rgb(var(--brand))] text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {index < step ? <Check className="size-3.5" /> : index + 1}
                  </div>
                  {label}
                </div>
              ))}
            </div>
          </aside>

          <section className="flex min-w-0 items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{
                  duration: reduceMotion ? 0.1 : 0.32,
                  ease: "easeOut",
                }}
                className="w-full max-w-3xl"
              >
                {step === 0 && (
                  <WelcomeStep onNext={() => setStep(1)} onSkip={skip} />
                )}
                {step === 1 && (
                  <ImportStep
                    error={error}
                    importableSources={importableSources}
                    isImporting={isImporting}
                    isScanning={isScanning}
                    onBack={() => setStep(0)}
                    onImport={importSelectedBookmarks}
                    onRescan={initialize}
                    selectedCount={selectedCount}
                    selectedSources={selectedSources}
                    setSelectedSources={setSelectedSources}
                    sources={sources}
                  />
                )}
                {step === 2 && (
                  <CustomizeStep
                    importResult={importResult}
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                    settings={settings}
                    updateSettings={updateSettings}
                  />
                )}
                {step === 3 && (
                  <FinishStep
                    importResult={importResult}
                    onBack={() => setStep(2)}
                    onComplete={complete}
                    settings={settings}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </section>
        </main>
      </div>
    </div>
  );
};

function WelcomeStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}): React.ReactElement {
  return (
    <div>
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-[rgb(var(--brand))]" />
        Make Blueberry yours
      </div>
      <h1 className="max-w-2xl text-6xl font-semibold leading-none tracking-normal">
        A fresher browser, set up in under a minute.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
        Bring over bookmarks from Chrome or Edge, choose the feel of your
        workspace, and land on a start page that already knows your favorite
        places.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <Button onClick={onNext} size="lg" className="bg-[rgb(var(--brand))]">
          Start setup
          <ChevronRight className="size-4" />
        </Button>
        <Button onClick={onSkip} variant="ghost" size="lg">
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function ImportStep({
  error,
  importableSources,
  isImporting,
  isScanning,
  onBack,
  onImport,
  onRescan,
  selectedCount,
  selectedSources,
  setSelectedSources,
  sources,
}: {
  error: string | null;
  importableSources: BookmarkSource[];
  isImporting: boolean;
  isScanning: boolean;
  onBack: () => void;
  onImport: () => void;
  onRescan: () => void;
  selectedCount: number;
  selectedSources: Set<string>;
  setSelectedSources: React.Dispatch<React.SetStateAction<Set<string>>>;
  sources: BookmarkSource[];
}): React.ReactElement {
  return (
    <div>
      <Import className="mb-4 size-10 text-[rgb(var(--brand))]" />
      <h2 className="text-4xl font-semibold tracking-normal">
        Bring your bookmarks along.
      </h2>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Blueberry can read local Chrome and Edge bookmark files. Locked or empty
        profiles are skipped without blocking setup.
      </p>

      <div className="mt-6 max-h-72 overflow-y-auto rounded-lg border border-border bg-background/70 p-2">
        {isScanning ? (
          <div className="p-5 text-sm text-muted-foreground">
            Looking for browser profiles...
          </div>
        ) : sources.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">
            No Chrome or Edge bookmark profiles were found on this Windows user.
          </div>
        ) : (
          sources.map((source) => {
            const checked = selectedSources.has(source.id);
            return (
              <label
                key={source.id}
                className={cn(
                  "mb-2 flex cursor-pointer items-center gap-3 rounded-md border p-3 last:mb-0",
                  checked
                    ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] dark:bg-white/10"
                    : "border-border bg-background",
                  source.error && "cursor-default opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  disabled={Boolean(source.error) || source.bookmarkCount === 0}
                  checked={checked}
                  onChange={(event) => {
                    setSelectedSources((current) => {
                      const next = new Set(current);
                      if (event.target.checked) {
                        next.add(source.id);
                      } else {
                        next.delete(source.id);
                      }
                      return next;
                    });
                  }}
                  className="size-4 accent-[rgb(var(--brand))]"
                />
                {getSourceIcon(source)}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {source.browserName} · {source.profileName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {source.error ??
                      `${source.bookmarkCount.toLocaleString()} bookmarks`}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>

      {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

      <div className="mt-6 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={onRescan} variant="outline" disabled={isScanning}>
            Rescan
          </Button>
          <Button
            onClick={onImport}
            disabled={isImporting || isScanning}
            className="bg-[rgb(var(--brand))]"
          >
            {selectedCount > 0
              ? `Import ${selectedCount} source${selectedCount === 1 ? "" : "s"}`
              : "Continue"}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {importableSources.length > 0 && (
        <div className="mt-3 text-right text-xs text-muted-foreground">
          {importableSources.length} importable profiles found
        </div>
      )}
    </div>
  );
}

function CustomizeStep({
  importResult,
  onBack,
  onNext,
  settings,
  updateSettings,
}: {
  importResult: BookmarkImportResult | null;
  onBack: () => void;
  onNext: () => void;
  settings: BrowserSettings;
  updateSettings: (settings: Partial<BrowserSettings>) => void;
}): React.ReactElement {
  return (
    <div>
      <Palette className="mb-4 size-10 text-[rgb(var(--brand))]" />
      <h2 className="text-4xl font-semibold tracking-normal">
        Tune the cockpit.
      </h2>
      <p className="mt-3 text-muted-foreground">
        Pick the shape and rhythm Blueberry opens with.
      </p>

      {importResult && (
        <div className="mt-5 rounded-md border border-border bg-background/70 px-4 py-3 text-sm">
          Imported {importResult.importedCount.toLocaleString()} bookmarks
          {importResult.skippedCount > 0 &&
            ` and skipped ${importResult.skippedCount.toLocaleString()} duplicates`}
          .
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <OptionGroup title="Theme" Icon={Monitor}>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateSettings({ theme: value })}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-2 rounded-md border text-sm",
                  settings.theme === value
                    ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand))] dark:bg-white/10 dark:text-white"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <Icon className="size-5" />
                {label}
              </button>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup title="Accent" Icon={Palette}>
          <div className="grid grid-cols-4 gap-2">
            {ACCENT_OPTIONS.map((accent) => (
              <button
                key={accent.value}
                type="button"
                onClick={() => updateSettings({ accent: accent.value })}
                className={cn(
                  "flex h-16 items-center justify-center gap-2 rounded-md border text-sm",
                  settings.accent === accent.value
                    ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] dark:bg-white/10"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                <span className={cn("size-4 rounded-full", accent.className)} />
                {accent.label}
              </button>
            ))}
          </div>
        </OptionGroup>

        <div className="grid grid-cols-2 gap-4">
          <OptionGroup title="Density" Icon={Gauge}>
            <div className="flex gap-2">
              {DENSITY_OPTIONS.map((density) => (
                <button
                  key={density.value}
                  type="button"
                  onClick={() => updateSettings({ density: density.value })}
                  className={cn(
                    "h-10 flex-1 rounded-md border text-sm",
                    settings.density === density.value
                      ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand))] dark:bg-white/10 dark:text-white"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {density.label}
                </button>
              ))}
            </div>
          </OptionGroup>

          <OptionGroup title="Assistant" Icon={PanelRight}>
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  sidebarDefaultOpen: !settings.sidebarDefaultOpen,
                })
              }
              className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
            >
              Sidebar opens by default
              <span
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  settings.sidebarDefaultOpen
                    ? "bg-[rgb(var(--brand))]"
                    : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                    settings.sidebarDefaultOpen
                      ? "translate-x-4"
                      : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          </OptionGroup>
        </div>

        <OptionGroup title="New tabs" Icon={Home}>
          <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={() => updateSettings({ startBehavior: "startPage" })}
              className={cn(
                "h-10 rounded-md border text-sm",
                settings.startBehavior === "startPage"
                  ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand))] dark:bg-white/10 dark:text-white"
                  : "border-border bg-background hover:bg-muted",
              )}
            >
              Start page
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ startBehavior: "homepage" })}
                className={cn(
                  "h-10 rounded-md border px-3 text-sm",
                  settings.startBehavior === "homepage"
                    ? "border-[rgb(var(--brand))] bg-[rgb(var(--brand-soft))] text-[rgb(var(--brand))] dark:bg-white/10 dark:text-white"
                    : "border-border bg-background hover:bg-muted",
                )}
              >
                Homepage
              </button>
              <input
                value={settings.customHomepage}
                onChange={(event) =>
                  updateSettings({ customHomepage: event.target.value })
                }
                className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-[rgb(var(--brand))]"
                placeholder="https://www.google.com"
              />
            </div>
          </div>
        </OptionGroup>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button onClick={onNext} className="bg-[rgb(var(--brand))]">
          Continue
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function OptionGroup({
  children,
  Icon,
  title,
}: {
  children: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-background/75 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-[rgb(var(--brand))]" />
        {title}
      </div>
      {children}
    </div>
  );
}

function FinishStep({
  importResult,
  onBack,
  onComplete,
  settings,
}: {
  importResult: BookmarkImportResult | null;
  onBack: () => void;
  onComplete: () => void;
  settings: BrowserSettings;
}): React.ReactElement {
  return (
    <div>
      <div className="grid size-14 place-items-center rounded-xl bg-[rgb(var(--brand))] text-white">
        <Check className="size-7" />
      </div>
      <h2 className="mt-5 text-4xl font-semibold tracking-normal">
        You are ready to browse.
      </h2>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Blueberry will open with your selected look, sidebar behavior, and new
        tab destination.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <SummaryCard
          Icon={Import}
          label="Bookmarks"
          value={`${importResult?.importedCount ?? 0} imported`}
        />
        <SummaryCard Icon={Palette} label="Accent" value={settings.accent} />
        <SummaryCard
          Icon={Search}
          label="New tabs"
          value={
            settings.startBehavior === "startPage" ? "Start page" : "Homepage"
          }
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button onClick={onBack} variant="ghost">
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button
          onClick={onComplete}
          size="lg"
          className="bg-[rgb(var(--brand))]"
        >
          Open Blueberry
          <Check className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({
  Icon,
  label,
  value,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-background/75 p-4">
      <Icon className="mb-3 size-5 text-[rgb(var(--brand))]" />
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold capitalize">
        {value}
      </div>
    </div>
  );
}
