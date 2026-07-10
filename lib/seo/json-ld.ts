import { HOME_FAQ } from "./faq";
import { SITE_NAME, siteUrl } from "./site";

export type BreadcrumbItem = {
  name: string;
  path: string;
};

const PUBLISHED = "2026-07-01";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl(),
    logo: siteUrl("/euclis-logo.png"),
    description:
      "Shared project memory for teams and AI agents — capture from WhatsApp, Claude, Cursor, and the web; Dreaming keeps context current.",
    sameAs: [],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["euclis.dev"],
    url: siteUrl(),
    description:
      "Project memory for teams and AI agents. Capture decisions and blockers where work happens; share one brief via MCP.",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: siteUrl("/euclis-logo.png"),
      },
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl(),
    description:
      "Shared project memory for humans and coding agents. Captures decisions, blockers, and milestones from chat and editors; Dreaming maintains the store; MCP shares one brief.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Hobby free forever — email signup, no credit card required",
    },
    featureList: [
      "Project memory (decisions, blockers, milestones)",
      "Dreaming — scheduled memory maintenance",
      "Capture from WhatsApp, Claude, Cursor, and web",
      "MCP connector with get_project_context",
      "Team discussions for humans and agents",
      "Kanban board with short task IDs",
      "WhatsApp 1:1 assistant",
      "Free Hobby tier",
    ],
  };
}

export function faqPageJsonLd(items = HOME_FAQ) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function breadcrumbsJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}

export function articleJsonLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
  dateModified?: string;
}) {
  const published = input.datePublished ?? PUBLISHED;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    url: siteUrl(input.path),
    datePublished: published,
    dateModified: input.dateModified ?? published,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: siteUrl(),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: siteUrl("/euclis-logo.png"),
      },
    },
  };
}

export function howToJsonLd(input: {
  name: string;
  description: string;
  path: string;
  steps: { name: string; text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    url: siteUrl(input.path),
    step: input.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export const guideBreadcrumbs = (title: string, path: string): BreadcrumbItem[] => [
  { name: "Home", path: "/" },
  { name: "Guides", path: "/guides/manage-tasks-from-whatsapp" },
  { name: title, path },
];

export const compareBreadcrumbs = (title: string, path: string): BreadcrumbItem[] => [
  { name: "Home", path: "/" },
  { name: "Compare", path: "/compare/trello" },
  { name: title, path },
];
