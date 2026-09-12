import { readFile, writeFile, mkdir } from "node:fs/promises";
import { checkSource, makePreview, sha256 } from "./lib.mjs";
const prompt = JSON.parse(await readFile("site/data/prompt.v1.json", "utf8"));
prompt.sha256 = sha256(prompt.text);
await writeFile(
  "site/data/prompt.v1.json",
  JSON.stringify(prompt, null, 2) + "\n",
);
const palettes = [
  {
    id: "demo-seaside",
    title: "海风里的慢骑",
    description: "线条、海风与一辆青色单车。一个轻盈的午后。",
    bg: "#e8eee7",
    ink: "#344a46",
    bike: "#009da9",
    sun: "#d6dfc2",
    bill: "#e8ad57",
    land: "#c9d8c9",
    sky: "海岸",
  },
  {
    id: "demo-sunset",
    title: "追着落日出发",
    description: "暖橙色的天空下，让每一圈车轮都有回响。",
    bg: "#f1e4d5",
    ink: "#694c43",
    bike: "#bc6046",
    sun: "#e9b688",
    bill: "#cf824c",
    land: "#dec8b3",
    sky: "落日",
  },
  {
    id: "demo-midnight",
    title: "月光骑行俱乐部",
    description: "夜色安静，星星亮着。下一站，还可以再远一点。",
    bg: "#283c47",
    ink: "#dce5d6",
    bike: "#d8bc73",
    sun: "#79928c",
    bill: "#dfb56c",
    land: "#3a555d",
    sky: "夜行",
  },
];
function scene(p, hero = false) {
  const bg = hero ? "none" : p.bg,
    ink = hero ? "#56665b" : p.ink;
  const wheel = (cx) =>
    `<g transform="translate(${cx} 300)"><circle r="57" fill="${p.bg}" stroke="${ink}" stroke-width="5"/><circle r="49" fill="none" stroke="${ink}" stroke-width="1" opacity=".3"/><g class="spokes" stroke="${ink}" stroke-width="1.3" opacity=".6">${[0, 30, 60, 90, 120, 150].map((a) => `<path d="M-49 0H49" transform="rotate(${a})"/>`).join("")}</g><circle r="5" fill="${ink}"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-labelledby="title"><title id="title">${p.title}：鹈鹕骑自行车</title><rect width="600" height="400" fill="${bg}"/><circle cx="444" cy="108" r="54" fill="${p.sun}" opacity=".75"/><path d="M22 271Q93 221 151 253T277 246T416 235T584 245" fill="none" stroke="${ink}" stroke-width="1" opacity=".22"/><path d="M0 344Q170 326 304 347T600 339V400H0Z" fill="${p.land}" opacity="${hero ? ".26" : ".55"}"/><path d="M44 357H555" stroke="${ink}" stroke-width="1" opacity=".45"/><g class="road" stroke="${ink}" stroke-linecap="round" opacity=".35"><path d="M64 374h35m56 0h19m209 0h39m80 0h30"/></g><g stroke="${ink}" fill="none" opacity=".45" stroke-linecap="round"><path d="M93 121q8-9 16 0 8-9 16 0m25-39q6-7 12 0 6-7 12 0"/><path d="M477 222h35m-22 9h41"/></g>${wheel(175)}${wheel(411)}<g fill="none" stroke="${p.bike}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="m175 300 66-81 46 81H175m66-81h126l-80 81m124 0-60-121h30"/></g><path d="m236 208 6 14m-16-16h32m88-27h34q15 1 10 14" stroke="${ink}" stroke-width="6" stroke-linecap="round" fill="none"/><g class="bird"><path d="m251 188 21 38 22 25" fill="none" stroke="${p.bill}" stroke-width="9" stroke-linecap="round"/><path d="m289 252 17 2" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><path d="M217 177 187 151l35 3c16-22 47-21 74-26 13-3 10-24 14-37 5-20 34-29 47-10 7 11 0 27-13 35-6 3-10 12-10 22-1 40-25 64-67 64-18 0-35-7-50-25Z" fill="#fbf8ed" stroke="${ink}" stroke-width="2.8" stroke-linejoin="round"/><path d="M345 90 431 107 344 111Z" fill="${p.bill}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><path d="M344 111 409 109q-33 38-76 25" fill="${p.bill}" opacity=".85" stroke="${ink}" stroke-width="2"/><circle cx="341" cy="86" r="4.5" fill="${ink}"/><circle cx="342" cy="84.6" r="1.1" fill="#fff"/><path d="M230 159q34-17 61 2l-22 16q-23 10-39-18Z" fill="${p.land}" stroke="${ink}" stroke-width="2"/><path d="m290 161 33 30 25-4" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/><path d="m277 191-13 35 18 48" fill="none" stroke="${p.bill}" stroke-width="10" stroke-linecap="round"/><path d="m274 277 22 1" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/></g><circle cx="287" cy="300" r="13" fill="${p.bike}" stroke="${ink}" stroke-width="2"/><g transform="translate(287 300)"><g class="crank" stroke="${ink}" stroke-width="3"><path d="m-5-24 10 48"/><path d="M-14-24H4M-4 24h18" stroke-width="5"/></g></g><g stroke="${ink}" stroke-width="1.5" opacity=".5"><path d="M78 340v-16m0 8-7-8m7 4 8-9m443 21v-22m0 10 7-8"/></g></svg>`;
}
const entries = [];
try {
  entries.push(
    ...JSON.parse(await readFile("site/data/submissions.json", "utf8")).filter(
      (s) => s.kind !== "demo",
    ),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const p of palettes) {
  const svg = scene(p);
  const source = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${p.title} · 站点演示</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:${p.bg};color:${p.ink};font-family:system-ui,sans-serif}main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}svg{width:min(100%,900px);height:auto;display:block}h1{font-size:18px;font-weight:500;letter-spacing:.15em;margin:0}p{font-size:12px;opacity:.8}button{font:14px system-ui;background:transparent;color:inherit;border:1px solid currentColor;border-radius:30px;padding:10px 24px;cursor:pointer}button:focus-visible{outline:3px solid ${p.bike};outline-offset:5px}.spokes{transform-origin:0 0;animation:spin 3s linear infinite}.crank{transform-origin:0 0;animation:spin 3s linear infinite}.bird{animation:bob 1.5s ease-in-out infinite}.road{animation:road 1.5s linear infinite}[data-playing="false"] *{animation-play-state:paused!important}@keyframes spin{to{transform:rotate(360deg)}}@keyframes bob{50%{transform:translateY(-3px)}}@keyframes road{to{transform:translateX(-25px)}}@media(max-width:500px){main{padding:18px 8px}h1{font-size:16px}svg{margin:25px 0}}
