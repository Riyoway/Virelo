import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import { api } from '../api';
import { PlaybackQueue } from '../components/PlaybackQueue';
import { Player } from '../components/Player';

export function WatchView(){
  const { mediaId } = useParams({from:'/watch/$mediaId'});
  const searchParams = useSearch({from:'/watch/$mediaId'});
  const queueEnabled = Boolean(searchParams.queue);
  const settingsQ = useQuery({queryKey:['settings'],queryFn:api.settings});
  const behavior = settingsQ.data?.queueBehavior ?? 'auto';
  const queueQ = useQuery({
    queryKey:['watch-queue',searchParams],
    queryFn:()=>api.media({search:searchParams.search,folder:searchParams.folder,libraryId:searchParams.libraryId,sort:searchParams.sort,limit:500}),
    enabled:queueEnabled
  });
  const itemQ = useQuery({queryKey:['media',Number(mediaId)],queryFn:()=>api.mediaById(Number(mediaId)),enabled:!queueEnabled});
  const items = queueEnabled ? (queueQ.data ?? []) : [];
  const [index,setIndex] = useState(()=>items.findIndex((i)=>i.id===Number(mediaId)));
  useEffect(()=>{
    if (!queueEnabled) return;
    const found = items.findIndex((i)=>i.id===Number(mediaId));
    setIndex(found>=0?found:0);
  },[queueEnabled,mediaId,items]);

  if (queueEnabled) {
    if (!queueQ.data) return <div className="watch-loading skeleton"/>;
    const activeIndex=index>=0&&index<items.length?index:Math.max(items.findIndex((item)=>item.id===Number(mediaId)),0);
    const current = items[activeIndex];
    if (!current) return <div className="watch-empty"><h1>No media in this folder</h1><p>The current filter matches no videos.</p></div>;
    const wraps=behavior==='loop';
    const canGoPrevious=items.length>1&&(activeIndex>0||wraps);
    const canGoNext=items.length>1&&(activeIndex<items.length-1||wraps);
    const selectIndex=(target:number)=>{
      if(target<0){if(wraps)setIndex(items.length-1);return;}
      if(target>=items.length){if(wraps)setIndex(0);return;}
      setIndex(target);
    };
    const advance=(dir:number)=>selectIndex(activeIndex+dir);
    const handleEnded=()=>{
      const last=activeIndex>=items.length-1;
      if (last) { if (behavior==='loop') setIndex(0); return; }
      if (behavior==='manual') return;
      setIndex(activeIndex+1);
    };
    return <div className="watch-view">
      <button className="watch-back" onClick={()=>history.back()} aria-label="Back"><ArrowLeft/></button>
      <Player item={current} queue={items} queueIndex={activeIndex} onEnded={handleEnded} onNext={()=>advance(1)} onPrev={()=>advance(-1)} canGoNext={canGoNext} canGoPrev={canGoPrevious} autoPlay/>
      <PlaybackQueue items={items} activeIndex={activeIndex} canGoPrevious={canGoPrevious} canGoNext={canGoNext} onSelect={selectIndex} onPrevious={()=>advance(-1)} onNext={()=>advance(1)}/>
      <div className="watch-copy">
        <h1>{current.title}</h1>
        <p className="watch-description">{current.overview||current.filename}</p>
      </div>
    </div>;
  }
  if (itemQ.isLoading || !itemQ.data) return <div className="watch-loading skeleton"/>;
  return <div className="watch-view"><button className="watch-back" onClick={()=>history.back()} aria-label="Back"><ArrowLeft/></button><Player item={itemQ.data} autoPlay/><div className="watch-copy"><h1>{itemQ.data.title}</h1><p>{itemQ.data.overview||itemQ.data.filename}</p></div></div>;
}
