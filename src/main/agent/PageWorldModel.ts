import type {
  ActionResult,
  PageElement,
  PageForm,
  PageState,
  PageTable,
} from "../../shared/agent";
import type { Tab } from "../Tab";
import { createId, nowIso } from "./ids";

interface DomSnapshot {
  visibleTextSummary: string;
  elements: PageElement[];
  forms: PageForm[];
  tables: PageTable[];
  dialogs: PageElement[];
  selectedElement: PageElement | null;
  loginHints: string[];
}

const DOM_SNAPSHOT_SCRIPT = String.raw`
(() => {
  const MAX_ELEMENTS = 120;
  const MAX_TEXT = 6000;
  const MAX_TABLES = 8;
  const MAX_ROWS = 12;
  const MAX_COLS = 8;
  const interactiveSelector = [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='tab']",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  function textOf(node) {
    return (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function attr(node, name) {
    const value = node.getAttribute(name);
    return value && value.trim() ? value.trim() : null;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function selectorFor(node) {
    const candidates = [];
    const id = attr(node, "id");
    const testId = attr(node, "data-testid") || attr(node, "data-test") || attr(node, "data-cy");
    const name = attr(node, "name");
    const aria = attr(node, "aria-label");

    if (id) candidates.push("#" + cssEscape(id));
    if (testId) candidates.push("[data-testid='" + testId.replace(/'/g, "\\'") + "']");
    if (name) candidates.push(node.tagName.toLowerCase() + "[name='" + name.replace(/'/g, "\\'") + "']");
    if (aria) candidates.push("[aria-label='" + aria.replace(/'/g, "\\'") + "']");

    let path = "";
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (!parent) break;
      const sameTag = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
      const index = sameTag.indexOf(current) + 1;
      path = tag + (sameTag.length > 1 ? ":nth-of-type(" + index + ")" : "") + (path ? " > " + path : "");
      current = parent;
    }
    if (path) candidates.push("body > " + path);

    return {
      selector: candidates[0] || node.tagName.toLowerCase(),
      selectorCandidates: Array.from(new Set(candidates)).slice(0, 5),
    };
  }

  function roleFor(node) {
    return attr(node, "role") || {
      A: "link",
      BUTTON: "button",
      INPUT: node.type === "submit" ? "button" : "textbox",
      TEXTAREA: "textbox",
      SELECT: "combobox"
    }[node.tagName] || null;
  }

  function safetyFor(node, text) {
    const joined = [
      text,
      attr(node, "aria-label"),
      attr(node, "name"),
      attr(node, "id"),
      attr(node, "type"),
      attr(node, "value")
    ].filter(Boolean).join(" ").toLowerCase();

    if (node.matches("input[type='password'], input[type='file']")) return "sensitive";
    if (/\b(pay|purchase|buy|checkout|delete|remove|destroy|submit order|place order)\b/.test(joined)) return "dangerous";
    if (/\b(send|post|submit|login|sign in|upload|password|secret|token)\b/.test(joined)) return "sensitive";
    if (node.matches("input, textarea, select, button, a[href], [role='button'], [role='link']")) return "medium";
    return "safe";
  }

  function toElement(node, index) {
    const rect = node.getBoundingClientRect();
    const styles = window.getComputedStyle(node);
    const text = textOf(node).slice(0, 240);
    const name = attr(node, "aria-label") || attr(node, "name") || attr(node, "title") || text || attr(node, "placeholder") || node.tagName.toLowerCase();
    const selectors = selectorFor(node);
    return {
      id: "el-" + index,
      tagName: node.tagName.toLowerCase(),
      role: roleFor(node),
      type: attr(node, "type"),
      name: name.slice(0, 180),
      text,
      href: node.href || attr(node, "href"),
      value: node.matches("input, textarea, select") ? String(node.value || "").slice(0, 180) : null,
      placeholder: attr(node, "placeholder"),
      ariaLabel: attr(node, "aria-label"),
      selector: selectors.selector,
      selectorCandidates: selectors.selectorCandidates,
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      isVisible: !!(rect.width && rect.height) && styles.visibility !== "hidden" && styles.display !== "none",
      isEnabled: !node.disabled && attr(node, "aria-disabled") !== "true",
      safetyLevel: safetyFor(node, text)
    };
  }

  const rawElements = Array.from(document.querySelectorAll(interactiveSelector))
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const styles = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && styles.display !== "none" && styles.visibility !== "hidden";
    })
    .slice(0, MAX_ELEMENTS);
  const elements = rawElements.map(toElement);
  const byNode = new Map(rawElements.map((node, index) => [node, elements[index]]));

  const forms = Array.from(document.forms).slice(0, 12).map((form, index) => {
    const selectors = selectorFor(form);
    const fieldNodes = Array.from(form.querySelectorAll("input, textarea, select")).slice(0, 24);
    const submitNodes = Array.from(form.querySelectorAll("button, input[type='submit'], [role='button']")).slice(0, 8);
    return {
      id: "form-" + index,
      name: attr(form, "aria-label") || attr(form, "name") || textOf(form).slice(0, 120) || "Form " + (index + 1),
      selector: selectors.selector,
      fields: fieldNodes.map((node, fieldIndex) => byNode.get(node) || toElement(node, 1000 + index * 100 + fieldIndex)),
      submitButtons: submitNodes.map((node, buttonIndex) => byNode.get(node) || toElement(node, 2000 + index * 100 + buttonIndex))
    };
  });

  const tables = Array.from(document.querySelectorAll("table")).slice(0, MAX_TABLES).map((table, index) => {
    const caption = textOf(table.querySelector("caption")).slice(0, 140);
    const headers = Array.from(table.querySelectorAll("thead th, tr:first-child th, tr:first-child td"))
      .slice(0, MAX_COLS)
      .map((cell) => textOf(cell).slice(0, 80));
    const rows = Array.from(table.querySelectorAll("tbody tr, tr"))
      .slice(0, MAX_ROWS)
      .map((row) => Array.from(row.querySelectorAll("td, th")).slice(0, MAX_COLS).map((cell) => textOf(cell).slice(0, 120)))
      .filter((row) => row.length);
    return { id: "table-" + index, caption, headers, rows };
  });

  const dialogs = Array.from(document.querySelectorAll("[role='dialog'], dialog, [aria-modal='true']"))
    .slice(0, 8)
    .map((node, index) => byNode.get(node) || toElement(node, 3000 + index));

  const active = document.activeElement && document.activeElement !== document.body
    ? byNode.get(document.activeElement) || toElement(document.activeElement, 9999)
    : null;

  const visibleTextSummary = textOf(document.body).slice(0, MAX_TEXT);
  const loginHints = [];
  if (document.querySelector("input[type='password']")) loginHints.push("Password field visible");
  if (/\b(sign in|log in|login|account)\b/i.test(visibleTextSummary)) loginHints.push("Login-related text visible");

  return {
    visibleTextSummary,
    elements,
    forms,
    tables,
    dialogs,
    selectedElement: active,
    loginHints
  };
})()
`;

