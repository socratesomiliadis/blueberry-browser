/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ApprovalRequest,
  GeneratedArtifact,
  PilotExportRequest,
  PilotExportResult,
  TraceRun,
} from "../../../../shared/agent";

interface PilotContextType {
  run: TraceRun | null;
  approval: ApprovalRequest | null;
  latestArtifact: GeneratedArtifact | null;
  exportResult: PilotExportResult | null;
  startRun: (goal: string) => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;
  stopRun: () => Promise<void>;
  approveAction: () => Promise<void>;
  rejectAction: () => Promise<void>;
  exportArtifact: (request: PilotExportRequest) => Promise<void>;
}

const PilotContext = createContext<PilotContextType | null>(null);

export const usePilot = (): PilotContextType => {
  const context = useContext(PilotContext);
  if (!context) {
    throw new Error("usePilot must be used within a PilotProvider");
  }
  return context;
};

export const PilotProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [run, setRun] = useState<TraceRun | null>(null);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [latestArtifact, setLatestArtifact] =
    useState<GeneratedArtifact | null>(null);
  const [exportResult, setExportResult] = useState<PilotExportResult | null>(
    null,
  );

  useEffect(() => {
    window.sidebarAPI
      .getCurrentPilotRun()
      .then((currentRun) => {
        setRun(currentRun);
        setLatestArtifact(currentRun?.artifacts.at(-1) ?? null);
      })
      .catch((error) => console.error("Failed to load Pilot run:", error));

    window.sidebarAPI.onPilotRunUpdated((updatedRun) => {
      setRun(updatedRun);
      setLatestArtifact(updatedRun.artifacts.at(-1) ?? null);
      if (updatedRun.status !== "awaitingApproval") {
        setApproval(null);
      }
    });
    window.sidebarAPI.onPilotApprovalRequested(setApproval);
    window.sidebarAPI.onPilotArtifactGenerated(setLatestArtifact);

    return () => {
      window.sidebarAPI.removePilotListeners();
    };
  }, []);

  const startRun = useCallback(async (goal: string): Promise<void> => {
    setExportResult(null);
    const nextRun = await window.sidebarAPI.startPilotRun(goal);
    setRun(nextRun);
  }, []);

  const pauseRun = useCallback(async (): Promise<void> => {
    setRun(await window.sidebarAPI.pausePilotRun());
  }, []);

  const resumeRun = useCallback(async (): Promise<void> => {
    setRun(await window.sidebarAPI.resumePilotRun());
  }, []);

  const stopRun = useCallback(async (): Promise<void> => {
    setRun(await window.sidebarAPI.stopPilotRun());
  }, []);

  const approveAction = useCallback(async (): Promise<void> => {
    setApproval(null);
    setRun(await window.sidebarAPI.approvePilotAction());
  }, []);

  const rejectAction = useCallback(async (): Promise<void> => {
    setApproval(null);
    setRun(await window.sidebarAPI.rejectPilotAction());
  }, []);

  const exportArtifact = useCallback(
    async (request: PilotExportRequest): Promise<void> => {
      const result = await window.sidebarAPI.exportPilotArtifact(request);
      setExportResult(result);
    },
    [],
  );

  const value = useMemo<PilotContextType>(
    () => ({
      run,
      approval,
      latestArtifact,
      exportResult,
      startRun,
      pauseRun,
      resumeRun,
      stopRun,
      approveAction,
      rejectAction,
      exportArtifact,
    }),
    [
      run,
      approval,
      latestArtifact,
      exportResult,
      startRun,
      pauseRun,
      resumeRun,
      stopRun,
      approveAction,
      rejectAction,
      exportArtifact,
    ],
  );

  return (
    <PilotContext.Provider value={value}>{children}</PilotContext.Provider>
  );
};
