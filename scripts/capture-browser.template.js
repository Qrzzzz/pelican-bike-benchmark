async (page) => {
  const ids=__IDS__;
  const base='http://127.0.0.1:4173/pelican-bike-benchmark/';
  const results=[];let errors=[];
  const onError=error=>errors.push(error.message);
  const onConsole=message=>{if(message.type()==='error')errors.push(message.text());};
  page.on('pageerror',onError);page.on('console',onConsole);
  const browser=page.context().browser().version();
  const snap=async button=>({label:await button.getAttribute('aria-label'),pressed:await button.getAttribute('aria-pressed'),text:await button.textContent()});
  for(const id of ids){
    const checks=[];const screenshots={};
    for(const [view,width,height] of [['desktop',1200,800],['mobile',390,844]]){
      errors=[];
      await page.emulateMedia({reducedMotion:'no-preference',colorScheme:'light'});
      await page.setViewportSize({width,height});
      await page.goto(base+'submissions/'+id+'/preview.html');
      const frame=page.frameLocator('iframe');await frame.locator('body').waitFor();
      const before=await page.screenshot();
      await page.waitForTimeout(3000);
      const screenshot=await page.screenshot({path:'site/submissions/'+id+'/'+view+'.png'});
      screenshots[view]=view+'.png';
      const sizing=await frame.locator('html').evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,dpr:devicePixelRatio}));
      if(sizing.width!==width||sizing.height!==height||sizing.dpr!==1)throw new Error('Capture environment mismatch '+id+' '+JSON.stringify(sizing));
      checks.push({name:view==='desktop'?'桌面无横向溢出':'手机无横向溢出',status:sizing.scrollWidth<=width?'pass':'fail',detail:width+' × '+height+'，页面宽度 '+sizing.scrollWidth+'px'});
      checks.push({name:view==='desktop'?'桌面自动动态':'手机自动动态',status:before.equals(screenshot)?'not-tested':'pass',detail:before.equals(screenshot)?'3 秒间隔未观察到画面变化，需人工复查':'相隔 3 秒的画面像素发生变化；不等同于轮子与脚踏质量评分'});
      const buttons=frame.getByRole('button',{name:/暂停|播放|继续|pause|play|resume/i});
      if(await buttons.count()===1){
        const button=buttons.first();const initial=await snap(button);await button.click();const clicked=await snap(button);await button.press('Space');const spaced=await snap(button);
        checks.push({name:view==='desktop'?'桌面播放／暂停按钮':'手机播放／暂停按钮',status:JSON.stringify(initial)!==JSON.stringify(clicked)?'pass':'fail',detail:JSON.stringify({before:initial,after:clicked})});
        checks.push({name:view==='desktop'?'桌面空格键切换':'手机空格键切换',status:JSON.stringify(clicked)!==JSON.stringify(spaced)?'pass':'fail',detail:JSON.stringify({before:clicked,after:spaced})});
      }else checks.push({name:view+' 播放与键盘操作',status:'not-tested',detail:'未找到唯一的语义播放按钮，需人工复查'});
      checks.push({name:view==='desktop'?'桌面控制台':'手机控制台',status:errors.length?'fail':'pass',detail:errors.length?[...new Set(errors)].join('\n'):'未捕获脚本异常或 error 级控制台消息'});
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1200,height:800});
    await page.goto(base+'submissions/'+id+'/preview.html');const frame=page.frameLocator('iframe');await frame.locator('body').waitFor();await page.waitForTimeout(300);
    const first=await page.screenshot();await page.waitForTimeout(700);const second=await page.screenshot();
    const active=await frame.locator('body').evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length);
    const buttons=frame.getByRole('button',{name:/暂停|播放|继续|pause|play|resume/i});const initial=await buttons.count()===1?await snap(buttons.first()):null;
    checks.push({name:'减少动态：默认静止',status:first.equals(second)&&active===0?'pass':'fail',detail:JSON.stringify({stablePixels:first.equals(second),runningAnimations:active,button:initial})});
    if(await buttons.count()===1){await buttons.first().click();const after=await snap(buttons.first());await page.waitForTimeout(250);const a=await page.screenshot();await page.waitForTimeout(700);const b=await page.screenshot();const motionObserved=!a.equals(b);checks.push({name:'减少动态：可手动播放',status:JSON.stringify(initial)!==JSON.stringify(after)&&motionObserved?'pass':'fail',detail:JSON.stringify({before:initial,after,motionObserved})});}
    results.push({id,screenshots,environment:{browser:'Chromium '+browser,os:'Windows',captureAt:'load + 3 seconds',motion:'prefers-reduced-motion: no-preference；默认加载状态',dpr:1,desktop:'1200 × 800',mobile:'390 × 844',testedAt:new Date().toISOString()},runtimeChecks:checks});
  }
  page.off('pageerror',onError);page.off('console',onConsole);
  return results;
}
