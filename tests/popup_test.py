"""Browser popup test: multiple targets, per-entry toggles, deletion and retention."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium')
    page=browser.new_page(viewport={'width':470,'height':1150},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('about:blank')
    page.set_content((ROOT/'popup.html').read_text())
    page.add_style_tag(path=str(ROOT/'popup.css'))
    page.evaluate("""() => {
      Object.defineProperty(crypto,'randomUUID',{value:()=>`test-${Math.random().toString(36).slice(2)}`});
      window.saved={targets:[],trackedTabIds:{},statsByTarget:{},globalEnabled:true};
      window.prompts=[]; window.listeners=[];
      const copy=ks=>Object.fromEntries(ks.map(k=>[k,window.saved[k]]));
      const set=async obj=>{
        Object.assign(window.saved,obj);
        for(const cb of window.listeners)cb(Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,{newValue:v}])),'local');
      };
      window.chrome={
        storage:{local:{get:async ks=>copy(ks),set},onChanged:{addListener:cb=>window.listeners.push(cb)}},
        permissions:{request:async o=>{window.prompts.push(o);return true},remove:async()=>true},
        runtime:{sendMessage:async msg=>({trackedTabIds:window.saved.trackedTabIds,total:window.saved.targets.length})},
        tabs:{query:async()=>[{id:100,url:'https://claude.ai/chat/abc'}],get:async id=>({id,discarded:false}),sendMessage:async()=>({phase:'disabled'}),create:async o=>o},
        windows:{update:async()=>{}}
      };
    }""")
    page.add_script_tag(path=str(ROOT/'popup.js'))
    assert page.locator('#empty-state').is_visible()
    page.locator('#url-input').fill('https://claude.ai/chat/abc?foo=bar')
    page.locator('#label-input').fill('Continue')
    page.locator('#add-btn').click()
    page.wait_for_function('window.saved.targets.length === 1')
    assert page.locator('.target-card').count()==1
    page.locator('#url-input').fill('https://chatgpt.com/c/xyz')
    page.locator('#label-input').fill('계속')
    page.locator('#add-btn').click()
    page.wait_for_function('window.saved.targets.length === 2')
    assert page.locator('.target-card').count()==2
    assert page.evaluate('window.saved.targets.map(t=>t.url)')==['https://claude.ai/chat/abc','https://chatgpt.com/c/xyz']
    assert len(page.evaluate('window.prompts'))==2
    page.locator('#url-input').fill('https://chatgpt.com/c/xyz#hash')
    page.locator('#add-btn').click()
    assert page.locator('#feedback').inner_text()=='이미 등록된 URL입니다.'
    assert page.evaluate('window.saved.targets.length')==2
    # Individual toggle changes only one item.
    page.locator('.target-card').first.locator('input[type="checkbox"]').uncheck()
    page.wait_for_function('window.saved.targets[0].enabled === false')
    assert page.evaluate('window.saved.targets[1].enabled') is True
    # Deleting the second entry leaves the first intact.
    page.locator('.target-card').nth(1).get_by_role('button',name='삭제').click()
    page.wait_for_function('window.saved.targets.length === 1')
    assert page.evaluate('window.saved.targets[0].url')=='https://claude.ai/chat/abc'
    page.locator('#global-switch').uncheck()
    page.wait_for_function('window.saved.globalEnabled===false')
    page.locator('#global-switch').check()
    page.wait_for_function('window.saved.globalEnabled===true')
    # Enable the entry again for the preview.
    page.locator('.target-card').first.locator('input[type="checkbox"]').check()
    page.wait_for_function('window.saved.targets[0].enabled === true')
    # Add another entry for the final screenshot.
    page.locator('#url-input').fill('https://chatgpt.com/c/xyz')
    page.locator('#label-input').fill('계속')
    page.locator('#add-btn').click()
    page.wait_for_function('window.saved.targets.length === 2')
    page.screenshot(path='/mnt/data/target-tab-auto-clicker-v3-preview.png',full_page=True)
    assert not errors, errors
    print('PASS: popup add two, URL normalization, duplicate rejected, individual toggle, delete, global ON/OFF, screenshot')
    browser.close()
