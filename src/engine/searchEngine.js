/**
 * AcadRebuttal Client-Side Hybrid IR Engine
 * Pure JavaScript Implementation of Okapi BM25 + Vector Space Model (TF-IDF Cosine)
 */

export class ClientSearchEngine {
  constructor(corpusBundle) {
    this.records = corpusBundle.records || [];
    this.metadata = corpusBundle.metadata || {};
    this.analytics = corpusBundle.analytics || {};
    this.strategyVault = corpusBundle.strategy_vault || [];
    this.scannerData = corpusBundle.scanner_data || {};
    this.knowledgeGraph = corpusBundle.knowledge_graph || { nodes: [], links: [] };

    // Stopwords for academic search
    this.stopwords = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
      'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
      'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
      'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
      'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my',
      'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
      'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should', 'so', 'some', 'such',
      'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
      'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
      'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
      'yours', 'yourself', 'yourselves'
    ]);

    this._buildIndex();
  }

  tokenize(text) {
    if (!text) return [];
    const tokens = text.toLowerCase().match(/\b[a-z0-9\-_]{2,}\b/g) || [];
    return tokens.filter(t => !this.stopwords.has(t));
  }

  _buildIndex() {
    this.docCount = this.records.length;
    this.docTokens = [];
    this.docLengths = [];
    this.docTermFreqs = []; // list of Map<term, freq>
    this.docVectors = [];   // list of Map<term, tfidf>
    this.docNorms = [];     // vector length for cosine
    this.df = new Map();    // term -> doc frequency

    let totalLength = 0;

    this.records.forEach((r, idx) => {
      // Field weighted token stream
      const commentTokens = this.tokenize(r.comment_text);
      const respTokens = this.tokenize(r.response_text);
      const goldenTokens = this.tokenize(r.golden_move);
      const kwTokens = (r.keywords || []).map(k => k.toLowerCase());
      const metaTokens = this.tokenize(`${r.journal} ${r.category} ${r.strategy} ${r.paper_topic}`);

      // Weighted compilation
      const combinedTokens = [
        ...commentTokens, ...commentTokens, // 2x
        ...goldenTokens, ...goldenTokens, ...goldenTokens, // 3x
        ...kwTokens, ...kwTokens, ...kwTokens, // 3x
        ...metaTokens,
        ...respTokens
      ];

      this.docTokens.push(combinedTokens);
      const len = combinedTokens.length;
      this.docLengths.push(len);
      totalLength += len;

      const tfMap = new Map();
      const uniqueInDoc = new Set();

      combinedTokens.forEach(t => {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
        uniqueInDoc.add(t);
      });

      this.docTermFreqs.push(tfMap);

      uniqueInDoc.forEach(t => {
        this.df.set(t, (this.df.get(t) || 0) + 1);
      });
    });

    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 1;

    // Precompute BM25 IDF: ln((N - n + 0.5) / (n + 0.5) + 1)
    this.bm25Idf = new Map();
    this.tfidfIdf = new Map();

    this.df.forEach((docFreq, term) => {
      const bm25Val = Math.log((this.docCount - docFreq + 0.5) / (docFreq + 0.5) + 1);
      this.bm25Idf.set(term, Math.max(0.1, bm25Val));

      const tfidfVal = Math.log((this.docCount + 1) / (docFreq + 1)) + 1;
      this.tfidfIdf.set(term, tfidfVal);
    });

    // Precompute document TF-IDF vectors for cosine similarity
    for (let i = 0; i < this.docCount; i++) {
      const tfMap = this.docTermFreqs[i];
      const vec = new Map();
      let sumSq = 0;

      tfMap.forEach((freq, term) => {
        const sublinearTf = 1 + Math.log(freq);
        const idf = this.tfidfIdf.get(term) || 1;
        const weight = sublinearTf * idf;
        vec.set(term, weight);
        sumSq += weight * weight;
      });

      this.docVectors.push(vec);
      this.docNorms.push(Math.sqrt(sumSq) || 1);
    }
  }

  search(options = {}) {
    const {
      query = "",
      journal = "ALL",
      category = "ALL",
      strategy = "ALL",
      revisionRound = "ALL",
      mode = "hybrid", // 'hybrid', 'semantic', 'lexical'
      topK = 24
    } = options;

    // Filter candidate pool
    const candidates = [];
    for (let i = 0; i < this.docCount; i++) {
      const r = this.records[i];
      if (journal && journal !== "ALL" && r.journal !== journal) continue;
      if (category && category !== "ALL" && r.category !== category) continue;
      if (strategy && strategy !== "ALL" && r.strategy !== strategy) continue;
      if (revisionRound && revisionRound !== "ALL" && r.revision_round !== revisionRound) continue;
      candidates.push(i);
    }

    if (candidates.length === 0) return [];

    const qTokens = this.tokenize(query);

    // If query is empty, return candidate pool directly
    if (qTokens.length === 0) {
      return candidates.slice(0, topK).map(idx => ({
        ...this.records[idx],
        similarity: 1.0,
        matched_terms: [],
        retrieval_mode: mode
      }));
    }

    // 1. Compute BM25 Scores
    const k1 = 1.2;
    const b = 0.75;
    const bm25RawScores = new Map();
    let maxBm25 = 0;

    candidates.forEach(idx => {
      const tfMap = this.docTermFreqs[idx];
      const docLen = this.docLengths[idx];
      let score = 0;

      qTokens.forEach(t => {
        const tf = tfMap.get(t) || 0;
        if (tf > 0) {
          const idf = this.bm25Idf.get(t) || 0.1;
          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (docLen / this.avgDocLength));
          score += idf * (numerator / denominator);
        }
      });

      bm25RawScores.set(idx, score);
      if (score > maxBm25) maxBm25 = score;
    });

    // 2. Compute Vector Space Cosine Similarity Scores
    const qTfMap = new Map();
    qTokens.forEach(t => qTfMap.set(t, (qTfMap.get(t) || 0) + 1));

    const qVec = new Map();
    let qSumSq = 0;
    qTfMap.forEach((freq, term) => {
      const sublinearTf = 1 + Math.log(freq);
      const idf = this.tfidfIdf.get(term) || (Math.log(this.docCount) + 1);
      const weight = sublinearTf * idf;
      qVec.set(term, weight);
      qSumSq += weight * weight;
    });
    const qNorm = Math.sqrt(qSumSq) || 1;

    const cosScores = new Map();
    let maxCos = 0;

    candidates.forEach(idx => {
      const dVec = this.docVectors[idx];
      const dNorm = this.docNorms[idx];
      let dot = 0;

      qVec.forEach((qWeight, term) => {
        const dWeight = dVec.get(term) || 0;
        if (dWeight > 0) {
          dot += qWeight * dWeight;
        }
      });

      const sim = dot / (qNorm * dNorm);
      cosScores.set(idx, sim);
      if (sim > maxCos) maxCos = sim;
    });

    // 3. Score Fusion based on Selected Mode
    const scoredCandidates = candidates.map(idx => {
      const normBm25 = maxBm25 > 0 ? (bm25RawScores.get(idx) || 0) / maxBm25 : 0;
      const cosSim = cosScores.get(idx) || 0;

      let finalScore = 0;
      if (mode === "lexical") {
        finalScore = normBm25;
      } else if (mode === "semantic") {
        finalScore = cosSim;
      } else {
        // Hybrid: 0.60 Cosine + 0.40 BM25
        finalScore = 0.60 * cosSim + 0.40 * normBm25;
      }

      // Find matched terms for highlight
      const tfMap = this.docTermFreqs[idx];
      const matched = qTokens.filter(t => tfMap.has(t));

      return {
        idx,
        score: finalScore,
        matched: Array.from(new Set(matched)).slice(0, 6)
      };
    });

    // Sort descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates.slice(0, topK).map(sc => {
      const orig = this.records[sc.idx];
      return {
        ...orig,
        similarity: Math.round(sc.score * 1000) / 1000,
        matched_terms: sc.matched,
        retrieval_mode: mode
      };
    });
  }

  generateMarkdownDossier(items, title = "学术论文返修决策手册 (Rebuttal Dossier)") {
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const lines = [
      `# ${title}`,
      `> 自动生成时间: ${nowStr} | 收录案例: ${items.length} 条 | 来源: AcadRebuttal 纯前端离线检索知识库`,
      "",
      "---",
      "",
      "## 目录概要",
      ""
    ];

    items.forEach((item, i) => {
      const shortCritique = item.comment_text.replace(/\n/g, ' ').slice(0, 60);
      lines.push(`- [${i + 1}. ${item.journal} (${item.category}): ${shortCritique}...](#case-${i + 1})`);
    });

    lines.push("", "---", "", "## 案例汇编与实战答辩决策", "");

    items.forEach((item, i) => {
      const simInfo = item.similarity ? ` (匹配度: ${Math.round(item.similarity * 100)}%)` : "";
      lines.push(
        `<a id="case-${i + 1}"></a>`,
        `### Case ${i + 1}: ${item.journal} · ${item.revision_round}${simInfo}`,
        `- **课题主题**: ${item.paper_topic}`,
        `- **审稿人角色**: ${item.reviewer_role}`,
        `- **核心痛点分类**: \`${item.category}\``,
        `- **作者应对招式**: \`${item.strategy}\``,
        "",
        "#### 🚨 审稿人批评意见 (Reviewer Critique)",
        "```text",
        item.comment_text.trim(),
        "```",
        "",
        "#### 💡 作者回辩与正文修改执行 (Author Rebuttal & Actions)",
        item.response_text.trim(),
        "",
        "#### ⚡ 修辞胜招金句提炼 (Golden Move)",
        `> **${item.golden_move}**`,
        "",
        "---",
        ""
      );
    });

    lines.push("\n*Generated by AcadRebuttal Client-Side Decision System*\n");
    return lines.join("\n");
  }
}
