import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adaptiveTranscodeStatus, startAdaptiveTranscode, startHlsTranscode, stopAllTranscodes, transcodeStatus } from '../dist/transcode.js';
import { hasFfmpeg } from '../dist/ffmpeg.js';

test('an interrupted HLS cache is not treated as playable on the next start', async () => {
  const root=await mkdtemp(join(tmpdir(),'virelo-hls-'));
  try{
    const dir=join(root,'cache','hls','1','default');
    await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'segment-00000.ts'),'segment');
    const playlist='#EXTM3U\n#EXTINF:2.0,\nsegment-00000.ts\n';
    await writeFile(join(dir,'index.m3u8'),playlist);
    assert.equal(transcodeStatus(root,1).status,'idle');
    await writeFile(join(dir,'index.m3u8'),playlist+'#EXT-X-ENDLIST\n');
    assert.equal(transcodeStatus(root,1).status,'ready');
    assert.equal(transcodeStatus(root,1).bufferedUntil,2);
    await rm(join(dir,'segment-00000.ts'));
    assert.equal(transcodeStatus(root,1).status,'idle');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('adaptive readiness requires every rendition and reports shared seek coverage', async () => {
  const root=await mkdtemp(join(tmpdir(),'virelo-adaptive-'));
  const qualities=[{height:720,label:'720p',bitrate:2800000},{height:360,label:'360p',bitrate:800000}];
  try{
    const dir=join(root,'cache','hls','2','adaptive-default');
    await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'master.m3u8'),'#EXTM3U\n');
    for(const [index,quality] of qualities.entries()){
      const variant=join(dir,String(quality.height));
      await mkdir(variant,{recursive:true});
      await writeFile(join(variant,'segment-00000.ts'),'segment');
      await writeFile(join(variant,'index.m3u8'),`#EXTM3U\n#EXTINF:${index===0?12:8},\nsegment-00000.ts\n#EXT-X-ENDLIST\n`);
      if(index===0)assert.equal(adaptiveTranscodeStatus(root,2,undefined,qualities).status,'idle');
    }
    const status=adaptiveTranscodeStatus(root,2,undefined,qualities);
    assert.equal(status.status,'ready');
    assert.equal(status.complete,true);
    assert.equal(status.bufferedUntil,8);
    assert.equal(adaptiveTranscodeStatus(root,2,undefined,[]).status,'idle');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('failed conversion jobs keep reporting an error instead of polling forever', async (t) => {
  if(!(await hasFfmpeg()))return t.skip('FFmpeg is unavailable');
  const root=await mkdtemp(join(tmpdir(),'virelo-conversion-error-'));
  const qualities=[{height:360,label:'360p',bitrate:800000}];
  try{
    const source=join(root,'missing.mp4');
    await startHlsTranscode(root,901,source);
    await startAdaptiveTranscode(root,902,source,{hasAudio:false,sourceWidth:640,sourceHeight:360,qualities});
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
      if(transcodeStatus(root,901).status==='error'&&adaptiveTranscodeStatus(root,902,undefined,qualities).status==='error')break;
      await new Promise((resolve)=>setTimeout(resolve,25));
    }
    assert.equal(transcodeStatus(root,901).status,'error');
    assert.equal(adaptiveTranscodeStatus(root,902,undefined,qualities).status,'error');
    await new Promise((resolve)=>setTimeout(resolve,50));
    assert.equal(transcodeStatus(root,901).status,'error');
    assert.equal(adaptiveTranscodeStatus(root,902,undefined,qualities).status,'error');
  }finally{stopAllTranscodes();await rm(root,{recursive:true,force:true});}
});
