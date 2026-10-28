'use strict';

// A target owns at most one exact-matching tab. The worker authorizes every
// click immediately before the content script dispatches it.
const SETTINGS = ['targets', 'trackedTabIds', 'globalEnabled', 'statsByTarget'];
let work = Promise.resolve();
const MAX_TARGETS = 50;

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
function isTarget(t) {
  return t && typeof t.id === 'string' && t.id.length > 0 &&
    canonical(t.url) === t.url && typeof t.buttonLabel === 'string' && t.buttonLabel.trim();
}
function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function enqueue(fn) {
  work = work.catch(() => {}).then(fn);
  return work;
}

// Preserve a v2 target if v3 is installed as an update to the same extension.
async function migrate() {
  const s = await chrome.storage.local.get([
    'targets', 'targetUrl', 'buttonLabel', 'autoContinueEnabled', 'targetTabId',
    'autoContinueStats', 'statsByTarget', 'globalEnabled'
  ]);
  if (Array.isArray(s.targets)) return;
  const url = canonical(s.targetUrl);
  const targets = url ? [{id:'migrated-v2',url,buttonLabel:(s.buttonLabel || '계속').trim() || '계속',enabled:true}] : [];
  const statsByTarget = url && s.autoContinueStats ? {'migrated-v2':s.autoContinueStats} : {};
  await chrome.storage.local.set({
    targets, trackedTabIds: {},
    globalEnabled:s.autoContinueEnabled !== false,
    statsByTarget:s.statsByTarget || statsByTarget
  });
}

async function reconcileTabs() {
  await migrate();
  const s = await chrome.storage.local.get(SETTINGS);
  const targets = (Array.isArray(s.targets) ? s.targets : []).filter(isTarget).slice(0, MAX_TARGETS);
  const old = s.trackedTabIds || {};
  const tabs = await chrome.tabs.query({});
  const next = {};
  const usedTabIds = new Set();
  for (const t of targets) {
    const matches = tabs.filter(tab => Number.isInteger(tab.id) &&
      canonical(tab.url) === t.url && !usedTabIds.has(tab.id));
    const selected = matches.find(tab => tab.id === old[t.id]) || matches[0];
    next[t.id] = selected?.id ?? null;
    if (selected) usedTabIds.add(selected.id);
  }
  if (!equal(old, next)) await chrome.storage.local.set({trackedTabIds: next});
  if (s.globalEnabled !== false) {
    const injected = new Set();
    for (const t of targets) {
      const id = next[t.id];
      if (!t.enabled || id === null || injected.has(id)) continue;
      const tab = tabs.find(item => item.id === id);
      if (tab?.discarded) continue;
      const origin = permissionOrigin(t.url);
      if (!await chrome.permissions.contains({origins:[origin]})) continue;
      injected.add(id);
      try { await chrome.scripting.executeScript({target:{tabId:id},files:['content.js']}); }
      catch (error) { console.debug('[TargetClick] Injection pending:', error?.message); }
    }
  }
  return {trackedTabIds: next, total: targets.length};
}
function reconcileSoon() {
  void enqueue(reconcileTabs).catch(e => console.warn('[TargetClick] Reconcile:', e));
}
function findAuthorized(s, sender, message) {
  const id = sender.tab?.id;
  const target = (Array.isArray(s.targets) ? s.targets : []).find(t =>
    t.id === message.targetId && isTarget(t));
  if (!target || !target.enabled || s.globalEnabled === false ||
      !Number.isInteger(id) || s.trackedTabIds?.[target.id] !== id ||
      canonical(message.href) !== target.url || canonical(sender.tab?.url) !== target.url) return null;
  return target;
}

chrome.runtime.onInstalled.addListener(reconcileSoon);
chrome.runtime.onStartup.addListener(reconcileSoon);
chrome.tabs.onCreated.addListener(reconcileSoon);
chrome.tabs.onRemoved.addListener(reconcileSoon);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if ('url' in change || change.status === 'complete' || 'discarded' in change) reconcileSoon();
});
chrome.webNavigation.onHistoryStateUpdated.addListener(d => {if (d.frameId === 0) reconcileSoon();});
chrome.permissions.onAdded.addListener(reconcileSoon);
chrome.permissions.onRemoved.addListener(reconcileSoon);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.targets || changes.globalEnabled)) reconcileSoon();
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'RECONCILE') {
    enqueue(reconcileTabs).then(respond).catch(e => respond({error:String(e)}));
    return true;
  }
  if (message?.type === 'CAN_CLICK' || message?.type === 'RECORD_CLICK') {
    (async () => {
      const s = await chrome.storage.local.get(SETTINGS);
      const target = findAuthorized(s, sender, message);
      if (!target) return {allowed:false};
      const origin = permissionOrigin(target.url);
      if (!await chrome.permissions.contains({origins:[origin]})) return {allowed:false};
      if (message.type === 'RECORD_CLICK') {
        // Serialized through the queue to avoid lost increments between tabs.
        return enqueue(async () => {
          const latest = await chrome.storage.local.get(SETTINGS);
          if (!findAuthorized(latest,sender,message)) return {allowed:false};
          const next = {...(latest.statsByTarget || {})};
          const old = next[target.id] || {};
          next[target.id] = {clickCount:(Number(old.clickCount)||0)+1,lastClickedAt:new Date().toISOString()};
          await chrome.storage.local.set({statsByTarget:next});
          return {allowed:true};
        });
      }
      return {allowed:true};
    })().then(respond).catch(() => respond({allowed:false}));
    return true;
  }
});
