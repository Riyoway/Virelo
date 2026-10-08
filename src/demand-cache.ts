import { lstat, readdir, rm, utimes } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute } from 'node:path';

export const SEGMENT_MAX_BYTES=32*1024*1024;
export class DemandCache {
  readonly root:string;
  private entries=new Map<string,{size:number;used:number}>();
  private pins=new Map<string,number>();
  private initialized:Promise<void>|undefined;
  private serial:Promise<void>=Promise.resolve();
  constructor(dataDir:string,readonly limit=512*1024*1024){this.root=resolve(dataDir,'cache');}
  private safe(path:string){const rel=relative(this.root,resolve(path));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Invalid cache path');}
  private async scan(dir:string){
    let children;
    try{children=await readdir(dir,{withFileTypes:true});}catch(reason){if((reason as NodeJS.ErrnoException).code==='ENOENT')return;throw reason;}
    for(const entry of children){
      const path=join(dir,entry.name),info=await lstat(path);
      if(info.isSymbolicLink())throw Error('Playback cache must not contain filesystem links.');
      if(info.isDirectory())await this.scan(path);
      else if(info.isFile()&&/^(?:segment-\d+\.ts(?:\.part|\.tmp)?|(?:index|master)\.m3u8(?:\.tmp)?|\d+\.vtt)$/.test(entry.name))this.entries.set(path,{size:info.size,used:info.mtimeMs});
    }
  }
  async init(){
    await(this.initialized??=(async()=>{
      const inspect=(path:string)=>lstat(path).catch(reason=>{
        if((reason as NodeJS.ErrnoException).code==='ENOENT')return null;
        throw reason;
      });
      const rootInfo=await inspect(this.root);
      if(rootInfo?.isSymbolicLink())throw Error('Playback cache root must not be a filesystem link.');
      for(const directory of ['hls','audio','segments-v1']){
        const path=join(this.root,directory),info=await inspect(path);
        if(info?.isSymbolicLink())throw Error('Playback cache must not contain filesystem links.');
        if(info?.isDirectory())await this.scan(path);
      }
    })());
  }
  pin(path:string){this.safe(path);this.pins.set(path,(this.pins.get(path)??0)+1);let released=false;return()=>{if(released)return;released=true;const count=(this.pins.get(path)??1)-1;if(count)this.pins.set(path,count);else this.pins.delete(path);};}
  private locked<T>(work:()=>Promise<T>):Promise<T>{const next=this.serial.then(work);this.serial=next.then(()=>{},()=>{});return next;}
  async prune(reserve=0){
    await this.init();
    await this.locked(async()=>{
      let total=this.bytes;
      for(const [path,entry] of [...this.entries].sort((a,b)=>a[1].used-b[1].used)){
        if(total+reserve<=this.limit)break;
        if(this.pins.has(path))continue;
        this.safe(path);await rm(path,{force:true});this.entries.delete(path);total-=entry.size;
      }
      if(total+reserve>this.limit)throw Error('Playback cache is busy. Try again after another stream finishes.');
    });
  }
  async lookup(path:string){
    await this.init();this.safe(path);const entry=this.entries.get(path);if(!entry)return false;
    const info=await lstat(path).catch(()=>null);
    if(!info||!info.isFile()||info.isSymbolicLink()){this.entries.delete(path);return false;}
    entry.used=Date.now();await utimes(path,new Date(),new Date()).catch(()=>{});return true;
  }
  async record(path:string){this.safe(path);const info=await lstat(path);this.entries.set(path,{size:info.size,used:Date.now()});}
  get bytes(){return [...this.entries.values()].reduce((sum,entry)=>sum+entry.size,0);}
  isPinned(path:string){return this.pins.has(path);}
}
