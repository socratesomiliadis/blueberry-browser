import { ElectronAPI } from "@electron-toolkit/preload";
import type {
  ApprovalRequest,
  GeneratedArtifact,
  PilotExportRequest,
  PilotExportResult,
  TraceRun,
} from "../shared/agent";

interface ChatRequest {
  message: string;
  context?: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) => Promise<void>;
  clearChat: () => Promise<boolean>;
  getMessages: () => Promise<unknown[]>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  onMessagesUpdated: (callback: (messages: unknown[]) => void) => void;
  removeChatResponseListener: () => void;
  removeMessagesUpdatedListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  // Pilot functionality
  startPilotRun: (goal: string) => Promise<TraceRun>;
  pausePilotRun: () => Promise<TraceRun | null>;
  resumePilotRun: () => Promise<TraceRun | null>;
  stopPilotRun: () => Promise<TraceRun | null>;
  approvePilotAction: () => Promise<TraceRun | null>;
  rejectPilotAction: () => Promise<TraceRun | null>;
  getCurrentPilotRun: () => Promise<TraceRun | null>;
  exportPilotArtifact: (
    request: PilotExportRequest,
  ) => Promise<PilotExportResult>;
  onPilotRunUpdated: (callback: (run: TraceRun) => void) => void;
  onPilotApprovalRequested: (
    callback: (approval: ApprovalRequest) => void,
  ) => void;
  onPilotArtifactGenerated: (
    callback: (artifact: GeneratedArtifact) => void,
  ) => void;
  removePilotListeners: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}
