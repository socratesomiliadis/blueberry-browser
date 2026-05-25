import type {
  ActionResult,
  AgentAction,
  ExtractedDataset,
  PageElement,
  PageState,
  SafetyLevel,
} from "../../shared/agent";
import type { Window } from "../Window";
import { createId, nowIso } from "./ids";

const OVERLAY_SCRIPT = String.raw`
(() => {
  if (window.__blueberryPilotOverlay) return;
  const root = document.createElement("div");
  root.id = "__blueberry-pilot-overlay";
  root.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const cursor = document.createElement("div");
  cursor.style.cssText = "position:fixed;width:18px;height:18px;border-radius:999px;background:#4f46e5;box-shadow:0 0 0 5px rgba(79,70,229,.18);transform:translate(-50%,-50%);transition:left .22s ease,top .22s ease;left:24px;top:24px";
  const spotlight = document.createElement("div");
  spotlight.style.cssText = "position:fixed;border:2px solid #4f46e5;border-radius:8px;box-shadow:0 0 0 9999px rgba(15,23,42,.08),0 0 0 5px rgba(79,70,229,.18);opacity:0;transition:all .18s ease";
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;left:16px;bottom:16px;max-width:min(360px,calc(100vw - 32px));padding:9px 11px;border-radius:8px;background:rgba(20,20,20,.92);color:white;font-size:12px;line-height:1.35;box-shadow:0 12px 30px rgba(0,0,0,.22);opacity:0;transition:opacity .16s ease";
  root.append(spotlight, cursor, toast);
  document.documentElement.appendChild(root);
  window.__blueberryPilotOverlay = {
    show(selector, label) {
      const node = selector ? document.querySelector(selector) : null;
      if (node) {
        const rect = node.getBoundingClientRect();
        cursor.style.left = Math.round(rect.left + rect.width / 2) + "px";
        cursor.style.top = Math.round(rect.top + rect.height / 2) + "px";
        spotlight.style.left = Math.max(0, Math.round(rect.left) - 4) + "px";
        spotlight.style.top = Math.max(0, Math.round(rect.top) - 4) + "px";
        spotlight.style.width = Math.round(rect.width + 8) + "px";
        spotlight.style.height = Math.round(rect.height + 8) + "px";
        spotlight.style.opacity = "1";
      } else {
        spotlight.style.opacity = "0";
      }
      toast.textContent = label || "";
      toast.style.opacity = label ? "1" : "0";
    },
    clear() {
      spotlight.style.opacity = "0";
      toast.style.opacity = "0";
    }
  };
})()
`;

const CLEAR_OVERLAY_SCRIPT = String.raw`
(() => {
  if (window.__blueberryPilotOverlay) {
    window.__blueberryPilotOverlay.clear();
  }
})()
`;

export class ActionRuntime {
  constructor(private readonly mainWindow: Window) {}

  enrichAction(action: AgentAction, state: PageState): AgentAction {
    const target = this.findTarget(action, state);
    const safetyLevel = this.classifyAction(action, target);

    return {
      ...action,
      id: action.id || createId("action"),
      selector: action.selector || target?.selector,
      targetElementId: action.targetElementId || target?.id,
      safetyLevel,
    };
  }

  needsApproval(action: AgentAction): boolean {
    return (
      action.safetyLevel === "sensitive" || action.safetyLevel === "dangerous"
    );
  }

