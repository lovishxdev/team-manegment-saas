import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/settings",
        "/w/",
        "/invite/",
        "/oauth/",
        "/api/",
        "/auth/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
