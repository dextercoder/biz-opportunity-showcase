// assets/charts.js — ECharts：线索规则构成 + 机会卡评分 + 企业邻域图谱
(function () {
  var style = getComputedStyle(document.documentElement);
  function css(name) { return style.getPropertyValue(name).trim(); }

  var accent = css('--accent');
  var accent2 = css('--accent2');
  var ink = css('--ink');
  var muted = css('--muted');
  var rule = css('--rule');
  var bg2 = css('--bg2');

  var axisFont = '"Instrument Sans", "PingFang SC", "Microsoft YaHei", sans-serif';
  var monoFont = '"IBM Plex Mono", monospace';

  var TYPE_CN = {
    Enterprise: '企业', Project: '项目', Policy: '政策', SpecialBond: '专项债',
    IndustryTrack: '赛道', Event: '事件', Asset: '设备资产', Order: '历史订单',
    BomItem: 'BOM 物料', Standard: '强制标准'
  };
  var TYPE_COLOR = {
    Enterprise: css('--c-enterprise'), Project: css('--c-project'), Policy: css('--c-policy'),
    SpecialBond: css('--c-bond'), IndustryTrack: css('--c-track'), Event: css('--c-event'),
    Asset: '#6B5B95', Order: '#3A6EA5', BomItem: '#8A6D3B', Standard: '#55606A'
  };
  var ATTR_CN = {
    region: '注册地 / 所在区域',
    service_regions: '服务区域',
    qualifications: '持有资质',
    require_qualifications: '要求资质',
    apply_regions: '适用区域',
    use_regions: '使用区域'
  };

  var tooltipBase = {
    trigger: 'item',
    appendToBody: true,
    backgroundColor: bg2,
    borderColor: rule,
    textStyle: { color: ink, fontFamily: axisFont, fontSize: 12 }
  };

  // ---------- Chart 1: 线索的规则构成 ----------
  var rulesEl = document.getElementById('chart-rules');
  var chartRules = rulesEl ? echarts.init(rulesEl, null, { renderer: 'svg' }) : null;

  function renderRules(stats) {
    if (!chartRules) return;
    var rows = (stats || []).slice();
    var max = rows.reduce(function (m, r) { return Math.max(m, r.count); }, 0);
    chartRules.setOption({
      animation: false,
      grid: { left: 186, right: 46, top: 14, bottom: 14, containLabel: false },
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: bg2,
        borderColor: rule,
        textStyle: { color: ink, fontFamily: axisFont, fontSize: 12 },
        formatter: function (p) {
          var level = p.data.level === 'soft' ? '软信号' : '需探查';
          return p.name + '<br/>命中 ' + p.value + ' 条 · ' + level;
        }
      },
      xAxis: {
        type: 'value',
        max: Math.max(4, max + 1),
        splitLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted, fontFamily: axisFont, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map(function (r) { return r.desc || r.rule_id; }),
        axisLabel: { color: ink, fontFamily: axisFont, fontSize: 10.5 },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        barWidth: 13,
        itemStyle: { borderRadius: [0, 2, 2, 0] },
        label: { show: true, position: 'right', color: muted, fontFamily: axisFont, fontSize: 11 },
        data: rows.map(function (r) {
          return {
            value: r.count,
            level: r.level,
            desc: r.desc,
            itemStyle: { color: r.level === 'soft' ? accent : accent2 }
          };
        })
      }]
    }, true);
  }

  // ---------- Chart 2: 机会卡评分 ----------
  var cardsEl = document.getElementById('chart-cards');
  var chartCards = cardsEl ? echarts.init(cardsEl, null, { renderer: 'svg' }) : null;

  function shortName(card) {
    var t = String(card.title).split('（')[0];
    return 'R' + card.rank + ' ' + (t.length > 12 ? t.slice(0, 12) + '…' : t);
  }

  function renderCards(cards) {
    if (!chartCards) return;
    var rows = (cards || []).slice();
    chartCards.setOption({
      animation: false,
      grid: { left: 172, right: 46, top: 14, bottom: 14, containLabel: false },
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: bg2,
        borderColor: rule,
        textStyle: { color: ink, fontFamily: axisFont, fontSize: 12 },
        formatter: function (p) {
          return p.data.full + '<br/>score ' + p.value + ' · ' + p.data.tier + ' 级 · 证据 ' + p.data.evidence + ' 条';
        }
      },
      xAxis: {
        type: 'value',
        max: 100,
        splitLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted, fontFamily: axisFont, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: rows.map(shortName),
        axisLabel: { color: ink, fontFamily: axisFont, fontSize: 10.5 },
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false }
      },
      series: [{
        type: 'bar',
        barWidth: 15,
        itemStyle: { borderRadius: [0, 2, 2, 0] },
        label: { show: true, position: 'right', color: muted, fontFamily: axisFont, fontSize: 11, fontWeight: 700 },
        data: rows.map(function (c) {
          return {
            value: c.score,
            tier: c.tier,
            full: c.title,
            evidence: c.evidence_count,
            itemStyle: { color: c.tier === 'A' ? accent : (c.tier === 'B' ? accent2 : muted) }
          };
        })
      }]
    }, true);
  }

  // ---------- Chart 3: 企业 2 跳邻域图谱 ----------
  var graphEl = document.getElementById('chart-graph');
  var panelTitle = document.getElementById('graph-panel-title');
  var panelType = document.getElementById('graph-panel-type');
  var panelBody = document.getElementById('graph-panel-body');
  var resetBtn = document.getElementById('graph-reset');

  var GD = window.__DISPLAY_GRAPH__ || { nodes: [], edges: [] };
  var nodeById = {};
  var nameOf = {};
  GD.nodes.forEach(function (n) { nodeById[n.id] = n; nameOf[n.id] = n.label; });
  var adj = {};
  GD.edges.forEach(function (e) {
    (adj[e.from] = adj[e.from] || []).push(e);
    (adj[e.to] = adj[e.to] || []).push(e);
  });

  var chartGraph = graphEl ? echarts.init(graphEl, null, { renderer: 'svg' }) : null;
  var current = { nodes: [], edges: [] };
  var defaultPanel = '<p class="p-hint">点击左侧图谱中的任意节点，这里会列出它的全部关系路径。</p>';

  function neighborhood(rootId) {
    var keep = {};
    keep[rootId] = true;
    var frontier = [rootId];
    // 区域/资质已降级为属性，3 跳正好覆盖 企业 → 能力赛道 → 需求赛道 → 项目/政策/专项债
    for (var depth = 0; depth < 3; depth++) {
      var next = [];
      frontier.forEach(function (id) {
        (adj[id] || []).forEach(function (e) {
          var other = e.from === id ? e.to : e.from;
          if (keep[other]) return;
          keep[other] = true;
          // 竞对与事件只作为端点展示，不再向外扩散，避免图被其他企业的业务域淹没
          var type = nodeById[other] && nodeById[other].ntype;
          if (type !== 'Enterprise' && type !== 'Event') next.push(other);
        });
      });
      frontier = next;
    }
    var nodes = GD.nodes.filter(function (n) { return keep[n.id]; });
    var edges = GD.edges.filter(function (e) { return keep[e.from] && keep[e.to]; });
    return { nodes: nodes, edges: edges };
  }

  function fillPanel(node) {
    var outs = [], ins = [];
    current.edges.forEach(function (e) {
      if (e.from === node.id) outs.push(e);
      if (e.to === node.id) ins.push(e);
    });
    panelTitle.textContent = node.name;
    panelType.style.display = '';
    panelType.textContent = TYPE_CN[node.ntype] || node.ntype;
    panelType.style.background = TYPE_COLOR[node.ntype] || muted;
    panelType.style.color = bg2;
    panelType.style.border = 'none';

    var html = '<p class="p-count">' + (outs.length + ins.length) + ' 条关系（出 ' + outs.length + ' · 入 ' + ins.length + '）</p>';
    if (outs.length) {
      html += '<p class="link-group">OUT ▸ 由该节点出发</p><ul class="link-list">';
      outs.forEach(function (e) {
        html += '<li><span class="rel">' + e.rel + '</span> → <b>' + nameOf[e.to] + '</b>' +
          (e.weight != null ? ' · w ' + e.weight : '') +
          (e.desc ? '<br/>' + e.desc : '') + '</li>';
      });
      html += '</ul>';
    }
    if (ins.length) {
      html += '<p class="link-group">◂ IN 指向该节点</p><ul class="link-list">';
      ins.forEach(function (e) {
        html += '<li><span class="rel">' + e.rel + '</span> ← <b>' + nameOf[e.from] + '</b>' +
          (e.weight != null ? ' · w ' + e.weight : '') +
          (e.desc ? '<br/>' + e.desc : '') + '</li>';
      });
      html += '</ul>';
    }
    var attrKeys = Object.keys(node.attrs || {});
    if (attrKeys.length) {
      html += '<p class="link-group">ATTR ▸ 维度属性（不参与路径）</p><ul class="attr-list">';
      attrKeys.forEach(function (k) {
        html += '<li><span>' + (ATTR_CN[k] || k) + '</span><b>' +
          node.attrs[k].join('、') + '</b></li>';
      });
      html += '</ul>';
    }
    panelBody.innerHTML = html;
    panelBody.scrollTop = 0;
  }

  function resetPanel(ent) {
    if (chartGraph) chartGraph.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    panelTitle.textContent = '节点详情';
    panelType.style.display = 'none';
    panelBody.innerHTML = defaultPanel + (ent
      ? '<p class="p-hint">当前视图：<b>' + ent.short + '</b> 的 3 跳业务邻域（' +
        current.nodes.length + ' 个节点 / ' + current.edges.length + ' 条关系，区域/资质已折叠为属性）。</p>'
      : '');
  }

  function renderGraph(ent) {
    if (!chartGraph) return;
    var rootId = 'Enterprise:' + ent.id;
    var sub = neighborhood(rootId);
    current = sub;

    var degree = {};
    sub.edges.forEach(function (e) {
      degree[e.from] = (degree[e.from] || 0) + 1;
      degree[e.to] = (degree[e.to] || 0) + 1;
    });

    chartGraph.setOption({
      animation: false,
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        backgroundColor: bg2,
        borderColor: rule,
        textStyle: { color: ink, fontFamily: axisFont, fontSize: 12 },
        formatter: function (p) {
          if (p.dataType === 'edge') {
            var line = nameOf[p.data.source] + ' <span style="color:' + accent2 + '">' +
              p.data.rel + '</span> ' + nameOf[p.data.target];
            var w = p.data.weight != null ? '<br/>权重 ' + p.data.weight : '';
            var d = p.data.desc ? '<br/>' + p.data.desc : '';
            return line + w + d;
          }
          return '<b>' + p.name + '</b><br/>' + (TYPE_CN[p.data.ntype] || p.data.ntype);
        }
      },
      series: [{
        type: 'graph',
        layout: 'force',
        force: { repulsion: 620, edgeLength: 120, gravity: 0.07 },
        roam: true,
        draggable: true,
        labelLayout: { hideOverlap: true },
        data: sub.nodes.map(function (n) {
          var isRoot = n.id === rootId;
          var showLabel = ['Enterprise', 'Project', 'IndustryTrack'].indexOf(n.ntype) >= 0;
          var maxLen = n.ntype === 'Enterprise' ? 16 : (n.ntype === 'Project' ? 13 : 12);
          var text = n.label.length > maxLen ? n.label.slice(0, maxLen) + '…' : n.label;
          return {
            id: n.id,
            name: n.label,
            ntype: n.ntype,
            attrs: n.attrs || {},
            symbolSize: Math.min(44, 9 + (degree[n.id] || 0) * 2.2 + (isRoot ? 8 : 0)),
            itemStyle: {
              color: TYPE_COLOR[n.ntype] || muted,
              borderColor: isRoot ? accent2 : 'transparent',
              borderWidth: isRoot ? 2.5 : 0
            },
            label: {
              show: showLabel,
              formatter: text,
              position: 'right',
              distance: 5,
              fontSize: isRoot ? 11 : 9.5,
              fontWeight: isRoot ? 700 : 400,
              color: ink,
              fontFamily: axisFont
            }
          };
        }),
        links: sub.edges.map(function (e) {
          return {
            source: e.from,
            target: e.to,
            rel: e.rel,
            weight: e.weight,
            desc: e.desc,
            lineStyle: { color: rule, width: 1, curveness: 0.12 }
          };
        }),
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 5,
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 2.4, color: accent2 },
          label: { show: true, fontWeight: 700 }
        },
        blur: {
          itemStyle: { opacity: 0.06 },
          label: { opacity: 0.05 },
          lineStyle: { opacity: 0.04 }
        }
      }]
    }, true);

    resetPanel(ent);
  }

  if (chartGraph) {
    chartGraph.on('click', function (p) {
      if (p.dataType === 'node') {
        chartGraph.dispatchAction({ type: 'downplay', seriesIndex: 0 });
        chartGraph.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: p.dataIndex });
        fillPanel(p.data);
      }
    });
    chartGraph.getZr().on('click', function (e) {
      if (!e.target) resetPanel();
    });
    if (resetBtn) resetBtn.addEventListener('click', function () { resetPanel(); });
  }

  window.addEventListener('resize', function () {
    [chartRules, chartCards, chartGraph].forEach(function (c) { if (c) c.resize(); });
  });

  window.BoardCharts = {
    render: function (ent) {
      renderRules(ent.rule_stats);
      renderCards(ent.displayed);
      renderGraph(ent);
    }
  };
})();
