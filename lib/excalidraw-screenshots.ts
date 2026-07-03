import "server-only";

import type { Browser } from "puppeteer-core";
import { getAppBaseUrl } from "@/lib/app-url";
import { ASSETS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";
import { ServiceError } from "@/lib/services/project";

export const MAX_WHITEBOARD_SCREENSHOTS = 5;

/** Shown to users — never include internal paths or stack traces. */
export const WHITEBOARD_EXPORT_USER_ERROR =
  "Could not export the whiteboard right now. Please try again in a moment.";

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_REMOTE_EXEC_PATH ??
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

export type ExcalidrawPersistedState = {
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown> | null;
};

export type WhiteboardRenderResult = {
  images: Buffer[];
  empty: boolean;
};

async function launchBrowser(): Promise<Browser> {
  const isVercel = process.env.VERCEL === "1";

  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = await import("puppeteer-core");
    chromium.setGraphicsMode = false;

    const viewport = {
      deviceScaleFactor: 1,
      hasTouch: false,
      height: 1080,
      isLandscape: true,
      isMobile: false,
      width: 1920,
    };

    return puppeteer.default.launch({
      args: await puppeteer.defaultArgs({
        args: chromium.args,
        headless: "shell",
      }),
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: "shell",
    });
  }

  try {
    const puppeteer = await import("puppeteer");
    return puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch {
    const puppeteer = await import("puppeteer-core");
    return puppeteer.default.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
}

/**
 * Renders up to 5 PNG tiles from persisted Excalidraw JSON using headless
 * Chromium + the static export page (official exportToBlob in a real browser).
 */
export async function renderWhiteboardScreenshots(
  state: ExcalidrawPersistedState
): Promise<WhiteboardRenderResult> {
  const baseUrl = getAppBaseUrl();
  const exportUrl = `${baseUrl.replace(/\/$/, "")}/whiteboard-export.html`;

  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    page.setDefaultTimeout(90_000);

    await page.goto(exportUrl, { waitUntil: "networkidle0", timeout: 90_000 });
    await page.waitForFunction(
      () =>
        typeof (window as unknown as { __renderWhiteboard?: unknown })
          .__renderWhiteboard === "function",
      { timeout: 60_000 }
    );

    const payload = {
      elements: state.elements ?? [],
      appState: state.appState ?? {},
      files: state.files ?? null,
    };

    const result = await page.evaluate(async (raw: typeof payload) => {
      const fn = (
        window as unknown as {
          __renderWhiteboard: (data: typeof raw) => Promise<{
            images: string[];
            empty: boolean;
          }>;
        }
      ).__renderWhiteboard;
      return fn(raw);
    }, payload);

    if (result.empty) {
      return { images: [], empty: true };
    }

    const images = result.images
      .slice(0, MAX_WHITEBOARD_SCREENSHOTS)
      .map((b64: string) => Buffer.from(b64, "base64"));

    if (images.length === 0) {
      return { images: [], empty: true };
    }

    return { images, empty: false };
  } catch (err) {
    console.error(
      "[whiteboard] render failed:",
      err instanceof Error ? err.message : err
    );
    throw new ServiceError(WHITEBOARD_EXPORT_USER_ERROR, "INVALID_INPUT");
  } finally {
    await browser?.close().catch(() => {});
  }
}

/** Upload rendered tiles to workspace storage; returns public URLs (MCP). */
export async function uploadWhiteboardImages(
  workspaceId: string,
  images: Buffer[]
): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const stamp = Date.now();
  const urls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const path = `whiteboard/${workspaceId}/${stamp}-${i + 1}.png`;
    const { error } = await supabase.storage
      .from(ASSETS_BUCKET)
      .upload(path, images[i], {
        contentType: "image/png",
        upsert: true,
      });
    if (error) {
      console.error("[whiteboard] upload failed:", error.message);
      throw new ServiceError(WHITEBOARD_EXPORT_USER_ERROR, "UPLOAD_FAILED");
    }
    const { data } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}
