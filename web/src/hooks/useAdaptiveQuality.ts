import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api, type QualityTranscodeState } from '../api';
import type { MediaItem, PlaybackQuality } from '../types';

type AdaptiveState='idle'|'starting'|'active'|'error';
type HlsInstance=InstanceType<(typeof import('hls.js/light'))['default']>;
let sessionBandwidth=1_000_000;

export function useAdaptiveQuality(item:MediaItem,videoRef:RefObject<HTMLVideoElement|null>,releasePreviousSource?:()=>void){
  const hlsRef=useRef<HlsInstance|null>(null);
  const requestToken=useRef(0);
  const restoreToken=useRef(0);
  const restoreCleanupRef=useRef<(()=>void)|null>(null);
  const variantsRef=useRef<QualityTranscodeState['variants']>([]);
  const selectedRef=useRef<number|null>(null);
  const [state,setState]=useState<AdaptiveState>('idle');
  const [error,setError]=useState('');
  const [selectedQuality,setSelectedQualityState]=useState<number|null>(null);
  const [activeQuality,setActiveQuality]=useState<number|null>(null);
  const [qualityOptions,setQualityOptions]=useState<PlaybackQuality[]>([]);

  const destroy=useCallback(()=>{
    restoreToken.current++;
    restoreCleanupRef.current?.();
    restoreCleanupRef.current=null;
    hlsRef.current?.destroy();
    hlsRef.current=null;
  },[]);
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
    return()=>{requestToken.current++;destroy();};
  },[destroy,item.id]);

  const applyHlsLevel=useCallback((height:number|null)=>{
    const hls=hlsRef.current;
    if(!hls)return;
    const level=height===null?-1:hls.levels.findIndex((candidate)=>candidate.height===height);
    // loadLevel accepts -1 for Auto and retains already buffered playback.
    hls.loadLevel=level;
  },[]);

  const attach=useCallback(async(result:QualityTranscodeState,resumeAt:number,shouldPlay:boolean)=>{
    const video=videoRef.current;
    if(!video)return false;
    const previousSource=video.currentSrc||video.src;
    variantsRef.current=result.variants;
    setQualityOptions(result.variants);
    destroy();
    releasePreviousSource?.();
    const attachToken=restoreToken.current;
    let restored=false;
    let positionRestored=false;
    let manifestReady=false;
    let finishAttach:(ready:boolean)=>void=()=>{};
    let failAttach:(error:Error)=>void=()=>{};
    const attached=new Promise<boolean>((resolve,reject)=>{finishAttach=resolve;failAttach=reject;});
    const timeout=window.setTimeout(()=>{cleanupRestore();failAttach(new Error('The selected quality could not start.'));},20000);
    let cleanupRestore=()=>{};
    const restore=()=>{
      if(restored||!manifestReady||attachToken!==restoreToken.current||video.readyState<HTMLMediaElement.HAVE_METADATA)return;
      if(!positionRestored){try{video.currentTime=resumeAt;positionRestored=true;}catch{return;}}
      if(video.seeking||video.readyState<HTMLMediaElement.HAVE_FUTURE_DATA)return;
      restored=true;
      cleanupRestore();
      setState('active');
      if(shouldPlay)void video.play().catch(()=>{});
      finishAttach(true);
    };
    cleanupRestore=()=>{
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata',restore);
      video.removeEventListener('durationchange',restore);
      video.removeEventListener('canplay',restore);
      if(restoreCleanupRef.current===cancelRestore)restoreCleanupRef.current=null;
    };
    const cancelRestore=()=>{cleanupRestore();finishAttach(false);};
    restoreCleanupRef.current=cancelRestore;
    video.addEventListener('loadedmetadata',restore);
    video.addEventListener('durationchange',restore);
    video.addEventListener('canplay',restore);
    try{
      const {default:Hls}=await import('hls.js/light');
      if(attachToken!==restoreToken.current){cancelRestore();return false;}
      if(Hls.isSupported()){
        const hls=new Hls({
          enableWorker:true,
          lowLatencyMode:false,
          maxBufferLength:20,
          startPosition:resumeAt,
          startLevel:-1,
          abrEwmaDefaultEstimate:sessionBandwidth
        });
        hlsRef.current=hls;
        hls.loadSource(result.playlist);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED,()=>{manifestReady=true;applyHlsLevel(selectedRef.current);restore();});
        hls.on(Hls.Events.FRAG_BUFFERED,()=>{
          if(Number.isFinite(hls.bandwidthEstimate)&&hls.bandwidthEstimate>0)sessionBandwidth=hls.bandwidthEstimate;
          restore();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED,(_event,data)=>setActiveQuality(hls.levels[data.level]?.height??null));
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){cleanupRestore();failAttach(new Error('Adaptive playback failed.'));setError('Adaptive playback failed.');setState('error');}});
        return await attached;
      }
      if(video.canPlayType('application/vnd.apple.mpegurl')){
        const selected=selectedRef.current;
        const url=selected===null?result.playlist:result.variants.find((variant)=>variant.height===selected)?.url||result.playlist;
        video.src=url;
        manifestReady=true;
        video.load();
        setActiveQuality(selected);
        return await attached;
      }
      throw new Error('This browser cannot play adaptive HLS video.');
    }catch(reason){
      if(attachToken!==restoreToken.current)return false;
      cleanupRestore();
      destroy();
      // A failed handoff must not leave a previously playable original blank.
      if(previousSource&&!previousSource.startsWith('blob:')){
        const recoveryToken=restoreToken.current;
        const recover=()=>{
          if(recoveryToken!==restoreToken.current)return;
          cleanupRecovery();
          video.currentTime=resumeAt;
          if(shouldPlay)void video.play().catch(()=>{});
        };
        const cleanupRecovery=()=>{
          video.removeEventListener('loadedmetadata',recover);
          if(restoreCleanupRef.current===cleanupRecovery)restoreCleanupRef.current=null;
        };
        restoreCleanupRef.current=cleanupRecovery;
        video.addEventListener('loadedmetadata',recover);
        video.src=previousSource;
        video.load();
      }
      setError(reason instanceof Error?reason.message:'Adaptive playback failed.');
      setState('error');
      return false;
    }
  },[applyHlsLevel,destroy,releasePreviousSource,videoRef]);

  const start=useCallback(async(audioStream:number|undefined,resumeAt:number,shouldPlay:boolean,keepPlaying=false)=>{
    const token=++requestToken.current;
    const video=videoRef.current;
    if(!keepPlaying)video?.pause();
    setState('starting');
    setError('');
    try{
      let result=await api.startQualityTranscode(item.id,audioStream);
      if(result.status==='error')throw new Error(result.error||'Adaptive playback could not start.');
      for(let attempt=0;attempt<600;attempt++){
        if(token!==requestToken.current)return false;
        const position=keepPlaying?video?.currentTime??resumeAt:resumeAt;
        if(result.status==='ready'&&(result.complete||(result.bufferedUntil??0)>=position+6)){
          return await attach(result,position,keepPlaying?Boolean(video&&!video.paused):shouldPlay);
        }
        await new Promise((resolve)=>window.setTimeout(resolve,250));
        if(token!==requestToken.current)return false;
        result=await api.qualityTranscodeStatus(item.id,audioStream);
        if(result.status==='error')throw new Error(result.error||'Adaptive playback failed.');
      }
      throw new Error('Adaptive playback did not become ready in time.');
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
