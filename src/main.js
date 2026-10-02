// AcadRebuttal Client-Side Application Entry
import './style.css';
import corpusBundle from './data/corpus.json';
import { ClientSearchEngine } from './engine/searchEngine.js';
import { ClientRebuttalStudio } from './engine/rebuttalStudio.js';

// Initialize Client-Side Engines
const searchEngine = new ClientSearchEngine(corpusBundle);
const rebuttalStudio = new ClientRebuttalStudio(searchEngine);

// State
let currentMode = "hybrid";
let currentResults = [];
let bookmarkedMap = new Map();

let selectedParadigmIds = new Set();
let checkedVectorIds = new Set();

let d3Simulation = null;
let d3Zoom = null;
let isSimRunning = true;
let isGraphFullscreen = false;

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  loadBookmarksFromStorage();
  initFilters();
  initKnowledgeGraph();
  executeSearch();
  initPreSubmissionScanner();
  loadStrategyVault();
  loadAnalytics();
});

// View Switching
export function switchView(viewName) {
  const views = ['graph', 'search', 'studio', 'scanner', 'vault', 'analytics'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const tabBtn = document.getElementById(`tab-${v}`);
    if (v === viewName) {
      el.classList.remove('hidden');
      tabBtn.classList.add('active');
    } else {
      el.classList.add('hidden');
      tabBtn.classList.remove('active');
    }
  });

  if (viewName === 'graph' && d3Simulation) {
    d3Simulation.alpha(0.3).restart();
  }
  if (window.lucide) lucide.createIcons();
}

export function setRetrievalMode(mode) {
  currentMode = mode;
  ['hybrid', 'semantic', 'lexical'].forEach(m => {
    const el = document.getElementById(`mode-${m}`);
    if (m === mode) el.classList.add('active');
    else el.classList.remove('active');
  });
  executeSearch();
}

export function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  toastText.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

export function copyText(text, label = "已复制到剪贴板") {
  navigator.clipboard.writeText(text).then(() => {
    showToast(label);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(label);
  });
}

export function toggleCliModal() {
  document.getElementById('cli-modal').classList.toggle('hidden');
}

export function toggleGraphFullscreen() {
  const container = document.getElementById('graph-container');
  const btn = document.getElementById('btn-graph-fullscreen');
  isGraphFullscreen = !isGraphFullscreen;
  
  if (isGraphFullscreen) {
    container.classList.add('fullscreen-canvas');
    btn.innerHTML = `<i data-lucide="minimize" class="w-3.5 h-3.5"></i><span>退出全屏</span>`;
  } else {
    container.classList.remove('fullscreen-canvas');
    btn.innerHTML = `<i data-lucide="maximize" class="w-3.5 h-3.5"></i><span>全屏</span>`;
  }
  
  if (window.lucide) lucide.createIcons();
  setTimeout(resetGraphZoom, 200);
}

function initFilters() {
  const meta = corpusBundle.metadata || {};
  populateSelect('filter-journal', meta.journals || []);
  populateSelect('filter-category', meta.categories || []);
  populateSelect('filter-strategy', meta.strategies || []);
  populateSelect('filter-round', meta.rounds || []);
}

function populateSelect(elemId, items) {
  const sel = document.getElementById(elemId);
  if (!sel) return;
  const firstOpt = sel.firstElementChild;
  sel.innerHTML = '';
  sel.appendChild(firstOpt);
  items.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it;
    opt.innerText = it;
    sel.appendChild(opt);
  });
}

// -------------------------------------------------------------
// VIEW 1: D3.JS INTERACTIVE KNOWLEDGE GRAPH
// -------------------------------------------------------------
function initKnowledgeGraph() {
  const data = corpusBundle.knowledge_graph;
  if (!data) return;

  const svg = d3.select("#graph-svg");
  svg.selectAll("*").remove();

  const width = svg.node().clientWidth || 900;
  const height = svg.node().clientHeight || 620;

  const g = svg.append("g");
  d3Zoom = d3.zoom()
    .scaleExtent([0.2, 3.5])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
  svg.call(d3Zoom);
  svg.call(d3Zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));

  const colorMap = {
    journal: "#D4A359",   // Amber clay
    category: "#68929E",  // Slate teal
    strategy: "#DE7E5D",  // Terracotta
    keyword: "#A88D9B"    // Dusty rose slate
  };

  d3Simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(d => {
      if (d.type === 'journal_category') return 120;
      if (d.type === 'category_strategy') return 90;
      return 70;
    }).strength(0.35))
    .force("charge", d3.forceManyBody().strength(-240))
    .force("collide", d3.forceCollide().radius(d => d.size + 14).iterations(2))
    .force("center", d3.forceCenter(0, 0).strength(0.05));

  const link = g.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(data.links)
    .enter().append("line")
    .attr("class", "graph-link")
    .attr("stroke", d => {
      if (d.type === 'journal_category') return "#D4A359";
      if (d.type === 'category_strategy') return "#DE7E5D";
      return "#6B665E";
    })
    .attr("stroke-width", d => Math.min(4, Math.max(1.2, Math.sqrt(d.value || 1) * 1.3)));

  const node = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(data.nodes)
    .enter().append("g")
    .attr("class", "graph-node")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  node.append("circle")
    .attr("r", d => d.size)
    .attr("fill", d => colorMap[d.type] || "#68929E")
    .attr("fill-opacity", 0.9)
    .attr("stroke", "#1C1A17")
    .attr("stroke-width", 2);

  node.append("text")
    .attr("dx", d => d.size + 4)
    .attr("dy", ".35em")
    .text(d => d.label)
    .attr("font-size", d => d.type === 'journal' ? "12px" : "11px")
    .attr("font-weight", d => d.type === 'journal' ? "600" : "400")
    .attr("fill", "#F5F3EF")
    .style("pointer-events", "none");

  node.on("mouseover", (event, d) => {
    const connectedNodeIds = new Set();
    connectedNodeIds.add(d.id);

    link.each(function(l) {
      if (l.source.id === d.id || l.target.id === d.id) {
        connectedNodeIds.add(l.source.id);
        connectedNodeIds.add(l.target.id);
        d3.select(this).classed("highlighted", true).attr("stroke-opacity", 0.95).attr("stroke-width", 3);
      } else {
        d3.select(this).attr("stroke-opacity", 0.08);
      }
    });

    node.each(function(n) {
      if (connectedNodeIds.has(n.id)) {
        d3.select(this).attr("opacity", 1);
      } else {
        d3.select(this).attr("opacity", 0.2);
      }
    });
  }).on("mouseout", () => {
    link.classed("highlighted", false).attr("stroke-opacity", 0.35).attr("stroke-width", d => Math.min(4, Math.max(1.2, Math.sqrt(d.value || 1) * 1.3)));
    node.attr("opacity", 1);
  });

  node.on("click", (event, d) => {
    openGraphDrawer(d);
  });

  d3Simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("transform", d => `translate(${d.x},${d.y})`);
  });

  function dragstarted(event, d) {
    if (!event.active && isSimRunning) d3Simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active && isSimRunning) d3Simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

