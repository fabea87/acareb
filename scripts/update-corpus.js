#!/usr/bin/env node
/**
 * AcadRebuttal Corpus Update Orchestrator (Node.js)
 * Executes the Python parsing pipeline and triggers Vite static build.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('='.repeat(60));
console.log('  AcadRebuttal · 全流程自动化语料更新与静态构建流水线');
console.log('='.repeat(60));
console.log('\n[1/2] 正在调用本地解析器扫描论文目录并更新语料库...\n');

// Use relative path to avoid Windows space in path escaping issues
const pyProc = spawn('python', ['scripts/update_corpus.py'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true
});

pyProc.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ 语料提取失败 (退出码: ${code})`);
    process.exit(code);
  }

  console.log('\n[2/2] 正在执行 Vite 纯静态构建 (npm run build)...\n');
  const buildProc = spawn('npm', ['run', 'build'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
  });

  buildProc.on('close', (buildCode) => {
    if (buildCode === 0) {
      console.log('\n' + '='.repeat(60));
      console.log('  🎉 语料库更新与静态网站编译全部完成！');
      console.log('  静态产物已就绪: acad-rebuttal-web/dist/');
      console.log('  可直接推送到 GitHub Pages 或部署上线！');
      console.log('='.repeat(60) + '\n');
    } else {
      console.error(`\n❌ 静态构建失败 (退出码: ${buildCode})`);
      process.exit(buildCode);
    }
  });
});
