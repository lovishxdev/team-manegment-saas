import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/app-url";

/** Public indexable pages — app routes behind auth are excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  const lastModified = new Date();

  const comparePages = ["trello", "notion", "clickup", "spreadsheets", "taskrio"] as const;
  const guidePages = [
    "project-memory-dreaming",
    "manage-tasks-from-whatsapp",
    "hackathon-task-board",
    "claude-mcp-task-board",
  ] as const;

  const pages: MetadataRoute.Sitemap = [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    {
      url: `${base}/pricing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${base}/sih`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${base}/signup`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...guidePages.map((slug) => ({
      url: `${base}/guides/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    ...comparePages.map((slug) => ({
      url: `${base}/compare/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${base}/login`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  return pages;
}