export function resetGraphZoom() {
  const svg = d3.select("#graph-svg");
  const width = svg.node().clientWidth || 900;
  const height = svg.node().clientHeight || 620;
  svg.transition().duration(500).call(d3Zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));
}

export function toggleSimulation() {
  const btn = document.getElementById("btn-toggle-sim");
  if (isSimRunning) {
    d3Simulation.stop();
    isSimRunning = false;
    btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i><span>激活引力</span>`;
  } else {
    d3Simulation.alpha(0.3).restart();
    isSimRunning = true;
    btn.innerHTML = `<i data-lucide="pause" class="w-3.5 h-3.5"></i><span>固定引力</span>`;
  }
  if (window.lucide) lucide.createIcons();
}

function openGraphDrawer(nodeData) {
  const drawer = document.getElementById("graph-drawer");
  const title = document.getElementById("drawer-title");
  const badge = document.getElementById("drawer-badge");
  const stats = document.getElementById("drawer-stats");
  const filterBtn = document.getElementById("drawer-filter-btn");
  const listContainer = document.getElementById("drawer-cases-list");

  title.innerText = nodeData.label;
  badge.innerText = nodeData.type.toUpperCase();

  stats.innerHTML = `
    <div class="flex justify-between items-center">
      <span class="text-[var(--text-secondary)]">节点类型:</span>
      <span class="font-mono text-[var(--text-primary)]">${nodeData.type}</span>
    </div>
    <div class="flex justify-between items-center">
      <span class="text-[var(--text-secondary)]">语料关联频次:</span>
      <span class="font-mono font-bold text-[#DE7E5D]">${nodeData.meta.count || nodeData.size} 次</span>
    </div>
  `;

  filterBtn.onclick = () => {
    closeGraphDrawer();
    switchView('search');
    if (nodeData.type === 'journal') document.getElementById('filter-journal').value = nodeData.meta.full_name || nodeData.label;
    else if (nodeData.type === 'category') document.getElementById('filter-category').value = nodeData.label;
    else if (nodeData.type === 'strategy') document.getElementById('filter-strategy').value = nodeData.label;
    else if (nodeData.type === 'keyword') document.getElementById('search-input').value = nodeData.label;
    executeSearch();
  };

  listContainer.innerHTML = '<div class="text-xs text-[var(--text-secondary)] p-2">正在检索关联案例...</div>';
  drawer.classList.remove("translate-x-full");

  // Client side search directly in memory
  const results = searchEngine.search({
    query: nodeData.type === 'keyword' ? nodeData.label : "",
    journal: nodeData.type === 'journal' ? (nodeData.meta.full_name || nodeData.label) : undefined,
    category: nodeData.type === 'category' ? nodeData.label : undefined,
    strategy: nodeData.type === 'strategy' ? nodeData.label : undefined,
    topK: 5,
    mode: currentMode
  });

  if (!results || results.length === 0) {
    listContainer.innerHTML = '<div class="text-xs text-[var(--text-secondary)] p-2">无直接关联案例</div>';
    return;
  }

  listContainer.innerHTML = results.map(r => `
    <div class="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col gap-1.5 shadow-sm">
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-[#DE7E5D] font-semibold">${r.journal.split('(')[0]}</span>
        <span class="text-[var(--text-muted)] font-mono">${r.revision_round}</span>
      </div>
      <p class="text-xs text-[var(--text-secondary)] line-clamp-2 italic">“${r.comment_text.replace(/\n/g, ' ')}”</p>
      <div class="p-2 rounded bg-[var(--bg-tertiary)] border-l-2 border-[#D4A359] text-[11px] text-[var(--text-secondary)]">
        <span class="font-semibold text-[#D4A359]">金句:</span> ${r.golden_move}
      </div>
      <div class="flex items-center justify-between pt-1">
        <button onclick="window.toggleBookmark('${r.id}')" class="text-[11px] text-[#DE7E5D] flex items-center gap-1">
          <i data-lucide="bookmark" class="w-3 h-3 ${isBookmarked(r.id) ? 'fill-[#DE7E5D]' : ''}"></i>
          <span>${isBookmarked(r.id) ? '已收藏' : '加备选'}</span>
        </button>
        <button onclick="window.copyText('${escapeAttr(r.response_text)}', '已复制该案例完整答辩')" class="text-[11px] text-[var(--text-secondary)] hover:text-[#DE7E5D] flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i> 复制答辩
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

export function closeGraphDrawer() {
  document.getElementById("graph-drawer").classList.add("translate-x-full");
}

// -------------------------------------------------------------
// VIEW 2: SEMANTIC SEARCH & DECISION MATRIX (CLIENT SIDE)
// -------------------------------------------------------------
export function setQueryAndSearch(q) {
  document.getElementById('search-input').value = q;
  executeSearch();
}

export function clearSearchFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-journal').value = 'ALL';
  document.getElementById('filter-category').value = 'ALL';
  document.getElementById('filter-strategy').value = 'ALL';
  document.getElementById('filter-round').value = 'ALL';
  executeSearch();
}

export function executeSearch() {
  const query = document.getElementById('search-input').value.trim();
  const journal = document.getElementById('filter-journal').value;
  const category = document.getElementById('filter-category').value;
  const strategy = document.getElementById('filter-strategy').value;
  const round = document.getElementById('filter-round').value;

  const container = document.getElementById('cards-container');
  const countText = document.getElementById('results-count-text');

  // Client-side instant execution (No network latency!)
  const startTime = performance.now();
  currentResults = searchEngine.search({
    query,
    journal,
    category,
    strategy,
    revisionRound: round,
    mode: currentMode,
    topK: 24
  });
  const elapsed = Math.round((performance.now() - startTime) * 10) / 10;

  const modeLabels = {
    hybrid: "智能混合向量",
    semantic: "LSA 深度概念语义",
    lexical: "BM25 精确词法"
  };

  countText.innerHTML = `
    共召回 <b class="text-[var(--text-primary)]">${currentResults.length}</b> 条实战对局 
    <span class="text-[#DE7E5D] font-mono">(${modeLabels[currentMode]} · ${elapsed}ms)</span>
  `;

  if (currentResults.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-12 rounded-xl text-center text-[var(--text-secondary)] text-xs">
        未检索到完全匹配的案例，请尝试精简关键词或放宽筛选条件。
      </div>
    `;
    return;
  }

  container.innerHTML = currentResults.map(r => renderDecisionCard(r, query)).join('');
  if (window.lucide) lucide.createIcons();
}

function renderDecisionCard(r, query) {
  const simPercent = Math.round((r.similarity || 1) * 100);
  const bookmarked = isBookmarked(r.id);
  const matchedBadges = (r.matched_terms || []).map(m => 
    `<span class="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--card-border)] text-[10px] text-[var(--text-secondary)] font-mono">${m}</span>`
  ).join('');

  return `
    <div id="card-${r.id}" class="glass-panel glass-panel-hover p-6 rounded-xl flex flex-col gap-4">
      
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--card-border)] flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-[#DE7E5D]"></span>
            ${r.journal}
          </span>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--card-border)]">
            ${r.revision_round}
          </span>
          <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--card-border)]">
            ${r.category}
          </span>
          <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-text)]">
            招式: ${r.strategy}
          </span>
        </div>

        <div class="flex items-center gap-3">
          ${matchedBadges ? `<div class="flex items-center gap-1">${matchedBadges}</div>` : ''}
          <div class="flex items-center gap-1.5 font-mono text-xs">
            <span class="text-[var(--text-secondary)]">匹配度:</span>
            <span class="font-bold text-[#DE7E5D]">${simPercent}%</span>
          </div>
          <button onclick="window.toggleBookmark('${r.id}')" class="p-1.5 rounded-lg btn-neutral" title="${bookmarked ? '移出备选库' : '加入备选库'}">
            <i data-lucide="bookmark" class="w-3.5 h-3.5 ${bookmarked ? 'fill-[#DE7E5D] text-[#DE7E5D]' : ''}"></i>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="critique-box p-4 rounded-lg flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-semibold text-[#E06C60]">
            <span class="flex items-center gap-1.5">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
              审稿人评语 (${r.reviewer_role || 'Reviewer'})
            </span>
            <span class="text-[10px] font-mono text-[var(--text-muted)]">CRITIQUE</span>
          </div>
          <div class="text-xs sm:text-[13px] leading-relaxed max-h-56 overflow-y-auto pr-1">
            ${highlightText(r.comment_text, query)}
          </div>
        </div>

        <div class="response-box p-4 rounded-lg flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-semibold text-[#5FA369]">
            <span class="flex items-center gap-1.5">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              作者应对策略与答辩 (Author Rebuttal)
            </span>
            <span class="text-[10px] font-mono text-[var(--text-muted)]">REBUTTAL</span>
          </div>
          <div class="text-xs sm:text-[13px] leading-relaxed max-h-56 overflow-y-auto pr-1 whitespace-pre-line">
            ${highlightText(r.response_text, query)}
          </div>
        </div>
      </div>

      <div class="golden-box p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="p-1.5 rounded bg-[var(--bg-secondary)] text-[#D4A359] mt-0.5 border border-[var(--golden-border)]">
            <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          </div>
          <div>
            <div class="text-[11px] font-semibold text-[#D4A359] uppercase tracking-wider">
              修辞胜招提取 (Golden Rhetorical Move):
            </div>
            <div class="text-xs sm:text-[13px] font-medium leading-relaxed mt-0.5">
              “${r.golden_move}”
            </div>
          </div>
        </div>

        <button onclick="window.copyText('${escapeAttr(r.golden_move)}', '已复制修辞金句')" class="self-end sm:self-center px-3 py-1.5 rounded-md btn-neutral text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap">
          <i data-lucide="copy" class="w-3 h-3"></i>
          <span>复制金句</span>
        </button>
      </div>

      <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
        <span class="text-[11px]">课题论文：${r.paper_topic}</span>
        <button onclick="window.copyText('${escapeAttr(r.response_text)}', '已复制完整作者答辩正文')" class="hover:text-[#DE7E5D] flex items-center gap-1 font-medium transition-all">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          <span>复制完整答辩正文</span>
        </button>
      </div>

    </div>
  `;
}

export function exportCurrentMarkdown() {
  const query = document.getElementById('search-input').value.trim();
  const mdContent = searchEngine.generateMarkdownDossier(
    currentResults,
    query ? `返修决策专题手册: ${query}` : "顶刊返修决策实战手册 (全部精选)"
  );

  downloadBlob(mdContent, `AcadRebuttal_Dossier_${new Date().toISOString().slice(0,10)}.md`);
  showToast("✓ 纯前端即时导出 Markdown 手册！");
}

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// -------------------------------------------------------------
// VIEW 3: REBUTTAL STUDIO (CLIENT-SIDE MOVE ASSEMBLER)
// -------------------------------------------------------------
export function setStudioPreset(type) {
  const input = document.getElementById('studio-critique-input');
  const journalSel = document.getElementById('studio-journal-select');
  const stratSel = document.getElementById('studio-strategy-select');

  if (type === 'sample_size') {
    input.value = "The sample size (N=4) appears extremely small and lacks adequate statistical power. This severely limits the generalizability and ecological credibility of your claims regarding the effectiveness of AI feedback.";
    journalSel.value = "Humanities and Social Sciences Communications (HSSC)";
    stratSel.value = "Concede & Expand";
  } else if (type === 'theoretical_framework') {
    input.value = "The construct of 'uptake' and 'feedback seeking' remains under-theorized. It is introduced without a clear operational definition, and its conceptual link with metacognitive revision is not adequately grounded in your theoretical framework.";
    journalSel.value = "International Journal of Applied Linguistics (InJAL)";
    stratSel.value = "ALL";
  } else if (type === 'literature_addition') {
    input.value = "The literature review fails to engage with several key recent studies on automated writing evaluation (please add the following 10 papers: Smith et al., 2023; Wang & Zhang, 2024; etc.). Discussion lacks grounding in these related frameworks.";
    journalSel.value = "Computer Assisted Language Learning (CALL)";
    stratSel.value = "Polite Defense & Boundary";
  } else if (type === 'prompt_transparency') {
    input.value = "The prompting template used for AI feedback should be provided as an appendix. Furthermore, the section on institutional GenAI policy is vague, simply referring to guidelines without explaining how student ethical agency was maintained.";
    journalSel.value = "System";
    stratSel.value = "Concede & Expand";
  } else if (type === 'discussion_mechanism') {
    input.value = "The Discussion section is largely descriptive and mostly restates the quantitative statistical results. It lacks critical argumentation on the cognitive and social mechanisms that explain WHY collaborative feedback outperformed individual processing.";
    journalSel.value = "Language Learning & Technology (LLT)";
    stratSel.value = "Methodological Fortification";
  }
}

export function executeAssembleDraft() {
  const critiqueText = document.getElementById('studio-critique-input').value.trim();
  if (!critiqueText) {
    showToast("请先在左侧输入或粘贴审稿人意见！");
    return;
  }

  const targetJournal = document.getElementById('studio-journal-select').value;
  const stratPref = document.getElementById('studio-strategy-select').value;

  const emptyState = document.getElementById('studio-empty-state');
  const resultCard = document.getElementById('studio-result-card');

  // Client-side Instant Assembly
  const draft = rebuttalStudio.assembleDraft(critiqueText, {
    journal: targetJournal,
    strategy: stratPref
  });

  emptyState.classList.add('hidden');
  resultCard.classList.remove('hidden');

  renderAssembledStudioCard(draft);
  if (window.lucide) lucide.createIcons();
  showToast("✓ 4-Move 返修信草稿已自动生成！");
}

function renderAssembledStudioCard(data) {
  const container = document.getElementById('studio-result-card');
  const refCasesHtml = (data.referencedCases || []).map((c, i) => `
    <div class="p-2.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-tertiary)] flex flex-col gap-1 text-[11px]">
      <div class="flex justify-between items-center text-[var(--accent-primary)] font-semibold">
        <span>#${i+1} ${c.journal} (${c.revision_round})</span>
        <span class="text-[var(--text-muted)] font-mono">匹配度: ${Math.round(c.similarity*100)}%</span>
      </div>
      <p class="text-[var(--text-secondary)] italic line-clamp-1">“${c.golden_move}”</p>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-tertiary)] flex flex-col gap-1">
      <div class="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
        <span class="flex items-center gap-1.5">
          <i data-lucide="eye" class="w-3.5 h-3.5 text-[#DE7E5D]"></i>
          审稿人隐性学术关切穿透诊断:
        </span>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)]">
          ${data.matchedCategory}
        </span>
      </div>
      <p class="text-xs text-[var(--text-secondary)] leading-relaxed">${data.latentConcern}</p>
    </div>

    <div class="flex flex-col gap-3">
      <!-- Move 1 -->
      <div class="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col gap-1.5 shadow-sm">
        <div class="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
          <span class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[#DE7E5D] flex items-center justify-center font-mono text-[10px] font-bold">M1</span>
            Move 1: Acknowledge & Validate (尊重大国外交与重塑重要性)
          </span>
          <button onclick="window.copyText('${escapeAttr(data.move1)}', '已复制 Move 1')" class="text-[var(--text-muted)] hover:text-[#DE7E5D]">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed select-all">${data.move1}</p>
      </div>

      <!-- Move 2 -->
      <div class="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col gap-1.5 shadow-sm">
        <div class="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
          <span class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[#D4A359] flex items-center justify-center font-mono text-[10px] font-bold">M2</span>
            Move 2: Concede Ambiguity or Delineate Scope (承认原稿歧义或划定边界)
          </span>
          <button onclick="window.copyText('${escapeAttr(data.move2)}', '已复制 Move 2')" class="text-[var(--text-muted)] hover:text-[#D4A359]">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed select-all">${data.move2}</p>
      </div>

      <!-- Move 3 -->
      <div class="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col gap-1.5 shadow-sm">
        <div class="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
          <span class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[#5FA369] flex items-center justify-center font-mono text-[10px] font-bold">M3</span>
            Move 3: Substantive Action & Grounding (实质性修改汇报与理论加固)
          </span>
          <button onclick="window.copyText('${escapeAttr(data.move3)}', '已复制 Move 3')" class="text-[var(--text-muted)] hover:text-[#5FA369]">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed select-all">${data.move3}</p>
      </div>

      <!-- Move 4 -->
      <div class="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col gap-1.5 shadow-sm">
        <div class="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
          <span class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded bg-[var(--bg-tertiary)] text-[#A88D9B] flex items-center justify-center font-mono text-[10px] font-bold">M4</span>
            Move 4: Anchoring & Cross-referencing (正文页码精确定位与复核说明)
          </span>
          <button onclick="window.copyText('${escapeAttr(data.move4)}', '已复制 Move 4')" class="text-[var(--text-muted)] hover:text-[#A88D9B]">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed select-all">${data.move4}</p>
      </div>
    </div>

    <div class="flex flex-col gap-2 pt-2 border-t border-[var(--card-border)]">
      <span class="text-[11px] text-[var(--text-secondary)] font-medium flex items-center gap-1">
        <i data-lucide="book" class="w-3.5 h-3.5 text-[#DE7E5D]"></i>
        本草稿引用的历史顶刊发表成功对局背书:
      </span>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${refCasesHtml}</div>
    </div>

    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--card-border)]">
      <button onclick="window.copyText('${escapeAttr(data.fullAssembledText)}', '已复制整篇 4-Move 标准回辩信正文')" class="px-4 py-2 rounded-lg btn-terracotta text-xs font-semibold flex items-center gap-1.5">
        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        <span>一键复制整封 4-Move Rebuttal Letter</span>
      </button>
    </div>
  `;
}

// -------------------------------------------------------------
// VIEW 4: PRE-SUBMISSION SCANNER (PREEMPTIVE DEFENSE)
// -------------------------------------------------------------
function initPreSubmissionScanner() {
  renderParadigmChips();
  const paradigms = corpusBundle.scanner_data.paradigms || [];
  if (paradigms.length > 0) {
    selectedParadigmIds.add(paradigms[0].id);
    selectedParadigmIds.add(paradigms[1].id);
  }
  renderScannerCards();
}

function renderParadigmChips() {
  const container = document.getElementById('paradigm-chips-container');
  const paradigms = corpusBundle.scanner_data.paradigms || [];
  if (!container) return;

  container.innerHTML = paradigms.map(p => {
    const isSelected = selectedParadigmIds.has(p.id);
    return `
      <button 
        onclick="window.toggleParadigmSelect('${p.id}')" 
        class="text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 font-medium ${
          isSelected 
            ? 'bg-[var(--accent-primary-subtle)] text-[#DE7E5D] border-[#DE7E5D]' 
            : 'btn-neutral text-[var(--text-secondary)]'
        }">
        <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#DE7E5D]' : 'bg-[var(--text-muted)]'}"></span>
        <span>${p.name}</span>
        <span class="text-[10px] font-mono opacity-75">(${p.attack_vectors.length})</span>
      </button>
    `;
  }).join('');
}

export function toggleParadigmSelect(pid) {
  if (selectedParadigmIds.has(pid)) selectedParadigmIds.delete(pid);
  else selectedParadigmIds.add(pid);
  renderParadigmChips();
  renderScannerCards();
}

export function selectAllParadigms(flag) {
  const paradigms = corpusBundle.scanner_data.paradigms || [];
  if (flag) paradigms.forEach(p => selectedParadigmIds.add(p.id));
  else selectedParadigmIds.clear();
  renderParadigmChips();
  renderScannerCards();
}

export function toggleVectorCheck(vid) {
  if (checkedVectorIds.has(vid)) {
    checkedVectorIds.delete(vid);
    showToast("已取消标记");
  } else {
    checkedVectorIds.add(vid);
    showToast("✓ 标记：已在正文筑起防御！");
  }
  updateScannerScore();
}

function updateScannerScore() {
  const paradigms = corpusBundle.scanner_data.paradigms || [];
  let totalVisibleVectors = 0;
  paradigms.forEach(p => {
    if (selectedParadigmIds.has(p.id)) {
      totalVisibleVectors += p.attack_vectors.length;
    }
  });

  const checkedInVisible = Array.from(checkedVectorIds).filter(vid => {
    for (const p of paradigms) {
      if (selectedParadigmIds.has(p.id)) {
        if (p.attack_vectors.some(v => v.id === vid)) return true;
      }
    }
    return false;
  }).length;

  const percent = totalVisibleVectors > 0 ? Math.round((checkedInVisible / totalVisibleVectors) * 100) : 0;
  const scoreText = document.getElementById('scanner-score-text');
  if (scoreText) {
    scoreText.innerText = `${percent}% (${checkedInVisible}/${totalVisibleVectors})`;
    scoreText.className = `text-sm font-mono font-bold ${percent === 100 ? 'text-[#5FA369]' : 'text-[var(--text-primary)]'}`;
  }
}

function renderScannerCards() {
  const container = document.getElementById('scanner-cards-container');
  const paradigms = corpusBundle.scanner_data.paradigms || [];
  if (!container) return;

  const visibleVectors = [];
  paradigms.forEach(p => {
    if (selectedParadigmIds.has(p.id)) {
      p.attack_vectors.forEach(v => {
        visibleVectors.push({ ...v, paradigm_name: p.name });
      });
    }
  });

  if (visibleVectors.length === 0) {
    container.innerHTML = `
      <div class="glass-panel p-12 rounded-xl text-center text-[var(--text-secondary)] text-xs">
        请在上方至少勾选一个您的新论文研究范式，以呈现专属防线排查清单。
      </div>
    `;
    updateScannerScore();
    return;
  }

  container.innerHTML = visibleVectors.map(v => {
    const isChecked = checkedVectorIds.has(v.id);
    return `
      <div id="vcard-${v.id}" class="glass-panel glass-panel-hover p-6 rounded-xl flex flex-col gap-4 ${isChecked ? 'border-[#5FA369]' : ''}">
        
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
              v.danger_level.includes('极高') 
                ? 'bg-[#261A19] text-[#E06C60] border border-[#3D2522]' 
                : 'bg-[#221D15] text-[#D4A359] border border-[#3D3425]'
            }">
              ${v.danger_level}
            </span>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">${v.pitfall_title}</h3>
            <span class="text-[11px] text-[var(--text-muted)] font-mono">(${v.paradigm_name.split('(')[0]})</span>
          </div>

          <label class="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none">
            <input 
              type="checkbox" 
              onchange="window.toggleVectorCheck('${v.id}')" 
              ${isChecked ? 'checked' : ''}
              class="w-4 h-4 rounded text-[#DE7E5D] focus:ring-0 cursor-pointer"
            />
            <span class="${isChecked ? 'text-[#5FA369] font-semibold' : ''}">已在正文筑起防御</span>
          </label>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="critique-box p-4 rounded-lg flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-semibold text-[#E06C60]">
              <span class="flex items-center gap-1.5">
                <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
                审稿人必问原话 (Anticipated Attack Vector)
              </span>
              <span class="text-[10px] font-mono text-[var(--text-muted)]">ATTACK</span>
            </div>
            <p class="text-xs sm:text-[13px] italic leading-relaxed">
              “${v.reviewer_attack}”
            </p>
          </div>

          <div class="response-box p-4 rounded-lg flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-semibold text-[#5FA369]">
              <span class="flex items-center gap-1.5">
                <i data-lucide="shield" class="w-3.5 h-3.5"></i>
                先验防御要点与埋伏位置
              </span>
              <span class="text-[10px] font-mono text-[var(--text-secondary)]">${v.target_section}</span>
            </div>
            <p class="text-xs sm:text-[13px] leading-relaxed">
              ${v.preemptive_strategy}
            </p>
          </div>
        </div>

        <div class="golden-box p-4 rounded-lg flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="text-[11px] font-semibold text-[#D4A359] uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
              <span>推荐直接写入新论文初稿的示范学术段落 (Preemptive Text Excerpt):</span>
            </div>
            <button onclick="window.copyText('${escapeAttr(v.preemptive_template)}', '已复制正文示范段落')" class="text-xs text-[#D4A359] hover:text-[#EFE2CB] font-semibold flex items-center gap-1">
              <i data-lucide="copy" class="w-3 h-3"></i> 复制模板
            </button>
          </div>
          <p class="text-xs sm:text-[13px] font-mono leading-relaxed select-all bg-[var(--bg-secondary)] p-3 rounded border border-[var(--card-border)]">
            ${v.preemptive_template}
          </p>
        </div>

        <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
          <span class="flex items-center gap-1 text-[11px]">
            <i data-lucide="check" class="w-3.5 h-3.5 text-[#5FA369]"></i>
            <span>历史发表见证：${v.history_evidence}</span>
          </span>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
  updateScannerScore();
}

