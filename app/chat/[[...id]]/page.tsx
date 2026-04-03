import { redirect } from "next/navigation";

import { Assistant } from "../../assistant";
import { getCurrentUser } from "@/lib/auth";

const INVALID_THREAD_IDS = new Set(["DEFAULT_THREAD_ID", "__DEFAULT_ID__"]);

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id?: string[] }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const threadId = id?.[0];

  if (threadId && INVALID_THREAD_IDS.has(threadId)) {
    redirect("/chat");
  }

  return (
    <Assistant
      initialThreadId={threadId}
      currentUserLabel={user.name || user.email}
    />
  );
}
