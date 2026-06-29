import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var _pgSql: ReturnType<typeof postgres> | undefined;
}

export const sql = globalThis._pgSql ?? postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') globalThis._pgSql = sql;

export function cuid(): string {
  return 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