export function exportDefensePlan() {
  const paradigms = corpusBundle.scanner_data.paradigms || [];
  const lines = [
    `# 新学术论文投稿前先验防御施工方案与扫雷备忘录`,
    `> 自动生成时间: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} | 来源: AcadRebuttal 纯前端离线知识库`,
    "",
    "---",
    "",
    "## 📌 投稿前防御施工指导原则",
    "根据您过往在 *System, CALL, LLT, EAIT, ILE* 等顶刊发表的 181 条审稿交锋记录，以下是审稿人对本类研究所必挑的核心盲区。在向目标期刊提交初稿（Initial Submission）前，请对照下表完成正文相应章节的加固修筑。",
    "",
    "---",
    ""
  ];

  let count = 1;
  paradigms.forEach(p => {
    if (selectedParadigmIds.has(p.id)) {
      p.attack_vectors.forEach(v => {
        lines.push(
          `### 【防线 ${count}】${v.pitfall_title}`,
          `- **所属范式**: ${p.name}`,
          `- **高危程度**: \`${v.danger_level}\``,
          `- **正文埋伏防守位置**: \`${v.target_section}\``,
          "",
          `#### 🚨 审稿人常见攻击句式 (Anticipated Attack)`,
          `> *"${v.reviewer_attack}"*`,
          "",
          `#### 🛡️ 先验防御施工要点 (Preemptive Action)`,
          v.preemptive_strategy,
          "",
          `#### ✍️ 推荐直接写入初稿的防御学术模板 (Ready-to-use Template)`,
          "```latex",
          v.preemptive_template,
          "```",
          "",
          `#### 📚 历史过往发表见证 (Corpus Evidence)`,
          v.history_evidence,
          "",
          `- [ ] **施工状态核验**: \`${checkedVectorIds.has(v.id) ? '已在正文筑起防御 [已完成]' : '未加固 [待施工]'}\``,
          "",
          "---",
          ""
        );
        count++;
      });
    }
  });

  lines.push("\n*Generated by AcadRebuttal Pre-submission Scanner System (Pure JS Edition)*\n");
  downloadBlob(lines.join("\n"), `Pre_Submission_Defense_Plan_${new Date().toISOString().slice(0,10)}.md`);
  showToast("✓ 投稿前防御方案导出成功！");
}

