async page=>{
  const base='http://127.0.0.1:4187/pelican-bike-benchmark/';
  const assert=(v,m)=>{if(!v)throw new Error(m);};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  async function ready(path){await page.goto(base+path);await page.waitForFunction(()=>!document.documentElement.classList.contains('site-boot-loading'));await page.waitForFunction(()=>document.body.dataset.page);}
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await ready('');
  if(await page.locator('#clear-selection').isVisible()) await page.locator('#clear-selection').click();
  await page.locator('#provider-filter').selectOption('xAI');
  assert(await page.locator('#cards .card').count()===5,'provider filtering');
  await page.locator('#cards input[type=checkbox]').nth(0).check();await page.locator('#cards input[type=checkbox]').nth(1).check();
  await page.locator('#start-compare').click();await page.waitForFunction(()=>document.body.dataset.page==='compare');
  assert(new URL(page.url()).searchParams.get('ids').split(',').length===2,'comparison preserves selection');
  await page.locator('[data-viewport=mobile]').click();assert(await page.locator('[data-viewport=mobile]').getAttribute('aria-pressed')==='true','mobile comparison toggle');
  await ready('entry.html?id=grok-4-7-xhigh-20261010-run01');
  await page.waitForFunction(()=>document.querySelector('#integrity-status').textContent.includes('一致'));
  await page.locator('#show-source').click();assert(await page.locator('#source-code').isVisible(),'source disclosure');
  await page.locator('#copy-source').focus();await page.locator('#copy-source').click();await page.waitForFunction(()=>document.querySelector('#copy-source').classList.contains('copied'));
  assert(await page.evaluate(async()=>(await navigator.clipboard.readText()).replace(/\r\n/g,'\n')===document.querySelector('#source-code').textContent.replace(/\r\n/g,'\n')),'exact source clipboard');
  await ready('method.html');
  assert(await page.locator('.VPDocAsideOutline .outline-link').count()>=6,'shared VitePress outline');
  await page.locator('#copy-commands').focus();await page.locator('#copy-commands').click();await page.waitForFunction(()=>document.querySelector('#copy-commands').classList.contains('copied'));
  const wasDark=await page.evaluate(()=>document.documentElement.classList.contains('dark'));
  await page.getByRole('switch').click();await page.waitForFunction(was=>document.documentElement.classList.contains('dark')!==was,wasDark);assert(await page.evaluate(()=>document.documentElement.dataset.theme===(document.documentElement.classList.contains('dark')?'dark':'light')),'one appearance state');
  await page.getByRole('button',{name:'Search the site',exact:true}).click();
  const search=page.getByRole('combobox',{name:/Search/i});await search.fill('固定提示词');
  await page.waitForFunction(()=>document.querySelectorAll('.inline-search-result').length>0 || document.querySelector('[role=listbox] [role=option]'));
  await page.keyboard.press('Escape');
  const layouts=[];
  for(const theme of ['light','dark'])for(const target of ['','method.html','compare.html?ids=grok-4-7-xhigh-20261010-run01,grok-4-6-high-20261010-run01','entry.html?id=grok-4-7-xhigh-20261010-run01']){
    await ready(target);await page.evaluate(t=>{document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t;},theme);
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert(metrics.width===metrics.scroll,`overflow ${theme}/${target}/${width} ${JSON.stringify(metrics)}`);
      layouts.push(`${theme}/${target.split('?')[0]||'index'}/${width}`);
      if(width===390 || width===1440)await page.screenshot({path:`output/playwright/shared-${theme}-${target.split('.')[0]||'index'}-${width}.png`});
    }
  }
  const noJs=await page.context().browser().newContext({javaScriptEnabled:false});
  try{const p=await noJs.newPage();await p.goto(base);assert(await p.locator('#cards .card').count()===25,'no-JS gallery preserved');assert(await p.locator('.site-loading').isHidden(),'no-JS readable');}finally{await noJs.close();}
  assert(errors.length===0,`browser errors ${errors.join('; ')}`);
  return {filter:true,comparison:true,sourceHash:true,sourceCopy:true,commandCopy:true,outline:true,theme:true,search:true,noJS:true,layouts:layouts.length,errors};
}