  async execute(action: AgentAction, state: PageState): Promise<ActionResult> {
    const tab = action.tabId
      ? this.mainWindow.getTab(action.tabId)
      : this.mainWindow.activeTab;
    if (!tab) {
      return this.result(
        action,
        false,
        "No active tab is available.",
        undefined,
        "No active tab",
      );
    }

    try {
      await this.showOverlay(action);

      switch (action.kind) {
        case "navigate":
          if (!action.url) throw new Error("Navigate action is missing a URL.");
          await tab.loadURL(this.normalizeUrl(action.url));
          await this.wait(500);
          return this.result(action, true, `Navigated to ${action.url}`);

        case "click":
          await this.click(tab, action, state);
          await this.wait(450);
          return this.result(action, true, `Clicked ${action.label}`);

        case "type":
          if (!action.text) throw new Error("Type action is missing text.");
          await this.typeInto(tab, action, state);
          return this.result(action, true, `Typed into ${action.label}`);

        case "press":
          if (!action.key) throw new Error("Press action is missing a key.");
          tab.webContents.sendInputEvent({
            type: "keyDown",
            keyCode: action.key,
          });
          tab.webContents.sendInputEvent({
            type: "keyUp",
            keyCode: action.key,
          });
          await this.wait(250);
          return this.result(action, true, `Pressed ${action.key}`);

        case "scroll":
          await tab.runJs(
            `window.scrollBy({ top: ${this.scrollDelta(action)}, behavior: "smooth" })`,
          );
          await this.wait(600);
          return this.result(
            action,
            true,
            `Scrolled ${action.direction || "down"}`,
          );

        case "wait":
          await this.wait(action.amount ?? 1000);
          return this.result(action, true, "Waited for the page.");

        case "extract": {
          const dataset = await this.extract(tab, action, state);
          return this.result(
            action,
            true,
            `Extracted ${dataset.rows.length} rows.`,
            dataset,
          );
        }

        case "openTab": {
          const newTab = this.mainWindow.createTab(action.url);
          this.mainWindow.switchActiveTab(newTab.id);
          await this.wait(500);
          return this.result(action, true, `Opened tab ${newTab.id}`);
        }

        case "switchTab":
          if (!action.tabId)
            throw new Error("Switch tab action is missing tabId.");
          this.mainWindow.switchActiveTab(action.tabId);
          return this.result(action, true, `Switched to ${action.tabId}`);

        case "inspectElement":
          return this.result(
            action,
            true,
            "Inspected element.",
            this.findTarget(action, state),
          );

        case "runPageScript":
          if (!action.script)
            throw new Error("Script action is missing script.");
          return this.result(
            action,
            true,
            "Ran page script.",
            await tab.runJs(action.script),
          );

        case "askUser":
        case "confirmRiskyAction":
          return this.result(
            action,
            false,
            "This action must be handled by an approval prompt.",
          );

        case "finish":
          return this.result(action, true, action.label || "Finished.");

        case "select":
        case "download":
        case "upload":
          return this.result(
            action,
            false,
            `${action.kind} is not implemented in the MVP runtime.`,
          );
      }
    } catch (error) {
      return this.result(
        action,
        false,
        error instanceof Error ? error.message : "Action failed.",
        undefined,
        error instanceof Error ? error.message : "Unknown action error",
      );
    } finally {
      await tab.runJs(CLEAR_OVERLAY_SCRIPT).catch(() => undefined);
    }
  }

  private findTarget(
    action: AgentAction,
    state: PageState,
  ): PageElement | null {
    if (action.targetElementId) {
      return (
        state.elements.find(
          (element) => element.id === action.targetElementId,
        ) ?? null
      );
    }

    if (action.selector) {
      return (
        state.elements.find((element) =>
          element.selectorCandidates.includes(action.selector || ""),
        ) ?? null
      );
    }

    const label = [action.label, action.text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!label) return null;

    return (
      state.elements.find((element) => {
        const haystack =
          `${element.name} ${element.text} ${element.placeholder ?? ""}`.toLowerCase();
        return (
          haystack.includes(label) || label.includes(element.name.toLowerCase())
        );
      }) ?? null
    );
  }

  private classifyAction(
    action: AgentAction,
    target: PageElement | null,
  ): SafetyLevel {
    if (
      action.safetyLevel === "dangerous" ||
      action.safetyLevel === "sensitive"
    ) {
      return action.safetyLevel;
    }

    if (
      target?.safetyLevel === "dangerous" ||
      target?.safetyLevel === "sensitive"
    ) {
      return target.safetyLevel;
    }

    if (
      action.kind === "runPageScript" ||
      action.kind === "upload" ||
      action.kind === "download"
    ) {
      return "sensitive";
    }

    if (action.kind === "type" && target?.type === "password") {
      return "sensitive";
    }

    if (
      ["navigate", "click", "type", "select", "openTab", "switchTab"].includes(
        action.kind,
      )
    ) {
      return target?.safetyLevel === "medium" ? "medium" : "medium";
    }

    return "safe";
  }

  private async click(
    tab: NonNullable<Window["activeTab"]>,
    action: AgentAction,
    state: PageState,
  ): Promise<void> {
    const selector =
      action.selector || this.findTarget(action, state)?.selector;
    if (!selector) throw new Error("Click action has no selector.");

    const script = `
      (() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) throw new Error("Target not found: ${selector.replace(/"/g, '\\"')}");
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        node.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        node.click();
        return true;
      })()
    `;
    await tab.runJs(script);
  }

