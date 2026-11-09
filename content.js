(() => {
  'use strict';
  if (window.__targetTabAutoContinueV4) return;
  window.__targetTabAutoContinueV4 = true;

  const SCAN_DELAY = 200;
  const POLL_INTERVAL = 1800;
  const CLICK_GAP_MS = 2200;
  // Prevent a broken page from triggering endless clicks on newly-rendered buttons.
  const MAX_CLICKS_PER_10_MIN = 30;
  const LIMIT_HINTS = [
    /일시\s*중지됨/i, /무료\s*사용량/i, /사용량\s*제한/i, /사용량.*다시\s*제공/i,
    /usage\s*limit/i, /limit\s*reached/i, /temporarily\s*paused/i, /resets?\s+(?:at|in)/i
  ];
  let phase = 'waiting';
  let activeKey = null;
  let clickedButtons = new WeakSet();
  let rearmedButtons = new WeakSet();
  let seenDisabled = new WeakSet();
  let blockedButtons = new WeakSet();
  let lastClickAt = 0;
  let recentClicks = [];
  let scheduled = false;
  let scanning = false;
  let scanPromise = Promise.resolve();

  function canonical(raw) {
    try {
      const u = new URL(raw);
      if (!['http:', 'https:'].includes(u.protocol)) return null;
      return u.origin + (u.pathname.replace(/\/+$/, '') || '/');
    } catch { return null; }
  }
  const isChatGPT = () => ['chatgpt.com', 'chat.openai.com'].includes(location.hostname);
  function visible(el) {
    if (!el.isConnected || el.getClientRects().length === 0) return false;
    const css = getComputedStyle(el);
    return css.display !== 'none' && css.visibility !== 'hidden' && css.opacity !== '0';
  }
  function disabled(el) {
    return el.disabled === true || el.matches(':disabled') ||
      el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled') ||
      getComputedStyle(el).pointerEvents === 'none';
  }
  function hasLimitNotice(el) {
    let parent = el.parentElement;
    for (let i = 0; parent && i < 9 && parent !== document.body; i++, parent = parent.parentElement) {
      const text = parent.textContent || '';
      if (text.length > 2500) break;
      if (LIMIT_HINTS.some(re => re.test(text))) return true;
    }
    return false;
  }
  function normalized(text) {return String(text || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();}
  function candidates(label) {
    const wanted = normalized(label);
    return [...document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')]
      .filter(el => {
        const text = normalized(el.tagName === 'INPUT' ? el.value : el.textContent);
        const aria = normalized(el.getAttribute('aria-label'));
        return (text === wanted || (!text && aria === wanted)) && visible(el) &&
          (!isChatGPT() || hasLimitNotice(el));
      });
  }
  function resetFor(key) {
    if (activeKey === key) return;
    activeKey = key;
    phase = 'waiting';
    clickedButtons = new WeakSet();
    rearmedButtons = new WeakSet();
    seenDisabled = new WeakSet();
    blockedButtons = new WeakSet();
    lastClickAt = 0;
    recentClicks = [];
  }
  function scan() {
    if (scanning) return scanPromise;
    scanning = true;
    scanPromise = (async () => {
    try {
      const s = await chrome.storage.local.get(['targets', 'trackedTabIds', 'globalEnabled']);
      const page = canonical(location.href);
      const target = (Array.isArray(s.targets) ? s.targets : []).find(t => t.url === page && t.enabled);
      resetFor(target ? `${target.id}:${page}:${target.buttonLabel}` : null);
      if (!target) {phase = 'not-target';return;}
      if (s.globalEnabled === false) {phase = 'off';return;}
      const found = candidates(target.buttonLabel.trim());
      for (const el of found) {
        if (!disabled(el)) continue;
        seenDisabled.add(el);
        blockedButtons.delete(el);
        if (clickedButtons.has(el)) rearmedButtons.add(el);
      }
      if (!found.length) {phase = Date.now() - lastClickAt < 12000 ? 'clicked' : 'waiting';return;}
      const actionable = found.filter(el => !disabled(el) &&
        (!clickedButtons.has(el) || rearmedButtons.has(el)) &&
        (!blockedButtons.has(el) || rearmedButtons.has(el)));
      if (!actionable.length) {
        phase = found.every(disabled) ? 'disabled' : 'clicked';
        return;
      }
      const preferred = actionable.filter(el => seenDisabled.has(el) || rearmedButtons.has(el));
      if (found.some(disabled) && !preferred.length) {phase = 'disabled';return;}
      if (!preferred.length && actionable.length > 1) {phase = 'ambiguous';return;}
      const now = Date.now();
      recentClicks = recentClicks.filter(at => now - at < 10 * 60 * 1000);
      if (recentClicks.length >= MAX_CLICKS_PER_10_MIN) {phase = 'rate-limited';return;}
      if (now - lastClickAt < CLICK_GAP_MS) {phase = 'clicked';return;}
      const grant = await chrome.runtime.sendMessage({type:'CAN_CLICK',targetId:target.id,href:location.href});
      if (!grant?.allowed) {phase = 'waiting';return;}
      const button = (preferred.length ? preferred : actionable).at(-1);
      if (!button.isConnected || disabled(button) || !visible(button) || canonical(location.href) !== target.url) return;
      // Mark this exact DOM element as used. A new element may be clicked again;
      // a reused element must transition disabled -> enabled to be rearmed.
      clickedButtons.add(button);
      rearmedButtons.delete(button);
      // Other matching buttons already on the page are not the next generation.
      // Do not accidentally click an unrelated Continue control after this one.
      for (const other of found) if (other !== button && !disabled(other)) blockedButtons.add(other);
      lastClickAt = Date.now();
      recentClicks.push(lastClickAt);
      phase = 'clicked';
      try {
        button.click();
        const recorded = await chrome.runtime.sendMessage({type:'RECORD_CLICK',targetId:target.id,href:location.href});
        if (!recorded?.allowed) console.warn('[TargetClick] Click event was dispatched but not recorded.');
      } catch (error) {
        phase = 'error';
        console.warn('[TargetClick] Click:', error);
      }
    } catch (error) {phase = 'error';console.warn('[TargetClick] Scan:', error);}
    finally {scanning = false;}
    })();
    return scanPromise;
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {scheduled = false;void scan();}, SCAN_DELAY);
  }
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type === 'GET_STATUS' || message?.type === 'SCAN_NOW') {
      void scan().then(() => reply({phase,targetId:activeKey?.split(':')[0] || null}));
      return true;
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.targets || changes.globalEnabled || changes.trackedTabIds)) schedule();
  });
  new MutationObserver(schedule).observe(document.documentElement, {
    subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:['disabled','aria-disabled','data-disabled','class','style','hidden']
  });
  setInterval(() => void scan(), POLL_INTERVAL);
  void scan();
})();
