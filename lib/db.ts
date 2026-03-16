import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const TRANSIENT_DB_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "57P01",
]);
const TRANSIENT_DB_ERROR_MESSAGES = [
  "fetch failed",
  "connect timeout",
  "connection terminated unexpectedly",
  "connection closed unexpectedly",
  "server closed the connection unexpectedly",
  "socket hang up",
  "connection reset",
  "could not connect to server",
  "terminating connection due to administrator command",
];

type SqlClient = ReturnType<typeof postgres>;

// Reuse the connection pool across Next.js HMR reloads in development.
const globalForDb = globalThis as unknown as { _pgSql?: SqlClient };

function createClient(): SqlClient {
  if (!databaseUrl) {
    return (() => {
      throw new Error("DATABASE_URL is not set");
    }) as unknown as SqlClient;
  }

  // Strip query params that `postgres` npm doesn't understand (e.g. channel_binding)
  // and configure generous timeouts for Neon's serverless cold-start latency.
  const url = new URL(databaseUrl);
  url.searchParams.delete("channel_binding");

  return postgres(url.toString(), {
    ssl: "require",
    connect_timeout: 45,   // seconds — allows longer Neon wake-up windows
    idle_timeout: 20,      // release idle connections quickly (Neon best practice)
    max_lifetime: 600,     // recycle connections every 10 min
    max: 10,
  });
}

export function isTransientDbError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const code = (error as { code?: string }).code;
  if (code && TRANSIENT_DB_ERROR_CODES.has(code)) {
    return true;
  }

  const message = (
    (error as { message?: string }).message ?? String(error)
  ).toLowerCase();

  return TRANSIENT_DB_ERROR_MESSAGES.some((fragment) => message.includes(fragment));
}

export async function withDbRetry<T>(
  task: () => Promise<T>,
  options?: {
    attempts?: number;
    retryDelayMs?: number;
  },
) {
  const attempts = options?.attempts ?? 3;
  const retryDelayMs = options?.retryDelayMs ?? 1000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }

  throw lastError;
}

export const sql: SqlClient = globalForDb._pgSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgSql = sql;
}
