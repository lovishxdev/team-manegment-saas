import type { Metadata } from "next";
import { DEFAULT_DESCRIPTION, SITE_NAME, siteUrl } from "./site";

type PageMetadataInput = {
  title: string;
  description?: string;
  path?: string;
  /** Set false on pages that should not be indexed (e.g. duplicate aliases). */
  index?: boolean;
  ogImageAlt?: string;
};

export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  index = true,
  ogImageAlt = `${SITE_NAME} — project memory for teams and agents`,
}: PageMetadataInput): Metadata {
  const canonical = siteUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} | Project memory for teams and AI agents`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: siteUrl() }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl(),
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Project memory for teams and AI agents`,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Euclis — project memory for teams and AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Project memory for teams and AI agents`,
    description: DEFAULT_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};
