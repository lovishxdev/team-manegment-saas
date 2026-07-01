import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Sign in",
  description:
    "Sign in to your Euclis workspace. Free team task board with web kanban, WhatsApp assistant, and Claude MCP sync.",
  path: "/login",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