</style></head><body><main><h1>${p.title}</h1><p>PELICAN BIKE / ${p.sky} / 站点演示</p>${svg}<button id="play" type="button" aria-pressed="false">播放动画</button><p>空格键切换 · 演示作品，不参与模型评分</p></main><script>
const preference=matchMedia('(prefers-reduced-motion: reduce)');let playing=!preference.matches;const button=document.getElementById('play');function render(){document.body.dataset.playing=String(playing);button.textContent=playing?'暂停动画':'播放动画';button.setAttribute('aria-pressed',String(playing));}button.addEventListener('click',()=>{playing=!playing;render();});document.addEventListener('keydown',event=>{if(event.code==='Space'&&!event.repeat&&event.target!==button){event.preventDefault();playing=!playing;render();}});preference.addEventListener('change',event=>{playing=!event.matches;render();});render();
</script></body></html>
`;
  const dir = `site/submissions/${p.id}`;
  await mkdir(dir, { recursive: true });
  const entry = {
    id: p.id,
    kind: "demo",
    title: p.title,
    description: p.description,
    model: "站点演示",
    version: "不适用",
    generatedAt: "2026-09-12",
    promptVersion: "v1",
    input: prompt.text,
    parameters: {
      purpose: "手工编写的站点演示，不是独立模型测试",
      sampling: "不适用",
    },
    tech: "SVG + CSS",
    environment: null,
    review: null,
    sourceSha256: sha256(source),
    staticCheck: checkSource(source),
    screenshots: {},
    cover: "cover.svg",
  };
  for (const [file, content] of Object.entries({
    "source.html.txt": source,
    "cover.svg": svg,
    "meta.json": JSON.stringify(entry, null, 2) + "\n",
    "preview.html": makePreview(source, p.title),
  }))
    await writeFile(`${dir}/${file}`, content);
  entries.push(entry);
}
await writeFile(
  "site/data/submissions.json",
  JSON.stringify(entries, null, 2) + "\n",
);
await writeFile("site/assets/hero.svg", scene(palettes[0], true));
await writeFile(
  "site/data/submission.template.json",
  JSON.stringify(
    {
      id: "model-name-20260912-run01",
      kind: "benchmark",
      title: "作品标题",
      description: "一句话描述作品",
      model: "填写模型名称",
      version: "填写精确模型版本",
      generatedAt: "2026-09-12",
      promptVersion: "v1",
      input: prompt.text,
      parameters: {
        temperature: "未记录",
        seed: "未记录",
        reasoningEffort: "未记录",
        tools: "未使用",
        durationSeconds: "未记录",
      },
      tech: "HTML + CSS + SVG",
      environment: null,
      review: null,
    },
    null,
    2,
  ) + "\n",
);
console.log("已生成 3 个明确标识的演示作品、提示词哈希和元数据模板。");
