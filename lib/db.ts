import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

type SqlClient = ReturnType<typeof postgres>;

export const sql: SqlClient = databaseUrl
  ? postgres(databaseUrl, { ssl: { rejectUnauthorized: false } })
  : ((() => {
      throw new Error("DATABASE_URL is not set");
    }) as unknown as SqlClient);
