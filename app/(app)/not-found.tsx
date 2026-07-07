import { NotFoundContent } from "@/components/errors/not-found-content";

/** 404 inside the authenticated app shell (sidebar stays visible). */
export default function AppNotFound() {
  return <NotFoundContent compact />;
}
