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
      "Free team task board for small groups — web kanban, WhatsApp assistant, and Claude MCP connector in one workspace.",
    sameAs: [],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl(),
    description:
      "Free team task board for small groups — web, WhatsApp, and Claude MCP.",
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
      "Free shared kanban task board reachable from a web dashboard, WhatsApp messages, or Claude MCP. Real-time sync for small teams.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free to start — email signup, no credit card required",
    },
    featureList: [
      "Drag-and-drop kanban board",
      "Real-time sync across web and WhatsApp",
      "WhatsApp natural-language task commands",
      "Claude MCP connector",
      "Multiplayer whiteboard",
      "Shared assets and file uploads",
      "Per-workspace task short IDs",
      "Free tier with email-only signup",
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
