# 通过 PR 提交作品

投稿只需 GitHub Fork、Node.js 22+ 和 Git，不需要服务器、Token 或额外自动化服务。一个 PR 提交一个作品最容易审阅；同一批多个独立运行也可以一起提交。

## 1. 生成并保留原始输出

原样复制站内「固定提示词 v1」或 `site/data/prompt.v1.json` 的 `text` 字段。JSON 文件本身不是提示词。保留首次输出，不追加提示、不修复 HTML、不删除代码围栏。输出不满足要求也可登记，静态检查失败时停用预览。

将原始输出保存为 UTF-8 `result.txt`。已经编辑过或不是首次输出的作品不属于当前同条件批次，请先开 Issue 讨论新的实验协议。不要把声明改成 true 来绕过检查。

## 2. Fork 并填写元数据

在自己的 Fork 中建立分支，再运行：

```sh
npm ci --ignore-scripts
npm run submission:init -- model-effort-20260912-run01
```

编辑生成的 `output/model-effort-20260912-run01.meta.json`：

| 字段 | 规范 |
| --- | --- |
| id | 小写字母、数字、连字符，最多 80 字符；建议 模型-强度-日期-runNN，不覆盖旧 id |
| title / description | 作品标题与简短描述 |
| model / version | 实际模型名称和精确版本；未提供精确版本则明确写“未记录” |
| generatedAt | 实际生成日期 YYYY-MM-DD；未知填 null，不用上传日期代替 |
| promptVersion / input | 初始化自动填入，不修改 |
| parameters | 推理强度、工具使用、温度、seed、耗时等；未知写“未记录” |
| provenance.submitter | 投稿者 GitHub 用户名 |
| provenance.executionEnvironment | 实际生成平台、工具及上下文环境 |
| provenance.firstOutput / unmodified / promptUnchanged | 首次输出、未修改、提示词原样使用的真实声明，均须为 true |
| environment | 无截图可为 null；有截图须记录下述环境 |
| review | 新投稿保持 null；后续独立评审另开 PR |

首次输出声明是投稿者陈述；Action 能检查字段，不能证明模型身份或生成历史。请在 PR 说明中补充可公开的生成记录，不上传私密聊天或凭据。

## 3. 一条命令登记

```sh
npm run import -- --source ./result.txt --meta ./output/model-effort-20260912-run01.meta.json
npm run check
npm run dev
```

导入器保存原始字节，自动计算 SHA-256，生成元数据、索引、静态检查与沙盒包装。不要手改派生文件。输出上限 1 MiB。

截图可暂缺，页面显示待补充。已有实测截图时，在 import 命令后添加 `--desktop ./desktop.png --mobile ./mobile.png`。PNG 或 WebP，每张最多 10 MiB；桌面 1200×800、手机 390×844、DPR 1。必须记录 `environment.browser` 完整版本、`captureAt` 捕获时机、`motion` 动态偏好及播放状态、`dpr: 1`。禁止用生成插画冒充截图。后补截图与实测记录参考 README 的复现步骤。

## 4. 提交 PR

只提交这两处自动生成的内容，`output/` 中的工作文件不要提交：

```text
site/submissions/<id>/
  source.html.txt      # 不可变的原始输出
  meta.json           # 导入器生成
  preview.html        # 仅静态检查通过时存在
  desktop.png         # 可选，也支持 .webp
  mobile.png          # 可选，也支持 .webp
site/data/submissions.json
```

```sh
git remote add upstream https://github.com/Qrzzzz/pelican-bike-benchmark.git
git fetch upstream main
npm run check:pr -- upstream/main
git add site/submissions/model-effort-20260912-run01 site/data/submissions.json
git commit -m "submission: add model effort run01"
git push origin HEAD
```

如果 upstream 已存在，跳过添加 remote。在 GitHub 打开 PR，目标为本仓库 main，标题建议 `submission: 模型 / 强度 / run01`，填写自动提供的模板和公开展示授权声明。并发投稿造成索引冲突时，保留自己的原始输入与元数据，在最新 main 上重新运行导入，避免手拼索引。

## 5. Action 与合并

- `Validate site / check`：站点测试、固定输入、元数据一致性、SHA-256、静态报告与沙盒包装、截图检查。
- `Submission contract / submission-contract`：对照 PR 基准，禁止覆盖或删除已有原始输出；新投稿不得混入站点代码或其他作品修改，必须填写来源声明。通过后继续执行完整站点检查。报告在运行页的 `submission-report` artifact 中，可保留 14 天；JSON 的 passed 仅代表投稿规范检查，完整结果以 job 状态为准。
- 静态检查失败的原始作品仍允许收录；失败原因公开、运行预览停用。没有截图或评分不冒充已有证据。Action 不执行投稿中的 JavaScript，也不自动生成浏览器截图或审美评分。
- 维护者审阅原文、元数据和公开权限后合并。现有 Pages Action 在 main 更新后校验并发布。

PR Action 使用 GitHub 托管 runner、只读仓库权限，不需要 secrets，不使用 `pull_request_target` 执行投稿；不自动合并、不向 PR 分支回写。外部贡献者首次运行可能需要维护者在 GitHub 批准工作流，这是 GitHub 的执行权限，与作品审核不同。

仓库管理员可在 main 的 branch rules 中将上述两个 job 设为 required checks，并限制直接推送。工作流文件本身不会自动开启分支保护；本次未修改仓库的分支规则。包含工作流或校验器修改的代码 PR 必须由维护者额外审阅，CI 通过不等于这些代码可信。

## 维护已有作品

截图、来源说明和评审可以独立开 PR 更新，并同步索引；原始输出始终不可改。修订后的生成结果使用新 id 和适用的新协议。撤稿由维护者确认后单独处理，不能混入普通投稿 PR。站点当前只有正式投稿，不再生成或收录三个手工示例。
