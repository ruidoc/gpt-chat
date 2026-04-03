import { getCurrentUser } from "@/lib/auth";
import { softDeleteThreadByUser } from "@/lib/chat-db";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/threads/[id]">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await softDeleteThreadByUser(user.id, id);

  if (!deleted) {
    return Response.json({ error: "Thread not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
