import { getCurrentUser } from "@/lib/auth";
import { loadThreadMessagesByUser } from "@/lib/chat-db";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/threads/[id]/messages">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const messages = await loadThreadMessagesByUser(user.id, id);

  if (!messages) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  return Response.json({ messages });
}
