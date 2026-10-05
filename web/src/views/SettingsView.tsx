import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Switch } from '@heroui/react';
import { ArrowLeft, ArrowsClockwise, CheckCircle, FolderPlus, Trash, WarningCircle } from '@phosphor-icons/react';
import { api } from '../api';
import { ScanProgress } from '../components/ScanProgress';
import { Select } from '../components/Select';
import { SettingsNavigation } from '../components/SettingsNavigation';
import type { QueueBehavior, Settings } from '../types';

const settingsSections = [
  { id:'libraries', label:'Libraries', description:'Folders and automatic scanning' },
  { id:'network', label:'Metadata', description:'Titles, posters and artwork' },
  { id:'playback', label:'Playback', description:'What plays next' },
  { id:'shorts', label:'Shorts', description:'Videos in your vertical feed' },
  { id:'tools', label:'Advanced', description:'Media tool availability' },
] as const;
const QUEUE_OPTIONS = [
  { value: 'auto', label: 'Auto next, stop at end' },
  { value: 'loop', label: 'Auto next, loop folder' },
  { value: 'manual', label: 'Manual next only' }
];
type SettingsSectionId = (typeof settingsSections)[number]['id'];

export function SettingsView(){
  const client=useQueryClient();
  const settingsQuery=useQuery({queryKey:['settings'],queryFn:api.settings});
  const libraries=useQuery({queryKey:['libraries'],queryFn:api.libraries});
  const scan=useQuery({queryKey:['scan'],queryFn:api.scanStatus,refetchInterval:(q)=>q.state.data?.running?1000:5000});
  const health=useQuery({queryKey:['health'],queryFn:async()=>{const r=await fetch('/api/health');return r.json() as Promise<{ffmpeg:boolean;ffprobe:boolean}>;}});
  const [form,setForm]=useState<Settings|null>(null);
  const [path,setPath]=useState('');
  const [activeSection,setActiveSection]=useState<SettingsSectionId>('libraries');
  const [mobileDetail,setMobileDetail]=useState(false);
  const openSection=(id:string)=>{
    setActiveSection(id as SettingsSectionId);
    setMobileDetail(true);
    if(window.matchMedia('(max-width: 900px)').matches) window.requestAnimationFrame(()=>document.querySelector<HTMLElement>(`#settings-title-${id}`)?.focus());
  };
  const closeSection=()=>{
    setMobileDetail(false);
    window.requestAnimationFrame(()=>document.getElementById(`settings-nav-${activeSection}`)?.focus());
  };
  useEffect(()=>{if(settingsQuery.data&&!form)setForm(settingsQuery.data);},[settingsQuery.data,form]);
  const save=useMutation({mutationFn:()=>api.saveSettings(form!),onSuccess:(data)=>{setForm(data);client.setQueryData(['settings'],data);}});
  const add=useMutation({mutationFn:()=>api.addLibrary(path),onSuccess:()=>{setPath('');void client.invalidateQueries({queryKey:['libraries']});void client.invalidateQueries({queryKey:['scan']});}});
  const remove=useMutation({mutationFn:(id:number)=>api.removeLibrary(id),onSuccess:()=>{void client.invalidateQueries({queryKey:['libraries']});void client.invalidateQueries({queryKey:['home']});}});
  const clearMetadata=useMutation({mutationFn:api.clearAllMetadata,onSuccess:()=>client.invalidateQueries({predicate:(query)=>['home','media','related','shorts','watch-queue','queue','search'].includes(String(query.queryKey[0]))})});
  if(!form)return <div className="settings-loading skeleton"/>;
  const hasChanges=JSON.stringify(form)!==JSON.stringify(settingsQuery.data);
  return <div className={`content-view settings-view${mobileDetail?' settings-detail-open':''}`}>
    <header className="settings-heading"><h1>Settings</h1><div className="settings-heading-actions"><span aria-live="polite">{save.isSuccess&&!hasChanges&&<span className="settings-saved"><CheckCircle/> Saved</span>}</span><Button isPending={save.isPending} isDisabled={!hasChanges} onPress={()=>save.mutate()}>Save settings</Button></div></header>
    {save.error&&<p className="error-copy settings-save-error">{save.error.message}</p>}

    <div className="settings-layout">
      <SettingsNavigation sections={settingsSections} activeSection={activeSection} onSelect={openSection}/>

      <div className="settings-content">
        <button type="button" className="settings-back" onClick={closeSection}><ArrowLeft aria-hidden="true"/> All settings</button>
        {activeSection==='libraries'&&<section id="settings-panel-libraries" className="settings-card settings-section" aria-labelledby="settings-title-libraries">
          <div className="settings-card-head"><div><h2 id="settings-title-libraries" tabIndex={-1}>Libraries</h2><p>Manage the folders Virelo scans for media.</p></div></div>
          <div className="add-library"><Input aria-label="Media folder path" placeholder={navigator.userAgent.includes('Windows')?'D:\\Videos':'/home/user/Videos'} value={path} onChange={(e)=>setPath(e.target.value)}/><Button isPending={add.isPending} onPress={()=>add.mutate()} isDisabled={!path.trim()}><FolderPlus/> Add folder</Button></div>
          {add.error&&<p className="error-copy">{add.error.message}</p>}
          <div className="library-list">{libraries.data?.map(lib=><div key={lib.id}><div><strong>{lib.label}</strong><span>{lib.path}</span></div><Button isIconOnly variant="ghost" aria-label={`Remove ${lib.label}`} onPress={()=>remove.mutate(lib.id)}><Trash/></Button></div>)}</div>
          <div className="scan-strip"><div>{scan.data?.running?<ArrowsClockwise className="spin"/>:<CheckCircle/>}<span><strong>{scan.data?.message||'Idle'}</strong>{scan.data?.running&&` · ${scan.data.scanned} scanned`}</span></div><Button variant="secondary" isPending={scan.data?.running} onPress={()=>api.startScan().then(()=>client.invalidateQueries({queryKey:['scan']}))}>Scan</Button></div>
          <ScanProgress status={scan.data} compact/>
          <SettingSwitch checked={form.showAllLibraries} onChange={(v)=>setForm({...form,showAllLibraries:v})} title="Show libraries from other folders" description="Include folders added outside the folder where Virelo was started."/>
          <SettingSwitch checked={form.libraryWatchEnabled} onChange={(v)=>setForm({...form,libraryWatchEnabled:v})} title="Watch local folders" description="Monitor configured folders and scan when files change."/>
        </section>}

        {activeSection==='network'&&<section id="settings-panel-network" className="settings-card settings-section" aria-labelledby="settings-title-network">
          <div className="settings-card-head"><div><h2 id="settings-title-network" tabIndex={-1}>Metadata</h2><p>Choose how Virelo matches your videos and finds artwork.</p></div></div>
          <SettingSwitch checked={form.externalMetadataEnabled} onChange={(v)=>setForm({...form,externalMetadataEnabled:v})} title="Online metadata" description="Match titles, summaries, genres and release years during scans. No account or API key required."/>
          <SettingSwitch checked={form.externalImagesEnabled} disabled={!form.externalMetadataEnabled} onChange={(v)=>setForm({...form,externalImagesEnabled:v})} title="Posters and artwork" description="Replace generated thumbnails with posters, backdrops and episode images."/>
          <div className="setting-row settings-action-row"><div className="setting-copy"><div><strong>Clear all metadata</strong><p>Reset titles and remove matched descriptions and artwork from every added library. Videos, generated thumbnails, favorites and watch progress stay intact. Existing videos will not be automatically matched again.</p></div></div><Button variant="secondary" isPending={clearMetadata.isPending} onPress={()=>{if(window.confirm('Clear metadata for ALL videos in every added library, including hidden libraries? Titles will return to filenames. Videos, generated thumbnails, favorites and watch progress will be kept. Existing videos will not be automatically matched again.'))clearMetadata.mutate();}}>Clear all metadata</Button></div>
          <div role="status">{clearMetadata.isSuccess&&<p>Metadata cleared for {clearMetadata.data.cleared} videos.</p>}</div>
          {clearMetadata.error&&<p className="error-copy" role="alert">{clearMetadata.error.message}</p>}
        </section>}

        {activeSection==='playback'&&<section id="settings-panel-playback" className="settings-card settings-section" aria-labelledby="settings-title-playback">
          <div className="settings-card-head"><div><h2 id="settings-title-playback" tabIndex={-1}>Playback</h2><p>Choose what happens when a video ends in a folder queue.</p></div></div>
          <div className="setting-row"><div className="setting-copy"><div><strong>Queue advance</strong><p>Auto-advance, loop, or manually step through the folder.</p></div></div>
            <Select className="settings-picker" label="Queue advance" value={form.queueBehavior} options={QUEUE_OPTIONS} align="end" onChange={(value)=>setForm({...form,queueBehavior:value as QueueBehavior})}/></div>
        </section>}

        {activeSection==='shorts'&&<section id="settings-panel-shorts" className="settings-card settings-section" aria-labelledby="settings-title-shorts">
          <div className="settings-card-head"><div><h2 id="settings-title-shorts" tabIndex={-1}>Shorts</h2><p>Choose which videos appear in the vertical feed.</p></div></div>
          <SettingSwitch checked={form.shortsIncludeLandscapes} onChange={(v)=>setForm({...form,shortsIncludeLandscapes:v})} title="Include landscape videos" description="Add landscape videos with known dimensions to the Shorts feed."/>
        </section>}

        {activeSection==='tools'&&<section id="settings-panel-tools" className="settings-card settings-section compact-card" aria-labelledby="settings-title-tools">
          <div className="settings-card-head"><div><h2 id="settings-title-tools" tabIndex={-1}>Advanced</h2><p>Tools used for thumbnails and video compatibility.</p></div></div>
          <div className="tool-status"><span className={health.data?.ffmpeg?'ok':'warn'}>{health.data?.ffmpeg?<CheckCircle/>:<WarningCircle/>} FFmpeg {health.data?.ffmpeg?'available':'not found'}</span><span className={health.data?.ffprobe?'ok':'warn'}>{health.data?.ffprobe?<CheckCircle/>:<WarningCircle/>} ffprobe {health.data?.ffprobe?'available':'not found'}</span></div>
        </section>}
      </div>
    </div>
  </div>;
}

function SettingSwitch({checked,onChange,title,description,disabled=false}:{checked:boolean;onChange:(value:boolean)=>void;title:string;description:string;disabled?:boolean}){
  return <div className="setting-row"><div className="setting-copy"><div><strong>{title}</strong><p>{description}</p></div></div><Switch isSelected={checked} isDisabled={disabled} onChange={onChange} aria-label={title}><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control></Switch.Content></Switch></div>;
}
