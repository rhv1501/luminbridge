import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

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
    connect_timeout: 30,   // seconds — covers Neon cold-start (~5-15s)
    idle_timeout: 20,      // release idle connections quickly (Neon best practice)
    max_lifetime: 600,     // recycle connections every 10 min
    max: 10,
  });
}

export const sql: SqlClient = globalForDb._pgSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgSql = sql;
}
