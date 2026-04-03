import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/20 px-4">
      <LoginForm />
    </main>
  );
}
