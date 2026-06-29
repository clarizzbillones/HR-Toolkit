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

// Users: set HR_PASSWORD and ADMIN_PASSWORD env vars in Vercel to secure these
const USERS = [
  { id: 'hr-1',    name: 'Clarizz Alon',  email: 'clarizz@litson.co',  password: process.env.HR_PASSWORD    ?? 'litson2026', role: 'hr' },
  { id: 'admin-1', name: 'Admin Viewer',  email: 'admin@litson.co',     password: process.env.ADMIN_PASSWORD ?? 'admin2026',  role: 'admin' },
];

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? 'dev-secret',
  session: { strategy: 'jwt' },
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
        const user = USERS.find(
          u => u.email === credentials?.email && u.password === credentials?.password
        );
        return user ?? null;
      },
    }),
    ...(azureProvider ? [azureProvider] : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) token.role = (user as any).role ?? 'hr';
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
      return session;
    },
  },
};
