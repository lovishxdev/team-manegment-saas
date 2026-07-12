// Config for the Remotion CLI only (`npx remotion studio` / `render`).
// Next.js never reads this file.
import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.setEntryPoint("./remotion/index.ts");

// Remotion bundles with its own webpack (not Next's), so mirror the tsconfig
// `@/*` path alias here and layer Tailwind v4 on top.
Config.overrideWebpackConfig((currentConfig) => {
  const withTailwind = enableTailwind(currentConfig);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve?.alias ?? {}),
        "@": path.resolve(process.cwd()),
        // Reused landing components pull in next/image, which needs the Next
        // runtime. Swap in a plain <img> shim for the standalone CLI bundle.
        "next/image$": path.resolve(process.cwd(), "remotion/next-image-shim.tsx"),
      },
    },
  };
});
