#!/usr/bin/env node
/**
 * AcadRebuttal - Cloudflare Worker 一键自动更新与边缘发布脚本
 * 流程: 扫描语料库 -> 构建静态站 -> 部署至 Cloudflare Worker 边缘网络
 */

import { execSync, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('='.repeat(60));
console.log('  AcadRebuttal · Cloudflare Worker 自动化部署工作流');
console.log('='.repeat(60));

// Step 1: Check Cloudflare Authentication status
console.log('\n[1/3] 检查 Cloudflare 账户登录状态 (wrangler whoami)...');
try {
  const whoami = execSync('npx wrangler whoami', { cwd: projectRoot, encoding: 'utf-8' });
  console.log(whoami.trim());
} catch (err) {
  console.log('\n⚠️ 未检测到已登录的 Cloudflare 账户。');
  console.log('👉 请先在终端执行: npm run cf:login (或 npx wrangler login) 登录您的 Cloudflare 账号。');
  console.log('登录完成后，再次执行 npm run deploy:cf 即可自动部署！\n');
  process.exit(1);
}

// Step 2: Auto-update corpus & rebuild static assets
console.log('\n[2/3] 扫描论文工作区，更新语料库并编译静态站点...');
const pyRes = spawnSync('python', ['scripts/update_corpus.py', '--build'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

if (pyRes.status !== 0) {
  console.error('\n❌ 语料库更新或前端构建失败，中止部署！');
  process.exit(pyRes.status);
}

// Step 3: Deploy to Cloudflare Worker
console.log('\n[3/3] 正在发布至 Cloudflare Worker 全球边缘网络 (wrangler deploy)...\n');
const deployRes = spawnSync('npx', ['wrangler', 'deploy'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

if (deployRes.status === 0) {
  console.log('\n' + '='.repeat(60));
  console.log('  🎉 成功发布到 Cloudflare Worker！');
  console.log('  您的学术决策系统已在全球边缘 CDN 网络上线！');
  console.log('='.repeat(60) + '\n');
} else {
  console.error('\n❌ Cloudflare Worker 发布出现错误。');
  process.exit(deployRes.status);
}
