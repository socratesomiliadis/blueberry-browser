import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Code2,
  Download,
  FileJson,
  MousePointer2,
  Pause,
  Play,
  Square,
  Table2,
  X,
} from "lucide-react";
import { Button } from "@common/components/Button";
import { cn } from "@common/lib/utils";
import { usePilot } from "../contexts/PilotContext";
import type {
  GeneratedArtifact,
  GeneratedArtifactKind,
  TraceEvent,
} from "../../../../shared/agent";

const statusLabel = {
  idle: "Idle",
  running: "Running",
  paused: "Paused",
  awaitingApproval: "Needs approval",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

const artifactIcon: Record<GeneratedArtifactKind, React.ReactNode> = {
  "trace-json": <FileJson className="size-4" />,
  "blueberry-recipe": <FileJson className="size-4" />,
  playwright: <Code2 className="size-4" />,
  html: <Code2 className="size-4" />,
};

export const PilotPanel: React.FC = () => {
  const {
    run,
    approval,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    approveAction,
    rejectAction,
  } = usePilot();
  const [goal, setGoal] = useState("");

  const isBusy =
    run?.status === "running" ||
    run?.status === "paused" ||
    run?.status === "awaitingApproval";

  const handleStart = (): void => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    void startRun(trimmed);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-brand-soft text-brand dark:bg-muted">
            <Bot className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Blueberry Pilot</div>
            <div className="truncate text-xs text-muted-foreground">
              {run?.currentStatus || "Give Pilot a goal for this tab"}
            </div>
          </div>
          <StatusPill status={run?.status || "idle"} />
        </div>

        <div className="mt-3 flex gap-2">
          <textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Find useful information on this page, operate the browser, and extract what matters..."
            className="min-h-20 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
          />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Button onClick={handleStart} disabled={!goal.trim()} size="sm">
            <Play className="size-4" />
            Run
          </Button>
          {run?.status === "running" && (
            <Button onClick={() => void pauseRun()} variant="outline" size="sm">
              <Pause className="size-4" />
              Pause
            </Button>
          )}
          {run?.status === "paused" && (
            <Button
              onClick={() => void resumeRun()}
              variant="outline"
              size="sm"
            >
              <Play className="size-4" />
              Resume
            </Button>
          )}
          {isBusy && (
            <Button onClick={() => void stopRun()} variant="ghost" size="sm">
              <Square className="size-4" />
              Stop
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {approval && (
          <div className="mb-3 rounded-md border border-destructive/35 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 text-destructive" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Approval required</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {approval.reason}
                </p>
                <div className="mt-2 rounded-md bg-background p-2 text-xs">
                  {approval.action.label}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => void approveAction()} size="sm">
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => void rejectAction()}
                    variant="outline"
                    size="sm"
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <PlanCard />
        <ExtractedDataCard />
        <Timeline limit={8} />
      </div>
    </div>
  );
};

export const TracePanel: React.FC = () => {
  const { run } = usePilot();
  const actionEvents = useMemo(
    () =>
      run?.events.filter((event) =>
        [
          "observation",
          "action-proposed",
          "action-result",
          "run-error",
        ].includes(event.type),
      ) ?? [],
    [run?.events],
  );

  return (
    <div className="h-full overflow-y-auto bg-background p-3">
      <SectionTitle icon={<MousePointer2 className="size-4" />} title="Trace" />
      {actionEvents.length === 0 ? (
        <EmptyState text="Pilot actions will appear here as a replayable trace." />
      ) : (
        <div className="space-y-2">
          {actionEvents.map((event) => (
            <TraceEventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
};

export const AutomatePanel: React.FC = () => {
  const { run, latestArtifact, exportResult, exportArtifact } = usePilot();
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const selectedArtifact =
    run?.artifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    latestArtifact ??
    run?.artifacts[0] ??
    null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border p-3">
        <SectionTitle icon={<Code2 className="size-4" />} title="Automate" />
        <div className="mt-2 flex flex-wrap gap-2">
          {run?.artifacts.map((artifact) => (
            <Button
              key={artifact.id}
              onClick={() => setSelectedArtifactId(artifact.id)}
              variant={
                artifact.id === selectedArtifact?.id ? "default" : "outline"
              }
              size="sm"
            >
              {artifactIcon[artifact.kind]}
              {artifact.title}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!selectedArtifact ? (
          <EmptyState text="Generated recipes, Playwright code, and optional HTML artifacts will appear after a run completes." />
        ) : (
          <ArtifactPreview
            artifact={selectedArtifact}
            onExport={() =>
              void exportArtifact({ artifactId: selectedArtifact.id })
            }
          />
        )}
        {exportResult && (
          <div
            className={cn(
              "mt-3 rounded-md border p-2 text-xs",
              exportResult.ok
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-muted/40",
            )}
          >
            {exportResult.message}
          </div>
        )}
      </div>
    </div>
  );
};

const PlanCard: React.FC = () => {
  const { run } = usePilot();
  if (!run) return <EmptyState text="No Pilot run yet." />;

  return (
    <div className="mb-3 rounded-md border border-border p-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        Current Plan
      </div>
      <ol className="mt-2 space-y-1 text-sm">
        {(run.plan.length
          ? run.plan
          : ["Waiting for the first observation"]
        ).map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span className="text-muted-foreground">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      {run.milestones.length > 0 && (
        <div className="mt-3 grid gap-1">
          {run.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs"
            >
              <span className="truncate">{milestone.label}</span>
              <span className="text-muted-foreground">{milestone.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ExtractedDataCard: React.FC = () => {
  const { run } = usePilot();
  const dataset = run?.extractedData.at(-1);
  if (!dataset) return null;

  return (
    <div className="mb-3 rounded-md border border-border p-3">
      <SectionTitle
        icon={<Table2 className="size-4" />}
        title={dataset.label}
      />
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[340px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              {dataset.columns.slice(0, 5).map((column) => (
                <th key={column} className="border-b border-border px-2 py-1">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.slice(0, 8).map((row, index) => (
              <tr key={`${dataset.id}-${index}`}>
                {dataset.columns.slice(0, 5).map((column) => (
                  <td
                    key={column}
                    className="max-w-40 truncate border-b border-border/60 px-2 py-1"
                  >
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Timeline: React.FC<{ limit?: number }> = ({ limit }) => {
  const { run } = usePilot();
  const events = limit ? run?.events.slice(-limit) : run?.events;

  if (!events?.length) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        Live Timeline
      </div>
      {events.map((event) => (
        <TraceEventRow key={event.id} event={event} compact />
      ))}
    </div>
  );
};

const TraceEventRow: React.FC<{ event: TraceEvent; compact?: boolean }> = ({
  event,
  compact,
}) => (
  <div className="rounded-md border border-border p-2">
    <div className="flex items-start gap-2">
      {event.screenshot && !compact && (
        <img
          src={event.screenshot}
          alt=""
          className="h-16 w-24 rounded-md border border-border object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium">{event.title}</div>
          <div className="shrink-0 text-[10px] text-muted-foreground">
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
          {event.detail}
        </p>
        {event.action && (
          <div className="mt-2 rounded-md bg-muted/50 px-2 py-1 text-xs">
            {event.action.kind} · {event.action.safetyLevel}
          </div>
        )}
        {event.actionResult && (
          <div
            className={cn(
              "mt-2 rounded-md px-2 py-1 text-xs",
              event.actionResult.ok
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {event.actionResult.message}
          </div>
        )}
      </div>
    </div>
  </div>
);

const ArtifactPreview: React.FC<{
  artifact: GeneratedArtifact;
  onExport: () => void;
}> = ({ artifact, onExport }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-sm font-semibold">{artifact.title}</div>
        <div className="text-xs text-muted-foreground">{artifact.filename}</div>
      </div>
      <Button onClick={onExport} size="sm">
        <Download className="size-4" />
        Export
      </Button>
    </div>
    {artifact.kind === "html" ? (
      <iframe
        title="Generated artifact"
        srcDoc={artifact.content}
        sandbox=""
        className="h-[520px] w-full rounded-md border border-border bg-white"
      />
    ) : (
      <pre className="max-h-[560px] overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">
        <code>{artifact.content}</code>
      </pre>
    )}
  </div>
);

const StatusPill: React.FC<{ status: keyof typeof statusLabel }> = ({
  status,
}) => (
  <span
    className={cn(
      "rounded-full px-2 py-1 text-[10px] font-semibold uppercase",
      status === "running" && "bg-emerald-500/10 text-emerald-700",
      status === "awaitingApproval" && "bg-amber-500/10 text-amber-700",
      status === "failed" && "bg-destructive/10 text-destructive",
      !["running", "awaitingApproval", "failed"].includes(status) &&
        "bg-muted text-muted-foreground",
    )}
  >
    {statusLabel[status]}
  </span>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string }> = ({
  icon,
  title,
}) => (
  <div className="flex items-center gap-2 text-sm font-semibold">
    {icon}
    <span className="truncate">{title}</span>
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
    {text}
  </div>
);
