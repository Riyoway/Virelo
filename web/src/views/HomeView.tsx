import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@heroui/react';
import { Play, Info, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { api, artwork } from '../api';
import { MediaRow } from '../components/MediaRow';
import { EmptyState } from '../components/EmptyState';
import { distinctDiscoveryShelves, mediaGenres, moviesOutsideRecent } from '../utils/home-catalog';
import type { MediaItem } from '../types';
import '../home.css';

type HomeFilter='all'|'movie'|'series';
const filters=[['all','For you'],['movie','Movies'],['series','Series']] as const;
function featuredTitles(items:MediaItem[]) {
  const seen=new Set<string>();
  return items.filter(item=>{
    if(item.width&&item.height&&item.height>item.width)return false;
    const key=item.kind==='series'&&item.series_title?item.library_id+':'+item.series_title:'item:'+item.id;
    if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>Number(Boolean(b.backdrop_path||b.thumbnail_path))-Number(Boolean(a.backdrop_path||a.thumbnail_path))).slice(0,5);
}
export function HomeView() {
  const navigate=useNavigate();
  const [filter,setFilter]=useState<HomeFilter>('all');
  const [heroIndex,setHeroIndex]=useState(0);
  const [shortsSeed]=useState(()=>Math.floor(Date.now()/86400000));
  const home=useQuery({queryKey:['home'],queryFn:api.home,refetchInterval:q=>q.state.data?.total===0?2000:30000});
  const shorts=useQuery({queryKey:['shorts','row',shortsSeed],queryFn:()=>api.shorts({limit:12,seed:shortsSeed}),staleTime:60000});
  const data=home.data;
  const heroPool=useMemo(()=>!data?[]:featuredTitles(filter==='movie'?data.movies:filter==='series'?data.series:
    [...(data.unwatched??[]),...data.movies,...data.series,...data.recent]),[data,filter]);
  const pick=(items:MediaItem[]|undefined)=>(items??[]).filter(item=>filter==='all'||item.kind===filter);
  if(home.isLoading)return <HomeSkeleton/>;
  if(home.isError&&!data)return <div className="home-load-error"><h1>Couldn’t load your library</h1><p>Try again to reconnect to your videos.</p><Button onPress={()=>void home.refetch()}>Try again</Button></div>;
  if(!data||data.total===0)return <EmptyState/>;
  const index=heroIndex%Math.max(1,heroPool.length),hero=heroPool[index];
  const genres=hero?mediaGenres(hero.genres).slice(0,2):[];
  const metadata=hero?[hero.kind==='series'?'Series':hero.kind==='movie'?'Movie':null,hero.year,
    hero.kind==='series'&&hero.season!==null&&hero.episode!==null?'S'+hero.season+' · E'+hero.episode:
    hero.duration?Math.round(hero.duration/60)+' min':null,...genres].filter(Boolean):[];
  const resume=hero&&(hero.progress_position??0)>10&&!hero.progress_completed;
  // Recent remains authoritative; omit identical discovery collections even
  // when their order differs. History and favorites keep their own purpose.
  const genreShelves=data.genres??[];
  const discoveryShelves=distinctDiscoveryShelves(pick(data.recent),[
    pick(data.unwatched),filter==='series'?[]:pick(data.quickWatches),filter==='movie'?[]:data.series,
    ...genreShelves.map(genre=>pick(genre.items)),
    filter==='series'?[]:moviesOutsideRecent(data.movies,data.recent)
  ]);
  const [unwatched,quickWatches,series]=discoveryShelves;
  const movieDiscovery=discoveryShelves[discoveryShelves.length-1];
  return <div className="home-view">
    <nav className="home-browse" aria-label="Home categories">
      <div className="home-filter">{filters.map(([value,label])=><button key={value} aria-pressed={filter===value}
        onClick={()=>{setFilter(value);setHeroIndex(0);}}>{label}</button>)}</div>
      <Link to="/library" className="home-library-link">Browse library</Link>
    </nav>
    {hero?<section className={'hero-banner home-feature'+(hero.backdrop_path||hero.thumbnail_path||hero.poster_path?'':' home-feature-text')} aria-label="Featured titles">
      <FeaturedArtwork key={hero.id+':'+hero.backdrop_path+':'+hero.thumbnail_path+':'+hero.poster_path} item={hero}/>
      <div className="hero-vignette"/>
      <div className="hero-content">
        <h1>{hero.kind==='series'?hero.series_title||hero.title:hero.title}</h1>
        {metadata.length>0&&<div className="home-feature-meta">{metadata.map((value,i)=><span key={i}>{value}</span>)}</div>}
        {hero.overview&&<p>{hero.overview}</p>}
        <div className="hero-actions">
          <Button size="lg" onPress={()=>void navigate({to:'/watch/$mediaId',params:{mediaId:String(hero.id)}})}>
            <Play weight="fill"/>{resume?'Resume':'Play'}
          </Button>
          <Button size="lg" variant="secondary" onPress={()=>void navigate({to:'/title/$mediaId',params:{mediaId:String(hero.id)}})}><Info/>More info</Button>
        </div>
      </div>
      {heroPool.length>1&&<div className="home-feature-picker">
        <div className="home-feature-navigation"><button aria-label="Previous featured title" onClick={()=>setHeroIndex((index+heroPool.length-1)%heroPool.length)}><CaretLeft/></button>
          <span>{index+1} / {heroPool.length}</span>
          <button aria-label="Next featured title" onClick={()=>setHeroIndex((index+1)%heroPool.length)}><CaretRight/></button>
        </div>
        <div className="home-feature-previews">{heroPool.map((item,i)=><button key={item.id} aria-pressed={i===index}
          aria-label={'Feature '+(item.series_title||item.title)} onClick={()=>setHeroIndex(i)}>
          <img src={artwork(item,item.backdrop_path?'backdrop':'thumbnail')} alt="" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>
          <span>{item.series_title||item.title}</span>
        </button>)}</div>
      </div>}
    </section>:<header className="home-simple-heading"><h1>{filter==='series'?'Series':filter==='movie'?'Movies':'Your library'}</h1></header>}
    <div className="home-rows home-curated-rows">
      <MediaRow title="Continue watching" items={pick(data.continueWatching)} playDirect/>
      <MediaRow title="Up next" items={pick(data.nextEpisodes)} playDirect/>
      <MediaRow title="Not watched yet" items={unwatched} poster/>
      <MediaRow title="Your favorites" items={pick(data.favorites)} poster/>
      <MediaRow title="Recently added" items={pick(data.recent)}/>
      {filter!=='series'&&<MediaRow title="A movie in 90 minutes" items={quickWatches} poster/>}
      {filter!=='movie'&&<MediaRow title="Your series" items={series} poster seriesTitles/>}
      {genreShelves.map((genre,i)=><MediaRow key={genre.name} title={genre.name} items={discoveryShelves[i+3]} poster/>)}
      {filter==='all'&&shorts.data&&shorts.data.total>0&&<MediaRow title="Shorts" items={shorts.data.items} short
        action={<Link to="/shorts" className="row-link">View all</Link>}/>}
      {filter!=='series'&&<MediaRow title="Movies" items={movieDiscovery} poster/>}
      {filter!=='all'&&!(filter==='movie'?data.movies:data.series).length&&<div className="home-category-empty"><h2>No {filter==='movie'?'movies':'series'} yet</h2>
        <p>Browse your library or add another folder in Settings.</p><Link to="/library">Browse library</Link></div>}
    </div>
  </div>;
}
function FeaturedArtwork({item}:{item:MediaItem}) {
  const sources=[...new Set((['backdrop','thumbnail','poster'] as const).filter(kind=>Boolean(kind==='backdrop'?item.backdrop_path:kind==='poster'?item.poster_path:item.thumbnail_path)).map(kind=>artwork(item,kind)))];
  const [fallback,setFallback]=useState(0);
  return fallback<sources.length?<img className="hero-backdrop" src={sources[fallback]} alt="" fetchPriority="high" onError={()=>setFallback(current=>current+1)}/>:null;
}
function HomeSkeleton() {
  return <div className="home-skeleton"><div className="skeleton hero-skeleton"/>{[0,1].map(row=><div key={row}>
    <div className="skeleton-line"/><div className="skeleton-row">{Array.from({length:6},(_,i)=><div className="skeleton card-skeleton" key={i}/>)}</div>
  </div>)}</div>;
}
