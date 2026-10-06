import { useEffect, useRef, useState } from 'react';
import { ArrowsOut, FastForward, Pause, PictureInPicture, Play, RepeatOnce, Rewind, SkipBack, SkipForward, SpeakerHigh, SpeakerSlash, SpinnerGap } from '@phosphor-icons/react';
import { api } from '../api';
import { useHlsFallback } from '../hooks/useHlsFallback';
import { useAdaptiveQuality } from '../hooks/useAdaptiveQuality';
import { playVideo } from '../utils/media-playback';
import { toggleFullscreen } from '../utils/fullscreen';
import { DraggableCaption, HiddenSubtitleTrack } from './DraggableCaption';
import { PlaybackSettingsMenu } from './PlaybackSettingsMenu';
import type { MediaItem, PlaybackInfo } from '../types';

interface PlayerProps {
  item: MediaItem;
  queue?: MediaItem[];
  queueIndex?: number;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  canGoNext?: boolean;
  canGoPrev?: boolean;
  autoPlay?: boolean;
}

const DIRECT_AUDIO_CODECS=new Set(['aac','flac','mp3','opus','vorbis']);
const QUALITY_PREFERENCE_KEY='virelo-playback-quality';
type HlsInstance=InstanceType<(typeof import('hls.js/light'))['default']>;

