(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const addBtn=$('add-btn'), list=$('target-list'), enabled=$('global-switch');
  let targets=[], tracked={}, stats={}, checks={}, globalEnabled=true, timer=null, updating=false;

  function canonical(raw) {
    try {
      const u=new URL(raw.trim());
      if (!['http:','https:'].includes(u.protocol) || !u.hostname || u.username || u.password) return null;
      return u.origin + (u.pathname.replace(/\/+$/, '') || '/');
    } catch {return null;}
  }
  function permissionOrigin(raw) {
    const u = new URL(raw);
    return u.protocol + '//' + u.hostname + '/*';
  }
  function feedback(text,error=false) {
    $('feedback').textContent=text;
    $('feedback').dataset.error=String(error);
  }
  function create(tag, className, value) {
    const el=document.createElement(tag);
    if (className) el.className=className;
    if (value != null) el.textContent=value;
    return el;
  }
  function formatDate(iso) {
    if (!iso) return '기록 없음';
    const n=new Date(iso);
    return isNaN(n.getTime()) ? '기록 없음' : new Intl.DateTimeFormat('ko-KR',{
      month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'
    }).format(n);
  }
  function formatNextCheck(value) {
    if (!Number.isFinite(value)) return '다음 확인: 준비 중';
    const diff = value - Date.now();
    if (diff <= 0) return '다음 확인: 곧 시작';
    const minutes = Math.ceil(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `다음 확인: ${hours ? `${hours}시간 ` : ''}${rest}분 후 (${formatDate(value)})`;
  }
  function setToggle(targetId,checked,description) {
    const label=create('label','switch card-toggle');
    const input=document.createElement('input');
    input.type='checkbox';input.setAttribute('role','switch');input.checked=checked;
    input.setAttribute('aria-label',`${description} 감시 ${checked?'중지':'시작'}`);
    input.addEventListener('change',async () => {
      const old=targets;
      try {
        const next=targets.map(t => t.id===targetId ? {...t,enabled:input.checked} : t);
        await chrome.storage.local.set({targets:next});
        targets=next;await reconcile();render();
      } catch(err) {targets=old;input.checked=!input.checked;feedback(`설정 변경 실패: ${err.message}`,true);}
    });
    const track=create('span','switch-track');track.setAttribute('aria-hidden','true');
    track.append(create('span','switch-knob'));
    label.append(input,track);
    return label;
  }
  function render() {
    $('list-count').textContent=String(targets.length);
    $('list-summary').textContent=targets.length ? `${targets.filter(t=>t.enabled).length}개 활성화 · 각 URL별 1개 탭 연결` : '등록한 페이지가 없습니다';
    $('empty-state').hidden=targets.length!==0;
    list.replaceChildren();
    for (const t of targets) {
      const u=new URL(t.url);
      const card=create('article',`target-card${t.enabled?'':' is-off'}`);
      card.dataset.id=t.id;
      const head=create('div','card-head');
      head.append(create('span','site-mark',u.hostname.slice(0,1).toUpperCase()));
      const info=create('div','target-info');
      const host=create('span','target-host',u.hostname);
      const path=create('span','target-url',u.pathname);
      path.title=t.url;info.append(host,path);
      head.append(info,setToggle(t.id,t.enabled,u.hostname+u.pathname));
      const state=create('div','card-state');
      const status=create('span','status-text');status.dataset.role='status';
      status.append(create('span','status-dot'),document.createTextNode('연결 확인 중'));
      const total=create('span','click-mini');total.dataset.role='clicks';
      state.append(status,total);
      const schedule = create('div','schedule-info');
      schedule.dataset.role='schedule';
      const intervalRow = create('div','interval-row');
      const intervalLabel = create('label','interval-caption','확인 주기');
      const intervalInput = create('input','interval-edit');
      intervalInput.type='number';intervalInput.min='1';intervalInput.max='48';intervalInput.step='1';
      intervalInput.value=String(t.intervalHours || 5);
      intervalInput.setAttribute('aria-label',`${t.url} 확인 주기 (시간)`);
      intervalLabel.append(intervalInput,document.createTextNode(' 시간'));
      intervalInput.addEventListener('change', async () => {
        const hours=Number(intervalInput.value);
        if (!Number.isInteger(hours) || hours < 1 || hours > 48) {
          intervalInput.value=String(t.intervalHours || 5);
          feedback('확인 주기는 1~48시간으로 설정하세요.',true);return;
        }
        try {
          const next=targets.map(v=>v.id===t.id ? {...v,intervalHours:hours} : v);
          await chrome.storage.local.set({targets:next});
          targets=next;
          feedback('확인 주기를 변경했습니다. 다음 확인 시각을 다시 계산합니다.');
        } catch(e) {intervalInput.value=String(t.intervalHours || 5);feedback(`주기 저장 실패: ${e.message}`,true);}
      });
      intervalRow.append(intervalLabel);
      const checkNow=create('button','mini-button','지금 확인');
      checkNow.type='button';checkNow.dataset.role='check';
      checkNow.disabled=!t.enabled || !globalEnabled;
      checkNow.addEventListener('click',()=>void checkTarget(t.id,checkNow));
      intervalRow.append(checkNow);
      const footer=create('div','card-footer');
      const label=create('span','button-label',`버튼: ${t.buttonLabel}`);
      label.title=t.buttonLabel;footer.append(label);
      const open=create('button','mini-button','탭 열기');open.type='button';open.dataset.role='open';
      open.addEventListener('click',()=>void openTab(t.id));
      const remove=create('button','mini-button delete','삭제');remove.type='button';
      remove.setAttribute('aria-label',`${t.url} 목록에서 삭제`);
      remove.addEventListener('click',()=>void removeTarget(t.id));
      footer.append(open,remove);
      card.append(head,state,schedule,intervalRow,footer);list.append(card);
    }
    updateTotals();
    void updateStatuses();
  }
  function updateTotals() {
    const count=targets.reduce((a,t)=>a+(Number(stats[t.id]?.clickCount)||0),0);
    $('total-clicks').textContent=`${count.toLocaleString('ko-KR')}회`;
  }
  async function checkTarget(targetId,button) {
    button.disabled=true;
    try {
      const response=await chrome.runtime.sendMessage({type:'CHECK_NOW',targetId});
      if (response?.error) throw new Error(response.error);
      await sync();
      feedback('페이지 확인을 요청했습니다. 닫힌 탭은 자동으로 열립니다.');
    } catch(e) {feedback(`확인 실패: ${e.message}`,true);}
    finally {button.disabled=false;}
  }
  async function reconcile() {
    const result=await chrome.runtime.sendMessage({type:'RECONCILE'});
    if (result?.error) throw new Error(result.error);
    return result;
  }
  async function sync() {
    const s=await chrome.storage.local.get(['targets','trackedTabIds','statsByTarget','checksByTarget','globalEnabled']);
    const next=Array.isArray(s.targets) ? s.targets : [];
    const changed=JSON.stringify(next)!==JSON.stringify(targets);
    targets=next;
    tracked=s.trackedTabIds || {};
    stats=s.statsByTarget || {};
    checks=s.checksByTarget || {};
    globalEnabled=s.globalEnabled!==false;
    enabled.checked=globalEnabled;
    if (changed) render();
    else {updateTotals();await updateStatuses();}
  }
  async function updateStatuses() {
    if (updating) return;
    updating=true;
    try {
      await Promise.all(targets.map(async t => {
        const card=[...list.children].find(c=>c.dataset.id===t.id);
        if (!card) return;
        const status=card.querySelector('[data-role=status]');
        const clicks=card.querySelector('[data-role=clicks]');
        const open=card.querySelector('[data-role=open]');
        const schedule=card.querySelector('[data-role=schedule]');
        const checkButton=card.querySelector('[data-role=check]');
        if (checkButton) checkButton.disabled=!globalEnabled || !t.enabled;
        if (!status || !clicks || !open || !schedule) return;
        const count=Number(stats[t.id]?.clickCount)||0;
        clicks.textContent=`${count}회 · 마지막 클릭 ${formatDate(stats[t.id]?.lastClickedAt)}`;
        const check=checks[t.id] || {};
        schedule.textContent=`${formatNextCheck(check.nextCheckAt)} · 최근 점검 ${formatDate(check.lastCheckedAt)}`;
        if (check.lastError) schedule.title=check.lastError;
        const id=tracked[t.id];
        open.textContent=id==null?'탭 열기':'탭 이동';
        let state='waiting', title='예약 시각에 탭 자동 열기';
        if (!globalEnabled || !t.enabled) {state='off';title='감시 중지';}
        else if (id!=null) {
          let tab=null;
          try{tab=await chrome.tabs.get(id);}catch{}
          if (tab?.discarded) {title='절전 탭 · 확인 시 자동 복구';}
          else if (!tab) {title='탭 자동 재연결 대기';}
          else {
            let detail=null;
            try {detail=await chrome.tabs.sendMessage(id,{type:'GET_STATUS'});}catch{}
            const phases={disabled:['waiting','버튼 활성화 대기'],clicked:['clicked','클릭 후 다음 단계 감시'],
              waiting:['ready','버튼 감시 중'], 'rate-limited':['waiting','과다 클릭 보호 (10분 대기)'],'ambiguous':['waiting','동일 문구 버튼이 여러 개'],
              error:['waiting','감시 오류'],off:['off','감시 중지'],
              'not-target':['waiting','탭 연결 확인 중']};
            [state,title]=phases[detail?.phase] || ['waiting','페이지 연결 중'];
          }
        }
        if (check.lastStatus==='permission-error') {state='off';title='사이트 접근 권한 필요';}
        else if (check.lastStatus==='error' && state==='waiting') {title='확인 오류 · 다시 시도 예정';}
        status.replaceChildren(create('span','status-dot'),document.createTextNode(title));
        status.dataset.state=state;
      }));
    } finally {updating=false;}
  }
  async function openTab(targetId) {
    const t=targets.find(t=>t.id===targetId);
    if (!t) return;
    try {
      const id=tracked[targetId];
      if (id==null) await chrome.tabs.create({url:t.url});
      else {
        const tab=await chrome.tabs.update(id,{active:true});
        if(tab.windowId!=null) await chrome.windows.update(tab.windowId,{focused:true});
      }
      window.close();
    } catch(e) {feedback('탭을 열 수 없습니다. 주소를 확인하고 다시 시도하세요.',true);}
  }
  async function removeTarget(id) {
    const t=targets.find(t=>t.id===id);
    if (!t) return;
    const next=targets.filter(item=>item.id!==id);
    try {
      await chrome.storage.local.set({targets:next});
      targets=next;
      // Minimize retained site privileges when the last target for a host is removed.
      const origin=permissionOrigin(t.url);
      if (!next.some(item=>permissionOrigin(item.url)===origin)) {
        try {await chrome.permissions.remove({origins:[origin]});}catch{}
      }
      await reconcile();await sync();render();
      feedback('목록에서 삭제했습니다. 해당 탭은 더 이상 감시하지 않습니다.');
    } catch(e) {feedback(`삭제에 실패했습니다: ${e.message}`,true);await sync();}
  }
  $('add-form').addEventListener('submit',async event => {
    event.preventDefault();
    const url=canonical($('url-input').value);
    const buttonLabel=$('label-input').value.trim();
    if (!url) {feedback('https:// 또는 http:// 주소를 입력하세요.',true);return;}
    if (!buttonLabel) {feedback('클릭할 버튼 문구를 입력하세요.',true);return;}
    if (targets.some(t=>t.url===url)) {feedback('이미 등록된 URL입니다.',true);return;}
    if (targets.length>=50) {feedback('최대 50개까지 등록할 수 있습니다.',true);return;}
    const origin=permissionOrigin(url);
    addBtn.disabled=true;
    feedback('사이트 접근 권한을 요청하고 있습니다.');
    try {
      // permissions.request is initiated by the user gesture before other awaits.
      const granted=await chrome.permissions.request({origins:[origin]});
      if (!granted) {feedback('사이트 접근 권한을 허용해야 등록할 수 있습니다.',true);return;}
      const intervalHours=Number($('interval-input').value);
      if (!Number.isInteger(intervalHours) || intervalHours<1 || intervalHours>48) {
        feedback('확인 주기는 1~48시간으로 설정하세요.',true);return;
      }
      const entry={id:crypto.randomUUID(),url,buttonLabel,intervalHours,enabled:true};
      await chrome.storage.local.set({targets:[...targets,entry],globalEnabled:true});
      enabled.checked=true;
      await reconcile();await sync();render();
      $('url-input').value='';
      feedback('URL을 등록했습니다. 닫혀 있어도 백그라운드에서 자동 확인합니다.');
    } catch(e) {feedback(`등록 실패: ${e.message}`,true);}
    finally {addBtn.disabled=false;}
  });
  $('use-current').addEventListener('click',async () => {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const url=canonical(tab?.url || '');
    if (!url) {feedback('현재 탭 주소를 사용할 수 없습니다.',true);return;}
    $('url-input').value=url;feedback('현재 탭 주소를 입력했습니다. 추가 버튼으로 저장하세요.');
  });
  enabled.addEventListener('change',async () => {
    const value=enabled.checked;
    try {await chrome.storage.local.set({globalEnabled:value});await reconcile();await sync();}
    catch(e) {enabled.checked=!value;feedback('전체 설정 변경 실패',true);}
  });
  $('refresh-all').addEventListener('click',async () => {
    $('refresh-all').disabled=true;
    try {const r=await chrome.runtime.sendMessage({type:'CHECK_NOW'});if(r?.error)throw new Error(r.error);await sync();feedback('모든 대상 페이지 확인을 요청했습니다.');}
    catch(e) {feedback(`새로고침 실패: ${e.message}`,true);}
    finally {$('refresh-all').disabled=false;}
  });
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area==='local' && (changes.targets || changes.trackedTabIds || changes.statsByTarget || changes.checksByTarget || changes.globalEnabled)) void sync();
  });
  async function init() {
    await reconcile();await sync();
    timer=setInterval(()=>void sync(),3000);
    window.addEventListener('unload',()=>clearInterval(timer));
  }
  void init().catch(e => feedback(`설정 불러오기 실패: ${e.message}`,true));
})();
