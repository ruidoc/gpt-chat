"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "登录失败，请稍后再试。");
        return;
      }

      router.replace("/chat");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border bg-background/95 p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-semibold tracking-tight">
          登录 DataTalk
        </h1>
        <p className="text-sm text-muted-foreground">
          只开放已有账号登录，账号由后台手动维护。
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-foreground">邮箱</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-foreground">密码</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 rounded-xl border bg-background px-3 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          placeholder="请输入密码"
          required
        />
      </label>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "登录中..." : "登录"}
      </Button>
    </form>
  );
}
