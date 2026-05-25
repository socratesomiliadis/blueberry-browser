export type SafetyLevel = "safe" | "medium" | "sensitive" | "dangerous";

export type AgentRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "awaitingApproval"
  | "completed"
  | "failed"
  | "stopped";

export type AgentActionKind =
  | "navigate"
  | "click"
  | "type"
  | "select"
  | "press"
  | "scroll"
  | "wait"
  | "extract"
  | "download"
  | "upload"
  | "openTab"
  | "switchTab"
  | "inspectElement"
  | "runPageScript"
  | "askUser"
  | "confirmRiskyAction"
  | "finish";

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageElement {
  id: string;
  tagName: string;
  role: string | null;
  type: string | null;
  name: string;
  text: string;
  href: string | null;
  value: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  selector: string;
  selectorCandidates: string[];
  bounds: RectLike;
  isVisible: boolean;
  isEnabled: boolean;
  safetyLevel: SafetyLevel;
}

export interface PageForm {
  id: string;
  name: string;
  selector: string;
  fields: PageElement[];
  submitButtons: PageElement[];
}

export interface PageTable {
  id: string;
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface ExtractedDataset {
  id: string;
  label: string;
  sourceUrl: string;
  columns: string[];
  rows: Array<Record<string, string>>;
  extractedAt: string;
}

export interface PageState {
  id: string;
  capturedAt: string;
  tabId: string;
  url: string;
  title: string;
  screenshot: string | null;
  visibleTextSummary: string;
  elements: PageElement[];
  forms: PageForm[];
  tables: PageTable[];
  dialogs: PageElement[];
  selectedElement: PageElement | null;
  lastActionResult: ActionResult | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  consoleErrors: string[];
  networkActivity: "idle" | "loading" | "unknown";
  loginHints: string[];
}

export interface AgentAction {
  id: string;
  kind: AgentActionKind;
  label: string;
  why: string;
  targetElementId?: string;
  selector?: string;
  url?: string;
  text?: string;
  key?: string;
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  tabId?: string;
  script?: string;
  extractionGoal?: string;
  safetyLevel: SafetyLevel;
}

export interface ActionResult {
  actionId: string;
  ok: boolean;
  message: string;
  completedAt: string;
  safetyLevel: SafetyLevel;
  data?: unknown;
  error?: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  action: AgentAction;
  reason: string;
  createdAt: string;
}

export interface AgentMilestone {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  evidence?: string;
}

export type TraceEventType =
  | "run-started"
  | "plan-updated"
  | "observation"
  | "action-proposed"
  | "approval-requested"
  | "approval-resolved"
  | "action-result"
  | "extraction"
  | "artifact-generated"
  | "run-finished"
  | "run-error";

export interface TraceEvent {
  id: string;
  runId: string;
  type: TraceEventType;
  timestamp: string;
  title: string;
  detail: string;
  screenshot?: string | null;
  pageStateId?: string;
  action?: AgentAction;
  actionResult?: ActionResult;
  extractedData?: ExtractedDataset;
  artifactId?: string;
}

export type GeneratedArtifactKind =
  | "trace-json"
  | "blueberry-recipe"
  | "playwright"
  | "html";

export interface GeneratedArtifact {
  id: string;
  runId: string;
  kind: GeneratedArtifactKind;
  title: string;
  filename: string;
  language: "json" | "typescript" | "html";
  content: string;
  createdAt: string;
}

export interface TraceRun {
  id: string;
  goal: string;
  status: AgentRunStatus;
  startedAt: string;
  completedAt: string | null;
  currentStatus: string;
  plan: string[];
  milestones: AgentMilestone[];
  events: TraceEvent[];
  pageStates: PageState[];
  actions: AgentAction[];
  results: ActionResult[];
  approvals: ApprovalRequest[];
  extractedData: ExtractedDataset[];
  artifacts: GeneratedArtifact[];
  error: string | null;
}

export interface PilotExportRequest {
  artifactId?: string;
  kind?: GeneratedArtifactKind;
}

export interface PilotExportResult {
  ok: boolean;
  filePath: string | null;
  message: string;
}
