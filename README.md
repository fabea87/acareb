# AcadRebuttal · 纯静态客户端学术决策系统 (Cloudflare Worker Edition)

> **脱离 Python 后端，纯前端 0 毫秒极速运行，一键托管至 Cloudflare Worker 全球边缘 CDN。**

---

## 🌟 架构亮点

1. **零服务端依赖 (100% Client-Side JAMstack)**：
   - 彻底摆脱传统 Python / FastAPI / 数据库服务器依赖，无需购买云主机。
   - 所有数据（181 条发表实战对局、知识图谱拓扑、防线扫雷矩阵）已静态编译在前端包中。
2. **纯 JS 混合检索引擎 (Client-Side Hybrid IR Engine)**：
   - **Okapi BM25 算法**：纯 JS 实现 $k_1=1.2, b=0.75$ 标准词法检索，精准秒级命中 `TEM-4`, `Cronbach`, `TEQSA`, `Rubrics`, `ANOVA` 等学术专有名词；
   - **向量空间语义检索**：纯 JS TF-IDF 概念余弦相似度计算，计算耗时仅 **0.3 毫秒**；
   - 支持动态无缝切换 `Hybrid`、`Semantic`、`Lexical` 三大模式。
3. **Cloudflare Worker 边缘极速托管**：
   - 搭载 `wrangler.toml` 与原生静态资产绑定（Static Assets Binding），支持全球 Anycast 边缘加速、SPA 路由 Fallback 与高效不可变缓存。
4. **4-Move 语篇动作组装器 (Rebuttal Studio)**：
   - 纯前端内存中诊断审稿人隐性学术关切，自动组装符合国际应用语言学顶刊规范的四步修辞草稿。
5. **投稿前排查扫雷矩阵 (Pre-submission Scanner)**：
   - 覆盖 6 大主流实证与理论范式，实时计算正文防御完备度，一键生成并下载 Markdown 施工备忘录。
6. **Anthropic 官方标志性温润暗夜美学**：
   - 85% 居中优雅宽幅，温润黑曜石底色（`#141311`）与经典赤陶珊瑚强调色（`#DE7E5D`）。

---

## 🚀 Cloudflare Worker 一键部署指南

在 `acad-rebuttal-web` 目录下：

### 第一步：登录 Cloudflare（仅需执行一次）
```bash
npm run cf:login
```
*(系统会自动打开浏览器弹窗，点击授权同意即可在本地完成绑定)*

### 第二步：一键扫描更新并发布上线
```bash
npm run deploy:cf
```
脚本将全自动执行：
1. 自动扫描上级所有论文目录并重新提取最新语料；
2. 自动触发 Vite 编译生成最新静态包；
3. 自动通过 Wrangler 发布至 Cloudflare Worker 全球边缘网络，并在终端输出访问域名（如 `https://acareb.<您的账号>.workers.dev`）！

---

## 🛠️ 本地常用开发命令

```bash
# 启动本地热重载开发服务器
npm run dev

# 本地模拟 Cloudflare Worker 边缘环境运行
npm run cf:dev

# 单独更新语料库
npm run update-corpus
```
