import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/settings",
        "/w/",
        "/invite/",
        "/oauth/",
        "/api/",
        "/auth/",
        "/marketing/",
        "/demo1",
        "/demo2",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
