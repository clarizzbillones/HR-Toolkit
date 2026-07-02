import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const azureProvider = process.env.AZURE_AD_CLIENT_ID
  ? (() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AzureADProvider = require('next-auth/providers/azure-ad').default;
      return AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        tenantId: process.env.AZURE_AD_TENANT_ID!,
        authorization: {
          params: {
            scope: 'openid profile email offline_access User.Read Calendars.Read MailboxSettings.Read Mail.Send',
          },
        },
      });
    })()
  : null;

// Single shared invite password — set APP_PASSWORD env var in Vercel (defaults to litson2026)
const PWD = process.env.APP_PASSWORD ?? 'litson2026';
// Known named accounts get a friendly name; any other invited email may log in
// with the shared password too (see authorize below).
const USERS = [
  { id: 'hr-1',    name: 'Clarizz Ann Billones', email: 'clarizz@litson.co', role: 'hr' },
  { id: 'admin-1', name: 'Admin Viewer',         email: 'admin@litson.co',   role: 'admin' },
];

function nameFromEmail(email: string) {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ');
  return local.replace(/\b\w/g, c => c.toUpperCase());
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? 'dev-secret',
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/auth/signin' },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email ?? '').trim().toLowerCase();
        const password = credentials?.password ?? '';
        // Shared invite password gates access
        if (!email || password !== PWD) return null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        // Known account → keep its name/role; otherwise, any invited email is admin-viewer
        const known = USERS.find(u => u.email === email);
        if (known) return { id: known.id, name: known.name, email, role: known.role };
        return { id: `inv-${email}`, name: nameFromEmail(email), email, role: 'hr' };
      },
    }),
    ...(azureProvider ? [azureProvider] : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as any).role ?? 'hr';
        if (user.name) token.name = user.name;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).provider = token.provider;
      (session.user as any).role = token.role ?? 'hr';
      if (token.name) session.user!.name = token.name as string;
      return session;
    },
  },
};
