import type {
  AgentAction,
  GeneratedArtifact,
  GeneratedArtifactKind,
  TraceRun,
} from "../../shared/agent";
import { createId, nowIso } from "./ids";

const BUILD_INTENT_PATTERN =
  /\b(build|create|generate|make|turn .* into|website|microsite|page|app|component|artifact)\b/i;

export class AutomationCompiler {
  compile(run: TraceRun): GeneratedArtifact[] {
    const artifacts = [
      this.traceJson(run),
      this.recipeJson(run),
      this.playwrightScript(run),
    ];

    if (BUILD_INTENT_PATTERN.test(run.goal) && run.extractedData.length > 0) {
      artifacts.push(this.htmlArtifact(run));
    }

    return artifacts;
  }

  private traceJson(run: TraceRun): GeneratedArtifact {
    return this.artifact(
      run,
      "trace-json",
      "Trace JSON",
      "trace.json",
      "json",
      JSON.stringify(run, null, 2),
    );
  }

  private recipeJson(run: TraceRun): GeneratedArtifact {
    const recipe = {
      schemaVersion: 1,
      name: this.titleFromGoal(run.goal),
      goal: run.goal,
      createdAt: nowIso(),
      safety: {
        askBefore: ["sensitive", "dangerous"],
        never: [
          "payment_without_user_approval",
          "password_without_user_approval",
        ],
      },
      steps: run.actions
        .filter((action) => action.kind !== "finish")
        .map((action) => ({
          kind: action.kind,
          label: action.label,
          why: action.why,
          selector: action.selector,
          url: action.url,
          text: action.kind === "type" ? "{{input}}" : action.text,
          key: action.key,
          direction: action.direction,
          extractionGoal: action.extractionGoal,
          safetyLevel: action.safetyLevel,
        })),
      outputs: run.extractedData.map((dataset) => ({
        label: dataset.label,
        columns: dataset.columns,
      })),
    };

    return this.artifact(
      run,
      "blueberry-recipe",
      "Blueberry Recipe",
      "blueberry-recipe.json",
      "json",
      JSON.stringify(recipe, null, 2),
    );
  }

  private playwrightScript(run: TraceRun): GeneratedArtifact {
    const lines = [
      "import { test, expect } from '@playwright/test';",
      "",
      `test(${JSON.stringify(this.titleFromGoal(run.goal))}, async ({ page }) => {`,
    ];

    const firstUrl = run.pageStates.find((state) =>
      /^https?:\/\//i.test(state.url),
    )?.url;
    if (firstUrl) {
      lines.push(`  await page.goto(${JSON.stringify(firstUrl)});`);
    }

    for (const action of run.actions) {
      const code = this.actionToPlaywright(action);
      if (code) lines.push(`  ${code}`);
    }

    lines.push("  await expect(page).toHaveTitle(/.+/);");
    lines.push("});");

    return this.artifact(
      run,
      "playwright",
      "Playwright Script",
      "workflow.spec.ts",
      "typescript",
      lines.join("\n"),
    );
  }

  private htmlArtifact(run: TraceRun): GeneratedArtifact {
    const dataset = run.extractedData[run.extractedData.length - 1];
    const rows = dataset.rows.slice(0, 24);
    const title = this.titleFromGoal(run.goal);
    const cards = rows
      .map((row) => {
        const heading = this.escapeHtml(
          row.title || row.name || row[dataset.columns[0]] || "Result",
        );
        const description = this.escapeHtml(
          row.description || row.summary || row[dataset.columns[1]] || "",
        );
        const price = this.escapeHtml(row.price || "");
        const url = this.escapeAttribute(row.url || "");
        const image = this.escapeAttribute(row.image || "");
        return `<article class="card">
          ${image ? `<img src="${image}" alt="" />` : ""}
          <div class="content">
            <h2>${heading}</h2>
            ${price ? `<strong>${price}</strong>` : ""}
            <p>${description}</p>
            ${url ? `<a href="${url}">Open source</a>` : ""}
          </div>
        </article>`;
      })
      .join("\n");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${this.escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #161616;
        background: #fbfbfc;
      }
      main { max-width: 1100px; margin: 0 auto; padding: 36px 20px 56px; }
      header { margin-bottom: 24px; }
      h1 { margin: 0 0 8px; font-size: clamp(2rem, 5vw, 4rem); letter-spacing: 0; line-height: 1; }
      .source { color: #666; font-size: .95rem; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
      .card {
        overflow: hidden;
        border: 1px solid #dedee6;
        border-radius: 8px;
        background: white;
        box-shadow: 0 8px 24px rgba(20,20,20,.06);
      }
      img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; background: #eee; }
      .content { padding: 14px; }
      h2 { margin: 0 0 8px; font-size: 1.02rem; line-height: 1.25; }
      strong { display: block; margin-bottom: 8px; color: #0f766e; }
      p { margin: 0 0 12px; color: #555; line-height: 1.45; }
      a { color: #4338ca; font-weight: 650; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${this.escapeHtml(title)}</h1>
        <div class="source">Built from ${this.escapeHtml(dataset.label)} on ${this.escapeHtml(new URL(dataset.sourceUrl).hostname || dataset.sourceUrl)}</div>
      </header>
      <section class="grid">${cards}</section>
    </main>
  </body>
</html>`;

    return this.artifact(
      run,
      "html",
      "HTML Microsite",
      "artifact.html",
      "html",
      html,
    );
  }

  private actionToPlaywright(action: AgentAction): string | null {
    if (action.kind === "navigate" && action.url) {
      return `await page.goto(${JSON.stringify(action.url)});`;
    }

    if (action.kind === "click" && action.selector) {
      return `await page.locator(${JSON.stringify(action.selector)}).click();`;
    }

    if (action.kind === "type" && action.selector) {
      return `await page.locator(${JSON.stringify(action.selector)}).fill(${JSON.stringify(action.text || "")});`;
    }

    if (action.kind === "press" && action.key) {
      return `await page.keyboard.press(${JSON.stringify(action.key)});`;
    }

    if (action.kind === "scroll") {
      const delta =
        action.direction === "up"
          ? -Math.abs(action.amount ?? 650)
          : Math.abs(action.amount ?? 650);
      return `await page.mouse.wheel(0, ${delta});`;
    }

    if (action.kind === "wait") {
      return `await page.waitForTimeout(${action.amount ?? 1000});`;
    }

    if (action.kind === "extract") {
      return `// Extract data: ${action.extractionGoal || action.label}`;
    }

    return null;
  }

  private artifact(
    run: TraceRun,
    kind: GeneratedArtifactKind,
    title: string,
    filename: string,
    language: GeneratedArtifact["language"],
    content: string,
  ): GeneratedArtifact {
    return {
      id: createId("artifact"),
      runId: run.id,
      kind,
      title,
      filename,
      language,
      content,
      createdAt: nowIso(),
    };
  }

  private titleFromGoal(goal: string): string {
    const trimmed = goal.trim().replace(/\s+/g, " ");
    return trimmed.length > 80
      ? `${trimmed.slice(0, 77)}...`
      : trimmed || "Blueberry workflow";
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }
}
