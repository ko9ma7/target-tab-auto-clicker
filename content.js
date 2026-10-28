(() => {
  'use strict';
  if (window.__targetTabAutoContinueV3) return;
  window.__targetTabAutoContinueV3 = true;

  const SCAN_DELAY = 180;
  const POLL_INTERVAL = 1600;
  const LIMIT_HINTS = [
    /일시\s*중지됨/i, /무료\s*사용량/i, /사용량\s*제한/i, /사용량.*다시\s*제공/i,
    /usage\s*limit/i, /limit\s*reached/i, /temporarily\s*paused/i, /resets?\s+(?:at|in)/i
  ];
  let phase = 'waiting';
  let activeKey = null;
  let cycle = 'idle', missingCount = 0, clickedElement = null;
  let seenDisabled = new WeakSet();
  let scheduled = false, scanning = false;

  function canonical(raw) {
    try {
      const u = new URL(raw);
      if (!['http:','https:'].includes(u.protocol)) return null;
      return u.origin + (u.pathname.replace(/\/+$/, '') || '/');
    } catch { return null; }
  }
  const isChatGPT = () => ['chatgpt.com','chat.openai.com'].includes(location.hostname);
  const visible = el => el.isConnected && el.getClientRects().length > 0 &&
    getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  function disabled(el) {
    return el.disabled || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' ||
      el.hasAttribute('data-disabled') || getComputedStyle(el).pointerEvents === 'none';
  }
  function hasLimitNotice(el) {
    let p = el.parentElement;
    for (let i=0; p && i<9 && p!==document.body; i++,p=p.parentElement) {
      const text=p.textContent || '';
      if (text.length > 2500) break;
      if (LIMIT_HINTS.some(re => re.test(text))) return true;
    }
    return false;
  }
  function candidates(label) {
    return [...document.querySelectorAll('button')].filter(el => {
      const text = (el.textContent||'').replace(/\s+/g,' ').trim();
      const aria=(el.getAttribute('aria-label')||'').trim();
      return (text===label || (!text && aria===label)) && visible(el) &&
        (!isChatGPT() || hasLimitNotice(el));
    });
  }
  function resetFor(key) {
    if (activeKey===key) return;
    activeKey=key;
    phase='waiting';cycle='idle';missingCount=0;clickedElement=null;seenDisabled=new WeakSet();
  }
  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      const s=await chrome.storage.local.get(['targets','trackedTabIds','globalEnabled']);
      const page=canonical(location.href);
      const target=(s.targets||[]).find(t => t.url===page && t.enabled);
      resetFor(target ? `${target.id}:${page}:${target.buttonLabel}` : null);
      if (!target) {phase='not-target';return;}
      if (s.globalEnabled===false) {phase='off';return;}
      const found=candidates(target.buttonLabel.trim());
      if (cycle==='clicked') {
        if (!clickedElement?.isConnected || !found.includes(clickedElement)) {
          missingCount++;
          if (missingCount>=3) {cycle='idle';clickedElement=null;phase='waiting';}
        } else {missingCount=0;phase='clicked';}
        return;
      }
      if (!found.length) {phase='waiting';return;}
      for (const el of found) if (disabled(el)) seenDisabled.add(el);
      const actionable=found.filter(el => !disabled(el) && (isChatGPT() || seenDisabled.has(el)));
      if (!actionable.length) {
        phase=found.some(disabled) ? 'disabled' : 'ready-not-armed';
        return;
      }
      const grant=await chrome.runtime.sendMessage({type:'CAN_CLICK',targetId:target.id,href:location.href});
      if (!grant?.allowed) {phase='not-target';return;}
      const button=actionable[actionable.length-1];
      if (!button.isConnected || disabled(button) || !visible(button) || canonical(location.href)!==target.url) return;
      cycle='clicked';clickedElement=button;missingCount=0;phase='clicked';
      try {
        button.click();
        void chrome.runtime.sendMessage({type:'RECORD_CLICK',targetId:target.id,href:location.href});
      } catch (e) {cycle='idle';phase='error';console.warn('[TargetClick] Click:',e);}
    } catch (e) {phase='error';console.warn('[TargetClick] Scan:',e);}
    finally {scanning=false;}
  }
  function schedule() {
    if (scheduled) return;
    scheduled=true;
    setTimeout(() => {scheduled=false;void scan();},SCAN_DELAY);
  }
  chrome.runtime.onMessage.addListener((m,_sender,reply) => {
    if (m?.type==='GET_STATUS' || m?.type==='SCAN_NOW') {
      void scan().then(() => reply({phase, targetId:activeKey?.split(':')[0] || null}));
      return true;
    }
  });
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area==='local' && (changes.targets || changes.globalEnabled || changes.trackedTabIds)) schedule();
  });
  new MutationObserver(schedule).observe(document.documentElement,{
    subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:['disabled','aria-disabled','data-disabled','class','style','hidden']
  });
  setInterval(() => void scan(),POLL_INTERVAL);
  void scan();
})();
