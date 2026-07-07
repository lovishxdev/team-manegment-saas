import { NotFoundContent } from "@/components/errors/not-found-content";

/** 404 for public workspace routes outside the app shell (e.g. whiteboard). */
export default function PublicWorkspaceNotFound() {
  return <NotFoundContent />;
}
