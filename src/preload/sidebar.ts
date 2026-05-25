import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type {
  ApprovalRequest,
  GeneratedArtifact,
  PilotExportRequest,
  TraceRun,
} from "../shared/agent";

interface ChatRequest {
  message: string;
  context: {
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

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: unknown[]) => void) => {
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages),
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Page content access
  getPageContent: () => electronAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: () => electronAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => electronAPI.ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: () => electronAPI.ipcRenderer.invoke("get-active-tab-info"),

  // Pilot functionality
  startPilotRun: (goal: string) =>
    electronAPI.ipcRenderer.invoke("pilot-start-run", goal),
  pausePilotRun: () => electronAPI.ipcRenderer.invoke("pilot-pause-run"),
  resumePilotRun: () => electronAPI.ipcRenderer.invoke("pilot-resume-run"),
  stopPilotRun: () => electronAPI.ipcRenderer.invoke("pilot-stop-run"),
  approvePilotAction: () =>
    electronAPI.ipcRenderer.invoke("pilot-approve-action"),
  rejectPilotAction: () =>
    electronAPI.ipcRenderer.invoke("pilot-reject-action"),
  getCurrentPilotRun: () =>
    electronAPI.ipcRenderer.invoke("pilot-get-current-run"),
  exportPilotArtifact: (request: PilotExportRequest) =>
    electronAPI.ipcRenderer.invoke("pilot-export-artifact", request),
  onPilotRunUpdated: (callback: (run: TraceRun) => void) => {
    electronAPI.ipcRenderer.on("pilot-run-updated", (_, run) => callback(run));
  },
  onPilotApprovalRequested: (callback: (approval: ApprovalRequest) => void) => {
    electronAPI.ipcRenderer.on("pilot-approval-requested", (_, approval) =>
      callback(approval),
    );
  },
  onPilotArtifactGenerated: (
    callback: (artifact: GeneratedArtifact) => void,
  ) => {
    electronAPI.ipcRenderer.on("pilot-artifact-generated", (_, artifact) =>
      callback(artifact),
    );
  },
  removePilotListeners: () => {
    electronAPI.ipcRenderer.removeAllListeners("pilot-run-updated");
    electronAPI.ipcRenderer.removeAllListeners("pilot-approval-requested");
    electronAPI.ipcRenderer.removeAllListeners("pilot-artifact-generated");
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
