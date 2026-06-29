import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var _pgSql: ReturnType<typeof postgres> | undefined;
}

export const sql = globalThis._pgSql ?? postgres({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT ?? 6543),
  database: process.env.DB_NAME ?? 'postgres',
  username: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') globalThis._pgSql = sql;

export function cuid(): string {
  return 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
