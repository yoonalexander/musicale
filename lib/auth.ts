import { redirect } from "next/navigation";

import { getViewerState } from "@/lib/data";

export async function requireAdmin() {
  const viewer = await getViewerState();

  if (!viewer.user || !viewer.isAdmin) {
    redirect("/login?message=Admin+access+required");
  }

  return viewer;
}
