/**
 * AcadRebuttal Client-Side Rebuttal Studio & Swalesian 4-Move Assembler
 * Fully deterministic, client-side discourse generation based on published corpus.
 */

export class ClientRebuttalStudio {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  diagnoseCritique(text, defaultCategory = "Methodology & Design") {
    const t = text.toLowerCase();
    if (/(sample|participant|size|power|generaliz|dropout|attrition)/.test(t)) {
      return {
        diagnosis: "审稿人深层关切：研究结论的生态效度、被试流失率与外推边界是否过度宣称（Overclaiming）。",
        targetTopic: "the sample size determination and participant cohort specifications",
        recommendedStrategy: "Concede & Expand"
      };
    } else if (/(theory|theor|framework|grounding|concept|construct|underpin|lens)/.test(t)) {
      return {
        diagnosis: "审稿人深层关切：理论透镜是否只是'贴标签'，未能在后文讨论与变量操作化中提供实际解释机制。",
        targetTopic: "the theoretical underpinnings and the operationalization of core constructs",
        recommendedStrategy: "Direct Correction"
      };
    } else if (/(prompt|ai|genai|chatgpt|teqsa|ethic|policy|reproducib)/.test(t)) {
      return {
        diagnosis: "审稿人深层关切：生成式 AI 介入的可复现性黑箱、提示词保真度以及高校伦理政策遵从。",
        targetTopic: "the transparency of GenAI prompt configurations and institutional ethical compliance",
        recommendedStrategy: "Concede & Expand"
      };
    } else if (/(literature|cite|citation|reference|prior|previous studies)/.test(t)) {
      return {
        diagnosis: "审稿人深层关切：文献综述是否遗漏核心争鸣，或本研究与既有范式的知识贡献边界未厘清。",
        targetTopic: "the critical engagement with suggested literature and the delineation of research scope",
        recommendedStrategy: "Polite Defense & Boundary"
      };
    } else if (/(p-value|statistic|effect size|anova|normality|validity|kappa|reliability)/.test(t)) {
      return {
        diagnosis: "审稿人深层关切：统计推断前提假设是否满足、测量信效度与编码者一致性是否严谨。",
        targetTopic: "the statistical assumptions, measurement validity, and reporting rigor",
        recommendedStrategy: "Methodological Fortification"
      };
    } else if (/(discussion|mechanism|implication|limitation|critical)/.test(t)) {
      return {
        diagnosis: "审稿人深层关切：讨论部分是否仅停留在复述统计结果，缺乏认知/社会层面的深层机制提炼。",
        targetTopic: "the critical discussion of underlying mechanisms rather than mere descriptive reporting",
        recommendedStrategy: "Empirical Supplement"
      };
    } else {
      return {
        diagnosis: `审稿人深层关切：正文论证的逻辑链条在 ${defaultCategory} 维度需要更有说服力的实证锚定。`,
        targetTopic: `the detailed methodological and conceptual elaboration of ${defaultCategory}`,
        recommendedStrategy: "Concede & Expand"
      };
    }
  }

  assembleDraft(critiqueText, options = {}) {
    const {
      journal = "System",
      strategy = "ALL"
    } = options;

    const matchedCases = this.searchEngine.search({
      query: critiqueText,
      journal: journal !== "ALL" ? journal : undefined,
      strategy: strategy !== "ALL" ? strategy : undefined,
      topK: 3,
      mode: "hybrid"
    });

    const topCase = matchedCases.length > 0 ? matchedCases[0] : this.searchEngine.records[0];
    const issueCat = topCase.category;
    const strat = topCase.strategy;
    const topMove = topCase.golden_move;

    const diagnosis = this.diagnoseCritique(critiqueText, issueCat);

    // Move 1: Acknowledge & Validate
    const move1 = `Thank you very much for this perceptive and constructive comment regarding ${diagnosis.targetTopic}. We deeply appreciate your focus on the methodological rigor and conceptual precision of our work.`;

    // Move 2: Concede Ambiguity or Delineate Scope (with variants)
    const move2Variants = {
      concede: `We completely agree with the reviewer that the original presentation was insufficient in clarity and might potentially cause ambiguity regarding ${diagnosis.targetTopic}.`,
      scopeDefense: `While we acknowledge the reviewer's valuable insight regarding [potential broader elements], it should be noted that the present investigation purposefully focused on ${diagnosis.targetTopic} because [provide contextual justification, e.g., ecological constraints in classroom quasi-experiments].`,
      methodFortify: `We appreciate the reviewer highlighting the need for greater methodological detail. In this revision, we have thoroughly verified the underlying assumptions and expanded the reporting protocol.`
    };

    const isScopeDefense = /defense|boundary/i.test(strat) || strategy === "Polite Defense & Boundary";
    const move2 = isScopeDefense ? move2Variants.scopeDefense : move2Variants.concede;

    // Move 3: Substantive Action & Grounding
    // Extract actual historical action from the top matching response
    const actionMatch = topCase.response_text.match(/\b(In the revised? manuscript|In the revision|To address this|We have added|We have expanded|We have revised)[^.!?]+[.!?]/i);
    const actionSnippet = actionMatch ? actionMatch[0].trim() : topMove.replace(/^Response:\s*/i, '');

    const move3 = `To address this critical point in the revised manuscript, ${actionSnippet} Specifically, we have substantially enriched the framing by [specify exact data or literature added, e.g., integrating baseline statistics, Cohen's d, or theoretical justification].`;

    // Move 4: Anchoring & Cross-referencing
    const move4 = `These amendments have now been fully incorporated into Section [X.X] (Pages [X-Y], Lines [X-Y]). We believe these systematic revisions have substantially strengthened the coherence and validity of our manuscript.`;

    const fullAssembledText = `Response:\n${move1}\n\n${move2}\n\n${move3}\n\n${move4}`;

    return {
      queryCritique: critiqueText,
      latentConcern: diagnosis.diagnosis,
      recommendedFocus: diagnosis.targetTopic,
      matchedCategory: issueCat,
      matchedStrategy: strat,
      move1,
      move2,
      move2Variants,
      move3,
      move4,
      fullAssembledText,
      referencedCases: matchedCases.slice(0, 2)
    };
  }
}
