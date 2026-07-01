import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Sign up free",
  description:
    "Create a free Euclis account. Shared kanban task board for small teams — web, WhatsApp, and Claude MCP. Email signup, no credit card required.",
  path: "/signup",
});

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
