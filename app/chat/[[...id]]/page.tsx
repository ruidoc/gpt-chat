import { Assistant } from "../../assistant";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id?: string[] }>;
}) {
  const { id } = await params;
  const threadId = id?.[0];

  return <Assistant initialThreadId={threadId} />;
}
