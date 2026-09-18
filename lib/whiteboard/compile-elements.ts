import type { VibeDiagram, VibeNode, VibeNodeKind } from "@/lib/whiteboard/diagram";

/** Minimal Excalidraw element shape we persist into Workspace.excalidrawState. */
export type CompiledElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { id: string; type: "text" | "arrow" }[] | null;
  updated: number;
  link: null;
  locked: boolean;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  originalText?: string;
  autoResize?: boolean;
  lineHeight?: number;
  // linear
  points?: [number, number][];
  lastCommittedPoint?: null;
  startBinding?: Binding | null;
  endBinding?: Binding | null;
  startArrowhead?: null;
  endArrowhead?: "arrow" | null;
  index?: string;
};

type Binding = {
  elementId: string;
  focus: number;
  gap: number;
};

const STROKE = "#1e1e1e";
const FILL_BOX = "#f8f7f4";
const FILL_NOTE = "#fff3bf";
const FILL_DIAMOND = "#e7f5ff";
const FILL_TITLE = "transparent";

const NODE_W = 210;
const NODE_H = 78;
const H_GAP = 90;
const V_GAP = 70;
const FONT_SIZE = 18;
const TITLE_SIZE = 28;

function randNonce(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function nextIndex(n: number): string {
  // Fractional indices: a0, a1, ... — good enough for z-order.
  return `a${n.toString(36)}`;
}

function shapeType(kind: VibeNodeKind | undefined): "rectangle" | "diamond" {
  return kind === "diamond" ? "diamond" : "rectangle";
}

function fillFor(kind: VibeNodeKind | undefined): string {
  if (kind === "note") return FILL_NOTE;
  if (kind === "diamond") return FILL_DIAMOND;
  return FILL_BOX;
}

function roundnessFor(
  kind: VibeNodeKind | undefined
): { type: number } | null {
  if (kind === "diamond") return null;
  if (kind === "rounded" || kind === "note") return { type: 3 };
  return { type: 3 };
}

type Positioned = VibeNode & { x: number; y: number };

function layoutNodes(diagram: VibeDiagram): Positioned[] {
  const nodes = diagram.nodes;
  if (nodes.length === 0) return [];

  const layout = diagram.layout ?? "left-right";
  const titleOffset = diagram.title ? 70 : 0;

  if (layout === "grid") {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((node, i) => ({
      ...node,
      x: (i % cols) * (NODE_W + H_GAP),
      y: Math.floor(i / cols) * (NODE_H + V_GAP) + titleOffset,
    }));
  }

  // Kahn layering: roots first, then children.
  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const indeg = new Map(ids.map((id) => [id, 0]));
  const outs = new Map(ids.map((id) => [id, [] as string[]]));
  for (const edge of diagram.edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to) || edge.from === edge.to) {
      continue;
    }
    indeg.set(edge.to, (indeg.get(edge.to) ?? 0) + 1);
    outs.get(edge.from)!.push(edge.to);
  }

  const layers: string[][] = [];
  let frontier = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  if (frontier.length === 0) frontier = [...ids];
  const remaining = new Set(ids);

  while (frontier.length > 0 && remaining.size > 0) {
    const layer = frontier.filter((id) => remaining.has(id));
    if (layer.length === 0) break;
    layers.push(layer);
    for (const id of layer) remaining.delete(id);

    for (const id of layer) {
      for (const to of outs.get(id) ?? []) {
        if (!remaining.has(to)) continue;
        indeg.set(to, Math.max(0, (indeg.get(to) ?? 0) - 1));
      }
    }
    frontier = [...remaining].filter((id) => (indeg.get(id) ?? 0) <= 0);
    if (frontier.length === 0 && remaining.size > 0) {
      // Cycle / leftover — dump remaining as one layer.
      layers.push([...remaining]);
      remaining.clear();
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const positioned: Positioned[] = [];

  if (layout === "top-down") {
    layers.forEach((layer, row) => {
      const width = layer.length * NODE_W + Math.max(0, layer.length - 1) * H_GAP;
      const startX = -width / 2;
      layer.forEach((id, col) => {
        const node = byId.get(id);
        if (!node) return;
        positioned.push({
          ...node,
          x: startX + col * (NODE_W + H_GAP),
          y: titleOffset + row * (NODE_H + V_GAP),
        });
      });
    });
  } else {
    layers.forEach((layer, col) => {
      const height =
        layer.length * NODE_H + Math.max(0, layer.length - 1) * V_GAP;
      const startY = titleOffset + Math.max(0, -height / 2 + NODE_H);
      layer.forEach((id, row) => {
        const node = byId.get(id);
        if (!node) return;
        positioned.push({
          ...node,
          x: col * (NODE_W + H_GAP),
          y: startY + row * (NODE_H + V_GAP),
        });
      });
    });
  }

  return positioned;
}

function baseElement(
  partial: Omit<
    CompiledElement,
    | "angle"
    | "strokeStyle"
    | "opacity"
    | "groupIds"
    | "frameId"
    | "isDeleted"
    | "updated"
    | "link"
    | "locked"
    | "version"
  > &
    Partial<CompiledElement>
): CompiledElement {
  const now = Date.now();
  return {
    angle: 0,
    strokeStyle: "solid",
    opacity: 100,
    groupIds: [],
    frameId: null,
    isDeleted: false,
    updated: now,
    link: null,
    locked: false,
    version: 1,
    ...partial,
  };
}

/**
 * Compile a vibe diagram into Excalidraw elements ready for persistence.
 * Returns elements with stable z-order indices.
 */
export function compileVibeDiagram(
  diagram: VibeDiagram,
  options?: { offsetX?: number; offsetY?: number; indexStart?: number }
): CompiledElement[] {
  const offsetX = options?.offsetX ?? 40;
  const offsetY = options?.offsetY ?? 40;
  let index = options?.indexStart ?? 0;
  const elements: CompiledElement[] = [];
  const positioned = layoutNodes(diagram);
  const shapeByNodeId = new Map<string, CompiledElement>();

  if (diagram.title) {
    const titleId = `title_${randNonce().toString(36)}`;
    elements.push(
      baseElement({
        id: titleId,
        type: "text",
        x: offsetX,
        y: offsetY,
        width: Math.max(320, diagram.title.length * 16),
        height: 40,
        strokeColor: STROKE,
        backgroundColor: FILL_TITLE,
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 1,
        roundness: null,
        seed: randNonce(),
        versionNonce: randNonce(),
        boundElements: null,
        text: diagram.title,
        originalText: diagram.title,
        fontSize: TITLE_SIZE,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        containerId: null,
        autoResize: true,
        lineHeight: 1.25,
        index: nextIndex(index++),
      })
    );
  }

  for (const node of positioned) {
    const shapeId = `shape_${node.id}_${randNonce().toString(36)}`;
    const textId = `text_${node.id}_${randNonce().toString(36)}`;
    const x = offsetX + node.x;
    const y = offsetY + node.y;
    const shape = baseElement({
      id: shapeId,
      type: shapeType(node.kind),
      x,
      y,
      width: NODE_W,
      height: NODE_H,
      strokeColor: STROKE,
      backgroundColor: fillFor(node.kind),
      fillStyle: "hachure",
      strokeWidth: 2,
      roughness: 1,
      roundness: roundnessFor(node.kind),
      seed: randNonce(),
      versionNonce: randNonce(),
      boundElements: [{ id: textId, type: "text" }],
      index: nextIndex(index++),
    });
    const text = baseElement({
      id: textId,
      type: "text",
      x: x + 12,
      y: y + NODE_H / 2 - FONT_SIZE,
      width: NODE_W - 24,
      height: FONT_SIZE * 2.2,
      strokeColor: STROKE,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      roundness: null,
      seed: randNonce(),
      versionNonce: randNonce(),
      boundElements: null,
      text: node.label,
      originalText: node.label,
      fontSize: FONT_SIZE,
      fontFamily: 1,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: shapeId,
      autoResize: false,
      lineHeight: 1.25,
      index: nextIndex(index++),
    });
    elements.push(shape, text);
    shapeByNodeId.set(node.id, shape);
  }

  for (const edge of diagram.edges) {
    const from = shapeByNodeId.get(edge.from);
    const to = shapeByNodeId.get(edge.to);
    if (!from || !to) continue;

    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const arrowId = `arrow_${edge.from}_${edge.to}_${randNonce().toString(36)}`;

    const arrow = baseElement({
      id: arrowId,
      type: "arrow",
      x: startX,
      y: startY,
      width: dx,
      height: dy,
      strokeColor: STROKE,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 1,
      roundness: { type: 2 },
      seed: randNonce(),
      versionNonce: randNonce(),
      boundElements: null,
      points: [
        [0, 0],
        [dx, dy],
      ],
      lastCommittedPoint: null,
      startBinding: { elementId: from.id, focus: 0, gap: 4 },
      endBinding: { elementId: to.id, focus: 0, gap: 4 },
      startArrowhead: null,
      endArrowhead: "arrow",
      index: nextIndex(index++),
    });
    elements.push(arrow);

    from.boundElements = [
      ...(from.boundElements ?? []),
      { id: arrowId, type: "arrow" },
    ];
    to.boundElements = [
      ...(to.boundElements ?? []),
      { id: arrowId, type: "arrow" },
    ];

    if (edge.label) {
      const midX = startX + dx / 2;
      const midY = startY + dy / 2 - 14;
      elements.push(
        baseElement({
          id: `elabel_${arrowId}`,
          type: "text",
          x: midX - 40,
          y: midY,
          width: 80,
          height: 24,
          strokeColor: STROKE,
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          roundness: null,
          seed: randNonce(),
          versionNonce: randNonce(),
          boundElements: null,
          text: edge.label,
          originalText: edge.label,
          fontSize: 14,
          fontFamily: 1,
          textAlign: "center",
          verticalAlign: "middle",
          containerId: null,
          autoResize: true,
          lineHeight: 1.25,
          index: nextIndex(index++),
        })
      );
    }
  }

  return elements;
}

/** Bounding box of existing scene elements (for append offset). */
export function sceneBounds(elements: unknown[]): {
  maxY: number;
  maxX: number;
} {
  let maxY = 0;
  let maxX = 0;
  for (const raw of elements) {
    if (!raw || typeof raw !== "object") continue;
    const el = raw as {
      isDeleted?: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    if (el.isDeleted) continue;
    const x = Number(el.x) || 0;
    const y = Number(el.y) || 0;
    const w = Number(el.width) || 0;
    const h = Number(el.height) || 0;
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  return { maxX, maxY };
}
