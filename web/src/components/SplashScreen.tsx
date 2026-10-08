import { useEffect, useState } from 'react';

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'logo' | 'name' | 'leaving'>('logo');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let leaveTimer: number | undefined;
    let finishTimer: number | undefined;
    const nameTimer = window.setTimeout(() => {
      setPhase('name');
      leaveTimer = window.setTimeout(() => {
        setPhase('leaving');
        finishTimer = window.setTimeout(onDone, reducedMotion ? 0 : 560);
      }, reducedMotion ? 80 : 430);
    }, reducedMotion ? 80 : 410);

    return () => {
      window.clearTimeout(nameTimer);
      if (leaveTimer !== undefined) window.clearTimeout(leaveTimer);
      if (finishTimer !== undefined) window.clearTimeout(finishTimer);
    };
  }, [onDone]);

  return (
    <div className={`splash-screen splash-phase-${phase}`} role="status" aria-label="Virelo">
      <div className="splash-content">
        <div className="splash-logo" aria-hidden="true">
          <img src="/virelo-icon.png?v=transparent-1" alt="" />
        </div>
        <div className="splash-wordmark" aria-hidden="true">Virelo</div>
      </div>
    </div>
  );
}
