import type { JSX } from 'react';
import { lazy, Suspense } from 'react';
import { BrowserRouter } from 'react-router';

const WebsiteApp = lazy(async () => {
  await import('./website/src/style.css');
  return import('./website/src/App');
});

const DocsApp = lazy(async () => {
  await import('./docs/src/style/variables.css');
  await import('./docs/src/style/global.css');
  await import('./docs/src/style/layout.css');
  await import('./docs/src/style/prism-theme.css');
  return import('./docs/src/App');
});

const ExamplesApp = lazy(() => import('./examples/src/App'));

type AppName = 'website' | 'docs' | 'examples';

const detectApp = (pathname: string): AppName => {
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'docs';
  if (pathname === '/examples' || pathname.startsWith('/examples/')) return 'examples';
  if (pathname === '/website' || pathname.startsWith('/website/')) return 'website';
  return 'website';
};

const getBasename = (app: AppName, pathname: string): string | undefined => {
  if (app === 'docs') return '/docs';
  if (app === 'examples') return '/examples';
  if (app === 'website' && (pathname === '/website' || pathname.startsWith('/website/'))) return '/website';
  return undefined;
};

function Loading(): JSX.Element {
  return <div style={{ padding: '2rem' }}>Loading…</div>;
}

export default function App(): JSX.Element {
  const pathname = window.location.pathname;
  const app = detectApp(pathname);
  const basename = getBasename(app, pathname);

  if (app === 'docs') {
    return (
      <BrowserRouter basename={basename}>
        <Suspense fallback={<Loading />}>
          <DocsApp />
        </Suspense>
      </BrowserRouter>
    );
  }

  if (app === 'examples') {
    return (
      <BrowserRouter basename={basename}>
        <Suspense fallback={<Loading />}>
          <ExamplesApp />
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={basename}>
      <Suspense fallback={<Loading />}>
        <WebsiteApp />
      </Suspense>
    </BrowserRouter>
  );
}
