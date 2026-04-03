import "server-only";

import type { UIMessage } from "ai";
import type { PoolConnection } from "mysql2/promise";

import type { StoredThreadSummary } from "@/lib/chat-thread-store";
import {
  execute,
  executeWithConnection,
  getDb,
  query,
  queryWithConnection,
} from "@/lib/db";

type TimestampValue = Date | string;

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  status: "active" | "disabled";
  created_at: TimestampValue;
  last_login_at: TimestampValue | null;
};

type ThreadRow = {
  id: string;
  title: string | null;
  created_at: TimestampValue;
  updated_at: TimestampValue;
};

type MessageRow = {
  content_json: unknown;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "disabled";
};

const toMillis = (value: TimestampValue) =>
  value instanceof Date ? value.getTime() : new Date(value).getTime();

const deriveTitle = (messages: UIMessage[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const firstTextPart = firstUserMessage?.parts?.find((part) => part.type === "text");
  const title =
    firstTextPart && "text" in firstTextPart
      ? firstTextPart.text?.trim().replace(/\s+/g, " ")
      : undefined;

  return title?.slice(0, 40) || "新聊天";
};

const mapUser = (row: UserRow): AuthUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  status: row.status,
});

const parseStoredMessage = (value: unknown): UIMessage => {
  if (typeof value === "string") {
    return JSON.parse(value) as UIMessage;
  }

  return value as UIMessage;
};

export const findUserByEmail = async (email: string) => {
  const rows = await query<UserRow>(
    `
      select id, email, name, password_hash, status, created_at, last_login_at
      from users
      where lower(email) = lower(?)
      limit 1
    `,
    [email.trim()],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...mapUser(row),
    passwordHash: row.password_hash,
  };
};

export const getUserById = async (id: string) => {
  const rows = await query<UserRow>(
    `
      select id, email, name, password_hash, status, created_at, last_login_at
      from users
      where id = ?
      limit 1
    `,
    [id],
  );

  const row = rows[0];
  return row ? mapUser(row) : null;
};

export const touchUserLastLogin = async (id: string) => {
  await execute(
    `
      update users
      set last_login_at = current_timestamp(3)
      where id = ?
    `,
    [id],
  );
};

export const listThreadsByUser = async (
  userId: string,
): Promise<StoredThreadSummary[]> => {
  const rows = await query<ThreadRow>(
    `
      select id, title, created_at, updated_at
      from chat_threads
      where user_id = ? and deleted_at is null
      order by updated_at desc
    `,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title || "新聊天",
    createdAt: toMillis(row.created_at),
    updatedAt: toMillis(row.updated_at),
  }));
};

export const loadThreadMessagesByUser = async (
  userId: string,
  threadId: string,
): Promise<UIMessage[] | null> => {
  const threadRows = await query<{ id: string }>(
    `
      select id
      from chat_threads
      where id = ? and user_id = ? and deleted_at is null
      limit 1
    `,
    [threadId, userId],
  );

  if (!threadRows[0]) {
    return null;
  }

  const rows = await query<MessageRow>(
    `
      select content_json
      from chat_messages
      where thread_id = ? and user_id = ?
      order by seq asc
    `,
    [threadId, userId],
  );

  return rows.map((row) => parseStoredMessage(row.content_json));
};

export const softDeleteThreadByUser = async (userId: string, threadId: string) => {
  const result = await execute(
    `
      update chat_threads
      set deleted_at = current_timestamp(3), updated_at = current_timestamp(3)
      where id = ? and user_id = ? and deleted_at is null
    `,
    [threadId, userId],
  );

  return result.affectedRows > 0;
};

const upsertThread = async (
  client: PoolConnection,
  userId: string,
  threadId: string,
  title: string,
  modelName?: string,
) => {
  const existingRows = await queryWithConnection<{ user_id: string }>(
    client,
    `
      select user_id
      from chat_threads
      where id = ?
      limit 1
      for update
    `,
    [threadId],
  );

  const existingThread = existingRows[0];

  if (!existingThread) {
    await executeWithConnection(
      client,
      `
        insert into chat_threads (id, user_id, title, model_name)
        values (?, ?, ?, ?)
      `,
      [threadId, userId, title, modelName ?? null],
    );
    return;
  }

  if (existingThread.user_id !== userId) {
    throw new Error("Thread belongs to another user.");
  }

  await executeWithConnection(
    client,
    `
      update chat_threads
      set
        title = ?,
        model_name = coalesce(?, model_name),
        updated_at = current_timestamp(3),
        deleted_at = null
      where id = ? and user_id = ?
    `,
    [title, modelName ?? null, threadId, userId],
  );
};

export const replaceThreadMessages = async ({
  userId,
  threadId,
  messages,
  modelName,
}: {
  userId: string;
  threadId: string;
  messages: UIMessage[];
  modelName?: string;
}) => {
  const title = deriveTitle(messages);
  const client = await getDb().getConnection();

  try {
    await client.beginTransaction();
    await upsertThread(client, userId, threadId, title, modelName);

    await executeWithConnection(
      client,
      `
        delete from chat_messages
        where thread_id = ? and user_id = ?
      `,
      [threadId, userId],
    );

    for (const [index, message] of messages.entries()) {
      await executeWithConnection(
        client,
        `
          insert into chat_messages (thread_id, user_id, seq, role, content_json)
          values (?, ?, ?, ?, cast(? as json))
        `,
        [
          threadId,
          userId,
          index,
          message.role,
          JSON.stringify(message),
        ],
      );
    }

    await client.commit();
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
};
