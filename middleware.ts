export { default } from 'next-auth/middleware';

// Require an authenticated session for everything except the sign-in page,
// the NextAuth API routes, the public coaching e-sign page/endpoint, and
// Next.js static assets.
export const config = {
  matcher: ['/((?!api/auth|api/coaching/sign|coaching/sign|api/hr-forms/sign|hr-forms/sign|api/offboarding/exit|offboarding/exit|api/onboarding/w8ben|onboarding/w8ben|auth/signin|_next/static|_next/image|favicon.ico|litson-logo).*)'],
};
