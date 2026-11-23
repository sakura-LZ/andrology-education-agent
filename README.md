# 男科个人知识库与教育智能体

基于 Node.js、HTML 和 Markdown 的个人知识库与辅助学习工具。支持男科基础知识、指南与共识、基本手术、基础实验操作、技术与结果判读，以及文献检索与科研学习。

## 功能与内容

- 37篇资料：28篇正文与专题，9份默认收起的历史证据档案；历史档案不用于问答检索。
- 分类浏览、全文搜索、完整正文、章节目录、版本与审核状态。
- 基于本地资料检索的模型问答，以及本地资料、DOI、PMID等原文入口。
- Europe PMC公开文献检索，保留摘要、年份、PMID、DOI和查询式。
- 自测与本地判分、错题本、文献四步法精读、病例练习和教师端统计。
- 上下文默认最多80条消息或64000字符；同标签页刷新恢复对话，点“新对话”清空。

来源链接、书目核对、全文读取和专业审核是不同状态。部分内容仍待专业复核；以各篇标记为准，不能直接作为临床决策或未经验证的实验SOP。

## 本地启动

安装Node.js 22+和Git，然后：

```sh
git clone https://github.com/sakura-LZ/andrology-education-agent.git
cd andrology-education-agent
```

将`.env.example`复制为`.env`（Windows PowerShell用`Copy-Item .env.example .env`，macOS/Linux用`cp .env.example .env`），填写自己的模型API密钥、兼容接口地址、模型名、普通访问口令和独立教师口令。

```sh
npm start
```

打开 http://127.0.0.1:3360 并输入自己设置的口令。核心服务无第三方运行依赖；本地资料浏览不依赖模型账户余额，问答、出题、精读和病例生成需要可用模型服务。

## 配置

| 配置项 | 用途 |
|---|---|
| DEEPSEEK_BASE_URL | 兼容OpenAI的接口根地址，按服务商要求填写 |
| DEEPSEEK_MODEL | 服务商实际支持的模型名称 |
| DEEPSEEK_API_KEY | 模型服务密钥，配置字段沿用历史命名 |
| ACCESS_TOKEN / TEACHER_TOKEN | 两个独立访问口令，部署时必须自行设置 |
| HOST / PORT | 默认127.0.0.1:3360 |
| CHAT_HISTORY_MESSAGES / CHAT_HISTORY_CHARS | 历史消息预算，默认80条/64000字符，最多120条/256000字符 |
| TRUST_PROXY | 经可信Nginx反向代理时设1，本机直连设0 |

历史预算是应用设置，不代表模型最大上下文窗口。前端缓存最多120条/256000字符到当前标签页sessionStorage，关闭标签页后不保证保留，不跨设备同步。学习进度与错题本保存在当前浏览器；服务器统计写入本机私有学习日志。

## 项目结构

- `server/`：服务、知识检索、摘要处理与历史上下文。
- `web/index.html`：网页学习台。
- `kb/`：当前知识正文。
- `data/`：统一目录、官方来源、量表与参考值。
- `文献/`：必读文献和指南清单。
- `output/男科教育智能体/`：统一目录引用的历史专题与证据档案。
- `tests/`：行为测试及可选浏览器验收。
- `deploy/`：PM2、Nginx与打包脚本。

## 验证

```sh
npm test
node --check server/server.mjs
```

可选浏览器回归：`npm run test:browser`。需本机安装Playwright及Edge，并通过`CODEX_TEST_NODE_MODULES`指定包含Playwright的模块目录。

## 服务器部署与分享

本项目包含后端，公开GitHub仓库用于保存与分发源码，不能直接用GitHub Pages运行全部功能。服务器需Node.js、PM2和Nginx；配置HTTPS及访问口令后，可向使用者分享网站地址。详见 [部署与他人使用](docs/PUBLIC-DEPLOYMENT.md)。`127.0.0.1`只能在运行服务的电脑访问。

仓库不包含现用密钥、现用口令、个人学习记录、运行日志、本机备份或原始文献PDF。请自行配置环境，并尊重引用资料的使用条件。
