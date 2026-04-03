import { getCurrentUser } from "@/lib/auth";
import { listThreadsByUser } from "@/lib/chat-db";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await listThreadsByUser(user.id);

  return Response.json({ threads });
}
