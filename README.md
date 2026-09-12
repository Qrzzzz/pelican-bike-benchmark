# 鹈鹕骑车 · Pelican Bike Benchmark

用同一份提示词，观察 AI 生成「鹈鹕骑自行车」单文件 HTML 的差异。原生 HTML / CSS / JavaScript 静态站，无后端、无运行时框架、无外部字体或 CDN。

## 本地预览

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run check
npm run dev
```

打开 http://127.0.0.1:4173/pelican-bike-benchmark/ 。服务器也支持根路径，便于检查 Pages 子路径兼容性。页面使用 fetch 读取 JSON，请通过服务器访问。

## 页面与数据

- `site/index.html`：作品库、搜索、模型与类型筛选、2–4 项选择、提示词复制。
- `site/compare.html?ids=run-a,run-b`：2–4 项对比，1200×800 / 390×844 固定视口，静态图或沙盒运行；链接可分享。
- `site/entry.html?id=run-a`：预览、原始输出、浏览器端 SHA-256 核对、参数、完整输入、环境与评分记录。
- `site/method.html`：测试约定、完整 v1 提示词、评分维度、环境与导入说明。
- `site/data/prompt.v1.json`：固定输入，哈希基于 text 字段 UTF-8 字节（LF，无末尾换行）。
- `site/data/submissions.json`：作品索引，每项与 `submissions/<id>/meta.json` 必须一致。

站点收录用户提交的 DeepSeek 4.1 Flash · max 原始输出，以及相同 v1 提示词生成的 Codex 模型作品。模型与推理强度逐项登记，原始字节与哈希保留；没有主观评分。正式作品附桌面／手机实测截图及浏览器检查记录。另有 3 个明确标识的站点演示，它们是手工编写的 SVG / CSS 场景变体，封面插画不是实测截图，不参与模型测试。

视觉参考 Qrzzzz 个人站的暖纸色、炭灰双主题、青色点缀、衬线标题与留白；插画独立编写。主题遵循系统偏好，可切换并保存在本机。

## 导入真实作品

1. 原样使用 `site/data/prompt.v1.json` 的 text 作为完整输入，保留首次原始输出（包括失败结果）。
2. 复制 `site/data/submission.template.json`，填写 id、模型精确版本、生成日期、参数。未知参数写“未记录”。
3. 将输出保存为 UTF-8 `result.txt`，执行：

```sh
npm run import -- --source ./result.txt --meta ./meta.json
# 可选：提供真实截图
npm run import -- --source ./result.txt --meta ./meta.json --desktop ./desktop.png --mobile ./mobile.png
npm run check
```

id 仅允许小写字母、数字和连字符（最多 80 字符），已有 id 不得覆盖。导入器保留原始字节、生成 SHA-256 和静态报告；原始输出超过 1 MiB 时拒绝导入。静态失败结果仍登记，但不生成运行预览。元数据不能指定任意资源路径或伪造检查结论。

截图仅接受 PNG / WebP，每张不超过 10 MiB。传入截图时，environment 必须包含 browser（名称及完整版本）、captureAt（如 load + 3 seconds）、motion（动态偏好与播放状态）、dpr: 1。桌面截图应为 1200×800，手机为 390×844，导入者须核对。未提供时显示待补充。可额外记录操作系统、捕获时间和交互实测结论。

评分可保留为 null。如记录评审，review 必须有 reviewer、date、scores 和 notes；后两者均含 runnable、visual、animation、accessibility、quality 五个键。scores 为 0–10 数字，notes 为对应文字依据。权重为 20%、30%、20%、20%、10%。演示作品不得计分。

`npm run demo` 可重建本项目演示、插画及模板，保留正式作品；不要用它生成模型测试结果。

## 预览隔离与限制

原始输出仅以 source.html.txt 保存。preview.html 是固定包装：即使单独打开，原始代码也位于 sandbox="allow-scripts" iframe 内，未启用同源、弹窗、表单、下载或顶层导航权限。最前方 CSP 禁止网络连接、外链资源、嵌套框架、worker、表单提交等，允许内联脚本、样式及 data 图像；网络资源仍被阻止。

导入器用 HTML 解析器检查危险标签、外部资源引用及脚本／事件中的常见网络、导航和动态代码接口。允许本地 SVG 片段、SVG 动画和经过检查的自包含 SVG 图标。该检查保守且不是通用 JavaScript 安全证明；沙盒也不隔离 CPU / 内存占用。仍需审阅提交。限制可能改变作品表现，不将静态通过称为完整浏览器验收。

## 验证与发布

`npm run check` 覆盖导入保真、拒绝重复 id / 路径穿越 / 提示词不一致、危险资源、失效作品停用、评分约束，并核验全部哈希、静态报告、沙盒包装与页面静态链接。PR 工作流与 Pages 发布前执行同一检查。

既有工作流在 main 推送或手动触发时部署 site/，无需站点构建步骤。

- 仓库：https://github.com/Qrzzzz/pelican-bike-benchmark
- 目标地址：https://qrzzzz.github.io/pelican-bike-benchmark/

发布后应核对 Actions 成功状态、线上索引和对应原始输出哈希；不能只以本地检查替代部署证据。

### 本批实测环境

Chromium 152.0.7977.83 / Windows，DPR 1，桌面 1200×800、手机 390×844，页面加载约 3 秒后截图。减少动态使用独立的浏览器启动参数与上下文，并核对 iframe 媒体查询。检查结果与局限保存在各作品 runtimeChecks 中，不是画面质量评分。Codex 作品使用本地任务环境，模型可自行调用工具；DeepSeek 作品为用户确认的首次外部投稿，这两种执行环境并不完全相同。

原始 source.html.txt 和派生 preview.html 使用 Git -text 属性，避免 Windows / Linux 换行转换改变哈希。生成日期未知时允许 null，不用文件修改时间冒充生成时间。

### 复现浏览器证据

先启动本地服务器，再为指定作品生成捕获脚本。使用已验证的 Playwright CLI 版本，普通与减少动态测试使用独立会话，避免测试进程互相干扰。

```sh
npm run prepare:capture -- <run-id>
npx --yes --package @playwright/cli@0.1.19 playwright-cli -s=pelican-capture open http://127.0.0.1:4173/
npx --yes --package @playwright/cli@0.1.19 playwright-cli -s=pelican-capture run-code --filename output/capture.js > output/capture.log
node scripts/attach-evidence.mjs output/capture.log
npx --yes --package @playwright/cli@0.1.19 playwright-cli -s=pelican-reduced open --config output/reduced-browser.json http://127.0.0.1:4173/
npx --yes --package @playwright/cli@0.1.19 playwright-cli -s=pelican-reduced run-code --filename output/reduced-check.js > output/reduced-check.log
node scripts/attach-evidence.mjs output/reduced-check.log
npm run check
```

截图、实测记录可更新，原始输出不可修改。检查器规则更新后运行 `node scripts/recheck.mjs` 重建派生报告与包装，并重新验收受影响行为。
