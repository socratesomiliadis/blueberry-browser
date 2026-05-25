import type {
  ActionResult,
  AgentAction,
  AgentMilestone,
  ApprovalRequest,
  ExtractedDataset,
  GeneratedArtifact,
  PageState,
  TraceEvent,
  TraceRun,
} from "../../shared/agent";
import { createId, nowIso } from "./ids";

export class TraceStore {
  private currentRun: TraceRun | null = null;
  private recentRuns: TraceRun[] = [];

  startRun(goal: string): TraceRun {
    const run: TraceRun = {
      id: createId("run"),
      goal,
      status: "running",
      startedAt: nowIso(),
      completedAt: null,
      currentStatus: "Starting Pilot",
      plan: [],
      milestones: [],
      events: [],
      pageStates: [],
      actions: [],
      results: [],
      approvals: [],
      extractedData: [],
      artifacts: [],
      error: null,
    };

    this.currentRun = run;
    this.recentRuns = [run, ...this.recentRuns].slice(0, 10);
    this.addEvent({
      type: "run-started",
      title: "Run started",
      detail: goal,
    });
    return this.cloneRun(run);
  }

  getCurrentRun(): TraceRun | null {
    return this.currentRun ? this.cloneRun(this.currentRun) : null;
  }

  setStatus(
    status: TraceRun["status"],
    currentStatus: string,
  ): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.status = status;
    this.currentRun.currentStatus = currentStatus;
    if (["completed", "failed", "stopped"].includes(status)) {
      this.currentRun.completedAt = nowIso();
    }
    return this.cloneRun(this.currentRun);
  }

  setError(error: string): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.error = error;
    this.currentRun.status = "failed";
    this.currentRun.currentStatus = "Pilot hit an error";
    this.currentRun.completedAt = nowIso();
    this.addEvent({
      type: "run-error",
      title: "Run failed",
      detail: error,
    });
    return this.cloneRun(this.currentRun);
  }

  updatePlan(plan: string[], milestones: AgentMilestone[]): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.plan = plan;
    this.currentRun.milestones = milestones;
    this.addEvent({
      type: "plan-updated",
      title: "Plan updated",
      detail: plan.join("\n"),
    });
    return this.cloneRun(this.currentRun);
  }

  addPageState(pageState: PageState): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.pageStates.push(pageState);
    this.currentRun.currentStatus = `Observing ${pageState.title || pageState.url}`;
    this.addEvent({
      type: "observation",
      title: "Observed page",
      detail: pageState.visibleTextSummary.slice(0, 600),
      screenshot: pageState.screenshot,
      pageStateId: pageState.id,
    });
    return this.cloneRun(this.currentRun);
  }

  addAction(action: AgentAction): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.actions.push(action);
    this.currentRun.currentStatus = action.label;
    this.addEvent({
      type: "action-proposed",
      title: action.label,
      detail: action.why,
      action,
    });
    return this.cloneRun(this.currentRun);
  }

  addApproval(approval: ApprovalRequest): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.approvals.push(approval);
    return this.cloneRun(this.currentRun);
  }

  addResult(result: ActionResult): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.results.push(result);
    this.addEvent({
      type: "action-result",
      title: result.ok ? "Action succeeded" : "Action failed",
      detail: result.message,
      actionResult: result,
    });
    return this.cloneRun(this.currentRun);
  }

  addExtractedData(dataset: ExtractedDataset): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.extractedData.push(dataset);
    this.addEvent({
      type: "extraction",
      title: dataset.label,
      detail: `Extracted ${dataset.rows.length} rows from ${dataset.sourceUrl}`,
      extractedData: dataset,
    });
    return this.cloneRun(this.currentRun);
  }

  addArtifact(artifact: GeneratedArtifact): TraceRun | null {
    if (!this.currentRun) return null;
    this.currentRun.artifacts = [
      ...this.currentRun.artifacts.filter(
        (item) => item.kind !== artifact.kind,
      ),
      artifact,
    ];
    this.addEvent({
      type: "artifact-generated",
      title: artifact.title,
      detail: artifact.filename,
      artifactId: artifact.id,
    });
    return this.cloneRun(this.currentRun);
  }

  addEvent(
    event: Omit<TraceEvent, "id" | "runId" | "timestamp">,
  ): TraceRun | null {
    if (!this.currentRun) return null;
    const traceEvent: TraceEvent = {
      id: createId("event"),
      runId: this.currentRun.id,
      timestamp: nowIso(),
      ...event,
    };

    this.currentRun.events.push(traceEvent);
    return this.cloneRun(this.currentRun);
  }

  cloneRun(run: TraceRun): TraceRun {
    return JSON.parse(JSON.stringify(run)) as TraceRun;
  }
}
