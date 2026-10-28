"""DOM behavior test: different URLs and button labels act independently."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
CHAT='''<!doctype html><html lang="ko"><body><button id="other">계속</button>
<div><span>일시 중지됨. 무료 사용량은 오후 4:40 이후 다시 제공됩니다.</span>
<button id="target" aria-disabled="true" style="pointer-events:none">계속</button></div>
<script>window.clicks=0;window.other=0;
document.querySelector('#target').addEventListener('click',()=>window.clicks++);
document.querySelector('#other').addEventListener('click',()=>window.other++);
window.activate=()=>{const b=document.querySelector('#target');b.removeAttribute('aria-disabled');b.style.pointerEvents='auto'};
</script></body></html>'''
OTHER='''<!doctype html><html lang="en"><body><button id="other">Continue</button>
<button id="target" disabled>Continue</button>
<script>window.clicks=0;window.other=0;
document.querySelector('#target').addEventListener('click',()=>window.clicks++);
document.querySelector('#other').addEventListener('click',()=>window.other++);
window.activate=()=>document.querySelector('#target').removeAttribute('disabled');
</script></body></html>'''
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    for href,html,target_id in [('https://chatgpt.com/c/first',CHAT,'a'),('https://claude.ai/chat/second',OTHER,'b')]:
        page=browser.new_page()
        page.goto('about:blank');page.set_content(html)
        page.evaluate('(href) => window.__fakeHref = href',href)
        page.evaluate('''() => {
          window.recorded=[];
          window.state={globalEnabled:true,targets:[
            {id:'a',url:'https://chatgpt.com/c/first',buttonLabel:'계속',enabled:true},
            {id:'b',url:'https://claude.ai/chat/second',buttonLabel:'Continue',enabled:true}
          ],trackedTabIds:{a:1,b:2}};
          window.changeCallbacks=[];
          window.chrome={runtime:{sendMessage:async msg=>{
            if(msg.type==='RECORD_CLICK'){window.recorded.push(msg.targetId);return {allowed:true};}
            return {allowed:msg.targetId === (new URL(window.__fakeHref).hostname==='chatgpt.com'?'a':'b') &&
             window.state.globalEnabled && window.state.targets.find(t=>t.id===msg.targetId)?.enabled};
          },onMessage:{addListener:()=>{}}},storage:{local:{get:async keys=>Object.fromEntries(keys.map(k=>[k,window.state[k]]))},
           onChanged:{addListener:fn=>window.changeCallbacks.push(fn)}}};
          window.disableTarget=()=>{window.state.targets.find(t=>t.id==='b').enabled=false;
            window.changeCallbacks.forEach(fn=>fn({targets:{}},'local'));};
        }''')
        script=(ROOT/'content.js').read_text().replace('location.href','window.__fakeHref').replace('location.hostname','new URL(window.__fakeHref).hostname')
        page.add_script_tag(content=script)
        page.wait_for_timeout(400)
        assert page.evaluate('window.clicks')==0
        assert page.evaluate('window.other')==0
        page.evaluate('window.activate()')
        page.wait_for_function('window.clicks===1',timeout=5000)
        page.wait_for_timeout(1900)
        assert page.evaluate('window.clicks')==1
        assert page.evaluate('window.other')==0
        assert page.evaluate('window.recorded')==[target_id]
        page.close()
        print('PASS content script:',href)
    browser.close()
