// assets/ui.js — 企业选择器 + 数据驱动渲染（KPI / 商机卡 / 汇总表 / 行动优先级）
(function () {
  var D = window.__BOARD_DATA__;
  if (!D || !D.enterprises || !D.enterprises.length) return;

  var el = function (id) { return document.getElementById(id); };
  var ents = D.enterprises;
  var defaultId = D.default_enterprise;
  var state = { id: ents.filter(function (e) { return e.id === defaultId; }).length ? defaultId : ents[0].id, filter: 'all', bt: '', region: '', qual: '' };

  var CAT_CN = D.category_cn || { explicit: '显性', implicit: '隐式', recurring: '存量复购' };
  var BT_LABEL = {};   // business_type → { name, cat }
  ents.forEach(function (e) {
    (e.bt_distribution || []).forEach(function (d) {
      BT_LABEL[d.business_type] = { name: d.bt_name, cat: d.bt_category };
    });
    (e.displayed || []).concat(e.vetoed || []).forEach(function (c) {
      BT_LABEL[c.business_type] = { name: c.bt_name, cat: c.bt_category };
    });
  });

  function btTag(c) {
    var bt = BT_LABEL[c.business_type] || { name: c.business_type, cat: '' };
    return '<span class="bt-tag ' + (bt.cat || '') + '">' + bt.name + '</span>' +
      '<span class="bt-cat">' + (CAT_CN[bt.cat] || bt.cat || '') + '</span>';
  }

  function verifyBadge(c) {
    var st = c.verify_status || 'unverified';
    var txt = { verified: '已核验', partial: '部分核验', unverified: '待核验', skipped: '未送检', rejected: '已否决' }[st] || st;
    var conf = c.verify_confidence ? ' ' + Math.round(c.verify_confidence * 100) + '%' : '';
    return '<span class="badge verify-' + st + '" title="' + (c.verify_note || '') + '">' + txt + conf + '</span>';
  }

  function verdictCn(v) {
    return { agree: '一致', conflict: '冲突', missing: '未核实' }[v] || v;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  // 研究证据抽屉：字段级结论 + 可回溯来源 + 冲突与缺口
  function researchHtml(c) {
    var fvs = c.field_verdicts || [];
    var evs = c.evidence_sources || [];
    if (!fvs.length && !evs.length) return '';
    var rows = fvs.map(function (v) {
      var val = v.verdict === 'conflict' ? '<span class="fv-conflict">口径冲突</span>' : esc(v.value || '—');
      var pub = (v.values || []).map(function (x) {
        return esc(x.publisher || '—') + ' <span class="lv lv-' + (x.level || '') + '">' + (x.level || '') + '</span>';
      }).join('<br>');
      return '<tr class="fv-' + v.verdict + '"><td>' + esc(v.label) + '</td><td>' + val +
        '</td><td>' + verdictCn(v.verdict) + '</td><td>' + pub + '</td></tr>';
    }).join('');
    var evsHtml = evs.map(function (e) {
      var href = e.snapshot_url || '#';
      return '<li><span class="lv lv-' + (e.source_level || '') + '">' + (e.source_level || '') + '</span> ' +
        '<a href="' + href + '" target="_blank" rel="noopener">' + esc(e.title || e.doc_id) + '</a>' +
        '<span class="pub">' + esc(e.publisher || '') + (e.published_at ? ' · ' + esc(e.published_at) : '') + '</span>' +
        (e.quote ? '<div class="quote">“' + esc(e.quote) + '”</div>' : '') + '</li>';
    }).join('');
    var conflicts = (c.conflicts || []).map(function (x) {
      return '<span class="conflict-chip">⚠ ' + esc(x.label) + '：' +
        (x.values || []).map(function (v) { return esc(v.publisher) + '=' + esc(v.value); }).join(' / ') +
        '</span>';
    }).join('');
    var risks = (c.research_risks || []).map(function (r) {
      return '<span class="risk-chip">' + esc(r) + '</span>';
    }).join('');
    var gaps = (c.research_gaps || []).slice(0, 4).map(function (g) {
      return '<span class="gap-chip">' + esc(g) + '</span>';
    }).join('');
    var delta = c.score_delta
      ? '<span class="delta ' + (c.score_delta > 0 ? 'pos' : 'neg') + '">修正 ' +
        (c.score_delta > 0 ? '+' : '') + c.score_delta + '</span>'
      : '';
    return '<details class="research">' +
      '<summary>研究证据 · 置信 ' + Math.round((c.verify_confidence || 0) * 100) + '%' +
      ' · 来源 ' + evs.length + ' 条 ' + delta + '</summary>' +
      (rows ? '<table class="fv-table"><caption>字段级核验结论</caption><thead><tr><th>核查项</th><th>核验值</th><th>结论</th><th>来源</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      (evsHtml ? '<ul class="evidence-list">' + evsHtml + '</ul>' : '') +
      (conflicts || risks || gaps ? '<div class="research-flags">' + conflicts + risks + gaps + '</div>' : '') +
      '</details>';
  }

  function factorRow(c) {
    var fs = c.factors || [];
    if (!fs.length) return '';
    var chipsHtml = fs.map(function (f) {
      var pos = f.weight >= 0;
      var label = (f.desc || f.id || '').split(/[，,。；;]/)[0];
      return '<span class="f-chip ' + (pos ? 'pos' : 'neg') + '" title="' + (f.desc || '') + '">' +
        (pos ? '+' : '') + f.weight + ' · ' + esc(label) + '</span>';
    }).join('');
    return '<div class="factor-row"><span class="f-label">因子明细</span>' + chipsHtml +
      '<span class="raw-line">final <b>' + c.score + '</b>' +
      (c.score_delta ? ' · 核验修正 <span class="delta ' + (c.score_delta > 0 ? 'pos' : 'neg') + '">' +
        (c.score_delta > 0 ? '+' : '') + c.score_delta + '</span>' : '') +
      '</span></div>';
  }

  function bomHtml(c) {
    var rows = c.bom_table;
    if (!rows || !rows.length) return '';
    var matched = {};
    (c.matched_items || []).forEach(function (m) {
      var k = m && typeof m === 'object' ? (m.item_id || m.name) : (Array.isArray(m) ? m[0] : m);
      if (k) matched[k] = true;
    });
    var trs = rows.map(function (it) {
      var hit = matched[it.item_id] || matched[it.name];
      return '<tr><td>' + it.name + '</td>' +
        '<td>' + (it.item_type || '') + '</td>' +
        '<td>' + (it.quantity || '—') + '</td>' +
        '<td>' + (it.align_tracks || '—') + '</td>' +
        '<td class="' + (hit ? 'hit' : '') + '">' + (hit ? '✓ 我方可承接' : '—') + '</td></tr>';
    }).join('');
    var total = rows.reduce(function (s, it) { return s + (it.est_amount || 0); }, 0);
    return '<table class="bom-table"><caption>BOM 拆解 · ' + rows.length + ' 项 · 估算合计 ' + fmtAmt(total) +
      '</caption><thead><tr><th>物料 / 服务</th><th>类型</th><th>数量</th><th>对齐赛道</th><th>承接</th></tr></thead>' +
      '<tbody>' + trs + '</tbody></table>';
  }

  function current() {
    for (var i = 0; i < ents.length; i++) if (ents[i].id === state.id) return ents[i];
    return ents[0];
  }

  function fmtAmt(v) {
    if (!v) return '—';
    if (v >= 1e8) return (v / 1e8).toFixed(2).replace(/\.?0+$/, '') + ' 亿';
    if (v >= 1e4) return Math.round(v / 1e4) + ' 万';
    return v + ' 元';
  }

  function chips(list) {
    return '<div class="filters" role="group">' + list.map(function (g) {
      return '<button class="chip" data-group="' + g.key + '" aria-pressed="' +
        (g.key === state.filter) + '">' + g.label + '<span class="n">' + g.count + '</span></button>';
    }).join('') + '</div>';
  }

  // ---------- 企业选择 ----------
  function renderSwitch() {
    el('ent-switch').innerHTML = ents.map(function (e) {
      return '<button class="ent-chip" data-eid="' + e.id + '" aria-pressed="' + (e.id === state.id) + '">' +
        '<b>' + e.short + '</b><span>' + e.id + ' · ' + e.main_business + '</span></button>';
    }).join('');
  }

  // ---------- KPI / 文案 ----------
  function renderHeader(e) {
    var g = D.graph;
    var s = e.summary;
    var t = e.tier_stats;
    el('hero-sub').textContent = e.name + ' · ' + e.total_hits + ' 条规则路径线索归堆为 ' +
      e.total_cards + ' 张商机卡，本页展示 Top ' + s.displayed;
    el('meta-ent').textContent = e.name + '（' + e.id + '）';
    el('meta-graph').textContent = g.nodes + ' 节点 / ' + g.edges + ' 条关系';

    el('kpi-hits').innerHTML = e.total_hits + '<span class="unit">条</span>';
    el('kpi-cards').innerHTML = e.total_cards + '<span class="unit">张</span>';
    el('kpi-a').innerHTML = t.A + '<span class="unit">张</span>';
    el('kpi-budget').innerHTML = t.V + '<span class="unit">张</span>';
  }

  function renderOverview(e) {
    var g = D.graph;
    var s = e.summary;
    var t = e.tier_stats;
    var v = e.verify_stats;
    el('overview-cap').textContent = e.total_hits + ' 条线索 → ' + e.total_cards + ' 张卡 → Top ' + s.displayed;
    el('lede').innerHTML = '图谱按案例精简为 <b>' + g.demand_used + ' 个需求赛道 + ' +
      g.supply_used + ' 个供给赛道</b>（赛道本体精简后共 ' + g.demand_total + ' + ' + g.supply_total +
      ' 个节点，其余已裁剪）。' +
      '规则引擎为 <b>' + e.name + '</b> 命中 <b>' + e.total_hits + ' 条线索</b>，按「企业 × 商机类型 × 归堆目标」归堆为 <b>' +
      e.total_cards + ' 张商机卡</b>：A 级 ' + t.A + ' 张 / B 级 ' + t.B + ' 张 / C 级 ' + t.C +
      ' 张 / 强否决 ' + t.V + ' 张；其中 ' + e.live_cards + ' 张进入推送池，' +
      (e.filtered_cards || 0) + ' 张因低分过滤。Deep Research 已核验 ' + v.verified +
      ' 张、部分核验 ' + v.partial + ' 张、待核验 ' + v.unverified + ' 张。本页展示 <b>Top ' + s.displayed + '</b>。';
    el('cap-rules').textContent = e.total_hits + ' 条 / 按规则类别统计';
    el('cap-cards').textContent = '综合评分 / 按级别着色';

    var best = e.displayed[0];
    if (best) {
      var vtxt = best.verify_status === 'verified'
        ? '证据链已核验（置信 ' + Math.round((best.verify_confidence || 0) * 100) + '%）'
        : (best.verify_status === 'partial' ? '部分核验，建议人工复核' : '暂无外部佐证');
      el('callout').innerHTML = '<b>关键判断：</b>' + e.short + ' 当前确定性最高的机会是 R' +
        best.rank + '「' + best.title + '」（' + best.bt_name + ' · 分数 ' + best.score +
        ' · ' + best.tier + ' 级 · ' + vtxt + '）：' + best.action + '。' + (best.gaps.length
          ? '主要缺口 / 风险：' + best.gaps.join('；') + '。'
          : '能力、资质、区域均无缺口。');
    } else {
      el('callout').innerHTML = '<b>关键判断：</b>当前企业没有命中任何商机卡。';
    }
  }

  // ---------- 机会卡 ----------
  function chainHtml(path) {
    if (!path || !path.length) return '';
    var parts = ['<span class="chain"><span class="node">' + esc(path[0].label) + '</span>'];
    for (var i = 1; i < path.length; i++) {
      var s = path[i];
      parts.push('<em>' + (s.dir === 'in' ? '←' + s.rel + '—' : '—' + s.rel + '→') + '</em>');
      parts.push('<span class="node">' + esc(s.label) + '</span>');
    }
    parts.push('</span>');
    return parts.join(' ');
  }

  function cardHtml(c) {
    var tierCls = c.tier === 'A' ? 'tier-a' : (c.tier === 'B' ? 'tier-b' : 'tier-c');
    var oppCls = c.tier === 'A' ? '' : (c.tier === 'B' ? ' tier-b' : ' tier-c');
    var ev = (c.evidence || []).map(function (x) {
      return '<li>' + x.summary + chainHtml(x.path) + '</li>';
    }).join('');
    var more = c.evidence_count > (c.evidence || []).length
      ? '<p class="more-evidence">另有 ' + (c.evidence_count - c.evidence.length) + ' 条同类证据</p>'
      : '';
    var gaps;
    if (c.gaps && c.gaps.length) {
      gaps = c.gaps.map(function (g) { return '<span class="gap-chip">' + g + '</span>'; }).join('');
    } else {
      gaps = '<span class="gap-chip ok">' + (c.type === 'project' ? '无缺口 · 可直接行动' : '背景信号 · 无缺口') + '</span>';
    }
    return '<div class="opp' + oppCls + '">' +
      '<div class="opp-top">' +
        '<span class="opp-rank">R' + c.rank + '</span>' +
        btTag(c) +
        (c.region ? '<span class="region-chip">' + c.region + '</span>' : '') +
        '<span class="badge ' + tierCls + '">' + c.tier + ' 级</span>' +
        verifyBadge(c) +
        '<h3>' + c.title + '</h3>' +
        '<span class="opp-score">分数 <b>' + c.score + '</b>' +
          (c.amount ? ' · 规模 ' + fmtAmt(c.amount) : '') +
          ' · 证据 ' + c.evidence_count + ' 条</span>' +
      '</div>' +
      factorRow(c) +
      researchHtml(c) +
      bomHtml(c) +
      '<ul class="hits">' + ev + '</ul>' + more +
      '<div class="gaps">' + gaps + '</div>' +
      '<div class="action-line"><span class="tag">建议</span>' + c.action + '</div>' +
    '</div>';
  }

  function vetoCardHtml(c) {
    var ev = (c.evidence || []).map(function (x) {
      return '<li>' + x.summary + chainHtml(x.path) + '</li>';
    }).join('');
    return '<div class="veto-card">' +
      '<div class="opp-top">' +
        '<span class="opp-rank">强否决</span>' +
        btTag(c) +
        '<span class="badge tier-v">V 级 · 强否决</span>' +
        verifyBadge(c) +
        '<h3>' + c.title + '</h3>' +
        '<span class="opp-score">final <b>0</b> · 不推送</span>' +
      '</div>' +
      (c.veto_reasons || []).map(function (r) {
        return '<span class="veto-reason">⛔ ' + r + '</span>';
      }).join('') +
      '<ul class="hits">' + ev + '</ul>' +
      '<div class="action-line"><span class="tag">建议</span>' + c.action + '</div>' +
    '</div>';
  }

  function renderCards(e) {
    el('cards-cap').textContent = '按综合评分排序 · 共 ' + e.total_cards + ' 张，推送池 ' +
      e.live_cards + ' 张（低于阈值过滤 ' + (e.filtered_cards || 0) + ' 张），展示 ' +
      e.displayed.length + ' 张；强否决 ' + e.vetoed.length + ' 张单列于下';
    el('cards-host').innerHTML = e.displayed.map(cardHtml).join('') +
      (e.vetoed || []).map(vetoCardHtml).join('');
    el('cards-note').textContent = e.omitted_cards
      ? '另有 ' + e.omitted_cards + ' 张低分卡未展示。'
      : '';
  }

  // ---------- 汇总表 ----------
  function btName(c) {
    return (BT_LABEL[c.business_type] || {}).name || c.business_type;
  }

  function tableRow(c) {
    var group = c.tier === 'A' ? 'a' : 'bc';
    var tierCls = c.tier === 'A' ? 'tier-a' : (c.tier === 'B' ? 'tier-b' : 'tier-c');
    var vst = c.verify_status || 'unverified';
    return '<tr data-group="' + group + '">' +
      '<td class="no">R' + c.rank + '</td>' +
      '<td>' + c.title + '</td>' +
      '<td class="obj">' + btName(c) + '</td>' +
      '<td class="obj">' + (c.region || '—') + '</td>' +
      '<td><span class="badge ' + tierCls + '">' + c.tier + '</span></td>' +
      '<td class="rule">' + c.score + '</td>' +
      '<td class="obj"><span class="badge verify-' + vst + '">' +
        ({ verified: '已核验', partial: '部分核验', unverified: '待核验', skipped: '未送检' }[vst] || vst) +
        (c.verify_confidence ? ' ' + Math.round(c.verify_confidence * 100) + '%' : '') + '</span></td>' +
      '<td class="obj ev">' + c.evidence_count + ' 条</td>' +
      '<td class="obj">' + (c.gaps && c.gaps.length ? c.gaps.join('；') : '—') + '</td>' +
      '<td>' + c.action + '</td>' +
    '</tr>';
  }

  function renderFacets(e) {
    var regions = [], quals = [], bts = [];
    e.displayed.forEach(function (c) {
      if (c.business_type && bts.indexOf(c.business_type) < 0) bts.push(c.business_type);
      if (c.type !== 'project') return;
      if (c.region && regions.indexOf(c.region) < 0) regions.push(c.region);
      (c.require_quals || []).forEach(function (q) {
        if (quals.indexOf(q) < 0) quals.push(q);
      });
    });
    var html = '';
    if (bts.length > 1) {
      html += '<label class="facet">商机类型<select id="facet-bt">' +
        '<option value="">全部</option>' +
        bts.map(function (b) {
          return '<option value="' + b + '"' + (b === state.bt ? ' selected' : '') + '>' +
            esc(btName({ business_type: b })) + '</option>';
        }).join('') + '</select></label>';
    }
    if (regions.length) {
      html += '<label class="facet">区域<select id="facet-region">' +
        '<option value="">全部</option>' +
        regions.map(function (r) {
          return '<option value="' + r + '"' + (r === state.region ? ' selected' : '') + '>' + r + '</option>';
        }).join('') + '</select></label>';
    }
    if (quals.length) {
      html += '<label class="facet">项目要求资质<select id="facet-qual">' +
        '<option value="">全部</option>' +
        quals.map(function (q) {
          return '<option value="' + q + '"' + (q === state.qual ? ' selected' : '') + '>' + q + '</option>';
        }).join('') + '</select></label>';
    }
    el('facet-bar').innerHTML = html;
    var btSel = el('facet-bt');
    var regionSel = el('facet-region');
    var qualSel = el('facet-qual');
    if (btSel) btSel.addEventListener('change', function () {
      state.bt = btSel.value;
      renderTable(current());
    });
    if (regionSel) regionSel.addEventListener('change', function () {
      state.region = regionSel.value;
      renderTable(current());
    });
    if (qualSel) qualSel.addEventListener('change', function () {
      state.qual = qualSel.value;
      renderTable(current());
    });
  }

  function renderTable(e) {
    var a = e.displayed.filter(function (c) { return c.tier === 'A'; }).length;
    el('filter-bar').innerHTML = chips([
      { key: 'all', label: '全部', count: e.displayed.length },
      { key: 'a', label: 'A 级项目机会', count: a },
      { key: 'bc', label: 'B / C 级与背景信号', count: e.displayed.length - a }
    ]);
    var rows = e.displayed.filter(function (c) {
      var okTier = state.filter === 'all' || (state.filter === 'a' ? c.tier === 'A' : c.tier !== 'A');
      var okBt = !state.bt || c.business_type === state.bt;
      var okRegion = !state.region || c.region === state.region;
      var okQual = !state.qual || (c.require_quals || []).indexOf(state.qual) >= 0;
      return okTier && okBt && okRegion && okQual;
    });
    el('table-body').innerHTML = rows.length
      ? rows.map(tableRow).join('')
      : '<tr><td colspan="10" class="obj">当前筛选下没有商机卡</td></tr>';
    bindChips();
  }

  function bindChips() {
    var list = el('filter-bar').querySelectorAll('.chip');
    list.forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.filter = chip.getAttribute('data-group');
        renderTable(current());
      });
    });
  }

  // ---------- 行动优先级 ----------
  function renderPriority(e) {
    var top = e.displayed.slice(0, 4);
    el('prio-host').innerHTML = top.map(function (c) {
      var first = c.evidence && c.evidence[0] ? c.evidence[0].summary : '';
      return '<li><div>' +
        '<b>R' + c.rank + ' [' + btName(c) + '] ' + c.title + ' · ' + c.action + '</b>' +
        '<span>' + (first ? first + '。' : '') +
          '（分数 ' + c.score + ' · ' + c.tier + ' 级 · ' + (c.verify_status === 'verified' ? '已核验' : '部分核验') +
          ' · 证据 ' + c.evidence_count + ' 条）</span>' +
      '</div></li>';
    }).join('');
  }

  // ---------- 图谱说明 / 页脚 ----------
  function renderGraphText(e) {
    var g = D.graph;
    el('graph-lede').innerHTML = '当前按所选企业过滤为 <b>3 跳业务邻域</b>：企业 → 能力赛道 → 需求赛道 → ' +
      '项目 / 政策 / 专项债（竞对与事件只作端点，不再向外扩散）。节点大小按连接数缩放。' +
      '<b>点击任意节点</b>高亮其邻居，右侧面板列出全部关系路径（方向 · 关系类型 · 权重）与维度属性；' +
      '点击空白处或「重置视图」恢复。' +
      '<br/><span class="mono">本体：' + g.demand_used + ' 需求赛道 + ' + g.supply_used +
      ' 供给赛道｜展示图：' + g.nodes + ' 节点 / ' + g.edges + ' 条关系（区域 / 资质已折叠为属性）</span>';
    el('foot-scale').textContent = g.demand_used + ' 需求赛道 + ' + g.supply_used +
      ' 供给赛道、' + g.nodes + ' 节点 / ' + g.edges + ' 条关系';
    el('foot-ent').textContent = e.name + '（' + e.id + '）';
  }

  // ---------- 总渲染 ----------
  function render() {
    var e = current();
    renderSwitch();
    renderHeader(e);
    renderOverview(e);
    renderCards(e);
    renderTable(e);
    renderFacets(e);
    renderPriority(e);
    renderGraphText(e);
    if (window.BoardCharts) window.BoardCharts.render(e);
  }

  el('ent-switch').addEventListener('click', function (ev) {
    var btn = ev.target.closest('.ent-chip');
    if (!btn) return;
    state.id = btn.getAttribute('data-eid');
    state.filter = 'all';
    state.bt = '';
    state.region = '';
    state.qual = '';
    render();
  });

  render();
})();
