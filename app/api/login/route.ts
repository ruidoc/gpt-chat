import { z } from "zod";

import { setSessionCookie } from "@/lib/auth";
import { findUserByEmail, touchUserLastLogin } from "@/lib/chat-db";
import { verifyPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "请输入邮箱和密码。" },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(parsed.data.email);

  if (!user || user.status !== "active") {
    return Response.json(
      { error: "账号不存在或已停用。" },
      { status: 401 },
    );
  }

  const isValidPassword = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );

  if (!isValidPassword) {
    return Response.json(
      { error: "邮箱或密码错误。" },
      { status: 401 },
    );
  }

  await touchUserLastLogin(user.id);
  await setSessionCookie(user.id);

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}
