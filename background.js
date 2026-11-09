'use strict';

// MV3 service workers can be suspended at any time. All schedules, tab ownership
// and click timestamps therefore live in chrome.storage.local, not in timers.
const MAX_TARGETS = 50;
const DEFAULT_HOURS = 5;
const RETRY_MS = 5 * 60 * 1000;
const MANAGED_TAB_LIFETIME_MS = 2 * 60 * 1000;
const ALARM_NAME = 'target-click-scheduler-v4';
const SETTINGS = ['targets', 'trackedTabIds', 'managedTabIds', 'globalEnabled', 'statsByTarget', 'checksByTarget'];
let queue = Promise.resolve();
const injecting = new Set();
const probing = new Set();
let sweepActive = null;

function canonical(raw) {
  try {
    const u = new URL(raw);
    if (!['https:', 'http:'].includes(u.protocol) || !u.hostname || u.username || u.password) return null;
    return u.origin + (u.pathname.replace(/\/+$/, '') || '/');
  } catch { return null; }
}
function permissionOrigin(raw) {
  const u = new URL(raw);
  return u.protocol + '//' + u.hostname + '/*';
}
function intervalHours(t) {
  const n = Number(t.intervalHours);
  return Number.isInteger(n) && n >= 1 && n <= 48 ? n : DEFAULT_HOURS;
}
function isTarget(t) {
  return t && typeof t.id === 'string' && t.id.length > 0 &&
    canonical(t.url) === t.url && typeof t.buttonLabel === 'string' && !!t.buttonLabel.trim();
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function enqueue(fn) {
  queue = queue.catch(() => {}).then(fn);
  return queue;
}
async function ensureAlarm() {
  if (!await chrome.alarms.get(ALARM_NAME)) {
    await chrome.alarms.create(ALARM_NAME, {periodInMinutes: 1});
  }
}
async function migrate() {
  const s = await chrome.storage.local.get([
    'targets', 'targetUrl', 'buttonLabel', 'autoContinueEnabled',
    'autoContinueStats', 'statsByTarget', 'globalEnabled'
  ]);
  if (Array.isArray(s.targets)) return;
  const url = canonical(s.targetUrl);
  const targets = url ? [{id:'migrated-v2',url,buttonLabel:(s.buttonLabel || '계속').trim() || '계속',enabled:true,intervalHours:DEFAULT_HOURS}] : [];
  const stats = url && s.autoContinueStats ? {'migrated-v2':s.autoContinueStats} : {};
  await chrome.storage.local.set({
    targets, trackedTabIds:{}, managedTabIds:{}, checksByTarget:{},
    globalEnabled:s.autoContinueEnabled !== false, statsByTarget:s.statsByTarget || stats
  });
}
function initialCheck(target, stat, previous, now) {
  const hours = intervalHours(target);
  if (previous && previous.intervalHours === hours && Number.isFinite(previous.nextCheckAt)) return previous;
  const clicked = Date.parse(stat?.lastClickedAt || '');
  const next = Number.isFinite(clicked) ? Math.max(now, clicked + hours * 3600000) : now;
  return {...(previous || {}), intervalHours:hours, nextCheckAt:next, lastStatus:previous?.lastStatus || 'scheduled'};
}
async function allowedPermission(target) {
  return chrome.permissions.contains({origins:[permissionOrigin(target.url)]});
}

async function reconcileTabs(forceId = null) {
  await migrate();
  const s = await chrome.storage.local.get(SETTINGS);
  const targets = (Array.isArray(s.targets) ? s.targets : []).filter(isTarget).slice(0, MAX_TARGETS);
  const old = s.trackedTabIds || {};
  const tabs = await chrome.tabs.query({});
  const next = {};
  const used = new Set();
  for (const t of targets) {
    const matches = tabs.filter(tab => Number.isInteger(tab.id) && canonical(tab.url) === t.url && !used.has(tab.id));
    const selected = matches.find(tab => tab.id === old[t.id]) || matches[0];
    next[t.id] = selected?.id ?? null;
    if (selected) used.add(selected.id);
  }
  if (!equal(old, next)) await chrome.storage.local.set({trackedTabIds:next});
  if (s.globalEnabled !== false) {
    for (const t of targets) {
      const id = next[t.id];
      if (!t.enabled || id == null) continue;
      const tab = tabs.find(item => item.id === id);
      if (!tab || tab.discarded || tab.status === 'loading') continue;
      if (id !== forceId && injecting.has(id)) continue;
      if (!await allowedPermission(t)) continue;
      try {
        await chrome.scripting.executeScript({target:{tabId:id},files:['content.js']});
        injecting.add(id);
      } catch (error) {
        injecting.delete(id);
        console.debug('[TargetClick] Injection will retry:', error?.message);
      }
    }
  }
  return {trackedTabIds:next,total:targets.length};
}
function reconcileSoon(forceId = null) {
  void enqueue(() => reconcileTabs(forceId)).catch(e => console.warn('[TargetClick] Reconcile:', e));
}
function findAuthorized(s, sender, message) {
  const tabId = sender.tab?.id;
  const target = (Array.isArray(s.targets) ? s.targets : []).find(t => t.id === message.targetId && isTarget(t));
  if (!target || !target.enabled || s.globalEnabled === false ||
      !Number.isInteger(tabId) || s.trackedTabIds?.[target.id] !== tabId ||
      canonical(message.href) !== target.url || canonical(sender.tab?.url) !== target.url) return null;
  return target;
}

// Do not await a content-script message while holding the serialized queue:
// content.js may itself send RECORD_CLICK, which needs the same queue.
async function probeTab(tabId, targetId) {
  if (probing.has(targetId)) return;
  probing.add(targetId);
  const startedAt = Date.now();
  let status = 'connection-error', error = '', shouldRecord = true;
  try {
    const s = await chrome.storage.local.get(SETTINGS);
    const t = (s.targets || []).find(v => v.id === targetId && isTarget(v));
    if (!t || !t.enabled || s.globalEnabled === false || s.trackedTabIds?.[t.id] !== tabId) {shouldRecord=false;return;}
    const tab = await chrome.tabs.get(tabId);
    if (tab.discarded || tab.status === 'loading' || canonical(tab.url) !== t.url) {shouldRecord=false;return;}
    if (!await allowedPermission(t)) {status='permission-error';error='사이트 접근 권한이 없습니다.';}
    else {
      await chrome.scripting.executeScript({target:{tabId},files:['content.js']});
      injecting.add(tabId);
      const response = await chrome.tabs.sendMessage(tabId, {type:'SCAN_NOW'});
      status = response?.phase || 'connection-error';
    }
  } catch (e) {error = String(e?.message || e);}
  finally {
    probing.delete(targetId);
    if (!shouldRecord) return;
    void enqueue(async () => {
      const s = await chrome.storage.local.get(SETTINGS);
      const t = (s.targets || []).find(v => v.id === targetId && isTarget(v));
      if (!t) return;
      const checks = {...(s.checksByTarget || {})};
      const previous = checks[targetId] || {};
      // A click recorded during scanning has already scheduled a new five-hour cycle.
      const lastClick = Date.parse(s.statsByTarget?.[targetId]?.lastClickedAt || '');
      if (Number.isFinite(lastClick) && lastClick >= startedAt) return;
      checks[targetId] = {
        ...previous, lastCheckedAt:new Date().toISOString(), lastStatus:status,
        lastError:error || '',
        nextCheckAt:Number.isFinite(previous.nextCheckAt)
          ? previous.nextCheckAt : Date.now() + RETRY_MS
      };
      await chrome.storage.local.set({checksByTarget:checks});
    }).catch(e => console.warn('[TargetClick] Status update:', e));
  }
}

async function doSweep() {
  await ensureAlarm();
  const toProbe = await enqueue(async () => {
    await migrate();
    const initial = await chrome.storage.local.get(SETTINGS);
    const targets = (Array.isArray(initial.targets) ? initial.targets : []).filter(isTarget).slice(0, MAX_TARGETS);
    const now = Date.now();
    const valid = new Set(targets.map(t => t.id));
    const checks = {...(initial.checksByTarget || {})};
    const managed = {...(initial.managedTabIds || {})};
    const stats = initial.statsByTarget || {};
    for (const key of Object.keys(checks)) if (!valid.has(key)) delete checks[key];
    for (const key of Object.keys(managed)) if (!valid.has(key)) {
      // Removed targets are released, not force-closed: the page may belong to the user now.
      delete managed[key];
    }
    for (const t of targets) checks[t.id] = initialCheck(t, stats[t.id], checks[t.id], now);
    const {trackedTabIds} = await reconcileTabs();
    const tracked = {...trackedTabIds};
    const tabs = await chrome.tabs.query({});
    const byId = new Map(tabs.map(tab => [tab.id, tab]));
    const probes = [];
    let opened = 0;
    for (const t of targets) {
      const owned = managed[t.id];
      if (owned) {
        const tab = byId.get(owned.tabId);
        if (!tab) delete managed[t.id];
        else if (tab.active) delete managed[t.id]; // User intentionally opened this tab.
        else if (now - (owned.lastActivityAt || owned.createdAt) >= MANAGED_TAB_LIFETIME_MS) {
          try {await chrome.tabs.remove(owned.tabId);} catch {}
          byId.delete(owned.tabId);
          if (tracked[t.id] === owned.tabId) tracked[t.id] = null;
          injecting.delete(owned.tabId);
          delete managed[t.id];
        }
      }
      if (initial.globalEnabled === false || !t.enabled || checks[t.id].nextCheckAt > now) continue;
      // Move the next attempt ahead *before* launching a tab. A crash cannot
      // create duplicate tabs on the next service-worker restart.
      const prior = checks[t.id];
      checks[t.id] = {...prior,nextCheckAt:now + RETRY_MS,lastStatus:'checking',lastError:'',lastAttemptAt:new Date(now).toISOString()};
      if (!await allowedPermission(t)) {
        checks[t.id].lastStatus = 'permission-error';
        checks[t.id].lastError = '사이트 접근 권한을 확인하세요.';
        continue;
      }
      const id = tracked[t.id];
      const tab = id == null ? null : byId.get(id);
      try {
        if (tab && canonical(tab.url) === t.url) {
          if (tab.discarded) {
            checks[t.id].lastStatus = 'waking';
            await chrome.tabs.reload(id);
            injecting.delete(id);
          } else if (tab.status !== 'loading') probes.push({targetId:t.id,tabId:id});
          else checks[t.id].lastStatus = 'loading';
        } else if (opened < 4) {
          const created = await chrome.tabs.create({url:t.url,active:false});
          tracked[t.id] = created.id;
          managed[t.id] = {tabId:created.id,createdAt:now};
          opened++;
          checks[t.id].lastStatus = 'opening';
          if (created.status === 'complete') probes.push({targetId:t.id,tabId:created.id});
        } else {
          checks[t.id] = {...prior,nextCheckAt:now + 60000}; // Fairly stagger large lists.
        }
      } catch (e) {
        checks[t.id].lastStatus = 'error';
        checks[t.id].lastError = String(e?.message || e);
      }
    }
    await chrome.storage.local.set({checksByTarget:checks,managedTabIds:managed,trackedTabIds:tracked});
    return probes;
  });
  for (const p of toProbe) void probeTab(p.tabId, p.targetId);
}
function sweep() {
  if (sweepActive) return sweepActive;
  sweepActive = doSweep().catch(e => console.warn('[TargetClick] Scheduled check:', e)).finally(() => {sweepActive = null;});
  return sweepActive;
}
async function forceCheck(targetId = null) {
  await enqueue(async () => {
    const s = await chrome.storage.local.get(SETTINGS);
    if (s.globalEnabled === false) throw new Error('전체 자동 클릭이 꺼져 있습니다. 먼저 켜 주세요.');
    if (targetId && !(s.targets || []).some(t => t.id === targetId && t.enabled))
      throw new Error('선택한 URL의 감시가 꺼져 있거나 삭제되었습니다.');
    const checks = {...(s.checksByTarget || {})};
    for (const t of (s.targets || []).filter(isTarget)) {
      if ((targetId && t.id !== targetId) || !t.enabled) continue;
      checks[t.id] = {...(checks[t.id] || {}),intervalHours:intervalHours(t),nextCheckAt:Date.now(),lastStatus:'scheduled'};
    }
    await chrome.storage.local.set({checksByTarget:checks});
  });
  if (sweepActive) await sweepActive;
  await sweep();
  return {ok:true};
}

chrome.runtime.onInstalled.addListener(() => {void sweep();});
chrome.runtime.onStartup.addListener(() => {void sweep();});
chrome.alarms.onAlarm.addListener(a => {if (a.name === ALARM_NAME) void sweep();});
chrome.tabs.onCreated.addListener(() => reconcileSoon());
chrome.tabs.onRemoved.addListener(id => {injecting.delete(id);reconcileSoon();});
chrome.tabs.onUpdated.addListener((id, change) => {
  if ('url' in change || 'discarded' in change) {injecting.delete(id);reconcileSoon();}
  if (change.status === 'complete') {
    void enqueue(() => reconcileTabs(id)).then(async ({trackedTabIds}) => {
      const s = await chrome.storage.local.get(['targets','globalEnabled']);
      if (s.globalEnabled === false) return;
      const t = (s.targets || []).find(v => v.enabled && trackedTabIds[v.id] === id);
      if (t) void probeTab(id,t.id);
    }).catch(e => console.warn('[TargetClick] Completed tab:', e));
  }
});
chrome.webNavigation.onHistoryStateUpdated.addListener(d => {if (d.frameId === 0) reconcileSoon(d.tabId);});
chrome.permissions.onAdded.addListener(() => {void sweep();});
chrome.permissions.onRemoved.addListener(() => {void sweep();});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.targets || changes.globalEnabled)) void sweep();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'RECONCILE') {
    enqueue(() => reconcileTabs()).then(respond).catch(e => respond({error:String(e)}));
    return true;
  }
  if (message?.type === 'CHECK_NOW') {
    forceCheck(typeof message.targetId === 'string' ? message.targetId : null)
      .then(respond).catch(e => respond({error:String(e)}));
    return true;
  }
  if (message?.type === 'CAN_CLICK' || message?.type === 'RECORD_CLICK') {
    (async () => {
      const s = await chrome.storage.local.get(SETTINGS);
      const target = findAuthorized(s,sender,message);
      if (!target || !await allowedPermission(target)) return {allowed:false};
      if (message.type === 'CAN_CLICK') {
        const at = Date.parse(s.statsByTarget?.[target.id]?.lastClickedAt || '');
        return {allowed:!Number.isFinite(at) || Date.now() - at >= 1800};
      }
      return enqueue(async () => {
        const latest = await chrome.storage.local.get(SETTINGS);
        if (!findAuthorized(latest,sender,message)) return {allowed:false};
        const next = {...(latest.statsByTarget || {})};
        const previous = next[target.id] || {};
        const now = Date.now();
        const at = Date.parse(previous.lastClickedAt || '');
        if (Number.isFinite(at) && now - at < 1800) return {allowed:false};
        next[target.id] = {clickCount:(Number(previous.clickCount)||0)+1,lastClickedAt:new Date(now).toISOString()};
        const checks = {...(latest.checksByTarget || {})};
        checks[target.id] = {...(checks[target.id] || {}),
          intervalHours:intervalHours(target),lastStatus:'clicked',lastCheckedAt:new Date(now).toISOString(),
          lastError:'',nextCheckAt:now + intervalHours(target)*3600000};
        const managed = {...(latest.managedTabIds || {})};
        if (managed[target.id]?.tabId === sender.tab?.id) {
          managed[target.id] = {...managed[target.id],lastActivityAt:now};
        }
        await chrome.storage.local.set({statsByTarget:next,checksByTarget:checks,managedTabIds:managed});
        return {allowed:true};
      });
    })().then(respond).catch(e => {console.warn('[TargetClick] Click record:',e);respond({allowed:false});});
    return true;
  }
});

// Alarm persistence can change after a browser restart or extension update.
void ensureAlarm().catch(e => console.warn('[TargetClick] Alarm setup:', e));
