import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api, type QualityTranscodeState } from '../api';
import type { MediaItem, PlaybackQuality } from '../types';

type AdaptiveState='idle'|'starting'|'active'|'error';
type HlsInstance=InstanceType<(typeof import('hls.js/light'))['default']>;

export function useAdaptiveQuality(item:MediaItem,videoRef:RefObject<HTMLVideoElement|null>){
  const hlsRef=useRef<HlsInstance|null>(null);
  const requestToken=useRef(0);
  const variantsRef=useRef<QualityTranscodeState['variants']>([]);
  const selectedRef=useRef<number|null>(null);
  const [state,setState]=useState<AdaptiveState>('idle');
  const [error,setError]=useState('');
  const [selectedQuality,setSelectedQualityState]=useState<number|null>(null);
  const [activeQuality,setActiveQuality]=useState<number|null>(null);
  const [qualityOptions,setQualityOptions]=useState<PlaybackQuality[]>([]);

  const destroy=useCallback(()=>{hlsRef.current?.destroy();hlsRef.current=null;},[]);
  useEffect(()=>destroy,[destroy]);
  useEffect(()=>{
    requestToken.current++;
    destroy();
    variantsRef.current=[];
    selectedRef.current=null;
    setState('idle');
    setError('');
    setSelectedQualityState(null);
    setActiveQuality(null);
    setQualityOptions([]);
  },[destroy,item.id]);

  const applyHlsLevel=useCallback((height:number|null)=>{
    const hls=hlsRef.current;
    if(!hls)return;
    if(height===null){hls.currentLevel=-1;hls.nextLevel=-1;return;}
    const level=hls.levels.findIndex((candidate)=>candidate.height===height);
    if(level>=0)hls.currentLevel=level;
  },[]);

  const attach=useCallback(async(result:QualityTranscodeState,resumeAt:number,shouldPlay:boolean)=>{
    const video=videoRef.current;
    if(!video)return false;
    variantsRef.current=result.variants;
    setQualityOptions(result.variants);
    destroy();
    const restore=()=>{
      if(Number.isFinite(resumeAt)&&resumeAt>0)video.currentTime=resumeAt;
      setState('active');
      if(shouldPlay)void video.play().catch(()=>{});
    };
    try{
      const {default:Hls}=await import('hls.js/light');
      if(Hls.isSupported()){
        const hls=new Hls({
          enableWorker:true,
          lowLatencyMode:false,
          maxBufferLength:40,
          startLevel:-1,
          abrEwmaDefaultEstimate:1_000_000
        });
        hlsRef.current=hls;
        hls.loadSource(result.playlist);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{applyHlsLevel(selectedRef.current);restore();});
        hls.on(Hls.Events.LEVEL_SWITCHED,(_event,data)=>setActiveQuality(hls.levels[data.level]?.height??null));
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){setError('Adaptive playback failed.');setState('error');}});
        return true;
      }
      if(video.canPlayType('application/vnd.apple.mpegurl')){
        const selected=selectedRef.current;
        const url=selected===null?result.playlist:result.variants.find((variant)=>variant.height===selected)?.url||result.playlist;
        video.src=url;
        video.addEventListener('loadedmetadata',restore,{once:true});
        video.load();
        setActiveQuality(selected);
        return true;
      }
      throw new Error('This browser cannot play adaptive HLS video.');
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Adaptive playback failed.');
      setState('error');
      return false;
    }
  },[applyHlsLevel,destroy,videoRef]);

  const start=useCallback(async(audioStream:number|undefined,resumeAt:number,shouldPlay:boolean)=>{
    const token=++requestToken.current;
    const video=videoRef.current;
    video?.pause();
    setState('starting');
    setError('');
    try{
      let result=await api.startQualityTranscode(item.id,audioStream);
      if(result.status==='error')throw new Error(result.error||'Adaptive playback could not start.');
      for(let attempt=0;result.status!=='ready'&&attempt<600;attempt++){
        await new Promise((resolve)=>window.setTimeout(resolve,250));
        if(token!==requestToken.current)return false;
        result=await api.qualityTranscodeStatus(item.id,audioStream);
        if(result.status==='error')throw new Error(result.error||'Adaptive playback failed.');
      }
      if(token!==requestToken.current)return false;
      if(result.status!=='ready')throw new Error('Adaptive playback did not become ready in time.');
      return await attach(result,resumeAt,shouldPlay);
    }catch(reason){
      if(token!==requestToken.current)return false;
      setError(reason instanceof Error?reason.message:'Adaptive playback failed.');
      setState('error');
      return false;
    }
  },[attach,item.id,videoRef]);

  const setQuality=useCallback((height:number|null)=>{
    selectedRef.current=height;
    setSelectedQualityState(height);
    if(hlsRef.current){applyHlsLevel(height);return;}
    const video=videoRef.current;
    const variants=variantsRef.current;
    if(!video||!variants.length)return;
    const currentTime=video.currentTime;
    const shouldPlay=!video.paused;
    const url=height===null?variants[0].url.replace(/\d+\/index\.m3u8$/,'master.m3u8'):variants.find((variant)=>variant.height===height)?.url;
    if(!url)return;
    video.src=url;
    video.addEventListener('loadedmetadata',()=>{video.currentTime=currentTime;if(shouldPlay)void video.play().catch(()=>{});},{once:true});
    video.load();
    setActiveQuality(height);
  },[applyHlsLevel,videoRef]);

  return {state,error,start,selectedQuality,activeQuality,qualityOptions,setQuality,destroy};
}