  private async typeInto(
    tab: NonNullable<Window["activeTab"]>,
    action: AgentAction,
    state: PageState,
  ): Promise<void> {
    const selector =
      action.selector || this.findTarget(action, state)?.selector;
    if (!selector) throw new Error("Type action has no selector.");

    const script = `
      (() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) throw new Error("Target not found: ${selector.replace(/"/g, '\\"')}");
        node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        node.focus();
        const value = ${JSON.stringify(action.text || "")};
        if ("value" in node) {
          node.value = value;
          node.dispatchEvent(new Event("input", { bubbles: true }));
          node.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          node.textContent = value;
          node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
        }
        return true;
      })()
    `;
    await tab.runJs(script);
  }

  private async extract(
    tab: NonNullable<Window["activeTab"]>,
    action: AgentAction,
    state: PageState,
  ): Promise<ExtractedDataset> {
    const rowsFromTables = state.tables.flatMap((table) => {
      const headers =
        table.headers.length > 0
          ? table.headers
          : (table.rows[0]?.map((_, index) => `Column ${index + 1}`) ?? []);
      return table.rows
        .slice(table.headers.length > 0 ? 0 : 1)
        .map((row) =>
          Object.fromEntries(
            headers.map((header, index) => [
              header || `Column ${index + 1}`,
              row[index] || "",
            ]),
          ),
        );
    });

    if (rowsFromTables.length > 0) {
      return {
        id: createId("data"),
        label: action.extractionGoal || "Extracted table data",
        sourceUrl: state.url,
        columns: Object.keys(rowsFromTables[0] ?? {}),
        rows: rowsFromTables.slice(0, 60),
        extractedAt: nowIso(),
      };
    }

    const cardRows = (await tab.runJs(String.raw`
      (() => {
        const candidates = Array.from(document.querySelectorAll("article, [class*='card'], [class*='result'], li, section"))
          .filter((node) => {
            const rect = node.getBoundingClientRect();
            const text = (node.innerText || "").replace(/\s+/g, " ").trim();
            return rect.width > 120 && rect.height > 40 && text.length > 20;
          })
          .slice(0, 40);
        return candidates.map((node) => {
          const link = node.querySelector("a[href]");
          const img = node.querySelector("img");
          const text = (node.innerText || "").replace(/\s+/g, " ").trim();
          return {
            title: (node.querySelector("h1,h2,h3,h4,a")?.innerText || link?.innerText || text).replace(/\s+/g, " ").trim().slice(0, 140),
            description: text.slice(0, 420),
            url: link?.href || "",
            image: img?.src || "",
            price: (text.match(/[$€£][\d,.]+/) || [])[0] || ""
          };
        });
      })()
    `)) as Array<Record<string, string>>;

    const rows = cardRows.filter((row) => row.title || row.description);
    return {
      id: createId("data"),
      label: action.extractionGoal || "Extracted page data",
      sourceUrl: state.url,
      columns: ["title", "description", "url", "image", "price"],
      rows: rows.slice(0, 60),
      extractedAt: nowIso(),
    };
  }

  private async showOverlay(action: AgentAction): Promise<void> {
    const tab = this.mainWindow.activeTab;
    if (!tab) return;
    await tab.runJs(OVERLAY_SCRIPT).catch(() => undefined);
    const selector = action.selector ? JSON.stringify(action.selector) : "null";
    const label = JSON.stringify(action.label);
    await tab
      .runJs(`window.__blueberryPilotOverlay?.show(${selector}, ${label})`)
      .catch(() => undefined);
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" "))
      return `https://${trimmed}`;
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }

  private scrollDelta(action: AgentAction): number {
    const amount = action.amount ?? 650;
    if (action.direction === "up" || action.direction === "left")
      return -Math.abs(amount);
    return Math.abs(amount);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private result(
    action: AgentAction,
    ok: boolean,
    message: string,
    data?: unknown,
    error?: string,
  ): ActionResult {
    return {
      actionId: action.id,
      ok,
      message,
      completedAt: nowIso(),
      safetyLevel: action.safetyLevel,
      data,
      error,
    };
  }
}
