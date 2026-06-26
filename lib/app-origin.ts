import { headers } from "next/headers";

/** Public app origin (works behind Vercel/ngrok via forwarded headers). */
export async function getAppOrigin(): Promise<string> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function getMcpConnectorUrl(): Promise<string> {
  return `${await getAppOrigin()}/api/mcp`;
}