function fallbackSnapshot(): DomSnapshot {
  return {
    visibleTextSummary: "",
    elements: [],
    forms: [],
    tables: [],
    dialogs: [],
    selectedElement: null,
    loginHints: [],
  };
}

export class PageWorldModel {
  async observe(
    tab: Tab,
    lastActionResult: ActionResult | null = null,
  ): Promise<PageState> {
    const [screenshot, snapshot] = await Promise.all([
      this.captureScreenshot(tab),
      this.captureDomSnapshot(tab),
    ]);

    return {
      id: createId("state"),
      capturedAt: nowIso(),
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      screenshot,
      visibleTextSummary: snapshot.visibleTextSummary,
      elements: snapshot.elements,
      forms: snapshot.forms,
      tables: snapshot.tables,
      dialogs: snapshot.dialogs,
      selectedElement: snapshot.selectedElement,
      lastActionResult,
      isLoading: tab.webContents.isLoading(),
      canGoBack: tab.webContents.canGoBack(),
      canGoForward: tab.webContents.canGoForward(),
      consoleErrors: [],
      networkActivity: tab.webContents.isLoading() ? "loading" : "idle",
      loginHints: snapshot.loginHints,
    };
  }

  private async captureScreenshot(tab: Tab): Promise<string | null> {
    try {
      const image = await tab.screenshot();
      return image.toDataURL();
    } catch (error) {
      console.error("Pilot failed to capture screenshot:", error);
      return null;
    }
  }

  private async captureDomSnapshot(tab: Tab): Promise<DomSnapshot> {
    try {
      return (await tab.runJs(DOM_SNAPSHOT_SCRIPT)) as DomSnapshot;
    } catch (error) {
      console.error("Pilot failed to capture DOM snapshot:", error);
      return fallbackSnapshot();
    }
  }
}
