import { promises as fs } from "fs";
import path from "path";

interface Finding {
  file: string;
  line: number | null;
  message: string;
  severity: "low" | "medium" | "high";
  suggestion: string;
}

interface FindingsMap {
  duplicateProviders: Finding[];
  legacyEndpoints: Finding[];
  unsafeFetches: Finding[];
  missingPreventDefault: Finding[];
  pointerEventsNone: Finding[];
  overlays: Finding[];
  envConflicts: Finding[];
}

const findings: FindingsMap = {
  duplicateProviders: [],
  legacyEndpoints: [],
  unsafeFetches: [],
  missingPreventDefault: [],
  pointerEventsNone: [],
  overlays: [],
  envConflicts: [],
};

const root = process.cwd();
const scanExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".json", ".md"]);
const skipDirs = new Set(["node_modules", ".next", "reports", ".git", "supabase", "coverage"]);

async function walk(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith(".")) return;
      if (skipDirs.has(entry.name)) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (scanExtensions.has(path.extname(entry.name))) {
        await analyzeFile(fullPath);
      }
    }),
  );
}

function recordFinding(kind: keyof FindingsMap, finding: Finding) {
  findings[kind].push(finding);
}

function findLineNumber(content: string, match: string): number | null {
  const index = content.indexOf(match);
  if (index === -1) return null;
  const lines = content.slice(0, index).split(/\r?\n/);
  return lines.length;
}

function analyzeProviders(file: string, content: string) {
  if (file.startsWith("tests/")) {
    return;
  }
  const patterns = [/GROQ_/g, /ANTHROPIC_/g, /MOONSHOT/g];
  if (patterns.some((pattern) => pattern.test(content))) {
    recordFinding("duplicateProviders", {
      file,
      line: null,
      message: "Detected legacy provider keys (GROQ/ANTHROPIC/MOONSHOT)",
      severity: "medium",
      suggestion: "Remove unused provider env vars and ensure OpenAI is the single LLM provider.",
    });
  }
  if (/LLM_PROVIDER\s*=\s*(?!\"?openai\"?)/i.test(content) && !file.endsWith("package.json")) {
    recordFinding("envConflicts", {
      file,
      line: findLineNumber(content, "LLM_PROVIDER"),
      message: "LLM_PROVIDER set to non-openai value",
      severity: "medium",
      suggestion: "Normalize LLM_PROVIDER to 'openai' or remove overrides.",
    });
  }
}

function analyzeLegacyEndpoints(file: string, content: string) {
  const matches = content.match(/\/api\/(?:ai|v1)\//g);
  if (matches) {
    recordFinding("legacyEndpoints", {
      file,
      line: findLineNumber(content, "/api/"),
      message: "Legacy API namespace detected",
      severity: "medium",
      suggestion: "Route traffic through /api/chat or update docs to new namespace.",
    });
  }
}

function analyzeFetches(file: string, content: string) {
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes("fetch(")) return;
    const snippet = lines.slice(index, index + 5).join(" ");
    if (/health-check.ts/.test(file)) return;
    if (/signal\s*:/i.test(snippet) || /AbortController/.test(content.slice(0, Math.max(0, content.length)))) {
      return;
    }
    recordFinding("unsafeFetches", {
      file,
      line: index + 1,
      message: "fetch call missing abort signal or timeout",
      severity: "low",
      suggestion: "Wrap fetch with AbortController or timeout guard.",
    });
  });
}

function analyzeForms(file: string, content: string) {
  const regex = /onSubmit=\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    const handler = match[1];
    if (!handler.includes("=>")) {
      continue;
    }
    if (!/preventDefault\s*\(/.test(handler)) {
      recordFinding("missingPreventDefault", {
        file,
        line: findLineNumber(content, match[0]),
        message: "Form onSubmit handler missing preventDefault",
        severity: "low",
        suggestion: "Call event.preventDefault() to avoid double navigation.",
      });
    }
  }
}

function analyzePointerEvents(file: string, content: string) {
  if (content.includes("pointer-events-none")) {
    recordFinding("pointerEventsNone", {
      file,
      line: findLineNumber(content, "pointer-events-none"),
      message: "Found pointer-events-none class",
      severity: "low",
      suggestion: "Ensure this class does not block interactive controls.",
    });
  }
  if (/z-\[?9\d{2}/.test(content) || /z-50/.test(content)) {
    recordFinding("overlays", {
      file,
      line: findLineNumber(content, "z-"),
      message: "High z-index detected",
      severity: "low",
      suggestion: "Confirm overlay layering does not block chat interactions.",
    });
  }
}

async function analyzeFile(fullPath: string) {
  const relative = path.relative(root, fullPath);
  if (relative === "scripts/health-check.ts" || relative === "docs/codex-audit.md") {
    return;
  }
  const content = await fs.readFile(fullPath, "utf8");
  analyzeProviders(relative, content);
  analyzeLegacyEndpoints(relative, content);
  analyzeFetches(relative, content);
  analyzeForms(relative, content);
  analyzePointerEvents(relative, content);
}

function summarize() {
  const summary: Record<string, number> = {};
  (Object.keys(findings) as Array<keyof FindingsMap>).forEach((key) => {
    summary[key] = findings[key].length;
  });
  return summary;
}

async function writeReports() {
  const summary = summarize();
  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    findings,
  };
  await fs.mkdir(path.join(root, "reports"), { recursive: true });
  await fs.writeFile(path.join(root, "reports/health.json"), JSON.stringify(payload, null, 2));

  const priorityOrder: Array<keyof FindingsMap> = [
    "duplicateProviders",
    "envConflicts",
    "legacyEndpoints",
    "unsafeFetches",
    "missingPreventDefault",
    "overlays",
    "pointerEventsNone",
  ];

  let markdown = `# Codex Audit\n\nGenerated: ${payload.generatedAt}\n\n`;
  markdown += "## Summary\n\n";
  markdown += "| Category | Findings |\n";
  markdown += "| --- | --- |\n";
  priorityOrder.forEach((key) => {
    markdown += `| ${key} | ${summary[key]} |\n`;
  });

  markdown += "\n## Findings\n\n";
  priorityOrder.forEach((key) => {
    const list = findings[key];
    if (list.length === 0) {
      markdown += `### ${key}\n- _No findings_\n\n`;
      return;
    }
    markdown += `### ${key}\n`;
    list.forEach((item) => {
      const location = item.line ? `${item.file}:${item.line}` : item.file;
      markdown += `- (${item.severity}) **${location}** — ${item.message}. _Suggestion:_ ${item.suggestion}\n`;
    });
    markdown += "\n";
  });

  markdown += "## Prioritized Checklist\n\n";
  priorityOrder.forEach((key) => {
    const done = findings[key].length === 0;
    const label = key.replace(/([a-z])([A-Z])/g, "$1 $2");
    markdown += `${done ? "[x]" : "[ ]"} ${label}\n`;
  });

  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.writeFile(path.join(root, "docs/codex-audit.md"), markdown.trim() + "\n");
}

(async function main() {
  await walk(root);
  await writeReports();
})();
