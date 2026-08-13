import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Switch } from '@heroui/react';
import { ArrowsClockwise, CheckCircle, FolderPlus, HardDrives, MonitorPlay, Play, ShieldCheck, Trash, WarningCircle } from '@phosphor-icons/react';
import { api } from '../api';
import { ScanProgress } from '../components/ScanProgress';
import { Select } from '../components/Select';
import type { QueueBehavior, Settings } from '../types';

const settingsSections = [
  { id:'libraries', label:'Libraries', icon:HardDrives },
  { id:'network', label:'Network', icon:ShieldCheck },
  { id:'playback', label:'Playback', icon:Play },
  { id:'shorts', label:'Shorts', icon:MonitorPlay },
  { id:'tools', label:'Media tools', icon:WarningCircle },
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
  const [apiKey,setApiKey]=useState('');
  const [activeSection,setActiveSection]=useState<SettingsSectionId>('libraries');
  useEffect(()=>{if(settingsQuery.data&&!form)setForm(settingsQuery.data);},[settingsQuery.data,form]);
  const save=useMutation({mutationFn:()=>api.saveSettings({...form!,tmdbApiKey:apiKey||undefined}),onSuccess:(data)=>{setForm(data);setApiKey('');client.setQueryData(['settings'],data);}});
  const clearKey=useMutation({mutationFn:()=>api.saveSettings({clearTmdbApiKey:true}),onSuccess:(data)=>{setForm(data);setApiKey('');client.setQueryData(['settings'],data);}});
  const add=useMutation({mutationFn:()=>api.addLibrary(path),onSuccess:()=>{setPath('');void client.invalidateQueries({queryKey:['libraries']});void client.invalidateQueries({queryKey:['scan']});}});
  const remove=useMutation({mutationFn:(id:number)=>api.removeLibrary(id),onSuccess:()=>{void client.invalidateQueries({queryKey:['libraries']});void client.invalidateQueries({queryKey:['home']});}});
  if(!form)return <div className="settings-loading skeleton"/>;
  return <div className="content-view settings-view">
    <header className="settings-heading"><h1>Settings</h1></header>

    <div className="settings-save-bar">
      <div aria-live="polite">{save.isSuccess&&<span className="settings-saved"><CheckCircle/> Saved</span>}</div>
      <Button isPending={save.isPending} onPress={()=>save.mutate()}>Save settings</Button>
    </div>
    {save.error&&<p className="error-copy settings-save-error">{save.error.message}</p>}

    <div className="settings-layout">
      <nav className="settings-sidebar" aria-label="Settings sections">
        {settingsSections.map((section)=>{const Icon=section.icon;const selected=activeSection===section.id;return <button key={section.id} type="button" className={`settings-nav-item${selected?' active':''}`} aria-pressed={selected} aria-controls={`settings-panel-${section.id}`} onClick={()=>setActiveSection(section.id)}>
          <span className="settings-nav-icon"><Icon/></span>
          <strong>{section.label}</strong>
        </button>;})}
      </nav>

      <div className="settings-content">
        {activeSection==='libraries'&&<section id="settings-panel-libraries" className="settings-card settings-section" aria-labelledby="settings-title-libraries">
          <div className="settings-card-head"><div><h2 id="settings-title-libraries">Libraries</h2><p>Manage the folders Virelo scans for media.</p></div></div>
          <div className="add-library"><Input aria-label="Media folder path" placeholder={navigator.userAgent.includes('Windows')?'D:\\Videos':'/home/user/Videos'} value={path} onChange={(e)=>setPath(e.target.value)}/><Button isPending={add.isPending} onPress={()=>add.mutate()} isDisabled={!path.trim()}><FolderPlus/> Add folder</Button></div>
          {add.error&&<p className="error-copy">{add.error.message}</p>}
          <div className="library-list">{libraries.data?.map(lib=><div key={lib.id}><div><strong>{lib.label}</strong><span>{lib.path}</span></div><Button isIconOnly variant="ghost" aria-label={`Remove ${lib.label}`} onPress={()=>remove.mutate(lib.id)}><Trash/></Button></div>)}</div>
          <div className="scan-strip"><div>{scan.data?.running?<ArrowsClockwise className="spin"/>:<CheckCircle/>}<span><strong>{scan.data?.message||'Idle'}</strong>{scan.data?.running&&` · ${scan.data.scanned} scanned`}</span></div><Button variant="secondary" isPending={scan.data?.running} onPress={()=>api.startScan().then(()=>client.invalidateQueries({queryKey:['scan']}))}><ArrowsClockwise/> Scan now</Button></div>
          <ScanProgress status={scan.data} compact/>
          <SettingSwitch checked={form.showAllLibraries} onChange={(v)=>setForm({...form,showAllLibraries:v})} title="Show libraries from other folders" description="Include folders added outside the folder where Virelo was started."/>
        </section>}

        {activeSection==='network'&&<section id="settings-panel-network" className="settings-card settings-section" aria-labelledby="settings-title-network">
          <div className="settings-card-head"><div><h2 id="settings-title-network">Network & metadata</h2><p>Choose which online services Virelo can use for metadata and artwork.</p></div></div>
          <SettingSwitch checked={form.externalMetadataEnabled} onChange={(v)=>setForm({...form,externalMetadataEnabled:v})} title="External metadata" description="Allow TMDB requests for titles, summaries, years and genres."/>
          <SettingSwitch checked={form.externalImagesEnabled} onChange={(v)=>setForm({...form,externalImagesEnabled:v})} title="External artwork" description="Allow poster and backdrop downloads after metadata is enabled."/>
          <SettingSwitch checked={form.libraryWatchEnabled} onChange={(v)=>setForm({...form,libraryWatchEnabled:v})} title="Watch local folders" description="Monitor configured folders and scan when files change."/>
          <div className="settings-grid"><label><span>Metadata language</span><Input value={form.metadataLanguage} onChange={(e)=>setForm({...form,metadataLanguage:e.target.value})} placeholder="ja-JP"/></label><label><span>TMDB API key {form.tmdbApiKeyConfigured&&<em>configured</em>}</span><Input type="password" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder={form.tmdbApiKeyConfigured?'Leave blank to keep current key':'Only used if metadata is enabled'}/>{form.tmdbApiKeyConfigured&&<Button className="clear-key" size="sm" variant="ghost" isPending={clearKey.isPending} onPress={()=>clearKey.mutate()}>Clear saved key</Button>}</label></div>
        </section>}

        {activeSection==='playback'&&<section id="settings-panel-playback" className="settings-card settings-section" aria-labelledby="settings-title-playback">
          <div className="settings-card-head"><div><h2 id="settings-title-playback">Playback</h2><p>Choose what happens when a video ends in a folder queue.</p></div></div>
          <div className="setting-row"><div className="setting-copy"><div><strong>Queue advance</strong><p>Auto-advance, loop, or manually step through the folder.</p></div></div>
            <Select className="settings-picker" label="Queue advance" value={form.queueBehavior} options={QUEUE_OPTIONS} align="end" onChange={(value)=>setForm({...form,queueBehavior:value as QueueBehavior})}/></div>
        </section>}

        {activeSection==='shorts'&&<section id="settings-panel-shorts" className="settings-card settings-section" aria-labelledby="settings-title-shorts">
          <div className="settings-card-head"><div><h2 id="settings-title-shorts">Shorts</h2><p>Choose which videos appear in the vertical feed.</p></div></div>
          <SettingSwitch checked={form.shortsIncludeLandscapes} onChange={(v)=>setForm({...form,shortsIncludeLandscapes:v})} title="Include landscape videos" description="Add landscape videos with known dimensions to the Shorts feed."/>
        </section>}

        {activeSection==='tools'&&<section id="settings-panel-tools" className="settings-card settings-section compact-card" aria-labelledby="settings-title-tools">
          <div className="settings-card-head"><div><h2 id="settings-title-tools">Media tools</h2><p>Check the tools used for thumbnails and video compatibility.</p></div></div>
          <div className="tool-status"><span className={health.data?.ffmpeg?'ok':'warn'}>{health.data?.ffmpeg?<CheckCircle/>:<WarningCircle/>} FFmpeg {health.data?.ffmpeg?'available':'not found'}</span><span className={health.data?.ffprobe?'ok':'warn'}>{health.data?.ffprobe?<CheckCircle/>:<WarningCircle/>} ffprobe {health.data?.ffprobe?'available':'not found'}</span></div>
        </section>}
      </div>
    </div>
  </div>;
}

function SettingSwitch({checked,onChange,title,description}:{checked:boolean;onChange:(value:boolean)=>void;title:string;description:string}){
  return <div className="setting-row"><div className="setting-copy"><div><strong>{title}</strong><p>{description}</p></div></div><Switch isSelected={checked} onChange={onChange} aria-label={title}><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control></Switch.Content></Switch></div>;
}