// -------------------------------------------------------------
// BOOKMARK / BASKET FUNCTIONALITY (CLIENT-SIDE)
// -------------------------------------------------------------
function isBookmarked(id) {
  return bookmarkedMap.has(id);
}

export function toggleBookmark(id) {
  if (bookmarkedMap.has(id)) {
    bookmarkedMap.delete(id);
    showToast("已从备选库移除");
  } else {
    const found = searchEngine.records.find(r => r.id === id);
    if (found) {
      bookmarkedMap.set(id, found);
      showToast("⭐ 已加入我的返修灵感备选库");
    }
  }
  saveBookmarksToStorage();
  updateBookmarkUI();
}

function saveBookmarksToStorage() {
  const list = Array.from(bookmarkedMap.values());
  localStorage.setItem('acad_rebuttal_bookmarks', JSON.stringify(list));
}

function loadBookmarksFromStorage() {
  try {
    const raw = localStorage.getItem('acad_rebuttal_bookmarks');
    if (raw) {
      const list = JSON.parse(raw);
      bookmarkedMap = new Map();
      list.forEach(it => bookmarkedMap.set(it.id, it));
    }
  } catch (e) {
    bookmarkedMap = new Map();
  }
  updateBookmarkUI();
}

function updateBookmarkUI() {
  const count = bookmarkedMap.size;
  const badge = document.getElementById('bookmark-badge');
  const drawerCount = document.getElementById('drawer-bookmark-count');
  if (badge) badge.innerText = count;
  if (drawerCount) drawerCount.innerText = `${count} 条`;
  renderBookmarkList();
}

