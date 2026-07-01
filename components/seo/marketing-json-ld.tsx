import { JsonLd } from "@/components/seo/json-ld";
import {
  articleJsonLd,
  breadcrumbsJsonLd,
  type BreadcrumbItem,
} from "@/lib/seo/json-ld";

type MarketingJsonLdProps = {
  title: string;
  description: string;
  path: string;
  breadcrumbs: BreadcrumbItem[];
  extra?: Record<string, unknown> | Record<string, unknown>[];
};

/** Article + BreadcrumbList JSON-LD for guides and comparison pages. */
export function MarketingJsonLd({
  title,
  description,
  path,
  breadcrumbs,
  extra,
}: MarketingJsonLdProps) {
  const schemas: Record<string, unknown>[] = [
    articleJsonLd({ title, description, path }),
    breadcrumbsJsonLd(breadcrumbs),
  ];

  if (extra) {
    const extras = Array.isArray(extra) ? extra : [extra];
    schemas.push(...extras);
  }

  return <JsonLd data={schemas} />;
}
