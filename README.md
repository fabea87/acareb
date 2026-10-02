# AcadRebuttal · 纯静态客户端学术决策系统 (Vite + Pure JS Edition)

> **脱离 Python 后端，纯前端 0 毫秒极速运行，一键免费托管至全球静态 CDN (GitHub Pages / Vercel / Cloudflare Pages)。**

---

## 🌟 架构亮点

1. **零服务端依赖 (100% Client-Side JAMstack)**：
   - 彻底摆脱 Python / FastAPI / 数据库服务器依赖，无需购买云主机。
   - 所有数据（181 条发表实战对局、知识图谱拓扑、防线扫雷矩阵）已静态编译在前端包中。
2. **纯 JS 混合检索引擎 (Client-Side Hybrid IR Engine)**：
   - **Okapi BM25 算法**：纯 JS 实现 $k_1=1.2, b=0.75$ 标准词法检索，精准秒级命中 `TEM-4`, `Cronbach`, `TEQSA`, `Rubrics`, `ANOVA` 等学术专有名词；
   - **向量空间语义检索**：纯 JS TF-IDF 概念余弦相似度计算，计算耗时仅 **0.3 毫秒**；
   - 支持动态无缝切换 `Hybrid`、`Semantic`、`Lexical` 三大模式。
3. **4-Move 语篇动作组装器 (Rebuttal Studio)**：
   - 纯前端内存中诊断审稿人隐性学术关切，自动组装符合国际应用语言学顶刊规范的四步修辞草稿。
4. **投稿前排查扫雷矩阵 (Pre-submission Scanner)**：
   - 覆盖 6 大主流实证与理论范式，实时计算正文防御完备度，一键生成并下载 Markdown 施工备忘录。
5. **Anthropic 官方标志性温润暗夜美学**：
   - 85% 居中优雅宽幅，温润黑曜石底色（`#141311`）与经典赤陶珊瑚强调色（`#DE7E5D`）。

---

## 🛠️ 本地开发与构建

进入本项目目录：

```bash
cd acad-rebuttal-web

# 1. 安装依赖 (仅需 Vite)
npm install

# 2. 启动本地开发热重载服务器
npm run dev

# 3. 编译打包生成纯静态生产版本 (输出在 dist/ 目录)
npm run build

# 4. 预览静态打包版本
npm run preview
```

---

## 🚀 一键免费发布到互联网

因为本项目打包后是**纯静态网页**（仅包含 `dist/index.html` 与静态 `assets`），您可以任选以下平台**免费且永久上线**：

### 选项 A：GitHub Pages 免费托管 (推荐)
1. 在 GitHub 上新建一个仓库（如 `acad-rebuttal`）；
2. 将代码推送到 GitHub；
3. 在 GitHub 仓库设置中的 **Pages** 选项，选择部署分支或通过默认的 GitHub Actions（`Deploy static content to Pages`）；
4. 上线后即可在全球任何设备通过 `https://<用户名>.github.io/acad-rebuttal/` 永久免翻墙高速访问！

### 选项 B：Vercel / Cloudflare Pages 一键托管
1. 将打包好的 `dist/` 文件夹直接拖拽到 [Vercel](https://vercel.com) 或 [Cloudflare Pages](https://pages.cloudflare.com/) 网页中；
2. 几秒内即可自动获得一个全球 CDN 加速的专属网址（如 `https://acad-rebuttal.pages.dev`）。
