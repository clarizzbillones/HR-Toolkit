'use client';
import { signIn } from 'next-auth/react';

export default function SignIn() {
  const hasAzure = Boolean(process.env.NEXT_PUBLIC_HAS_AZURE);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="bg-white border border-border rounded-card p-10 w-full max-w-sm shadow-card text-center">
        {/* Wordmark */}
        <div className="font-spectral text-3xl font-semibold tracking-widest text-ink mb-1">LITSON</div>
        <div className="text-xs tracking-widest uppercase text-text-muted mb-8">HR Toolkit</div>

        <h2 className="font-spectral text-xl font-semibold text-text-primary mb-2">Sign in</h2>
        <p className="text-sm text-text-secondary mb-8">Access your HR admin workspace</p>

        {/* Dev login (shown when no Azure AD is configured) */}
        <button
          onClick={() => signIn('dev-login', { callbackUrl: '/' })}
          className="w-full bg-ink text-white font-semibold text-sm py-3 rounded-ctrl hover:bg-ink-dark transition-colors"
        >
          Continue as Renee Mathis
        </button>
        <p className="text-xs text-text-faint mt-3">Development mode — no login required</p>

        {hasAzure && (
          <button
            onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-border rounded-ctrl py-3 text-sm font-semibold text-ms hover:bg-canvas transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#0F6CBD">
              <rect x="3" y="5" width="11" height="14" rx="1.5"/>
              <path d="M14 9l7-2v10l-7-2z"/>
            </svg>
            Sign in with Microsoft 365
          </button>
        )}
      </div>
    </div>
  );
}
