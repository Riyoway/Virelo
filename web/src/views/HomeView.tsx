import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@heroui/react';
import { Play, Info } from '@phosphor-icons/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { api, artwork } from '../api';
import { MediaRow } from '../components/MediaRow';
import { MediaCard } from '../components/MediaCard';
import { EmptyState } from '../components/EmptyState';

const HERO_ROTATE_MS = 30_000;

export function HomeView() {
  const navigate = useNavigate();
  const {data,isLoading} = useQuery({queryKey:['home'],queryFn:api.home,refetchInterval:(q)=>q.state.data?.total === 0 ? 2_000 : 30_000});
  const shorts = useQuery({queryKey:['shorts','row'],queryFn:()=>api.shorts({limit:12}),staleTime:60_000});
  const favorites = useQuery({queryKey:['favorites'],queryFn:()=>api.media({liked:'1',limit:12}),staleTime:60_000});
  const heroPool = useMemo(() => {
    const base = data?.recent ?? [];
    const withArt = base.filter((h)=>h.thumbnail_path || (h.external_id && (h.poster_path || h.backdrop_path)));
    return withArt.length ? withArt : base;
  },[data]);
  const [heroIndex,setHeroIndex] = useState<number|null>(null);
  const [heroPaused,setHeroPaused] = useState(false);
  useEffect(()=>{
    if (heroIndex===null && heroPool.length) setHeroIndex(Math.floor(Math.random()*heroPool.length));
  },[heroIndex,heroPool.length]);
  useEffect(()=>{
    if (heroPool.length<2 || heroPaused) return;
    const id = setInterval(()=>{
      setHeroIndex((current)=>{
        if (current===null || heroPool.length<2) return current;
        let next = current;
        while (next===current) next = Math.floor(Math.random()*heroPool.length);
        return next;
      });
    }, HERO_ROTATE_MS);
    return ()=>clearInterval(id);
  },[heroPool.length,heroPaused]);
  if (isLoading) return <HomeSkeleton/>;
  if (!data || data.total === 0) return <EmptyState/>;
  const hero = heroPool.length ? heroPool[(heroIndex ?? 0) % heroPool.length] : undefined;
  return <div className="home-view">
    {hero && <section key={hero.id} className="hero-banner hero-swap">
      <img className="hero-backdrop" src={artwork(hero, hero.backdrop_path ? 'backdrop' : hero.poster_path ? 'poster' : 'thumbnail')} alt="" onError={(e)=>{e.currentTarget.style.display='none';}}/>
      <div className="hero-vignette"/>
      <div className="hero-content">
        <h1>{hero.title}</h1>
        <p>{hero.overview || `${hero.kind === 'series' ? 'Series' : 'Movie'}${hero.year ? ` · ${hero.year}` : ''}${hero.height ? ` · ${hero.height}p` : ''}`}</p>
        <div className="hero-actions">
          <Button size="lg" onPress={()=>void navigate({to:'/watch/$mediaId',params:{mediaId:String(hero.id)}})}><Play weight="fill"/> Play</Button>
          <Button size="lg" variant="secondary" onPress={()=>void navigate({to:'/title/$mediaId',params:{mediaId:String(hero.id)}})}><Info/> Details</Button>
        </div>
      </div>
      {heroPool.length>1 && heroIndex!==null && <div className="hero-dots" onMouseEnter={()=>setHeroPaused(true)} onMouseLeave={()=>setHeroPaused(false)}>
        {heroPool.map((h,i)=><button key={h.id} className={i===(heroIndex%heroPool.length)?'on':''} aria-label={`Featured title ${i+1}`} onClick={()=>setHeroIndex(i)}/>)}
      </div>}
    </section>}
    <div className="home-rows">
      <MediaRow title="Continue watching" items={data.continueWatching} playDirect/>
      {favorites.data && favorites.data.length > 0 && <MediaRow title="Favorites" items={favorites.data}/>} 
      {shorts.data && shorts.data.total > 0 && (
        <section className="media-section">
          <div className="section-heading"><h2>Shorts</h2><Link to="/shorts" className="row-link">View all</Link></div>
          <div className="media-row shorts-row">{shorts.data.items.map(item=><MediaCard key={item.id} item={item} short/>)}</div>
        </section>
      )}
      <MediaRow title="Recently added" items={data.recent}/>
      <MediaRow title="Movies" items={data.movies}/>
      <MediaRow title="Series" items={data.series}/>
    </div>
  </div>;
}

function HomeSkeleton() {
  return <div className="home-skeleton"><div className="skeleton hero-skeleton"/><div className="skeleton-line"/><div className="skeleton-row">{Array.from({length:6},(_,i)=><div className="skeleton card-skeleton" key={i}/>)}</div></div>;
}
