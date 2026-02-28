import { useEffect, useState } from 'react';
import type { JSX } from 'react';

export function ScrollIndicator(): JSX.Element {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY < 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`scroll-indicator${visible ? '' : ' scroll-indicator--hidden'}`}
      aria-hidden="true"
    >
      <span className="scroll-indicator__label">scroll to explore</span>
      <div className="scroll-indicator__arrows">
        <span className="scroll-indicator__arrow" />
        <span className="scroll-indicator__arrow" />
      </div>
    </div>
  );
}
