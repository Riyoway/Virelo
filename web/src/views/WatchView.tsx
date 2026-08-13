import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { api } from '../api';
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
    const current = items[index];
    if (!current) return <div className="watch-empty"><h1>No media in this folder</h1><p>The current filter matches no videos.</p></div>;
    const next = items[index+1] ?? (behavior==='loop' ? items[0] : undefined);
    const advance=(dir:number)=>setIndex((index+dir+items.length)%items.length);
    const handleEnded=()=>{
      const last=index>=items.length-1;
      if (last) { if (behavior==='loop') setIndex(0); return; }
      if (behavior==='manual') return;
      setIndex(index+1);
    };
    return <div className="watch-view">
      <button className="watch-back" onClick={()=>history.back()} aria-label="Back"><ArrowLeft/></button>
      <Player key={current.id} item={current} queue={items} queueIndex={index} onEnded={handleEnded} onNext={()=>advance(1)} onPrev={()=>advance(-1)} autoPlay/>
      <div className="watch-copy">
        <h1>{current.title}</h1>
        <p>{next ? `Up next: ${next.title}` : (behavior==='loop'?'Looping the folder':'End of folder')}</p>
        <p>{current.overview||current.filename}</p>
        {next && <button className="watch-next-card" onClick={()=>advance(1)} aria-label={`Play next: ${next.title}`}><span><small>UP NEXT</small><strong>{next.title}</strong></span><ArrowRight/></button>}
      </div>
    </div>;
  }
  if (itemQ.isLoading || !itemQ.data) return <div className="watch-loading skeleton"/>;
  return <div className="watch-view"><button className="watch-back" onClick={()=>history.back()} aria-label="Back"><ArrowLeft/></button><Player item={itemQ.data}/><div className="watch-copy"><h1>{itemQ.data.title}</h1><p>{itemQ.data.overview||itemQ.data.filename}</p></div></div>;
}
