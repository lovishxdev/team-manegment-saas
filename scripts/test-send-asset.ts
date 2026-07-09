/**
 * Asset download path parsing for WhatsApp send_asset.
 * Run: npx tsx scripts/test-send-asset.ts
 */
import { assetFileName, assetStoragePathFromUrl } from "../lib/services/project";

let failed = 0;

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.log(`✗ ${label}`);
    failed++;
  } else {
    console.log(`✓ ${label}`);
  }
}

const url =
  "https://example.supabase.co/storage/v1/object/public/assets/ws-1/1710000000-features_summary_trimmed.pdf";

assert(
  "parses storage path",
  assetStoragePathFromUrl(url) === "ws-1/1710000000-features_summary_trimmed.pdf"
);

assert(
  "extracts file name",
  assetFileName(url) === "features_summary_trimmed.pdf"
);

assert(
  "unknown host returns null path",
  assetStoragePathFromUrl("https://cdn.example.com/file.pdf") === null
);

console.log(
  failed === 0 ? "\nAll send-asset checks passed." : `\n${failed} FAILURES`
);
process.exit(failed === 0 ? 0 : 1);
