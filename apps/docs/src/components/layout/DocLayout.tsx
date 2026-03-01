import { JSX } from 'react';
import { Outlet } from 'react-router';
import type { NavSection } from '../../nav/types';
import { DocHeader } from './DocHeader';
import { DocSidebar } from './DocSidebar';

interface DocLayoutProps {
  book: 'core' | 'diagram' | 'model';
  nav: NavSection[];
}

export function DocLayout({ book, nav }: DocLayoutProps): JSX.Element {
  return (
    <div className="doc-layout">
      <DocHeader book={book} />
      <DocSidebar nav={nav} />
      <main className="doc-content">
        <Outlet />
      </main>
    </div>
  );
}
