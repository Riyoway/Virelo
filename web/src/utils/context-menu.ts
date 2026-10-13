export interface ContextMenuPosition { x: number; y: number; keyboard?: boolean }

export function contextMenuPlacement(point: ContextMenuPosition, size: { width: number; height: number },
  viewport: { width: number; height: number }) {
  const margin = 16, gap = 14;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
  const width = Math.min(size.width, Math.max(0, viewport.width - margin * 2));
  const x = clamp(point.x, margin, viewport.width - margin);
  const y = clamp(point.y, margin, viewport.height - margin);
  const below = Math.max(0, viewport.height - y - gap - margin);
  const above = Math.max(0, y - gap - margin);
  const side = below >= size.height || below >= above ? 'below' : 'above';
  const maxHeight = side === 'below' ? below : above;
  const height = Math.min(size.height, maxHeight);
  const left = clamp(x - 24, margin, viewport.width - width - margin);
  const inset = Math.min(24, width / 2);
  return {
    left, top: side === 'below' ? y + gap : y - gap - height,
    anchor: clamp(x - left, inset, width - inset), side, maxHeight
  };
}
