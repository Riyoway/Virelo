import type { FolderEntry, HomeData, Library, MediaItem, PlaybackInfo, PlaybackQuality, ScanStatus, Settings, ShortsFeed } from './types';

export interface QualityTranscodeState {
  status:string;
  error?:string;
  playlist:string;
  variants:Array<PlaybackQuality&{url:string}>;
  bufferedUntil?:number;
  complete?:boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string,string> | undefined) };
  if (init?.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function withQuery(url: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) query.set(key, String(value));
  return `${url}?${query}`;
}

export const api = {
  home: () => request<HomeData>('/api/home'),
  media: (params: Record<string,string|number|undefined> = {}) => request<MediaItem[]>(withQuery('/api/media', params)),
  mediaById: (id: number) => request<MediaItem>(`/api/media/${id}`),
  shorts: (params: {limit?:number;offset?:number} = {}) => request<ShortsFeed>(withQuery('/api/shorts', params)),
  setLike: (id: number, liked: boolean) => request<{ok:boolean;liked:boolean}>(`/api/media/${id}/like`, { method: 'POST', body: JSON.stringify({ liked }) }),
  folders: () => request<FolderEntry[]>('/api/folders'),
  libraries: () => request<Library[]>('/api/libraries'),
  addLibrary: (path: string, label?: string) => request<Library>('/api/libraries', { method: 'POST', body: JSON.stringify({ path, label }) }),
  removeLibrary: (id: number) => request<{ok:boolean}>(`/api/libraries/${id}`, { method:'DELETE' }),
  settings: () => request<Settings>('/api/settings'),
  saveSettings: (settings: Partial<Settings>) => request<Settings>('/api/settings', { method: 'POST', body: JSON.stringify(settings) }),
  startScan: () => request<{started:boolean;status:ScanStatus}>('/api/scan', { method: 'POST' }),
  scanStatus: () => request<ScanStatus>('/api/scan/status'),
  refreshMetadata: (id:number) => request<MediaItem>(`/api/media/${id}/metadata/refresh`, { method:'POST' }),
  playbackInfo: (id:number) => request<PlaybackInfo>(`/api/media/${id}/playback`),
  startTranscode: (id:number,audioStream?:number) => request<{status:string;error?:string;playlist:string;bufferedUntil?:number;complete?:boolean}>(`/api/media/${id}/transcode/start`, {method:'POST',body:JSON.stringify(audioStream===undefined?{}:{audioStream})}),
  transcodeStatus: (id:number,audioStream?:number) => request<{status:string;error?:string;playlist:string;bufferedUntil?:number;complete?:boolean}>(withQuery(`/api/media/${id}/transcode/status`,{audioStream})),
  startQualityTranscode: (id:number,audioStream?:number) => request<QualityTranscodeState>(`/api/media/${id}/quality/start`,{method:'POST',body:JSON.stringify(audioStream===undefined?{}:{audioStream})}),
  qualityTranscodeStatus: (id:number,audioStream?:number) => request<QualityTranscodeState>(withQuery(`/api/media/${id}/quality/status`,{audioStream})),
  startAudioTranscode: (id:number,audioStream:number) => request<{status:string;error?:string;url:string}>(`/api/media/${id}/audio/start`, {method:'POST',body:JSON.stringify({audioStream})}),
  audioTranscodeStatus: (id:number,audioStream:number) => request<{status:string;error?:string;url:string}>(withQuery(`/api/media/${id}/audio/status`,{audioStream})),
  subtitleUrl: (id:number,stream:number) => `/api/media/${id}/subtitles/${stream}`,
  progress: (id:number, position:number, duration:number) => fetch(`/api/media/${id}/progress`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({position,duration}), keepalive:true
  }).catch(()=>undefined)
};

export function artwork(item: MediaItem, kind: 'poster'|'backdrop'|'thumbnail' = 'thumbnail') {
  return `/api/media/${item.id}/artwork/${kind}`;
}
