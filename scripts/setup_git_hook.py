#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AcadRebuttal - Git Pre-Push Hook Auto-Installer
一键安装 Git pre-push 自动化钩子：确保每次 git push 之前，自动重新扫描抽取语料库并重新编译纯静态产物！
"""

import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_DIR = os.path.dirname(PROJECT_DIR)

def find_git_dir():
    # Check if project dir or workspace dir is a git repo
    for d in [PROJECT_DIR, WORKSPACE_DIR]:
        git_dir = os.path.join(d, '.git')
        if os.path.exists(git_dir):
            return d, git_dir
    return None, None

def install_hook():
    repo_root, git_dir = find_git_dir()
    
    if not git_dir:
        print("[提示] 检测到当前目录尚未初始化 Git 仓库。")
        choice = input("是否在此处初始化 Git 仓库以启用自动化钩子？(y/n): ").strip().lower()
        if choice in ['y', 'yes']:
            os.system(f'git init "{PROJECT_DIR}"')
            repo_root, git_dir = PROJECT_DIR, os.path.join(PROJECT_DIR, '.git')
            print(f"[OK] 已在 {PROJECT_DIR} 初始化 Git 仓库。")
        else:
            print("[取消] 请在执行 git init 之后重新运行此脚本。")
            return

    hooks_dir = os.path.join(git_dir, 'hooks')
    os.makedirs(hooks_dir, exist_ok=True)
    pre_push_path = os.path.join(hooks_dir, 'pre-push')

    # Path to update_corpus.py relative to repo root
    update_script = os.path.relpath(os.path.join(SCRIPT_DIR, 'update_corpus.py'), repo_root).replace('\\', '/')

    hook_content = f"""#!/bin/sh
# AcadRebuttal Auto-Update Pre-Push Hook
echo ""
echo "============================================================"
echo " [Git Pre-Push] 拦截到 push 操作，正在自动更新语料库与构建..."
echo "============================================================"

# Run python extraction pipeline
python "{update_script}"

if [ $? -ne 0 ]; then
    echo "❌ 语料库生成失败，已中止 push！"
    exit 1
fi

# Run static site build
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 静态站点构建失败，已中止 push！"
    exit 1
fi

echo "✓ 语料库与静态站点已自动更新完毕，继续执行推送..."
echo "============================================================"
echo ""
exit 0
"""

    with open(pre_push_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(hook_content)

    # Make executable on Unix/Git-Bash
    try:
        os.chmod(pre_push_path, 0o755)
    except Exception:
        pass

    print(f"\n[OK] 成功安装 Git pre-push 钩子至: {pre_push_path}")
    print("------------------------------------------------------------")
    print("从现在开始，每当您在该仓库执行 `git push`（无论在命令行还是 VS Code），")
    print("Git 都会自动先执行语料扫描、重新抽取、并触发前端编译，然后再推向 GitHub！")
    print("------------------------------------------------------------\n")

if __name__ == '__main__':
    install_hook()
