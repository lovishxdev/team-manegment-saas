import { NotFoundContent } from "@/components/errors/not-found-content";

/** 404 for invalid / inaccessible workspace routes (inside app shell). */
export default function WorkspaceNotFound() {
  return <NotFoundContent compact />;
}