export function toggleBookmarkDrawer() {
  document.getElementById('bookmark-drawer').classList.toggle('translate-x-full');
}

export function clearAllBookmarks() {
  bookmarkedMap.clear();
  saveBookmarksToStorage();
  updateBookmarkUI();
  showToast("已清空备选库");
}

function renderBookmarkList() {
  const container = document.getElementById('bookmark-list');
  if (!container) return;

  const list = Array.from(bookmarkedMap.values());
  if (list.length === 0) {
    container.innerHTML = '<div class="text-xs text-[var(--text-secondary)] p-4 text-center">暂未收藏任何案例，在检索卡片点击书签即可加入</div>';
    return;
  }

  container.innerHTML = list.map(r => `
    <div class="p-3.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col gap-2">
      <div class="flex items-center justify-between text-xs">
        <span class="text-[#DE7E5D] font-semibold">${r.journal.split('(')[0]} · ${r.revision_round}</span>
        <button onclick="window.toggleBookmark('${r.id}')" class="text-[var(--text-muted)] hover:text-[#E06C60]">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <p class="text-xs text-[var(--text-secondary)] line-clamp-2 italic">“${r.comment_text.replace(/\n/g, ' ')}”</p>
      <div class="p-2 rounded bg-[var(--bg-tertiary)] border-l-2 border-[#D4A359] text-[11px] text-[var(--text-secondary)]">
        <span class="font-semibold text-[#D4A359]">金句:</span> ${r.golden_move}
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

export function exportBookmarkedMarkdown() {
  const items = Array.from(bookmarkedMap.values());
  if (!items.length) {
    showToast("备选库为空，请先收藏对局！");
    return;
  }

  const content = searchEngine.generateMarkdownDossier(items, "我的学术论文返修灵感与决策备忘录 (My Selected Rebuttal Ideas)");
  downloadBlob(content, `My_Rebuttal_Plan_${new Date().toISOString().slice(0,10)}.md`);
  showToast("✓ 专属备忘录导出成功！");
}

// -------------------------------------------------------------
// VIEW 5: REBUTTAL STRATEGY VAULT
// -------------------------------------------------------------
function loadStrategyVault() {
  const container = document.getElementById('vault-container');
  const strategies = corpusBundle.strategy_vault || [];
  if (!container) return;

  container.innerHTML = strategies.map(s => `
    <div class="glass-panel p-5 rounded-xl flex flex-col gap-3">
      <div class="flex items-center justify-between border-b border-[var(--card-border)] pb-2">
        <span class="px-2.5 py-0.5 rounded text-xs font-semibold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-text)]">
          ${s.category}
        </span>
        <span class="text-xs text-[var(--text-secondary)] font-mono">${s.examples_count} 个案例支撑</span>
      </div>
      <div>
        <div class="text-[11px] font-semibold text-[#E06C60] mb-1">【审稿痛点场景】:</div>
        <p class="text-xs text-[var(--text-secondary)]">${s.challenge}</p>
      </div>
      <div>
        <div class="text-[11px] font-semibold text-[#DE7E5D] mb-1">【实战破局招式】:</div>
        <p class="text-xs text-[var(--text-primary)] font-medium">${s.core_move}</p>
      </div>
      <div class="bg-[var(--bg-tertiary)] p-3 rounded-lg border border-[var(--card-border)] relative">
        <div class="text-[10px] text-[var(--text-secondary)] font-mono mb-1">STANDARD TEMPLATE (EN):</div>
        <p class="text-xs text-[var(--text-primary)] font-mono leading-relaxed select-all">${s.template_en}</p>
        <button onclick="window.copyText('${escapeAttr(s.template_en)}', '已复制学术模板')" class="mt-2 text-[11px] text-[#DE7E5D] hover:underline font-semibold flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i> 一键应用此模板
        </button>
      </div>
    </div>
  `).join('');
  if (window.lucide) lucide.createIcons();
}

// -------------------------------------------------------------
// VIEW 6: JOURNAL ANALYTICS
// -------------------------------------------------------------
function loadAnalytics() {
  const container = document.getElementById('analytics-container');
  const analytics = corpusBundle.analytics || {};
  if (!container) return;

  const journalList = Object.entries(analytics.journal_distribution || {})
    .sort((a, b) => b[1] - a[1])
    .map(([j, cnt]) => `
      <div class="flex items-center justify-between text-xs py-2 border-b border-[var(--card-border)]">
        <span class="text-[var(--text-primary)] truncate max-w-[200px]" title="${j}">${j.split('(')[0]}</span>
        <span class="font-mono text-[#DE7E5D] font-bold">${cnt} 条</span>
      </div>
    `).join('');

  const categoryList = Object.entries(analytics.category_distribution || {})
    .sort((a, b) => b[1] - a[1])
    .map(([c, cnt]) => `
      <div class="flex items-center justify-between text-xs py-2 border-b border-[var(--card-border)]">
        <span class="text-[var(--text-primary)]">${c}</span>
        <span class="font-mono text-[#5FA369] font-bold">${cnt} 条</span>
      </div>
    `).join('');

  const strategyList = Object.entries(analytics.strategy_distribution || {})
    .sort((a, b) => b[1] - a[1])
    .map(([s, cnt]) => `
      <div class="flex items-center justify-between text-xs py-2 border-b border-[var(--card-border)]">
        <span class="text-[var(--text-primary)]">${s}</span>
        <span class="font-mono text-[#D4A359] font-bold">${cnt} 条</span>
      </div>
    `).join('');

  container.innerHTML = `
    <div class="glass-panel p-5 rounded-xl flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
        <i data-lucide="book-open" class="w-4 h-4 text-[#DE7E5D]"></i>
        期刊发表返修量榜单
      </h3>
      <div class="flex flex-col">${journalList}</div>
    </div>
    <div class="glass-panel p-5 rounded-xl flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
        <i data-lucide="layers" class="w-4 h-4 text-[#5FA369]"></i>
        审稿意见核心议题分布
      </h3>
      <div class="flex flex-col">${categoryList}</div>
    </div>
    <div class="glass-panel p-5 rounded-xl flex flex-col gap-3">
      <h3 class="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
        <i data-lucide="shield" class="w-4 h-4 text-[#D4A359]"></i>
        学术修辞招式采纳率
      </h3>
      <div class="flex flex-col">${strategyList}</div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function highlightText(text, query) {
  if (!text) return '';
  if (!query) return escapeHtml(text);
  const words = query.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return escapeHtml(text);

  let escaped = escapeHtml(text);
  words.forEach(w => {
    const reg = new RegExp(`(${escapeRegExp(w)})`, 'gi');
    escaped = escaped.replace(reg, '<mark class="bg-[#2A1E1A] text-[#DE7E5D] px-1 py-0.5 rounded font-semibold">$1</mark>');
  });
  return escaped;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str) {
  return (str || '')
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, " ");
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bind to window for HTML event handlers
window.switchView = switchView;
window.setRetrievalMode = setRetrievalMode;
window.showToast = showToast;
window.copyText = copyText;
window.toggleCliModal = toggleCliModal;
window.toggleGraphFullscreen = toggleGraphFullscreen;
window.resetGraphZoom = resetGraphZoom;
window.toggleSimulation = toggleSimulation;
window.closeGraphDrawer = closeGraphDrawer;
window.setQueryAndSearch = setQueryAndSearch;
window.clearSearchFilters = clearSearchFilters;
window.executeSearch = executeSearch;
window.exportCurrentMarkdown = exportCurrentMarkdown;
window.setStudioPreset = setStudioPreset;
window.executeAssembleDraft = executeAssembleDraft;
window.toggleParadigmSelect = toggleParadigmSelect;
window.selectAllParadigms = selectAllParadigms;
window.toggleVectorCheck = toggleVectorCheck;
window.exportDefensePlan = exportDefensePlan;
window.toggleBookmark = toggleBookmark;
window.toggleBookmarkDrawer = toggleBookmarkDrawer;
window.clearAllBookmarks = clearAllBookmarks;
window.exportBookmarkedMarkdown = exportBookmarkedMarkdown;
