type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Renders schema.org JSON-LD for crawlers and LLM extractors. */
export function JsonLd({ data }: JsonLdProps) {
  const items = Array.isArray(data) ? data : [data];

  // One object per script tag — top-level JSON arrays break consumers that
  // expect r["@context"] on the parsed root (browser extensions, rich-result parsers).
  return (
    <>
      {items.map((item, index) => (
        <script
          key={`${String(item["@type"] ?? "schema")}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
