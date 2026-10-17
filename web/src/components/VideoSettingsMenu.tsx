import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ArrowsIn, ArrowsOut, ArrowCounterClockwise, ArrowClockwise, SlidersHorizontal, CaretRight, X } from '@phosphor-icons/react';
import { sidePopoverPlacement } from '../utils/context-menu';
import { DEFAULT_VIDEO_PRESENTATION, type VideoPresentation } from '../utils/video-presentation';

interface Props {
  contextMenu?: boolean;
  settings: Readonly<VideoPresentation>;
  onChange: (patch: Partial<VideoPresentation>) => void;
  onReset: () => void;
}

export function VideoSettingsMenu({ settings, onChange, onReset, contextMenu = false }: Props) {
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [placement, setPlacement] = useState({ left: 8, top: 8, width: 300, maxHeight: 480, anchor: 150, side: 'above' });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const changed = Object.entries(DEFAULT_VIDEO_PRESENTATION).some(([key, value]) => settings[key as keyof VideoPresentation] !== value);
  const close = (focus = false) => { setOpen(false); if (focus) buttonRef.current?.focus({ preventScroll: true }); };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const fullscreen = () => setOpen(false);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      document.removeEventListener('fullscreenchange', fullscreen);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const button = buttonRef.current?.getBoundingClientRect(), menu = menuRef.current;
      if (!button || !menu) return;
      if (button.bottom < 0 || button.top > window.innerHeight) { setOpen(false); return; }
      const width = Math.min(300, window.innerWidth - (contextMenu ? 32 : 16));
      const above = Math.max(0, Math.min(window.innerHeight - 16, button.top - 22));
      const below = Math.max(0, Math.min(window.innerHeight - 16, window.innerHeight - button.bottom - 22));
      const desired = Math.min(480, (menu.querySelector<HTMLElement>('.video-settings-content')?.scrollHeight || 0)
        + (menu.querySelector<HTMLElement>('.video-settings-heading')?.offsetHeight || 36) + 16);
      if (contextMenu) {
        const next = sidePopoverPlacement(button, { width, height: desired }, { width: window.innerWidth, height: window.innerHeight });
        setPlacement(previous => Object.keys(next).every(key => next[key as keyof typeof next] === previous[key as keyof typeof previous]) ? previous : next);
        return;
      }
      const placeAbove = above >= desired || above >= below;
      const maxHeight = Math.min(480, placeAbove ? above : below);
      const left = Math.max(8, Math.min(button.left + button.width / 2 + 28 - width, window.innerWidth - width - 8));
      setPlacement(previous => {
        const height = Math.min(desired, maxHeight);
        const next = { width, maxHeight, left, top: Math.max(8, Math.min(window.innerHeight - height - 8,
          placeAbove ? button.top - height - 14 : button.bottom + 14)),
          anchor: Math.max(24, Math.min(button.left + button.width / 2 - left, width - 24)), side: placeAbove ? 'above' : 'below' };
        return Object.keys(next).every(key => next[key as keyof typeof next] === previous[key as keyof typeof previous]) ? previous : next;
      });
    };
    position();
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    const root = rootRef.current;
    for (const target of [root, root?.closest('.player'), root?.closest('.player-controls'), root?.closest('.player-tools')]) {
      if (target) observer.observe(target);
    }
    observer.observe(menuRef.current!);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open, contextMenu]);

  return <div className={contextMenu ? "video-settings video-settings-submenu" : "playback-settings video-settings"} ref={rootRef}
    onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); } }}>
    <button ref={buttonRef} type="button" role={contextMenu ? "menuitem" : undefined} data-setting="video" aria-label="Video settings" title="Video settings"
      className={open || changed ? 'active' : ''} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={event => { setAnimate(event.detail > 0); setOpen(value => !value); }}
      onKeyDown={event => { if (event.key === (contextMenu ? 'ArrowRight' : 'ArrowDown')) { event.preventDefault(); event.stopPropagation(); setAnimate(false); setOpen(true); } }}>
      <SlidersHorizontal />{contextMenu && <><span>Video settings</span><CaretRight /></>}
    </button>
    {open && createPortal(<div ref={menuRef} id={id} className="playback-settings-menu video-settings-menu" role="dialog" aria-labelledby={id + '-title'}
      data-side={placement.side} data-animate={animate}
      style={{ left: placement.left, top: placement.top, width: placement.width, maxHeight: placement.maxHeight,
        '--popover-anchor-x': placement.anchor + 'px', '--popover-anchor-y': placement.anchor + 'px' } as CSSProperties}
      onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && !rootRef.current?.contains(event.relatedTarget as Node)) close(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape' || (contextMenu && event.key === 'ArrowLeft' && !(event.target instanceof HTMLInputElement))) { event.preventDefault(); close(true); }
        if (event.key === 'Tab') {
          const controls = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input') || []);
          if ((!event.shiftKey && document.activeElement === controls.at(-1)) || (event.shiftKey && document.activeElement === controls[0])) {
            event.preventDefault(); close(true);
          }
        }
      }}>
      <div className="video-settings-heading"><h3 id={id + '-title'}><SlidersHorizontal />Video settings</h3>
        <button type="button" aria-label="Close video settings" onClick={() => close(true)}><X /></button></div>
      <div className="video-settings-content">
        <div className="video-settings-fit" role="group" aria-label="Video fit">
          <button type="button" aria-pressed={settings.fit === 'contain'} onClick={() => onChange({ fit: 'contain' })}><ArrowsIn />Fit</button>
          <button type="button" aria-pressed={settings.fit === 'cover'} onClick={() => onChange({ fit: 'cover' })}><ArrowsOut />Fill</button>
        </div>
        <p className="video-settings-hint">{settings.fit === 'cover' ? 'Crop the edges to fill the player.' : 'Show the entire frame without cropping.'} Quality stays unchanged.</p>
        <div className="video-settings-rotation"><span>Rotation</span><div>
          <button type="button" aria-label="Rotate counterclockwise" onClick={() => onChange({ rotation: settings.rotation - 90 })}><ArrowCounterClockwise /></button>
          <output aria-label="Rotation" aria-live="polite">{settings.rotation}°</output>
          <button type="button" aria-label="Rotate clockwise" onClick={() => onChange({ rotation: settings.rotation + 90 })}><ArrowClockwise /></button>
        </div></div>
        {(['brightness', 'contrast', 'saturation'] as const).map(key => <div className="video-settings-adjustment" key={key}>
          <label htmlFor={id + '-' + key}>{key === 'brightness' ? 'Brightness' : key === 'contrast' ? 'Contrast' : 'Saturation'}</label>
          <output htmlFor={id + '-' + key}>{settings[key]}%</output>
          <input id={id + '-' + key} type="range" min="0" max="200" step="1" value={settings[key]}
            aria-valuetext={settings[key] + '%'}
            style={{ '--range-fill': settings[key] / 2 + '%' } as CSSProperties} onChange={event => onChange({ [key]: Number(event.target.value) })} />
        </div>)}
        <button className="video-settings-reset" type="button" disabled={!changed} onClick={onReset}><ArrowCounterClockwise />Reset adjustments</button>
        <p className="video-settings-hint">Resets for each video. Picture in Picture uses the original view.</p>
      </div>
    </div>, document.fullscreenElement || document.body)}
  </div>;
}