export function Player({item,queue,queueIndex,onEnded,onNext,onPrev,canGoNext=true,canGoPrev=true,autoPlay}:PlayerProps) {
  const localPlayback=isLocalPlaybackHost();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceTransition = useRef(false);
  const wantsPlayback = useRef(Boolean(autoPlay));
  const [playRequested, setPlayRequested] = useState(Boolean(autoPlay));
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProgress = useRef(0);
  const playbackItemId = useRef(item.id);
  const controlsTimer = useRef<number | null>(null);
  const audioToken = useRef(0);
  const audioSourceToken = useRef(0);
  const audioHlsRef = useRef<HlsInstance|null>(null);
  const resumeAfterAudio = useRef(false);
  const audioResumeAt = useRef<number|null>(null);
  const audioRetryTimer = useRef<number|null>(null);
  const audioRetryCount = useRef(0);
  const initialResumeItem = useRef<number|null>(null);
  const videoFallbackRequested = useRef(false);
  const qualityRequested = useRef(true);
  const autoBufferTimer = useRef<number|null>(null);
  const { fallback, error, startFallback, release:releaseFallback } = useHlsFallback(item, videoRef, wantsPlayback, sourceTransition);
  const {state:qualityState,error:qualityError,start:startQuality,selectedQuality,activeQuality,qualityOptions,setQuality}=useAdaptiveQuality(item,videoRef,releaseFallback,wantsPlayback,sourceTransition);
  const [playbackInfo,setPlaybackInfo] = useState<PlaybackInfo|null>(null);
  const [selectedAudio,setSelectedAudio] = useState<number|null>(null);
  const [selectedSubtitle,setSelectedSubtitle] = useState<number|null>(null);
  const [activeCaption,setActiveCaption] = useState('');
  const [externalAudioUrl,setExternalAudioUrl] = useState('');
  const [audioPreparing,setAudioPreparing] = useState(false);
  const [audioError,setAudioError] = useState('');
  const [playbackReady,setPlaybackReady] = useState(false);
  const [playing,setPlaying] = useState(false);
  const [buffering,setBuffering] = useState(false);
  const [current,setCurrent] = useState(0);
  const [duration,setDuration] = useState(item.duration || 0);
  const [volume,setVolume] = useState(1);
  const [muted,setMuted] = useState(false);
  const [pip,setPip] = useState(false);
  const [pipSupported,setPipSupported] = useState(false);
  const [looping,setLooping] = useState(false);
  const [controlsVisible,setControlsVisible] = useState(true);

  useEffect(()=>{
    sourceTransition.current=false;
    wantsPlayback.current=Boolean(autoPlay);
    setPlayRequested(Boolean(autoPlay));
    playbackItemId.current=item.id;
    audioToken.current++;
    audioSourceToken.current++;
    videoFallbackRequested.current=false;
    qualityRequested.current=true;
    if(autoBufferTimer.current!==null)window.clearTimeout(autoBufferTimer.current);
    autoBufferTimer.current=null;
    audioRef.current?.pause();
    if(audioRetryTimer.current!==null)window.clearTimeout(audioRetryTimer.current);
    audioRetryTimer.current=null;
    audioRetryCount.current=0;
    resumeAfterAudio.current=false;
    audioResumeAt.current=null;
    initialResumeItem.current=null;
    lastProgress.current=0;
    setPlaybackInfo(null);
    setSelectedAudio(null);
    setSelectedSubtitle(null);
    setActiveCaption('');
    setExternalAudioUrl('');
    setAudioPreparing(false);
    setAudioError('');
    setPlaybackReady(false);
    setPlaying(false);
    setBuffering(false);
    setCurrent(0);
    setDuration(item.duration||0);
  },[item.id]);

  useEffect(()=>{
    let alive=true;
    if(wantsPlayback.current)requestVideoPlayback();
    api.playbackInfo(item.id).then(async(info)=>{
      if(!alive)return;
      setPlaybackInfo(info);
      setSelectedAudio(info.defaultAudioStream);
      const preferredQuality=resolvePreferredQuality(info.qualityOptions,readQualityPreference(localPlayback));
      setQuality(preferredQuality);
      const directPlayback=!info.qualityOptions.length||preferredQuality===null||preferredQuality===info.qualityOptions[0]?.height;
      if(directPlayback){
        qualityRequested.current=false;
        if(info.requiresTranscode||videoRef.current?.error){
          videoFallbackRequested.current=true;
          const video=videoRef.current;
          const position=video?.currentTime||item.progress_position||0;
          sourceTransition.current=true;
          video?.pause();
          await startFallback(info.defaultAudioStream??undefined,position,wantsPlayback.current);
        }else{
          setPlaybackReady(true);
          if(wantsPlayback.current)requestVideoPlayback();
        }
        return;
      }
      const adaptiveReady=await startQuality(info.defaultAudioStream??undefined,item.progress_position||0,wantsPlayback.current);
      if(!alive)return;
      if(adaptiveReady){
        setPlaybackReady(true);
        return;
      }
      qualityRequested.current=false;
      if(info.requiresAudioTranscode&&info.defaultAudioStream!==null){
        await prepareAudio(info.defaultAudioStream,info,true,true);
      }else{
        setPlaybackReady(true);
        if(wantsPlayback.current)requestVideoPlayback();
      }
    }).catch(()=>{
      if(!alive)return;
      qualityRequested.current=false;
      setPlaybackReady(true);
      if(wantsPlayback.current)requestVideoPlayback();
    });
    return()=>{alive=false;audioToken.current++;};
  },[autoPlay,item.id,localPlayback,setQuality,startQuality,startFallback]);

  useEffect(()=>{
    if(qualityState!=='active')return;
    sourceTransition.current=false;
    audioRef.current?.pause();
    setExternalAudioUrl('');
    setPlaybackReady(true);
  },[qualityState]);

  useEffect(()=>{if(fallback==='active'){sourceTransition.current=false;setPlaybackReady(true);}},[fallback]);

  useEffect(()=>{setActiveCaption('');},[item.id,selectedSubtitle]);

  useEffect(()=>{
    const video=videoRef.current;
    const audio=audioRef.current;
    if(!video)return;
    video.muted=externalAudioUrl?true:muted;
    video.volume=volume;
    if(audio){audio.volume=volume;audio.muted=muted;}
  },[externalAudioUrl,muted,volume]);

  useEffect(()=>{
    const audio=audioRef.current;
    const sourceToken=++audioSourceToken.current;
    audioHlsRef.current?.destroy();
    audioHlsRef.current=null;
    if(!audio)return;
    let disposed=false;
    let ready=false;
    const handleReady=()=>{
      if(disposed||sourceToken!==audioSourceToken.current||audio.readyState<HTMLMediaElement.HAVE_METADATA)return;
      const video=videoRef.current;
      const pendingPosition=audioResumeAt.current;
      syncExternalAudio(false,pendingPosition??undefined);
      if(pendingPosition!==null)audioResumeAt.current=null;
      if(!ready){
        ready=true;
        sourceTransition.current=false;
        setPlaybackReady(true);
      }
      if(video&&!video.paused){
        syncExternalAudio(true);
      }else if(resumeAfterAudio.current&&wantsPlayback.current){
        resumeAfterAudio.current=false;
        window.requestAnimationFrame(()=>{
          if(disposed||sourceToken!==audioSourceToken.current||!wantsPlayback.current)return;
          const playPromise=videoRef.current?.play();
          if(playPromise)void playPromise.then(()=>requestExternalAudioPlayback()).catch(()=>{resumeAfterAudio.current=true;});
        });
      }
    };
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.addEventListener('loadedmetadata',handleReady);
    audio.addEventListener('canplay',handleReady);
    if(!externalAudioUrl)return()=>{
      disposed=true;
      audio.removeEventListener('loadedmetadata',handleReady);
      audio.removeEventListener('canplay',handleReady);
    };
    if(audio.canPlayType('application/vnd.apple.mpegurl')){
      audio.src=externalAudioUrl;
      audio.load();
      return()=>{
        disposed=true;
        audio.removeEventListener('loadedmetadata',handleReady);
        audio.removeEventListener('canplay',handleReady);
      };
    }
    void import('hls.js/light').then(({default:Hls})=>{
      if(disposed||sourceToken!==audioSourceToken.current)return;
      if(!Hls.isSupported())throw new Error('This browser cannot play converted audio.');
      const hls=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:40});
      audioHlsRef.current=hls;
      hls.loadSource(externalAudioUrl);
      hls.attachMedia(audio);
      hls.on(Hls.Events.FRAG_BUFFERED,handleReady);
      hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)setAudioError('Converted audio playback failed.');});
    }).catch((reason)=>{if(!disposed)setAudioError(reason instanceof Error?reason.message:'Converted audio playback failed.');});
    return()=>{
      disposed=true;
      audio.removeEventListener('loadedmetadata',handleReady);
      audio.removeEventListener('canplay',handleReady);
      audioRetryCount.current=0;
      if(audioRetryTimer.current!==null)window.clearTimeout(audioRetryTimer.current);
      audioRetryTimer.current=null;
      audioHlsRef.current?.destroy();
      audioHlsRef.current=null;
    };
  },[externalAudioUrl]);

  useEffect(()=>{
    const video=videoRef.current;
    setPipSupported(Boolean(video && document.pictureInPictureEnabled && typeof video.requestPictureInPicture==='function'));
    if (!video) return;
    const handleEnterPip=()=>setPip(true);
    const handleLeavePip=()=>setPip(false);
    video.addEventListener('enterpictureinpicture',handleEnterPip);
    video.addEventListener('leavepictureinpicture',handleLeavePip);
    return ()=>{
      video.removeEventListener('enterpictureinpicture',handleEnterPip);
      video.removeEventListener('leavepictureinpicture',handleLeavePip);
    };
  },[]);

  useEffect(()=>()=>{
    if(controlsTimer.current!==null)window.clearTimeout(controlsTimer.current);
    if(autoBufferTimer.current!==null)window.clearTimeout(autoBufferTimer.current);
  },[]);

  useEffect(()=>{
    const video=videoRef.current;
    if(!buffering||!video||!wantsPlayback.current||video.paused||video.seeking||localPlayback||selectedQuality!==null||!playbackReady||qualityState!=='idle')return;
    autoBufferTimer.current=window.setTimeout(()=>{
      autoBufferTimer.current=null;
      if(!wantsPlayback.current||video.paused||video.seeking||video.readyState>=HTMLMediaElement.HAVE_FUTURE_DATA)return;
      qualityRequested.current=true;
      void startQuality(selectedAudio??undefined,video.currentTime,true,true).then((ready)=>{
        if(!ready)qualityRequested.current=false;
      });
    },1500);
    return()=>{
      if(autoBufferTimer.current!==null)window.clearTimeout(autoBufferTimer.current);
      autoBufferTimer.current=null;
    };
  },[buffering,playRequested,localPlayback,playbackReady,qualityState,selectedAudio,selectedQuality,startQuality]);

  function handleWaiting(){
    audioRef.current?.pause();
    if(wantsPlayback.current&&!videoRef.current?.paused)setBuffering(true);
  }
  function handlePlaying(){
    setBuffering(false);
    if(autoBufferTimer.current!==null)window.clearTimeout(autoBufferTimer.current);
    autoBufferTimer.current=null;
    syncExternalAudio(true);
  }

  function usesTouchControls(){return window.matchMedia('(hover: none), (pointer: coarse)').matches;}
  function revealControls(){
    if(controlsTimer.current!==null){window.clearTimeout(controlsTimer.current);controlsTimer.current=null;}
    setControlsVisible(true);
  }
  function scheduleControlsHide(){
    if(controlsTimer.current!==null)window.clearTimeout(controlsTimer.current);
    const video=videoRef.current;
    if(!video||video.paused){controlsTimer.current=null;return;}
    controlsTimer.current=window.setTimeout(()=>{
      const keyboardFocus=containerRef.current?.querySelector(':focus-visible');
      if(keyboardFocus){scheduleControlsHide();return;}
      setControlsVisible(false);
      controlsTimer.current=null;
    },2400);
  }

  function syncExternalAudio(play=false,targetTime?:number){
    const video=videoRef.current;const audio=audioRef.current;
    if(!video||!audio||!externalAudioUrl)return;
    const position=targetTime??video.currentTime;
    if(Number.isFinite(position)&&(!Number.isFinite(audio.currentTime)||Math.abs(audio.currentTime-position)>.2)){
      try{audio.currentTime=position;}catch{/* wait for metadata before seeking */}
    }
    try{audio.playbackRate=video.playbackRate;}catch{/* the audio source is still loading */}
    if(play)requestExternalAudioPlayback();
  }
  function requestExternalAudioPlayback(){
    const video=videoRef.current;const audio=audioRef.current;
    if(!video||!audio||!externalAudioUrl||video.paused||audio.readyState<HTMLMediaElement.HAVE_METADATA)return;
    if(!audio.paused)return;
    const result=audio.play();
    if(!result)return;
    void result.then(()=>{
      audioRetryCount.current=0;
      if(audioRetryTimer.current!==null)window.clearTimeout(audioRetryTimer.current);
      audioRetryTimer.current=null;
    }).catch(()=>{
      if(videoRef.current!==video||audioRef.current!==audio||video.paused||!externalAudioUrl)return;
      if(audioRetryCount.current>=8)return;
      audioRetryCount.current++;
      if(audioRetryTimer.current!==null)return;
      audioRetryTimer.current=window.setTimeout(()=>{
        audioRetryTimer.current=null;
        requestExternalAudioPlayback();
      },150);
    });
  }
  function requestVideoPlayback(){
    const video=videoRef.current;
    const requestItemId=item.id;
    if(!video)return;
    void playVideo(video,()=>wantsPlayback.current&&playbackItemId.current===requestItemId,()=>{
      setMuted(true);
      if(audioRef.current)audioRef.current.muted=true;
    }).then(()=>{if(playbackItemId.current===requestItemId)requestExternalAudioPlayback();});
  }
  function toggle(){
    const video=videoRef.current;
    if(!video)return;
    const preparingPlayback=audioPreparing||qualityState==='starting'||fallback==='starting';
    const next=preparingPlayback?!wantsPlayback.current:video.paused;
    wantsPlayback.current=next;
    setPlayRequested(next);
    if(next){audioRetryCount.current=0;requestVideoPlayback();}
    else {video.pause();audioRef.current?.pause();setBuffering(false);}
  }
  function handleVideoClick(){if(usesTouchControls()&&!controlsVisible){revealControls();return;}toggle();revealControls();}
  function seek(value:number){const v=videoRef.current;if(!v)return;v.currentTime=value;if(audioRef.current&&externalAudioUrl){try{audioRef.current.currentTime=value;}catch{audioResumeAt.current=value;}}setCurrent(value);}
  function seekBy(seconds:number){const v=videoRef.current;if(!v)return;seek(Math.max(0,Math.min(v.duration || duration,current + seconds)));}
  function toggleMute(){setMuted((value)=>!value);}
  function setVol(value:number){setMuted(false);setVolume(value);}
  async function fullscreen(){const container=containerRef.current;const video=videoRef.current;if(!container||!video)return;await toggleFullscreen(container,video);}
  async function togglePip(){const v=videoRef.current;if(!v||!pipSupported)return;if(document.pictureInPictureElement)await document.exitPictureInPicture();else await v.requestPictureInPicture().catch(()=>{});}

  async function prepareAudio(stream:number,info=playbackInfo,initial=false,skipAdaptive=false){
    if(!info||(videoFallbackRequested.current&&fallback!=='active'))return;
    if(!initial&&selectedAudio===stream&&!audioPreparing)return;
    const video=videoRef.current;
    const token=++audioToken.current;
    const shouldResume=wantsPlayback.current;
    const position=video&&Number.isFinite(video.currentTime)?video.currentTime:current;
    const track=info.audioTracks.find((candidate)=>candidate.index===stream);
    const canUseOriginal=stream===info.defaultAudioStream&&Boolean(track&&DIRECT_AUDIO_CODECS.has(track.codec));
    setSelectedAudio(stream);
    setAudioError('');
    sourceTransition.current=true;
    video?.pause();
    audioRef.current?.pause();

    if(!skipAdaptive&&info.qualityOptions.length&&qualityState==='active'){
      qualityRequested.current=true;
      resumeAfterAudio.current=false;
      audioResumeAt.current=null;
      setExternalAudioUrl('');
      setPlaybackReady(false);
      const ready=await startQuality(stream,position,shouldResume);
      if(token!==audioToken.current)return;
      if(ready){sourceTransition.current=false;setPlaybackReady(true);return;}
      qualityRequested.current=false;
    }

    if(fallback==='active'){
      resumeAfterAudio.current=false;
      audioResumeAt.current=null;
      setExternalAudioUrl('');
      void startFallback(stream,position,shouldResume);
      return;
    }
    if(canUseOriginal){
      resumeAfterAudio.current=false;
      audioResumeAt.current=null;
      setExternalAudioUrl('');
      setAudioPreparing(false);
      sourceTransition.current=false;
      setPlaybackReady(true);
      if(shouldResume)window.setTimeout(()=>{
        if(token!==audioToken.current||!wantsPlayback.current)return;
        const nextVideo=videoRef.current;
        if(nextVideo){nextVideo.muted=muted;nextVideo.volume=volume;void nextVideo.play().catch(()=>{});}
      },0);
      return;
    }

    resumeAfterAudio.current=shouldResume;
    audioResumeAt.current=position;
    setPlaybackReady(false);
    setAudioPreparing(true);
    try{
      const url=await waitForAudio(item.id,stream,()=>token!==audioToken.current);
      if(token!==audioToken.current)return;
      setExternalAudioUrl(url);
    }catch(reason){
      if(token!==audioToken.current)return;
      setAudioError(reason instanceof Error?reason.message:'The selected audio track could not be prepared.');
    }finally{
      if(token===audioToken.current)setAudioPreparing(false);
    }
  }

  async function selectQuality(height:number|null){
    saveQualityPreference(height);
    setQuality(height);
    if(qualityState==='active'||qualityState==='starting'||height===null||height===playbackInfo?.qualityOptions[0]?.height)return;
    const video=videoRef.current;
    const shouldResume=wantsPlayback.current;
    qualityRequested.current=true;
    sourceTransition.current=true;
    video?.pause();
    setPlaybackReady(false);
    const ready=await startQuality(selectedAudio??undefined,video?.currentTime||current,shouldResume);
    if(playbackItemId.current!==item.id)return;
    if(ready){sourceTransition.current=false;setPlaybackReady(true);return;}
    qualityRequested.current=false;
    setQuality(playbackInfo?.qualityOptions[0]?.height??null);
    sourceTransition.current=false;
    setPlaybackReady(true);
    if(wantsPlayback.current)requestVideoPlayback();
  }

  function prepareCompatibleVideo(){
    if(qualityRequested.current||qualityState==='starting'||qualityState==='active'||fallback!=='idle'||videoFallbackRequested.current)return;
    videoFallbackRequested.current=true;
    const video=videoRef.current;
    const shouldPlay=wantsPlayback.current;
    audioToken.current++;
    audioRef.current?.pause();
    setExternalAudioUrl('');
    setAudioPreparing(false);
    setAudioError('');
    void startFallback(selectedAudio??undefined,video?.currentTime||current,shouldPlay);
  }

  const pauseAction=playing||(playRequested&&(audioPreparing||qualityState==='starting'||fallback==='starting'));
  return <div className={`player${queue?.length?' has-queue':''}${controlsVisible?' controls-visible':''}`} ref={containerRef} onDoubleClick={()=>void fullscreen()} onPointerMove={(event)=>{if(event.pointerType==='mouse'){revealControls();scheduleControlsHide();}}} onPointerDown={revealControls} onPointerUp={scheduleControlsHide} onPointerCancel={scheduleControlsHide} onPointerLeave={scheduleControlsHide} onFocusCapture={revealControls} onBlurCapture={scheduleControlsHide} onKeyDown={()=>{revealControls();scheduleControlsHide();}}>
    <video
      ref={videoRef}
      src={`/api/media/${item.id}/stream`}
      playsInline
      loop={looping}
      preload={autoPlay?'auto':'metadata'}
      autoPlay={false}
      crossOrigin="anonymous"
      onClick={handleVideoClick}
      onVolumeChange={(event)=>{if(!externalAudioUrl){setMuted(event.currentTarget.muted);setVolume(event.currentTarget.volume);}}}
      onPlay={()=>{setPlaying(true);syncExternalAudio(true);requestExternalAudioPlayback();revealControls();scheduleControlsHide();}}
      onPlaying={handlePlaying}
      onWaiting={handleWaiting}
      onSeeking={()=>audioRef.current?.pause()}
      onSeeked={()=>syncExternalAudio(!videoRef.current?.paused)}
      onPause={(e)=>{if(!sourceTransition.current){wantsPlayback.current=false;setPlayRequested(false);}audioRef.current?.pause();if(audioRetryTimer.current!==null)window.clearTimeout(audioRetryTimer.current);audioRetryTimer.current=null;audioRetryCount.current=0;setPlaying(false);setBuffering(false);if(autoBufferTimer.current!==null)window.clearTimeout(autoBufferTimer.current);autoBufferTimer.current=null;revealControls();const v=e.currentTarget;void api.progress(playbackItemId.current,v.currentTime,fullDuration(v.duration,item.duration,duration));}}
      onLoadedMetadata={(e)=>{
        const v=e.currentTarget;playbackItemId.current=item.id;setDuration(fullDuration(v.duration,item.duration));
        if(initialResumeItem.current!==item.id){
          initialResumeItem.current=item.id;
          const resume=item.progress_position||0;
          if(resume>5 && (!v.duration || resume < v.duration*.92)) v.currentTime=resume;
        }
      }}
      onDurationChange={(e)=>setDuration(fullDuration(e.currentTarget.duration,item.duration,duration))}
      onCanPlay={(e)=>{
        if(!e.currentTarget.paused)syncExternalAudio(true);
        else if(wantsPlayback.current&&playbackReady&&fallback==='idle'&&qualityState==='idle'&&!audioPreparing)requestVideoPlayback();
      }}
      onTimeUpdate={(e)=>{
        const v=e.currentTarget;setCurrent(v.currentTime);syncExternalAudio(!v.paused);
        if(Math.abs(v.currentTime-lastProgress.current)>5){lastProgress.current=v.currentTime;void api.progress(playbackItemId.current,v.currentTime,fullDuration(v.duration,item.duration,duration));}
      }}
      onRateChange={()=>syncExternalAudio(false)}
      onEnded={(e)=>{audioRef.current?.pause();const total=fullDuration(e.currentTarget.duration,item.duration,duration);void api.progress(playbackItemId.current,total,total);onEnded?.();}}
      onError={prepareCompatibleVideo}
    >
      {selectedSubtitle!==null&&<HiddenSubtitleTrack
        key={selectedSubtitle}
        src={api.subtitleUrl(item.id,selectedSubtitle)}
        srcLang={playbackInfo?.subtitleTracks.find((track)=>track.index===selectedSubtitle)?.language||'und'}
        label={playbackInfo?.subtitleTracks.find((track)=>track.index===selectedSubtitle)?.title||'Subtitles'}
        onText={setActiveCaption}
      />}
    </video>
    <audio ref={audioRef} preload="auto"/>
    <DraggableCaption key={`${item.id}:${selectedSubtitle}`} text={activeCaption} controlsVisible={controlsVisible} containerRef={containerRef} onDraggingChange={(dragging)=>{if(dragging)revealControls();else window.setTimeout(scheduleControlsHide,0);}}/>
    {qualityState==='starting'&&playRequested&&(!playing||buffering)&&<div className="player-status"><SpinnerGap className="spin"/><strong>{selectedQuality===null?'Buffering…':`Switching to ${qualityLabel(selectedQuality)}…`}</strong></div>}
    {audioPreparing&&playRequested&&<div className="player-status"><SpinnerGap className="spin"/><strong>Preparing audio…</strong><span>Only the audio track is being converted. The cached result will be reused.</span></div>}
    {fallback==='starting'&&playRequested&&(!playing||buffering) && <div className="player-status"><SpinnerGap className="spin"/><strong>{playbackInfo?.requiresVideoTranscode?'Preparing video…':'Preparing audio…'}</strong></div>}
    {(fallback==='error'||audioError||(qualityState==='error'&&qualityRequested.current&&!playing)) && <div className="player-status error"><strong>Playback unavailable</strong><span>{audioError||error||qualityError}</span></div>}
    <div className="player-gradient"/>
    <div className="player-controls">
      <input className="player-seek" style={{'--range-fill':`${Math.min(100, duration > 0 ? current/duration*100 : 0)}%`} as React.CSSProperties} aria-label="Seek" type="range" min="0" max={Math.max(duration,1)} step="0.1" value={Math.min(current,Math.max(duration,1))} onChange={(e)=>seek(Number(e.target.value))}/>
      <div className="player-toolbar">
        {onPrev && <button onClick={onPrev} aria-label="Previous video" disabled={!canGoPrev}><SkipBack weight="fill"/></button>}
        <button className="skip-button" onClick={()=>seekBy(-10)} aria-label="Rewind 10 seconds"><Rewind weight="bold"/></button>
        <button onClick={toggle} aria-label={pauseAction?'Pause':'Play'} aria-busy={audioPreparing}>{pauseAction?<Pause weight="fill"/>:<Play weight="fill"/>}</button>
        <button className="skip-button" onClick={()=>seekBy(10)} aria-label="Fast-forward 10 seconds"><FastForward weight="bold"/></button>
        {onNext && <button onClick={onNext} aria-label="Next video" disabled={!canGoNext}><SkipForward weight="fill"/></button>}
        <button className={looping?'active':''} onClick={()=>setLooping((value)=>!value)} aria-label={looping?'Turn off loop':'Loop current video'} aria-pressed={looping}><RepeatOnce weight={looping?'fill':'regular'}/></button>
        <button onClick={toggleMute} aria-label={muted?'Unmute':'Mute'}>{muted?<SpeakerSlash weight="fill"/>:<SpeakerHigh weight="fill"/>}</button>
        <input className="volume-slider" style={{'--range-fill':`${muted ? 0 : volume*100}%`} as React.CSSProperties} aria-label="Volume" type="range" min="0" max="1" step="0.05" value={muted?0:volume} onChange={(e)=>setVol(Number(e.target.value))}/>
        <span className="player-time">{time(current)} / {time(duration)}</span>
        {queue && queueIndex!==undefined && <span className="player-queue">{queueIndex+1} / {queue.length}</span>}
        {playbackInfo&&<PlaybackSettingsMenu
          audioTracks={playbackInfo.audioTracks}
          subtitleTracks={playbackInfo.subtitleTracks}
          selectedAudio={selectedAudio}
          selectedSubtitle={selectedSubtitle}
          qualityOptions={qualityOptions.length?qualityOptions:playbackInfo.qualityOptions}
          selectedQuality={selectedQuality}
          activeQuality={activeQuality}
          allowAutoQuality={!localPlayback}
          busy={audioPreparing||fallback==='starting'}
          onSelectAudio={(stream)=>void prepareAudio(stream)}
          onSelectSubtitle={setSelectedSubtitle}
          onSelectQuality={(height)=>void selectQuality(height)}
        />}
        {pipSupported && <button onClick={()=>void togglePip()} aria-label={pip?'Exit Picture in Picture':'Picture in Picture'} className={pip?'active':''}>{pip?<PictureInPicture weight="fill"/>:<PictureInPicture/>}</button>}
        <button onClick={()=>void fullscreen()} aria-label="Fullscreen"><ArrowsOut/></button>
      </div>
    </div>
  </div>;
}

