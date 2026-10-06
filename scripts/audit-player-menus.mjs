import {createRequire} from 'node:module';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(process.env.VIRELO_TEST_NODE_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const screenshots=await mkdtemp(join(tmpdir(),'virelo-player-menus-'));
const browser=await chromium.launch({headless:true,...(process.env.VIRELO_TEST_CHROMIUM?{executablePath:process.env.VIRELO_TEST_CHROMIUM}:{})});
let checks=0;
const check=(value,name)=>{assert.ok(value,name);checks++;console.log('PASS',name);};
try {
 for(const [mode,base] of [['npm',process.env.VIRELO_TEST_NPM_URL||'http://127.0.0.1:5198'],['web',process.env.VIRELO_TEST_WEB_URL||'http://127.0.0.1:5199']]){
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',route=>route.fulfill({json:route.request().url().includes('/libraries')?[]:{recent:[],featured:[],continueWatching:[],liked:[],series:[],shorts:[],nextEpisodes:[],unwatched:[],shortMovies:[],genres:[]}}));
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+(mode==='web'?'/app/settings':'/settings'));
  await page.locator('.splash-screen').waitFor({state:'hidden'});
  await page.evaluate(async mode=>{
   const main=await(await fetch('/src/main.tsx')).text();
   const imports=[...main.matchAll(/from ["']([^"']+)["']/g)].map(match=>match[1]);
   const React=(await import(imports.find(url=>url.includes('/react.js')))).default;
   const {createRoot}=(await import(imports.find(url=>url.includes('/react-dom_client.js')))).default;
   const {PlaybackSettingsMenu}=await import('/src/components/PlaybackSettingsMenu.tsx');
   const {Play,SpeakerHigh,ArrowsOut,Rewind,FastForward,RepeatOnce,PictureInPicture,SkipBack,SkipForward}=await import('/@id/@phosphor-icons/react');
   document.body.replaceChildren();
   const node=document.createElement('main');node.style.cssText='max-width:980px;margin:48px auto;';document.body.append(node);
   const root=createRoot(node),h=React.createElement;
   window.__selections=[];
   const tracks=Array.from({length:22},(_,i)=>({index:i+1,typeIndex:i,codec:'aac',language:i===0?'eng':i===1?'jpn':null,title:i===0?'English':i===1?'Japanese':'Audio track '+(i+1),supported:i!==2,channels:2,channelLayout:'stereo'}));
   const captions=Array.from({length:22},(_,i)=>({...tracks[i],codec:'srt',title:i===0?'English':i===1?'Japanese':'Subtitle '+(i+1)}));
   function Demo(){
    const [selectedAudio,audio]=React.useState(1),[selectedSubtitle,subtitle]=React.useState(null),[selectedQuality,quality]=React.useState(1080);
    const [busy,setBusy]=React.useState(false),[limited,setLimited]=React.useState(false);
    window.__busy=setBusy;window.__limited=setLimited;
    const select=(kind,set)=>value=>{window.__selections.push({kind,value});set(value);};
    const button=(Icon,label)=>h('button',{'aria-label':label},h(Icon));
    return h('div',{className:'player has-queue controls-visible'},
      h('video',{'aria-label':'Demo video'}),
      h('div',{className:'player-gradient'}),
      h('div',{className:'player-controls'},
       h('input',{className:'player-seek',type:'range','aria-label':'Seek'}),
       h('div',{className:'player-toolbar'},
        button(SkipBack,'Previous video'),h('button',{className:'skip-button','aria-label':'Rewind'},h(Rewind)),button(Play,'Play'),
        h('button',{className:'skip-button','aria-label':'Fast-forward'},h(FastForward)),button(SkipForward,'Next video'),
        button(RepeatOnce,'Loop'),button(SpeakerHigh,'Mute'),
        h('input',{className:'volume-slider',type:'range','aria-label':'Volume'}),
        h('span',{className:'player-time'},'24:14 / 1:48:00'),h('span',{className:'player-queue'},'1 / 12'),
        h(PlaybackSettingsMenu,{audioTracks:limited?tracks.slice(0,1):tracks,subtitleTracks:limited?[]:captions,
          qualityOptions:limited?[{height:1080,label:'1080p',bitrate:5000000}]:[1080,720,480,360].map(height=>({height,label:height+'p',bitrate:1400000})),
          selectedAudio,selectedSubtitle,selectedQuality,busy,allowAutoQuality:false,
          onSelectAudio:select('audio',audio),onSelectSubtitle:select('subtitles',subtitle),onSelectQuality:select('quality',quality)}),
        button(PictureInPicture,'Picture in Picture'),button(ArrowsOut,'Fullscreen'))));
   }
   root.render(h(Demo));
  },mode);
  const trigger=label=>page.getByRole('button',{name:label,exact:true});
  const menu=label=>page.getByRole('menu',{name:label,exact:true});
  await trigger('Quality').waitFor();
  for(const label of ['Quality','Audio','Subtitles']){
   await trigger(label).click();
   check(await page.getByRole('menu').count()===1&&await menu(label).isVisible(),mode+' independent '+label+' menu');
   check(await menu(label).locator('h3').count()===1,mode+' no unrelated sections in '+label);
   check(await trigger(label).getAttribute('aria-expanded')==='true',mode+' '+label+' trigger expanded');
  }
  await menu('Subtitles').getByRole('menuitemradio',{name:/^Japanese/}).click();
  check(JSON.stringify(await page.evaluate(()=>window.__selections))===JSON.stringify([{kind:'subtitles',value:2}]),mode+' subtitle selection routes only to subtitles');
  check(await page.getByRole('menu').count()===0&&await trigger('Subtitles').evaluate(e=>e===document.activeElement),mode+' selection closes menu and restores focus');
  await trigger('Audio').focus();await page.keyboard.press('ArrowDown');
  check(await page.locator(':focus').getAttribute('aria-checked')==='true',mode+' keyboard opens first audio option');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
  check((await page.locator(':focus').innerText()).includes('Audio track 4'),mode+' arrow navigation skips unsupported track');
  await page.keyboard.press('End');
  check((await page.locator(':focus').innerText()).includes('Audio track 22'),mode+' End reaches final track');
  await page.keyboard.press('Home');check((await page.locator(':focus').innerText()).includes('English'),mode+' Home reaches first track');
  await page.keyboard.press('Escape');
  check(await page.getByRole('menu').count()===0&&await trigger('Audio').evaluate(e=>e===document.activeElement),mode+' Escape restores trigger focus');
  await trigger('Quality').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  check(await page.evaluate(()=>window.__selections.at(-1).kind==='quality'&&window.__selections.at(-1).value===720),mode+' keyboard selects quality');
  check((await trigger('Quality').innerText()).includes('720p'),mode+' current quality shown in toolbar');
  await trigger('Audio').click();await page.locator('video').click();
  check(await page.getByRole('menu').count()===0,mode+' outside click closes menu');
  await trigger('Audio').click();await page.keyboard.press('Tab');
  check(await page.getByRole('menu').count()===0&&await trigger('Subtitles').evaluate(e=>e===document.activeElement),mode+' Tab closes and continues toolbar navigation');
  await page.evaluate(()=>window.__busy(true));await trigger('Quality').click();
  check(await menu('Quality').getByRole('menuitemradio').evaluateAll(options=>options.every(e=>e.disabled)),mode+' busy options cannot start competing changes');
  await page.keyboard.press('Escape');await page.evaluate(()=>window.__busy(false));
  for(const viewport of [{width:1440,height:900},{width:320,height:780},{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);await trigger('Audio').click();
   const rect=await menu('Audio').boundingBox();
   check(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1,mode+' menu inside viewport '+viewport.width+'x'+viewport.height);
   check(await menu('Audio').locator('.playback-track-list').evaluate(e=>e.scrollHeight>e.clientHeight),mode+' long track list scrolls '+viewport.width);
   check(await page.locator('.player-toolbar').evaluate(e=>e.scrollWidth<=e.clientWidth),mode+' toolbar does not overflow '+viewport.width);
   await menu('Audio').getByRole('menuitemradio',{name:/^Audio track 22/}).click();
   check(await page.evaluate(()=>window.__selections.at(-1).value===22),mode+' final track accessible '+viewport.width);
   await trigger('Audio').click();
   await page.screenshot({path:join(screenshots,mode+'-'+viewport.width+'.png')});
   await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.player').evaluate(e=>e.requestFullscreen());
  await trigger('Quality').click();
  check(await menu('Quality').evaluate(e=>document.fullscreenElement?.contains(e)),mode+' menu renders inside fullscreen');
  await page.keyboard.press('Escape');await page.evaluate(()=>document.exitFullscreen());
  await page.evaluate(()=>window.__limited(true));
  check(await trigger('Audio').count()===0&&await trigger('Subtitles').count()===0,mode+' unavailable track controls omitted');
  await trigger('Quality').click();
  check(await menu('Quality').getByRole('menuitemradio').count()===1,mode+' original quality remains accessible when only one choice exists');
  check(errors.length===0,mode+' no runtime errors '+errors.join('|'));
  await context.close();
 }
 console.log(JSON.stringify({checks,result:'passed',screenshots}));
}finally{await browser.close();}
