import { JSX, ReactNode } from 'react';

interface CalloutProps {
  type: 'note' | 'warning' | 'tip';
  children: ReactNode;
}

const icons: Record<CalloutProps['type'], string> = {
  note: 'ℹ️',
  warning: '⚠️',
  tip: '💡',
};

export function Callout({ type, children }: CalloutProps): JSX.Element {
  return (
    <aside className={`callout callout--${type}`}>
      <span>{icons[type]}</span>
      <div>{children}</div>
    </aside>
  );
}