async function waitForAudio(mediaId:number,audioStream:number,cancelled:()=>boolean){
  const started=await api.startAudioTranscode(mediaId,audioStream);
  if(started.status==='error')throw new Error(started.error||'Audio conversion failed.');
  if(started.status==='ready')return started.url;
  for(let attempt=0;attempt<1200;attempt++){
    await new Promise((resolve)=>window.setTimeout(resolve,250));
    if(cancelled())throw new DOMException('Audio preparation was cancelled.','AbortError');
    const status=await api.audioTranscodeStatus(mediaId,audioStream);
    if(status.status==='ready')return status.url;
    if(status.status==='error')throw new Error(status.error||'Audio conversion failed.');
  }
  throw new Error('Audio conversion did not finish in time.');
}

function time(value:number){if(!Number.isFinite(value))return '0:00';const h=Math.floor(value/3600);const m=Math.floor(value%3600/60);const s=Math.floor(value%60);return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;}
function fullDuration(...values:Array<number|null|undefined>){return Math.max(0,...values.filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0));}
function isLocalPlaybackHost(){return ['localhost','127.0.0.1','::1','[::1]'].includes(window.location.hostname.toLowerCase());}
function qualityLabel(height:number){return height>=2160?'4K':`${height}p`;}
type QualityPreference='auto'|'source'|number;
function readQualityPreference(localPlayback:boolean):QualityPreference{
  try{
    const stored=window.localStorage.getItem(QUALITY_PREFERENCE_KEY);
    if(stored==='auto')return localPlayback?'source':'auto';
    const height=Number(stored);
    if(Number.isFinite(height)&&height>0)return height;
  }catch{/* use the host default */}
  return localPlayback?'source':'auto';
}
function saveQualityPreference(height:number|null){
  try{window.localStorage.setItem(QUALITY_PREFERENCE_KEY,height===null?'auto':String(height));}catch{/* keep the current session */}
}
function resolvePreferredQuality(qualities:PlaybackInfo['qualityOptions'],preference:QualityPreference){
  if(preference==='auto')return null;
  if(!qualities.length)return null;
  if(preference==='source')return qualities[0].height;
  return qualities.find((quality)=>quality.height<=preference)?.height??qualities.at(-1)?.height??null;
}
