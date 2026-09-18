/**
 * Intermediate diagram DSL for vibe whiteboarding.
 * LLMs emit this (not raw Excalidraw JSON) so we can layout + compile
 * deterministically on the server without a browser DOM.
 */

export type VibeNodeKind = "box" | "rounded" | "diamond" | "note";

export type VibeLayout = "left-right" | "top-down" | "grid";

export type VibeNode = {
  id: string;
  label: string;
  kind?: VibeNodeKind;
};

export type VibeEdge = {
  from: string;
  to: string;
  label?: string;
};

export type VibeDiagram = {
  title?: string;
  nodes: VibeNode[];
  edges: VibeEdge[];
  layout?: VibeLayout;
};

export type VibeMode = "replace" | "append";

const MAX_NODES = 24;
const MAX_EDGES = 40;
const MAX_LABEL = 80;

function cleanId(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return cleaned || fallback;
}

function cleanLabel(raw: unknown): string {
  const text = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL);
  return text || "Untitled";
}

function asKind(raw: unknown): VibeNodeKind {
  if (raw === "rounded" || raw === "diamond" || raw === "note") return raw;
  return "box";
}

function asLayout(raw: unknown): VibeLayout {
  if (raw === "top-down" || raw === "grid") return raw;
  return "left-right";
}

/** Coerce/clamp model output into a safe diagram. */
export function normalizeVibeDiagram(raw: unknown): VibeDiagram {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim().slice(0, 120)
      : undefined;

  const nodeRows = Array.isArray(input.nodes) ? input.nodes : [];
  const nodes: VibeNode[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodeRows.length && nodes.length < MAX_NODES; i++) {
    const row = nodeRows[i];
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const id = cleanId(String(obj.id ?? `n${i + 1}`), `n${i + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({
      id,
      label: cleanLabel(obj.label ?? obj.text ?? id),
      kind: asKind(obj.kind),
    });
  }

  const edgeRows = Array.isArray(input.edges) ? input.edges : [];
  const edges: VibeEdge[] = [];
  for (let i = 0; i < edgeRows.length && edges.length < MAX_EDGES; i++) {
    const row = edgeRows[i];
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const from = cleanId(String(obj.from ?? ""), "");
    const to = cleanId(String(obj.to ?? ""), "");
    if (!from || !to || from === to) continue;
    if (!seen.has(from) || !seen.has(to)) continue;
    const label =
      typeof obj.label === "string" && obj.label.trim()
        ? cleanLabel(obj.label)
        : undefined;
    edges.push({ from, to, label });
  }

  return {
    title,
    nodes,
    edges,
    layout: asLayout(input.layout),
  };
}
