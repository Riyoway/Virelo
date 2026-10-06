import { useEffect, type RefObject } from 'react';

export function useRowWheel(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let animationFrame = 0;
    let target = el.scrollLeft;
    let lastFrameTime = 0;

    const clamp = (value: number) => Math.max(0, Math.min(el.scrollWidth - el.clientWidth, value));

    const animate = (time: number) => {
      animationFrame = 0;
      const current = el.scrollLeft;
      const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 32) : 16;
      lastFrameTime = time;
      const progress = 1 - Math.exp(-elapsed / 90);
      const next = current + (target - current) * progress;

      if (Math.abs(target - next) < 0.5) {
        el.scrollLeft = target;
        lastFrameTime = 0;
        return;
      }

      el.scrollLeft = next;
      animationFrame = requestAnimationFrame(animate);
    };

    const scheduleAnimation = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(animate);
    };

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 1) return;

      // Horizontal trackpad gestures already scroll natively. Only translate
      // vertical wheel input into horizontal movement for the chip rail.
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? el.clientWidth
          : 1;
      const delta = event.deltaY * scale;
      if (delta === 0) return;

      const current = el.scrollLeft;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const movingTarget = animationFrame ? target : current;
      const nextTarget = clamp(movingTarget + delta);
      const atStart = current <= 0 && target <= 0;
      const atEnd = current >= maxScroll && target >= maxScroll;
      if ((atStart && delta < 0) || (atEnd && delta > 0)) return;

      target = nextTarget;
      scheduleAnimation();
      event.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [ref]);
}
