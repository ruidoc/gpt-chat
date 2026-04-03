import "server-only";

import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

declare global {
  var __gptChatMysqlPool: Pool | undefined;
}

export type DbRow = RowDataPacket & Record<string, unknown>;

const getPoolConfig = () => {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable.");
  }

  const url = new URL(connectionString);

  if (!["mysql:", "mysql2:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must use the mysql:// protocol.");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: 5,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  };
};

export const getDb = () => {
  if (!globalThis.__gptChatMysqlPool) {
    globalThis.__gptChatMysqlPool = mysql.createPool(getPoolConfig());
  }

  return globalThis.__gptChatMysqlPool;
};

export const query = async <TRow extends object>(
  text: string,
  params: unknown[] = [],
): Promise<TRow[]> => {
  const [rows] = await getDb().execute(text, params as never);
  return rows as TRow[];
};

export const execute = async (
  text: string,
  params: unknown[] = [],
): Promise<ResultSetHeader> => {
  const [result] = await getDb().execute(text, params as never);
  return result as ResultSetHeader;
};

export const queryWithConnection = async <TRow extends object>(
  connection: PoolConnection,
  text: string,
  params: unknown[] = [],
): Promise<TRow[]> => {
  const [rows] = await connection.execute(text, params as never);
  return rows as TRow[];
};

export const executeWithConnection = async (
  connection: PoolConnection,
  text: string,
  params: unknown[] = [],
): Promise<ResultSetHeader> => {
  const [result] = await connection.execute(text, params as never);
  return result as ResultSetHeader;
};
