import {createRequire} from 'node:module';
import {mkdtemp,mkdir,stat,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createVireloServer} from '../dist/server.js';
import {transcodeStatus,adaptiveTranscodeStatus} from '../dist/transcode.js';
import {playbackQualities} from '../dist/ffmpeg.js';
const require=createRequire(process.env.VIRELO_TEST_NODE_PACKAGE||import.meta.url);
const {chromium}=require('playwright');
const root=await mkdtemp(join(tmpdir(),'virelo-seek-audit-')),media=process.env.VIRELO_SEEK_ASSETS||join(root,'media'),dataDir=join(root,'data');
await mkdir(media,{recursive:true});
process.env.VIRELO_LOG_LEVEL='silent';
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
if(!process.env.VIRELO_SEEK_ASSETS){
  execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=854x480:rate=12','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','120','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','24','-c:a','ac3',join(media,'compatible.mkv')],{windowsHide:true});
  execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',join(media,'compatible.mkv'),'-c:v','copy','-c:a','aac','-movflags','+faststart',join(media,'direct.mp4')],{windowsHide:true});
}
const {app,db}=await createVireloServer({dataDir,mediaPaths:[],host:'127.0.0.1',port:0});
db.updateSettings({libraryWatchEnabled:false,externalMetadataEnabled:false});
const library=db.addLibrary(media,'Synthetic seek audit');
const ids=[];
for(const [name,codec] of [['compatible.mkv','ac3'],['direct.mp4','aac']]){
  const path=join(media,name),file=await stat(path);
  ids.push(db.upsertMedia({library_id:library.id,path,filename:name,title:name,sort_title:name,kind:'movie',series_title:null,season:null,episode:null,year:null,duration:120,width:854,height:480,video_codec:'h264',audio_codec:codec,container:name.split('.').at(-1),folder:'',size:file.size,mtime:file.mtimeMs,thumbnail_path:null,poster_path:null,backdrop_path:null,overview:null,genres:null,external_id:null}).id);
}
let longId;
if(process.env.VIRELO_SEEK_LONG==='1'){
  const longMedia=join(root,'long-media');await mkdir(longMedia);
  const seed=join(longMedia,'seed.mkv'),path=join(longMedia,'long-compatible.mkv');
  execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=navy:size=854x480:rate=2','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','6','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','4','-c:a','ac3','-b:a','32k','-ac','1',seed],{windowsHide:true});
  execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-stream_loop','-1','-i',seed,'-t','7041','-c','copy',path],{windowsHide:true});
  const file=await stat(path),longLibrary=db.addLibrary(longMedia,'Synthetic feature-length seek audit');
  longId=db.upsertMedia({library_id:longLibrary.id,path,filename:'long-compatible.mkv',title:'Synthetic feature-length clip',sort_title:'Synthetic feature-length clip',kind:'movie',series_title:null,season:null,episode:null,year:null,duration:7041,width:854,height:480,video_codec:'h264',audio_codec:'ac3',container:'mkv',folder:'',size:file.size,mtime:file.mtimeMs,thumbnail_path:null,poster_path:null,backdrop_path:null,overview:null,genres:null,external_id:null}).id;
}
await app.listen({host:'127.0.0.1',port:0});
const base='http://127.0.0.1:'+app.server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.VIRELO_TEST_CHROMIUM,args:['--autoplay-policy=no-user-gesture-required']});
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS',label);};
const limited=body=>{
  const lines=body.split(/\r?\n/),result=[];
  let segments=0;
  for(const line of lines){
    if(line.startsWith('#EXT-X-ENDLIST'))continue;
    if(line.startsWith('#EXTINF:')&&segments>=6)break;
    result.push(line);
    if(line&&!line.startsWith('#'))segments++;
  }
  return result.join('\n')+'\n';
};
const pauseUntil=async(predicate)=>{
  const deadline=Date.now()+45000;
  while(!predicate()){if(Date.now()>deadline)throw Error('Test encoder did not complete');await new Promise(resolve=>setTimeout(resolve,100));}
};
try{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('/start')&&request.method()==='POST')requests.push({url:request.url(),body:request.postDataJSON()});});
  // Freeze only the initial (zero-origin) playlist to simulate an encoder that
  // has produced 12 seconds of a much longer film. New seek windows are real.
  await page.route('**/hls/**/index.m3u8',async route=>{
    if(route.request().url().includes('/seek/'))return route.continue();
    const response=await route.fetch();
    if(!response.ok())return route.fulfill({response});
    await route.fulfill({response,body:limited(await response.text())});
  });
  const seek=async position=>page.locator('.player-seek').evaluate((input,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },position);
  const snapshot=()=>page.locator('.player video').evaluate(video=>({time:video.currentTime,duration:video.duration,paused:video.paused,ready:video.readyState,audio:video.webkitAudioDecodedByteCount,seekable:[...Array(video.seekable.length)].map((_,i)=>[video.seekable.start(i),video.seekable.end(i)])}));
  const arrived=position=>page.waitForFunction(value=>{const v=document.querySelector('.player video');return v&&Math.abs(v.currentTime-value)<1.5&&v.readyState>=3;},position,{timeout:30000});

  await page.goto(base+'/watch/'+ids[0]+'?queue=false');
  await page.waitForFunction(()=>{const v=document.querySelector('.player video');return v&&!v.paused&&v.currentTime>.3;},{},{timeout:30000});
  await pauseUntil(()=>transcodeStatus(dataDir,ids[0],1).complete);
  const initial=join(dataDir,'cache','hls',String(ids[0]),'audio-1','index.m3u8');
  // defaultAudioStream is 1. Keep the completed fixture's first six segments.
  await writeFile(initial,limited(await readFile(initial,'utf8')));
  console.log('PARTIAL_BEFORE',JSON.stringify(await snapshot()));
  await seek(92.4);
  if(process.env.VIRELO_EXPECT_SEEK_FAILURE==='1'){
    await page.waitForTimeout(2500);
    check((await snapshot()).time<20,'old build reproduces snap back to generated prefix');
    console.log('OLD_SEEK_RESULT',JSON.stringify(await snapshot()));
  }else{
    await arrived(92.4);
    check((await snapshot()).paused===false,'compatible seek keeps playing');
    check(requests.some(request=>request.body.startTime>=92),'encoder starts at the requested time');
    await page.waitForTimeout(1100);
    check((await snapshot()).time>92,'seek does not snap back after timeupdate');
    check((await snapshot()).audio>0,'compatible seek decodes audio');
    check(Number(await page.locator('.player-seek').getAttribute('max'))>=120,'range uses full movie duration');
    await seek(40);await seek(71);await seek(98.2);await arrived(98.2);
    check((await snapshot()).time>97,'rapid seeks retain the last target');
    await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(21.3);await arrived(21.3);
    check((await snapshot()).paused,'backward seek before window retains paused intent');

    await page.evaluate(()=>localStorage.setItem('virelo-playback-quality:v1','360'));
    await page.goto(base+'/watch/'+ids[1]+'?queue=false');
    await page.waitForFunction(()=>{const v=document.querySelector('.player video');return v&&!v.paused&&v.currentTime>.3;},{},{timeout:30000});
    const qualities=playbackQualities(854,480);
    await pauseUntil(()=>adaptiveTranscodeStatus(dataDir,ids[1],1,qualities).complete);
    for(const quality of qualities){
      const path=join(dataDir,'cache','hls',String(ids[1]),'adaptive-audio-1',String(quality.height),'index.m3u8');
      await writeFile(path,limited(await readFile(path,'utf8')));
    }
    await seek(88.7);await arrived(88.7);
    check(requests.some(request=>request.url.includes('/quality/start')&&request.body.startTime>=88),'manual-quality seek starts a new window');
    await page.getByRole('button',{name:'Quality',exact:true}).click();
    check(await page.getByRole('menuitemradio',{name:/^360p/}).getAttribute('aria-checked')==='true','manual quality ceiling survives seek');
    await page.getByRole('button',{name:'Quality',exact:true}).click();
    await page.waitForTimeout(1000);check((await snapshot()).time>88,'adaptive playback does not return to old position');
    await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(30.3);await arrived(30.3);
    check((await snapshot()).paused,'adaptive backward seek retains pause');

    await page.evaluate(()=>localStorage.setItem('virelo-playback-quality:v1','highest'));
    await page.goto(base+'/watch/'+ids[1]+'?queue=false');
    await page.waitForFunction(()=>{const v=document.querySelector('.player video');return v&&!v.paused&&v.currentTime>.3;},{},{timeout:30000});
    const previous=requests.length;await seek(90.2);await arrived(90.2);
    check(requests.length===previous,'direct-file seek has no conversion/preparation request');
    if(longId){
      await page.goto(base+'/watch/'+longId+'?queue=false');
      await page.waitForFunction(()=>{const v=document.querySelector('.player video');return v&&!v.paused&&v.currentTime>.3;},{},{timeout:30000});
      await seek(2844.4);await arrived(2844.4);
      check(requests.some(request=>request.url.includes('/media/'+longId+'/')&&request.body.startTime>=2844),'feature-length encoder starts at 47:24');
      check(!(await snapshot()).paused,'feature-length seek retains playback');
      check(Number(await page.locator('.player-seek').getAttribute('max'))>=7041,'feature-length range retains 1:57:21 duration');
      await page.waitForTimeout(1100);
      check(Math.abs((await snapshot()).time-2845.5)<3,'47-minute seek does not return to old position');
      console.log('LONG_FORWARD',JSON.stringify(await snapshot()));
      await page.getByRole('button',{name:'Pause',exact:true}).click();await seek(896.2);await arrived(896.2);
      check((await snapshot()).paused,'feature-length backward seek retains pause');
    }
    check(errors.length===0,'no browser runtime errors '+errors.join('|'));
    console.log('FINAL',JSON.stringify(await snapshot()));
  }
  console.log(JSON.stringify({checks,root}));
}finally{await browser.close();await app.close();}
