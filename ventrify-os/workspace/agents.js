// ============================================================
// Ventrify OS — Workspace agents
//
// Three pieces of agent logic, mirrored locally as deterministic JS
// so the Workspace shows what the real agents would surface — without
// needing the engagement repos to be running. When Firebase lands,
// each `compute*` function gets replaced by a Firestore subscription
// that reads the actual agent's latest output.
//
//   1. computeEngagementHealth(p)   → engagement-health-monitor
//      Returns the on-track / attention / stuck verdict + reasoning.
//
//   2. computeActionQueue(programs, currentOpId)
//                                   → workflow-orchestrator
//      Returns a rank-ordered list of next actions for the operator
//      across all engagements they own.
//
//   3. computeCompleteness(p)       → tier-compliance-auditor
//      Returns % of expected deliverables produced at the engagement's
//      current phase. Aggregated across the portfolio for a stat block.
//
// All three are deterministic — same engagement state → same output.
// ============================================================

(function() {
  if (typeof window === 'undefined') return;

  // ---- 1. engagement-health-monitor -----------------------------------
  // Rules:
  //  - briefSubmitted: false AND >3 days since launch → attention
  //  - briefSubmitted: false AND >7 days since launch → stuck
  //  - cards awaiting founder for >5 days → attention
  //  - cards awaiting founder for >9 days → stuck
  //  - no activity for >5 days → attention
  //  - no activity for >9 days → stuck
  //  - gate ready to sign for >2 days → attention
  //  - everything else → on-track
  function computeEngagementHealth(p) {
    const reasons = [];
    let level = 'on-track';

    const days = p.daysActive || 0;
    const cards = p.cards || { drafted: 0, awaitingFounder: 0, resolved: 0 };
    const lastActivityAgeDays = parseLastActivityAge(p.lastActivity);
    const cardsStuckDays = inferCardsStuckDays(p);

    // BRIEF gating — engagement created but founder hasn't submitted
    if (p.briefSubmitted === false) {
      if (days >= 7) {
        level = 'stuck';
        reasons.push({ severity: 'critical', text: `Founder hasn't submitted brief in ${days} days · Studio invite went out at launch · suggest a nudge` });
      } else if (days >= 3) {
        level = 'attention';
        reasons.push({ severity: 'warn', text: `Brief still pending after ${days} days · normal turnaround is 2-3 days` });
      }
    }

    // CARDS stuck awaiting founder
    if (cards.awaitingFounder > 0 && cardsStuckDays >= 9) {
      level = 'stuck';
      reasons.push({ severity: 'critical', text: `${cards.awaitingFounder} cards awaiting founder for ${cardsStuckDays}+ days · the engagement isn't moving` });
    } else if (cards.awaitingFounder > 0 && cardsStuckDays >= 5) {
      if (level !== 'stuck') level = 'attention';
      reasons.push({ severity: 'warn', text: `${cards.awaitingFounder} cards awaiting founder for ${cardsStuckDays}+ days · suggest a nudge or async check-in` });
    }

    // GENERAL activity staleness
    if (lastActivityAgeDays >= 9) {
      level = 'stuck';
      reasons.push({ severity: 'critical', text: `No activity for ${lastActivityAgeDays}+ days · founder hasn't opened the Studio` });
    } else if (lastActivityAgeDays >= 5 && level === 'on-track') {
      level = 'attention';
      reasons.push({ severity: 'warn', text: `Quiet for ${lastActivityAgeDays}+ days · check in this week` });
    }

    // GATE ready but not signed
    if (p.gateStatus && /ready to sign|ready to close|ready·/i.test(p.gateStatus)) {
      if (level === 'on-track') level = 'attention';
      reasons.push({ severity: 'opportunity', text: `Gate ready to close · sign off to unlock the next phase` });
    }

    // POSITIVE signals — show one if no negative signal exists
    if (level === 'on-track' && reasons.length === 0) {
      if (cards.resolved > 0 && cards.drafted > 0 && cards.awaitingFounder === 0) {
        reasons.push({ severity: 'positive', text: `All ${cards.resolved} cards resolved · ready for L3 rebuild + gate review` });
      } else if (p.briefSubmitted === true) {
        reasons.push({ severity: 'positive', text: `Brief submitted, agents running, no blockers` });
      } else {
        reasons.push({ severity: 'positive', text: `On track — no blockers surfaced` });
      }
    }

    return { level, reasons };
  }

  // Parse last-activity strings like "2 hours ago", "3 days ago", "Yesterday", "just now"
  function parseLastActivityAge(s) {
    if (!s) return 99;
    const lower = (s || '').toLowerCase();
    if (lower.includes('just now') || lower.includes('min') || lower.includes('hour')) return 0;
    if (lower.includes('yesterday')) return 1;
    const m = lower.match(/(\d+)\s*day/);
    if (m) return parseInt(m[1], 10);
    const w = lower.match(/(\d+)\s*week/);
    if (w) return parseInt(w[1], 10) * 7;
    return 0;
  }

  // For prototype: cards stuck-days mirrors the engagement's lastActivity age
  // unless explicitly captured. Real agent reads the per-card timestamp.
  function inferCardsStuckDays(p) {
    return parseLastActivityAge(p.lastActivity);
  }

  // Whole days since an ISO timestamp (null if missing/unparseable).
  function daysSince(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }

  // The next action for an ASSESSMENT engagement, mirroring the run banner's
  // lifecycle: no deck → upload; deck → run; running → in progress; done →
  // review (while recent); error/needs-attention → republish.
  function assessmentAction(p) {
    const rs = p.runState || {};
    const status = rs.status || 'idle';
    const hasPitch = !!p.pitchDoc;
    const hasVerdict = !!(p.assessment && p.assessment.recommendation);
    const active = ['queued', 'running', 'partial'].includes(status);
    if (active) {
      return { id: `act-assess-run-${p.id}`, type: 'assessment-running', urgency: 'low', programId: p.id,
        title: `Assessment running for ${p.name}`,
        detail: rs.label ? String(rs.label) : 'The agents are assessing the venture from the uploaded documents.',
        age: p.lastActivity || 'just now', cta: 'Open assessment', score: 40 };
    }
    if (status === 'needs-attention' || status === 'error') {
      return { id: `act-assess-fix-${p.id}`, type: 'assessment-attention', urgency: 'high', programId: p.id,
        title: `${p.name} assessment needs attention`,
        detail: status === 'error' ? 'The last run reported an error. Its results may be saved — try Republish, or re-run.' : 'The assessment finished but needs republishing to this page.',
        age: p.lastActivity || 'recently', cta: 'Open assessment', score: 88 };
    }
    if (status === 'done' && hasVerdict) {
      const age = daysSince(rs.finishedAt);
      if (age == null || age <= 7) {
        const pct = (p.investability && p.investability.pct != null) ? ` · ${p.investability.pct}% investability` : '';
        return { id: `act-assess-ready-${p.id}`, type: 'assessment-ready', urgency: 'high', programId: p.id,
          title: `${p.name} assessment is ready to review`,
          detail: `The verdict is in: ${p.assessment.recommendation}${pct}. Open the verdict, review the findings, and download the deal memo.`,
          age: p.lastActivity || 'recently', cta: 'Review verdict', score: 90 };
      }
      return null; // assumed reviewed after a week — drops off the queue
    }
    if (!hasPitch) {
      return { id: `act-assess-deck-${p.id}`, type: 'assessment-deck', urgency: 'medium', programId: p.id,
        title: `Upload a deck for ${p.name}`,
        detail: 'This assessment is waiting on a pitch deck. Upload it (and any supporting docs) to run the assessment.',
        age: p.lastActivity || 'recently', cta: 'Upload deck', score: 65 };
    }
    return { id: `act-assess-go-${p.id}`, type: 'assessment-run', urgency: 'medium', programId: p.id,
      title: `Run the assessment for ${p.name}`,
      detail: 'The deck is uploaded. Run the assessment to get a score, key findings, and a verdict.',
      age: p.lastActivity || 'recently', cta: 'Run assessment', score: 70 };
  }

  // ---- 2. workflow-orchestrator ---------------------------------------
  // Produces a rank-ordered action queue for the operator across all
  // engagements they own. Same shape as the sample-data `actions[]`,
  // but computed from state instead of hard-coded.
  function computeActionQueue(programs, currentOpId) {
    const queue = [];
    const owned = programs.filter(p => p.assignedOperator === currentOpId);

    owned.forEach(p => {
      const cards = p.cards || {};
      const lastAge = parseLastActivityAge(p.lastActivity);

      // ASSESSMENT engagements have their own lifecycle (deck → run → review),
      // not the build brief/gate/cards flow — handle them and move on.
      if (p.engagementType === 'assessment') {
        const act = assessmentAction(p);
        if (act) queue.push(act);
        return;
      }

      // BRIEF overdue
      if (p.briefSubmitted === false) {
        const days = p.daysActive || 0;
        if (days >= 7) {
          queue.push({
            id: `act-brief-${p.id}`, type: 'stuck-program', urgency: 'high', programId: p.id,
            title: `${p.name} founder hasn't submitted brief in ${days} days`,
            detail: `Studio invite went out at launch. ${p.founderName || 'The founder'} hasn't filled it in. Suggest a direct nudge or jump on a call.`,
            age: `${days} days ago`, cta: 'Send nudge', score: 100 + days
          });
        } else if (days >= 3) {
          queue.push({
            id: `act-brief-${p.id}`, type: 'intake', urgency: 'medium', programId: p.id,
            title: `${p.name} brief still pending`,
            detail: `${p.founderName || 'Founder'} received the Studio invite ${days} days ago. Normal turnaround is 2-3 days — check if they need a hand.`,
            age: `${days} days ago`, cta: 'Send check-in', score: 60 + days
          });
        } else {
          queue.push({
            id: `act-brief-${p.id}`, type: 'intake', urgency: 'low', programId: p.id,
            title: `${p.name} kicked off`,
            detail: `Studio invite sent to ${p.founderEmail || 'founder'}. Brief due in next 2-3 days.`,
            age: 'recently', cta: 'Open engagement', score: 10
          });
        }
        return;
      }

      // GATE ready
      if (p.gateStatus && /ready to sign|ready to close/i.test(p.gateStatus)) {
        queue.push({
          id: `act-gate-${p.id}`, type: 'gate-ready', urgency: 'high', programId: p.id,
          title: `Gate ready to close on ${p.name}`,
          detail: p.gateStatus + '. Confirm scope and unlock the next phase.',
          age: p.lastActivity || 'recently', cta: 'Review & close gate', score: 95
        });
      }

      // CARDS awaiting operator review (research-curator drafted, operator publishes)
      if (cards.draftedAwaitingOperator) {
        queue.push({
          id: `act-cards-${p.id}`, type: 'cards-to-review', urgency: 'high', programId: p.id,
          title: `${cards.draftedAwaitingOperator} cards awaiting your review on ${p.name}`,
          detail: 'research-curator drafted new cards from L3. Review before publishing to the founder.',
          age: p.lastActivity || 'recently', cta: 'Review cards', score: 80
        });
      }

      // FOUNDER unresponsive — long-stuck cards
      if (cards.awaitingFounder > 0 && lastAge >= 9) {
        queue.push({
          id: `act-stuck-${p.id}`, type: 'stuck-program', urgency: 'high', programId: p.id,
          title: `${p.name} founder unresponsive for ${lastAge} days`,
          detail: `${cards.awaitingFounder} cards waiting on founder. Last activity ${lastAge} days ago. Recommend a nudge.`,
          age: `${lastAge} days ago`, cta: 'Send nudge', score: 85 + lastAge
        });
      } else if (cards.awaitingFounder > 0 && lastAge >= 5) {
        queue.push({
          id: `act-quiet-${p.id}`, type: 'cards-to-review', urgency: 'medium', programId: p.id,
          title: `${cards.awaitingFounder} cards quiet on ${p.name}`,
          detail: `Founder hasn't engaged for ${lastAge} days. Soft check-in suggested.`,
          age: `${lastAge} days ago`, cta: 'Check in', score: 55
        });
      }

      // L3 rebuild flagged
      if (cards.awaitingL3Rebuild) {
        queue.push({
          id: `act-l3-${p.id}`, type: 'l3-rebuild', urgency: 'low', programId: p.id,
          title: `L3 rebuild needed on ${p.name}`,
          detail: 'Cards resolved but source documents not yet refreshed.',
          age: 'recently', cta: 'Run L3 rebuild', score: 30
        });
      }
    });

    // Rank by score desc
    return queue.sort((a, b) => b.score - a.score);
  }

  // ---- 3. tier-compliance-auditor -------------------------------------
  // Returns { completedItems, expectedItems, pct } for one engagement,
  // based on the current phase's expected outputs.
  //
  // Phase 0  → Brief + Lexicon + Brand kit (3 items)
  // Phase 1  → + Research Hub (~5 cards + 1 L3 doc + Gate 1 = 7)
  // Phase 2  → + Vision + Strategy (5 + 5 cards + 2 L3 = 12 + Gate 2)
  // Phase 2.5→ + Financials (11 files + Gate 2.5)
  // Phase 4  → + Marketing site + Video + Blog + App
  // Phase 5  → + Handoff bundle
  function computeCompleteness(p) {
    if (!p) return { completedItems: 0, expectedItems: 0, pct: 0 };
    const phase = p.phase || 0;
    const cards = p.cards || { drafted: 0, awaitingFounder: 0, resolved: 0 };
    const hubs = p.hubs || {};
    const briefDone = p.briefSubmitted !== false ? 1 : 0;

    let completed = 0;
    let expected = 0;

    // Phase 0 — Foundations
    expected += 3; // brief, lexicon, brand
    completed += briefDone;
    if (hubs.lexicon && (hubs.lexicon.status === 'signed' || hubs.lexicon.status === 'in-progress')) completed += hubs.lexicon.status === 'signed' ? 1 : 0.5;
    if (hubs.brand && (hubs.brand.status === 'signed' || hubs.brand.status === 'in-progress')) completed += hubs.brand.status === 'signed' ? 1 : 0.5;

    // Phase 1 — Research Hub
    if (phase >= 1) {
      expected += 7; // 5 cards + L3 + Gate 1
      completed += Math.min(cards.resolved || 0, 5);
      if (hubs.research && hubs.research.status === 'signed') completed += 2;
    }

    // Phase 2 — Vision + Strategy
    if (phase >= 2) {
      expected += 12;
      ['vision', 'strategy'].forEach(k => {
        const h = hubs[k] || {};
        if (h.status === 'signed') completed += 6;
        else if (h.status === 'awaiting-founder' || h.status === 'ready-to-sign') completed += 3;
        else if (h.status === 'in-progress') completed += 1;
      });
    }

    // Phase 2.5 — Financials
    if (phase >= 2.5) {
      expected += 12;
      const h = hubs.financials || {};
      if (h.status === 'signed') completed += 12;
      else if (h.status === 'ready-to-sign') completed += 9;
      else if (h.status === 'awaiting-founder') completed += 6;
      else if (h.status === 'in-progress') completed += 3;
    }

    // Phase 4 — Deliverables
    if (phase >= 4) {
      expected += 14; // marketing 4, video 3, blog 4, app 3
      ['marketing', 'video', 'blog'].forEach(k => {
        const h = hubs[k] || {};
        if (h.status === 'signed') completed += 4;
        else if (h.status === 'in-progress') completed += 2;
      });
    }

    // Phase 5 — Handoff
    if (phase >= 5) {
      expected += 4;
      completed += p.mvpDemoModeReady ? 4 : 2;
    }

    const pct = expected === 0 ? 0 : Math.round((completed / expected) * 100);
    return { completedItems: Math.round(completed), expectedItems: expected, pct };
  }

  // Aggregate completeness across a list of engagements (e.g., the operator's portfolio)
  function computePortfolioCompleteness(programs) {
    if (!programs || !programs.length) return { pct: 0, items: 0, of: 0 };
    const totals = programs.map(computeCompleteness);
    const items = totals.reduce((a, t) => a + t.completedItems, 0);
    const of = totals.reduce((a, t) => a + t.expectedItems, 0);
    return { pct: of === 0 ? 0 : Math.round((items / of) * 100), items, of };
  }

  // ---- Expose --------------------------------------------------------
  window.WORKSPACE_AGENTS = {
    computeEngagementHealth,
    computeActionQueue,
    computeCompleteness,
    computePortfolioCompleteness
  };
})();
