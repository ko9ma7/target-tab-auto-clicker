const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const listeners={};
function event(name){return {addListener(fn){listeners[name]=fn;}};}
let store={
  targets:[
    {id:'a',url:'https://claude.ai/chat/abc',buttonLabel:'Continue',enabled:true},
    {id:'b',url:'https://chatgpt.com/c/xyz',buttonLabel:'계속',enabled:true},
    {id:'c',url:'https://other.test/page',buttonLabel:'Continue',enabled:false},
  ],globalEnabled:true,trackedTabIds:{},statsByTarget:{}
};
let tabs=[
 {id:1,url:'https://example.test/',discarded:false},
 {id:2,url:'https://claude.ai/chat/abc?query=1',discarded:false},
 {id:3,url:'https://chatgpt.com/c/xyz',discarded:false},
 {id:4,url:'https://other.test/page',discarded:false},
 {id:5,url:'https://claude.ai/chat/not-abc',discarded:false}
];
let injected=[];
const chrome={
 storage:{local:{async get(keys){return Object.fromEntries(keys.map(k=>[k,store[k]]));},
  async set(values){const old={...store};Object.assign(store,values);const changes=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{oldValue:old[k],newValue:v}]));listeners.storage?.(changes,'local');},
  async remove(keys){for(const k of [].concat(keys))delete store[k];}},onChanged:event('storage')},
 runtime:{onInstalled:event('installed'),onStartup:event('startup'),onMessage:event('message')},
 tabs:{query:async()=>tabs,onCreated:event('created'),onRemoved:event('removed'),onUpdated:event('updated')},
 webNavigation:{onHistoryStateUpdated:event('history')},
 permissions:{onAdded:event('added'),onRemoved:event('permissionRemoved'),contains:async()=>true},
 scripting:{executeScript:async({target})=>{injected.push(target.tabId);}}
};
vm.runInNewContext(fs.readFileSync(__dirname+'/../background.js','utf8'),{URL,chrome,Number,JSON,Date,Promise,console});
const msg=(value,sender={})=>new Promise(resolve=>listeners.message(value,sender,resolve));
const tab=id=>({tab:tabs.find(t=>t.id===id)});
(async()=>{
 await msg({type:'RECONCILE'});
 assert.equal(store.trackedTabIds.a,2);assert.equal(store.trackedTabIds.b,3);assert.equal(store.trackedTabIds.c,4);
 assert(injected.includes(2));assert(injected.includes(3));assert(!injected.includes(4));
 let r=await msg({type:'CAN_CLICK',targetId:'a',href:'https://claude.ai/chat/abc'},tab(2));assert.equal(r.allowed,true);
 r=await msg({type:'CAN_CLICK',targetId:'b',href:'https://claude.ai/chat/abc'},tab(2));assert.equal(r.allowed,false);
 r=await msg({type:'CAN_CLICK',targetId:'a',href:'https://claude.ai/chat/abc'},tab(5));assert.equal(r.allowed,false);
 r=await msg({type:'CAN_CLICK',targetId:'c',href:'https://other.test/page'},tab(4));assert.equal(r.allowed,false);
 // Clicking one URL does not increment the other URL's counter.
 await msg({type:'RECORD_CLICK',targetId:'a',href:'https://claude.ai/chat/abc'},tab(2));
 assert.equal(store.statsByTarget.a.clickCount,1);assert.equal(store.statsByTarget.b,undefined);
 // Switch active browser tab, tracked IDs must remain stable.
 await msg({type:'RECONCILE'});assert.equal(store.trackedTabIds.a,2);
 // Removing target A means its tab can no longer authorize a click.
 store.targets=store.targets.filter(t=>t.id!=='a');await msg({type:'RECONCILE'});
 assert.equal(store.trackedTabIds.a,undefined);
 r=await msg({type:'CAN_CLICK',targetId:'a',href:'https://claude.ai/chat/abc'},tab(2));assert.equal(r.allowed,false);
 r=await msg({type:'CAN_CLICK',targetId:'b',href:'https://chatgpt.com/c/xyz'},tab(3));assert.equal(r.allowed,true);
 // Closing B and reopening the same URL must reconnect without a stale tab.
 tabs=tabs.filter(t=>t.id!==3);await msg({type:'RECONCILE'});assert.equal(store.trackedTabIds.b,null);
 tabs.push({id:12,url:'https://chatgpt.com/c/xyz',discarded:false});await msg({type:'RECONCILE'});
 assert.equal(store.trackedTabIds.b,12);
 store.globalEnabled=false;
 r=await msg({type:'CAN_CLICK',targetId:'b',href:'https://chatgpt.com/c/xyz'},tab(12));assert.equal(r.allowed,false);
 console.log('PASS: multiple URLs, separate tabs and stats, per-item off, deletion, reconnect, global off');
})().catch(e=>{console.error(e);process.exitCode=1;});
