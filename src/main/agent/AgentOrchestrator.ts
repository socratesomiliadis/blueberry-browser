import { dialog, WebContents } from "electron";
import { generateText, type CoreMessage, type LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as dotenv from "dotenv";
import { writeFileSync } from "fs";
import { join } from "path";
import type {
  ActionResult,
  AgentAction,
  AgentMilestone,
  ApprovalRequest,
  ExtractedDataset,
  PilotExportRequest,
  PilotExportResult,
  TraceRun,
} from "../../shared/agent";
import type { Window } from "../Window";
import { ActionRuntime } from "./ActionRuntime";
import { AutomationCompiler } from "./AutomationCompiler";
import { createId, nowIso } from "./ids";
import { PageWorldModel } from "./PageWorldModel";
import { TraceStore } from "./TraceStore";

dotenv.config({ path: join(__dirname, "../../.env") });

interface PilotDecision {
  status: string;
  thought: string;
  plan: string[];
  milestones: AgentMilestone[];
  action: Omit<AgentAction, "id" | "safetyLevel"> & {
    id?: string;
    safetyLevel?: AgentAction["safetyLevel"];
  };
}

type ApprovalResolution = "approved" | "rejected";

const DEFAULT_MODEL = "claude-sonnet-4-0";
const MAX_STEPS = 15;

export class AgentOrchestrator {
  private readonly worldModel = new PageWorldModel();
  private readonly traceStore = new TraceStore();
  private readonly runtime: ActionRuntime;
  private readonly compiler = new AutomationCompiler();
  private readonly model: LanguageModel | null;
  private abortController: AbortController | null = null;
  private paused = false;
  private approvalResolver: ((resolution: ApprovalResolution) => void) | null =
    null;
  private activeApproval: ApprovalRequest | null = null;

  constructor(
    private readonly mainWindow: Window,
    private readonly sidebarContents: WebContents,
  ) {
    this.runtime = new ActionRuntime(mainWindow);
    this.model = this.initializeModel();
  }

  startRun(goal: string): TraceRun {
    if (this.abortController) {
      this.stopRun();
    }

    const run = this.traceStore.startRun(goal);
    this.abortController = new AbortController();
    this.paused = false;
    this.emitRun();

    void this.runLoop(goal, this.abortController.signal);
    return run;
  }

  pauseRun(): TraceRun | null {
    this.paused = true;
    const run = this.traceStore.setStatus("paused", "Paused");
    this.emitRun();
    return run;
  }

  resumeRun(): TraceRun | null {
    this.paused = false;
    const run = this.traceStore.setStatus("running", "Resuming Pilot");
    this.emitRun();
    return run;
  }

  stopRun(): TraceRun | null {
    this.abortController?.abort();
    this.abortController = null;
    this.approvalResolver?.("rejected");
    this.approvalResolver = null;
    this.activeApproval = null;
    const run = this.traceStore.setStatus("stopped", "Stopped");
    this.emitRun();
    return run;
  }

  approveAction(): TraceRun | null {
    this.traceStore.addEvent({
      type: "approval-resolved",
      title: "Action approved",
      detail: this.activeApproval?.action.label || "Approved",
      action: this.activeApproval?.action,
    });
    this.approvalResolver?.("approved");
    this.approvalResolver = null;
    this.activeApproval = null;
    const run = this.traceStore.setStatus("running", "Continuing");
    this.emitRun();
    return run;
  }

  rejectAction(): TraceRun | null {
    this.traceStore.addEvent({
      type: "approval-resolved",
      title: "Action rejected",
      detail: this.activeApproval?.action.label || "Rejected",
      action: this.activeApproval?.action,
    });
    this.approvalResolver?.("rejected");
    this.approvalResolver = null;
    this.activeApproval = null;
    const run = this.traceStore.setStatus("running", "Choosing another route");
    this.emitRun();
    return run;
  }

  getCurrentRun(): TraceRun | null {
    return this.traceStore.getCurrentRun();
  }

  async exportArtifact(
    request: PilotExportRequest,
  ): Promise<PilotExportResult> {
    const run = this.traceStore.getCurrentRun();
    if (!run) {
      return { ok: false, filePath: null, message: "No Pilot run to export." };
    }

    const artifacts =
      run.artifacts.length > 0 ? run.artifacts : this.compiler.compile(run);
    const artifact =
      artifacts.find((item) => item.id === request.artifactId) ??
      artifacts.find((item) => item.kind === request.kind) ??
      artifacts[0];

    if (!artifact) {
      return {
        ok: false,
        filePath: null,
        message: "No artifact is available.",
      };
    }

    const result = await dialog.showSaveDialog({
      title: `Export ${artifact.title}`,
      defaultPath: artifact.filename,
      filters: [
        {
          name: artifact.title,
          extensions: [artifact.filename.split(".").pop() || "txt"],
        },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, filePath: null, message: "Export canceled." };
    }

    writeFileSync(result.filePath, artifact.content, "utf-8");
    return {
      ok: true,
      filePath: result.filePath,
      message: `Exported ${artifact.title}.`,
    };
  }

  private async runLoop(goal: string, signal: AbortSignal): Promise<void> {
    let lastResult: ActionResult | null = null;

    try {
      if (!this.model) {
        throw new Error(
          "Pilot needs ANTHROPIC_API_KEY in .env before it can run.",
        );
      }

      for (let step = 0; step < MAX_STEPS; step += 1) {
        if (signal.aborted) return;
        await this.waitWhilePaused(signal);

        const tab = this.mainWindow.activeTab;
        if (!tab) throw new Error("No active tab is available.");

        const pageState = await this.worldModel.observe(tab, lastResult);
        this.traceStore.addPageState(pageState);
        this.emitRun();

        const decision = await this.decide(goal, step, pageState, signal);
        this.traceStore.updatePlan(decision.plan, decision.milestones);
        this.emitRun();

        const proposedAction = this.toAction(decision.action, decision.thought);
        const action = this.runtime.enrichAction(proposedAction, pageState);
        this.traceStore.addAction(action);
        this.emitRun();

        if (action.kind === "finish") {
          const result = await this.runtime.execute(action, pageState);
          this.traceStore.addResult(result);
          this.finishRun();
          return;
        }

        if (this.runtime.needsApproval(action)) {
          const approved = await this.requestApproval(action, signal);
          if (!approved) {
            lastResult = {
              actionId: action.id,
              ok: false,
              message: "User rejected the action.",
              completedAt: nowIso(),
              safetyLevel: action.safetyLevel,
              error: "Rejected by user",
            };
            this.traceStore.addResult(lastResult);
            this.emitRun();
            continue;
          }
        }

        const result = await this.runtime.execute(action, pageState);
        lastResult = result;
        this.traceStore.addResult(result);

        if (this.isExtractedDataset(result.data)) {
          this.traceStore.addExtractedData(result.data);
        }

        this.emitRun();
      }

      this.finishRun(
        "Reached the step limit. I saved the trace and generated automation artifacts.",
      );
    } catch (error) {
      if (signal.aborted) return;
      this.traceStore.setError(
        error instanceof Error ? error.message : "Pilot failed.",
      );
      this.emitRun();
    } finally {
      this.abortController = null;
    }
  }

  private async decide(
    goal: string,
    step: number,
    pageState: Awaited<ReturnType<PageWorldModel["observe"]>>,
    signal: AbortSignal,
  ): Promise<PilotDecision> {
    const messages: CoreMessage[] = [
      {
        role: "system",
        content: [
          "You are Blueberry Pilot, a guarded browser agent.",
          "Return only compact JSON. Do not wrap it in markdown.",
          "Choose exactly one next action from the provided action contract.",
          "Prefer extract when the page visibly contains the information needed by the goal.",
          "Use finish when the goal is complete or blocked.",
          "Sensitive or dangerous actions may be proposed, but the browser will ask the user first.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          goal,
          step,
          page: {
            url: pageState.url,
            title: pageState.title,
            text: pageState.visibleTextSummary.slice(0, 3500),
            elements: pageState.elements.slice(0, 80).map((element) => ({
              id: element.id,
              role: element.role,
              tagName: element.tagName,
              name: element.name,
              text: element.text,
              placeholder: element.placeholder,
              selector: element.selector,
              safetyLevel: element.safetyLevel,
            })),
            tables: pageState.tables,
            loginHints: pageState.loginHints,
            lastActionResult: pageState.lastActionResult,
          },
          responseShape: {
            status: "short visible status",
            thought: "why this action is next",
            plan: ["3 to 5 short steps"],
            milestones: [
              {
                id: "m1",
                label: "Find the relevant data",
                status: "running|pending|completed|failed",
                evidence: "optional",
              },
            ],
            action: {
              kind: "navigate|click|type|press|scroll|wait|extract|openTab|switchTab|inspectElement|runPageScript|askUser|confirmRiskyAction|finish",
              label: "short user-visible action label",
              why: "why this action helps",
              targetElementId: "element id when acting on an element",
              selector: "selector when available",
              url: "for navigate/openTab",
              text: "for type",
              key: "for press, e.g. Enter",
              direction: "up|down|left|right",
              amount: "number for wait ms or scroll px",
              extractionGoal: "for extract",
              safetyLevel: "safe|medium|sensitive|dangerous",
            },
          },
        }),
      },
    ];

    const result = await generateText({
      model: this.model as LanguageModel,
      messages,
      temperature: 0.1,
      maxRetries: 1,
      abortSignal: signal,
    });

    return this.parseDecision(result.text);
  }

  private parseDecision(text: string): PilotDecision {
    const trimmed = text.trim();
    const jsonText = trimmed.startsWith("```")
      ? trimmed
          .replace(/^```(?:json)?/i, "")
          .replace(/```$/i, "")
          .trim()
      : trimmed;
    const parsed = JSON.parse(jsonText) as Partial<PilotDecision>;

    return {
      status: parsed.status || "Working",
      thought: parsed.thought || "Continue toward the goal.",
      plan: Array.isArray(parsed.plan)
        ? parsed.plan.slice(0, 5)
        : ["Observe", "Act", "Verify"],
      milestones: Array.isArray(parsed.milestones)
        ? parsed.milestones.slice(0, 6)
        : [],
      action: parsed.action || {
        kind: "finish",
        label: "Finish",
        why: "No next action was provided.",
      },
    };
  }

  private toAction(
    action: PilotDecision["action"],
    fallbackWhy: string,
  ): AgentAction {
    return {
      id: action.id || createId("action"),
      kind: action.kind,
      label: action.label || action.kind,
      why: action.why || fallbackWhy,
      targetElementId: action.targetElementId,
      selector: action.selector,
      url: action.url,
      text: action.text,
      key: action.key,
      direction: action.direction,
      amount: typeof action.amount === "number" ? action.amount : undefined,
      tabId: action.tabId,
      script: action.script,
      extractionGoal: action.extractionGoal,
      safetyLevel: action.safetyLevel || "safe",
    };
  }

  private async requestApproval(
    action: AgentAction,
    signal: AbortSignal,
  ): Promise<boolean> {
    const run = this.traceStore.getCurrentRun();
    if (!run) return false;

    const approval: ApprovalRequest = {
      id: createId("approval"),
      runId: run.id,
      action,
      reason: `${action.label} is classified as ${action.safetyLevel}.`,
      createdAt: nowIso(),
    };

    this.activeApproval = approval;
    this.traceStore.setStatus("awaitingApproval", "Waiting for approval");
    this.traceStore.addApproval(approval);
    this.traceStore.addEvent({
      type: "approval-requested",
      title: "Approval required",
      detail: approval.reason,
      action,
    });
    this.sidebarContents.send("pilot-approval-requested", approval);
    this.emitRun();

    const resolution = await new Promise<ApprovalResolution>((resolve) => {
      this.approvalResolver = resolve;
      signal.addEventListener(
        "abort",
        () => {
          resolve("rejected");
        },
        { once: true },
      );
    });

    return resolution === "approved";
  }

  private finishRun(message = "Pilot finished the run."): void {
    const run = this.traceStore.setStatus("completed", message);
    if (!run) return;

    const artifacts = this.compiler.compile(run);
    for (const artifact of artifacts) {
      this.traceStore.addArtifact(artifact);
      this.sidebarContents.send("pilot-artifact-generated", artifact);
    }

    this.traceStore.addEvent({
      type: "run-finished",
      title: "Run finished",
      detail: message,
    });
    this.emitRun();
  }

  private async waitWhilePaused(signal: AbortSignal): Promise<void> {
    while (this.paused && !signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  private initializeModel(): LanguageModel | null {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        "Pilot initialization failed: ANTHROPIC_API_KEY is missing.",
      );
      return null;
    }

    return anthropic(process.env.LLM_MODEL || DEFAULT_MODEL);
  }

  private emitRun(): void {
    const run = this.traceStore.getCurrentRun();
    if (run && !this.sidebarContents.isDestroyed()) {
      this.sidebarContents.send("pilot-run-updated", run);
    }
  }

  private isExtractedDataset(value: unknown): value is ExtractedDataset {
    return (
      typeof value === "object" &&
      value !== null &&
      "rows" in value &&
      "columns" in value &&
      Array.isArray((value as ExtractedDataset).rows)
    );
  }
}
