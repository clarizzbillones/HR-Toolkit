'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('clarizz@litson.co');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.ok) {
      router.push('/');
    } else {
      setError('Incorrect email or password.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="bg-white border border-border rounded-card p-10 w-full max-w-sm shadow-card">
        <div className="text-center mb-8">
          <div className="font-spectral text-3xl font-semibold tracking-widest text-ink mb-1">LITSON</div>
          <div className="text-xs tracking-widest uppercase text-text-muted">HR Toolkit</div>
        </div>

        <h2 className="font-spectral text-xl font-semibold text-text-primary mb-1">Sign in</h2>
        <p className="text-sm text-text-secondary mb-6">Access your HR admin workspace</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@litson.co"
              className="w-full border border-border-light rounded-ctrl px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full border border-border-light rounded-ctrl px-3 py-2.5 text-sm focus:outline-none focus:border-ink"
            />
          </div>
          {error && <p className="text-xs text-litred font-semibold">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-ink text-white font-semibold text-sm py-3 rounded-ctrl hover:bg-ink-dark transition-colors disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {process.env.NEXT_PUBLIC_HAS_AZURE && (
          <button onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
            className="mt-4 w-full flex items-center justify-center gap-2 border border-border rounded-ctrl py-3 text-sm font-semibold text-ms hover:bg-canvas transition-colors">
            <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft 365
          </button>
        )}

        <p className="text-[11px] text-text-faint text-center mt-6">
          HR Admin · clarizz@litson.co &nbsp;|&nbsp; Viewer · admin@litson.co
        </p>
      </div>
    </div>
  );
}
