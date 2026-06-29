import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// Only import AzureAD if the env vars exist — avoids errors at boot
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
            scope:
              'openid profile email offline_access User.Read Calendars.Read MailboxSettings.Read Mail.Send',
          },
        },
      });
    })()
  : null;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? 'dev-secret',
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/signin' },
  providers: [
    // Dev bypass — only active when Azure env vars are not set
    ...(!azureProvider
      ? [
          CredentialsProvider({
            id: 'dev-login',
            name: 'Dev Login',
            credentials: {},
            async authorize() {
              return {
                id: 'dev-user',
                name: 'Renee Mathis',
                email: 'renee@litson.com',
              };
            },
          }),
        ]
      : []),
    ...(azureProvider ? [azureProvider] : []),
  ],
  callbacks: {
    async jwt({ token, account }) {
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
      return session;
    },
  },
};
