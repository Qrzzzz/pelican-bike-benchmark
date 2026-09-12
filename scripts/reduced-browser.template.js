async page => {
  const ids=__IDS__,results=[];
  for(const id of ids){
    await page.goto('http://127.0.0.1:4173/pelican-bike-benchmark/submissions/'+id+'/preview.html');
    const frame=page.frameLocator('iframe');await frame.locator('body').waitFor();await page.waitForTimeout(350);
    const media=await frame.locator('body').evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(!media)throw new Error('Reduced-motion environment was not applied');
    const buttons=frame.getByRole('button',{name:/播放|暂停|继续|play|pause|resume/i});
    const getState=async()=>await buttons.count()===1?await buttons.first().evaluate(el=>({label:el.getAttribute('aria-label'),pressed:el.getAttribute('aria-pressed'),text:el.textContent.trim()})):null;
    const state=await getState();const a=await page.screenshot();await page.waitForTimeout(700);const b=await page.screenshot();const running=await frame.locator('body').evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
    const checks=[{name:'减少动态：默认静止',status:a.equals(b)&&running===0?'pass':'fail',detail:JSON.stringify({environment:'浏览器启动参数 force-prefers-reduced-motion，上下文 reduce；已核对 iframe 媒体查询',media,stablePixels:a.equals(b),runningAnimations:running,button:state})}];
    if(await buttons.count()===1){await buttons.first().click();await page.waitForTimeout(250);const after=await getState();const c=await page.screenshot();await page.waitForTimeout(700);const d=await page.screenshot();const moved=!c.equals(d);checks.push({name:'减少动态：可手动播放',status:moved&&JSON.stringify(state)!==JSON.stringify(after)?'pass':'fail',detail:JSON.stringify({before:state,after,motionObserved:moved})});}
    results.push({id,checks});
  }
  return results;
}
