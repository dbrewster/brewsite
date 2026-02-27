// Renders children only when the browser session is authenticated with Lucid.
// Shows a full-screen sign-in prompt otherwise.
// Wrap any page or component that uses Lucid dynamic loading with this gate.

import { useEffect, useState, type JSX } from 'react';
import { checkLucidAuthStatus } from '@brewsite/diagram';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

interface LucidAuthGateProps {
  readonly children: React.ReactNode;
}

export function LucidAuthGate({ children }: LucidAuthGateProps): JSX.Element {
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    checkLucidAuthStatus().then((authenticated) => {
      setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
    });
  }, []);

  if (authState === 'checking') {
    return (
      <div style={css.shell}>
        <div style={css.spinner} />
        <p style={css.label}>Checking Lucid session…</p>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div style={css.shell}>
        <div style={css.card}>
          <span style={css.logoMark}>◈</span>
          <h1 style={css.heading}>Connect your Lucid account</h1>
          <p style={css.body}>
            Sign in with your Lucid credentials to load diagrams from your
            workspace into the presentation.
          </p>
          <button
            style={css.button}
            onClick={() => { window.location.href = '/auth/login'; }}
          >
            Sign in with Lucid →
          </button>
          <p style={css.hint}>
            You'll be redirected to Lucid to authorize read-only access to
            your documents, then returned here automatically.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const css: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#08101e', gap: '16px',
  },
  spinner: {
    width: '28px', height: '28px',
    border: '2px solid rgba(255,255,255,0.08)',
    borderTopColor: '#7faeff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  label: { margin: 0, color: '#8ba4d4', fontSize: '13px' },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '16px', maxWidth: '380px', padding: '48px 32px',
    background: '#0f1a2e', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
  },
  logoMark: { fontSize: '40px', color: '#7faeff', lineHeight: 1, userSelect: 'none' },
  heading: {
    margin: 0, fontSize: '20px', fontWeight: 600,
    color: '#e8eeff', textAlign: 'center', letterSpacing: '-0.02em',
  },
  body: {
    margin: 0, fontSize: '14px', color: '#8ba4d4',
    textAlign: 'center', lineHeight: 1.6,
  },
  button: {
    padding: '12px 32px', fontSize: '15px', fontWeight: 600,
    background: '#2a4fa0', border: '1px solid #3560c0',
    borderRadius: '9px', color: '#e8eeff', cursor: 'pointer',
    letterSpacing: '-0.01em', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  hint: {
    margin: 0, fontSize: '11px', color: '#506080',
    textAlign: 'center', lineHeight: 1.5, maxWidth: '280px',
  },
};

// Inject spinner keyframes once
if (typeof document !== 'undefined') {
  const id = 'lucid-auth-gate-keyframes';
  if (!document.getElementById(id)) {
    const el = document.createElement('style');
    el.id = id;
    el.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(el);
  }
}
