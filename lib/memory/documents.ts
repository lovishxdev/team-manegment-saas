import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeMemoryTags } from "@/lib/services/memory";
import { ServiceError } from "@/lib/services/project";

export const MAX_MEMORY_DOCUMENTS = 12;
export const MAX_MEMORY_DOCUMENT_CHARS = 8_000;
export const MAX_MEMORY_DOCUMENT_TOTAL_CHARS = 48_000;

export type MemoryDocumentInput = {
  path: string;
  hash: string;
  content: string;
};

export type PersistedMemoryDocument = MemoryDocumentInput & {
  documentId: string;
  title: string;
  tags: string[];
};

type ParsedFrontmatter = {
  title?: string;
  tags: string[];
  body: string;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseMemoryDocument(content: string): ParsedFrontmatter | null {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return null;

  const frontmatter = normalized.slice(4, end);
  if (!/^euclis-memory:\s*true\s*$/im.test(frontmatter)) return null;

  const titleMatch = frontmatter.match(/^title:\s*(.+)$/im);
  const tagsMatch = frontmatter.match(/^tags:\s*(.*)$/im);
  let rawTags: string[] = [];
  if (tagsMatch?.[1]?.trim()) {
    rawTags = tagsMatch[1]
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map(unquote);
  } else if (tagsMatch) {
    const afterTags = frontmatter.slice(
      (tagsMatch.index ?? 0) + tagsMatch[0].length
    );
    for (const line of afterTags.split("\n")) {
      const item = line.match(/^\s*-\s*(.+)$/)?.[1];
      if (item) {
        rawTags.push(unquote(item));
      } else if (line.trim()) {
        break;
      }
    }
  }
  const body = normalized.slice(end + 4).trim();
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();

  return {
    title: titleMatch ? unquote(titleMatch[1]) : heading,
    tags: normalizeMemoryTags(rawTags),
    body,
  };
}

function fallbackTitle(path: string): string {
  const name = path.split("/").pop()?.replace(/\.md$/i, "") ?? "Memory document";
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function upsertMemoryDocuments(input: {
  workspaceId: string;
  userId: string;
  documents: MemoryDocumentInput[];
}): Promise<PersistedMemoryDocument[]> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    select: { role: true },
  });
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }
  if (membership.role === "GUEST") {
    throw new ServiceError(
      "Guests have read-only access to this workspace.",
      "FORBIDDEN"
    );
  }

  const persisted: PersistedMemoryDocument[] = [];
  let totalChars = 0;

  for (const document of input.documents.slice(0, MAX_MEMORY_DOCUMENTS)) {
    const content = document.content
      .trim()
      .slice(0, MAX_MEMORY_DOCUMENT_CHARS);
    if (!content || totalChars + content.length > MAX_MEMORY_DOCUMENT_TOTAL_CHARS) {
      break;
    }
    const parsed = parseMemoryDocument(content);
    if (!parsed) continue;

    // Trust content, not a client-supplied hash.
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    totalChars += content.length;
    const title = (parsed.title || fallbackTitle(document.path)).slice(0, 200);

    const row = await prisma.memoryDocument.upsert({
      where: {
        workspaceId_path: {
          workspaceId: input.workspaceId,
          path: document.path,
        },
      },
      update: {
        title,
        content: parsed.body,
        contentHash: hash,
        tags: parsed.tags,
        authorId: input.userId,
      },
      create: {
        workspaceId: input.workspaceId,
        path: document.path,
        title,
        content: parsed.body,
        contentHash: hash,
        tags: parsed.tags,
        authorId: input.userId,
      },
      select: {
        id: true,
        path: true,
        title: true,
        content: true,
        contentHash: true,
        tags: true,
      },
    });

    persisted.push({
      documentId: row.id,
      path: row.path,
      title: row.title,
      content: row.content,
      hash: row.contentHash,
      tags: row.tags,
    });
  }

  return persisted;
}

export async function getMemoryDocument(input: {
  workspaceId: string;
  userId: string;
  documentId: string;
}): Promise<{
  id: string;
  path: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: Date;
} | null> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    select: { userId: true },
  });
  if (!membership) {
    throw new ServiceError("You are not a member of this workspace", "FORBIDDEN");
  }

  return prisma.memoryDocument.findFirst({
    where: {
      id: input.documentId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      path: true,
      title: true,
      content: true,
      tags: true,
      updatedAt: true,
    },
  });
}
