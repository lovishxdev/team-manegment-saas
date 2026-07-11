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
  title?: string;
  tags?: string[];
};

export type PersistedMemoryDocument = MemoryDocumentInput & {
  documentId: string;
  title: string;
  tags: string[];
};

export type MemoryDocumentListItem = {
  id: string;
  path: string;
  title: string;
  tags: string[];
  contentHash: string;
  updatedAt: Date;
  author: { username: string; email: string | null } | null;
  eventCount: number;
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
  if (!normalized) return null;
  const hasFrontmatter = normalized.startsWith("---\n");
  const end = hasFrontmatter ? normalized.indexOf("\n---", 4) : -1;
  const frontmatter = end >= 0 ? normalized.slice(4, end) : "";
  // Authors can explicitly opt a changed Markdown file out.
  if (/^euclis-memory:\s*false\s*$/im.test(frontmatter)) return null;

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
  const body = end >= 0 ? normalized.slice(end + 4).trim() : normalized;
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
    const title = (
      document.title ||
      parsed.title ||
      fallbackTitle(document.path)
    ).slice(0, 200);
    const tags = normalizeMemoryTags(
      document.tags && document.tags.length > 0
        ? [...parsed.tags, ...document.tags]
        : parsed.tags
    );

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
        tags,
        authorId: input.userId,
      },
      create: {
        workspaceId: input.workspaceId,
        path: document.path,
        title,
        content: parsed.body,
        contentHash: hash,
        tags,
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

export async function listMemoryDocuments(input: {
  workspaceId: string;
  userId: string;
  limit?: number;
}): Promise<MemoryDocumentListItem[]> {
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

  const rows = await prisma.memoryDocument.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 24, 1), 100),
    select: {
      id: true,
      path: true,
      title: true,
      tags: true,
      contentHash: true,
      updatedAt: true,
      author: { select: { username: true, email: true } },
      _count: { select: { events: true } },
    },
  });
  return rows.map(({ _count, ...row }) => ({
    ...row,
    eventCount: _count.events,
  }));
}

/** Remove only snapshots with no event provenance; repository files untouched. */
export async function removeUnlinkedMemoryDocuments(input: {
  workspaceId: string;
  paths: string[];
}): Promise<number> {
  if (input.paths.length === 0) return 0;
  const result = await prisma.memoryDocument.deleteMany({
    where: {
      workspaceId: input.workspaceId,
      path: { in: input.paths },
      events: { none: {} },
    },
  });
  return result.count;
}

export async function recordMemoryDocumentReviews(input: {
  workspaceId: string;
  reviews: {
    path: string;
    content: string;
    accepted: boolean;
    reason: string;
    explicit: boolean;
    title?: string;
  }[];
}): Promise<void> {
  if (input.reviews.length === 0) return;
  await prisma.$transaction(
    input.reviews.map((review) => {
      const contentHash = crypto
        .createHash("sha256")
        .update(review.content)
        .digest("hex");
      return prisma.memoryDocumentReview.upsert({
        where: {
          workspaceId_path: {
            workspaceId: input.workspaceId,
            path: review.path,
          },
        },
        update: {
          contentHash,
          title: review.title?.slice(0, 200) ?? null,
          accepted: review.accepted,
          reason: review.reason.slice(0, 1000),
          explicit: review.explicit,
          reviewedAt: new Date(),
        },
        create: {
          workspaceId: input.workspaceId,
          path: review.path,
          contentHash,
          title: review.title?.slice(0, 200) ?? null,
          accepted: review.accepted,
          reason: review.reason.slice(0, 1000),
          explicit: review.explicit,
        },
      });
    })
  );
}
