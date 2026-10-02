#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AcadRebuttal CLI - 命令行极速检索工具 (直接基于编译好的前端数据湖 corpus.json)
"""

import sys
import os
import io
import json
import argparse
import re

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS_JSON_PATH = os.path.join(PROJECT_DIR, "src", "data", "corpus.json")

class Term:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    UNDERLINE = "\033[4m"
    
    TERRACOTTA = "\033[38;5;209m"
    SAGE = "\033[38;5;108m"
    GOLD = "\033[38;5;221m"
    ROSE = "\033[38;5;203m"
    PURPLE = "\033[38;5;139m"
    SLATE = "\033[38;5;67m"
    GRAY = "\033[38;5;244m"
    WHITE = "\033[38;5;253m"

def print_banner():
    banner = rf"""{Term.TERRACOTTA}{Term.BOLD}
   ___                  __  ___      __          __  __          __ 
  / _ | ____ ___ _____ / / / _ \___ / /  __ __  / /_/ /____ ____/ / 
 / __ |/ __/ _ `/ _  // _\/ , _/ -_) _ \/ // / / __/ __/ _ `/ -_) _ \
/_/ |_|\__/\_,_/\_,_//_//_/_/|_|\__/_.__/\_,_/  \__/\__/\_,_/\__/_.__/ 
{Term.RESET}{Term.GRAY}>> 顶刊论文审稿意见与返修决策 CLI 工具 (Client Data Lake Edition){Term.RESET}
"""
    print(banner)

def load_data():
    if not os.path.exists(CORPUS_JSON_PATH):
        print(f"Error: Corpus data file not found at {CORPUS_JSON_PATH}")
        sys.exit(1)
    with open(CORPUS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def render_cli_card(item, index, total, highlight_kw=None):
    width = 82
    j_title = f" [{item['journal']}] · {item['revision_round']} "
    
    line_left = f"+--{Term.GOLD}{Term.BOLD}{j_title}{Term.RESET}"
    line_right = f"{Term.TERRACOTTA}{Term.BOLD} [{item['category']}] {Term.RESET}--+"
    pad = width - len(strip_ansi(line_left)) - len(strip_ansi(line_right))
    if pad < 0: pad = 2
    print(line_left + ("-" * pad) + line_right)
    
    print(f"| {Term.SLATE}课题:{Term.RESET} {item['paper_topic']}")
    print(f"| {Term.PURPLE}议题:{Term.RESET} {item['category']}  |  {Term.TERRACOTTA}招式:{Term.RESET} {item['strategy']}  |  {Term.GRAY}审稿人:{Term.RESET} {item['reviewer_role']}")
    print("+" + ("-" * (width - 2)) + "+")
    
    critique_clean = item['comment_text'].strip()
    if highlight_kw:
        for kw in highlight_kw:
            critique_clean = re.sub(f"(?i)({re.escape(kw)})", f"{Term.ROSE}{Term.BOLD}\\1{Term.RESET}", critique_clean)
    
    print(f"| {Term.ROSE}{Term.BOLD}[CRITIQUE 审稿人批评]:{Term.RESET}")
    for line in wrap_text(critique_clean, width - 6):
        print(f"|   {line}")
        
    print("|")
    resp_clean = item['response_text'].strip()
    if highlight_kw:
        for kw in highlight_kw:
            resp_clean = re.sub(f"(?i)({re.escape(kw)})", f"{Term.SAGE}{Term.BOLD}\\1{Term.RESET}", resp_clean)
            
    print(f"| {Term.SAGE}{Term.BOLD}[REBUTTAL 作者答辩与修改]:{Term.RESET}")
    for line in wrap_text(resp_clean[:650] + ("..." if len(resp_clean) > 650 else ""), width - 6):
        print(f"|   {line}")
        
    print("|")
    print(f"| {Term.GOLD}{Term.BOLD}[GOLDEN MOVE 修辞胜招]:{Term.RESET}")
    print(f"|   {Term.GOLD}\"{item['golden_move']}\"{Term.RESET}")
    
    print("+---" + f"[{index}/{total}]" + ("-" * (width - 9 - len(str(index)) - len(str(total)))) + "+\n")

def strip_ansi(text):
    return re.sub(r'\033\[[0-9;]*m', '', text)

def wrap_text(text, width):
    paragraphs = text.split("\n")
    lines = []
    for p in paragraphs:
        if not p.strip():
            continue
        words = p.split(" ")
        curr = ""
        for w in words:
            if len(strip_ansi(curr)) + len(strip_ansi(w)) + 1 > width:
                lines.append(curr)
                curr = w
            else:
                curr = f"{curr} {w}" if curr else w
        if curr:
            lines.append(curr)
    return lines

def main():
    parser = argparse.ArgumentParser(description="AcadRebuttal CLI - 顶刊论文审稿意见命令行极速检索")
    parser.add_argument("query", nargs="?", default="", help="审稿意见原句或关键词")
    parser.add_argument("-j", "--journal", default=None, help="期刊筛选")
    parser.add_argument("-c", "--category", default=None, help="议题筛选")
    parser.add_argument("-k", "--top", type=int, default=5, help="返回数量")

    args = parser.parse_args()
    data = load_data()
    records = data.get("records", [])

    print_banner()

    query_tokens = [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', args.query)]
    
    filtered = []
    for r in records:
        if args.journal and args.journal.lower() not in r['journal'].lower():
            continue
        if args.category and args.category.lower() not in r['category'].lower():
            continue
            
        full_text = (r['comment_text'] + " " + r['response_text'] + " " + r['golden_move']).lower()
        
        score = 0
        if query_tokens:
            for qt in query_tokens:
                if qt in full_text:
                    score += 1
            if score > 0:
                filtered.append((score, r))
        else:
            filtered.append((1, r))

    filtered.sort(key=lambda x: x[0], reverse=True)
    results = [r for _, r in filtered[:args.top]]

    print(f"{Term.BOLD}检索词: {Term.TERRACOTTA}\"{args.query}\"{Term.RESET} | 召回结果: {len(results)} 条\n")

    for idx, r in enumerate(results, 1):
        render_cli_card(r, idx, len(results), highlight_kw=query_tokens)

if __name__ == '__main__':
    main()
