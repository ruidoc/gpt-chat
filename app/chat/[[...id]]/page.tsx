import { redirect } from "next/navigation";

import { Assistant } from "../../assistant";
import { getCurrentUser } from "@/lib/auth";

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

  return (
    <Assistant
      initialThreadId={threadId}
      currentUserLabel={user.name || user.email}
    />
  );
}
