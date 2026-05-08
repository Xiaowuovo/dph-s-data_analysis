// static/js/pages/rfm_analysis.js  — complete implementation
class RFMAnalysisModule {
    constructor() {
        this.rfmData = {};
        this._charts = {};
    }

    async init() {
        try {
            this.setupRFMControls();
            this.initRFMEventListeners();
            await this.loadRFMData();
        } catch (error) {
            console.error('RFM模块初始化失败:', error);
            this.showError('RFM分析初始化失败: ' + error.message);
        }
    }

    /* ── UI helpers ── */
    showLoading(msg) {
        ['rfm-matrix','rfm-segments','rfm-trends','rfm-comparison'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#999"><i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>${msg || '加载中...'}</div>`;
        });
    }
    hideLoading() {}
    showError(msg) {
        ['rfm-matrix','rfm-segments','rfm-trends','rfm-comparison'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#e74c3c"><i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>${msg}</div>`;
        });
    }

    /* ── controls panel ── */
    setupRFMControls() {
        const controls = document.getElementById('rfm-controls');
        if (!controls) return;
        controls.innerHTML = `
        <div class="control-section" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 0">
            <div class="control-group" style="display:flex;align-items:center;gap:8px">
                <label style="white-space:nowrap;font-size:13px">分析周期</label>
                <select id="rfm-days" class="form-control" style="width:120px">
                    <option value="30">近30天</option>
                    <option value="90" selected>近90天</option>
                    <option value="180">近180天</option>
                    <option value="0">全量</option>
                </select>
            </div>
            <button id="generate-rfm" class="btn btn-primary" style="white-space:nowrap">
                <i class="fas fa-sync-alt"></i> 刷新分析
            </button>
            <button id="export-rfm" class="btn btn-secondary" style="white-space:nowrap">
                <i class="fas fa-download"></i> 导出报告
            </button>
        </div>`;
    }

    initRFMEventListeners() {
        document.addEventListener('click', e => {
            if (e.target.closest('#generate-rfm')) this.loadRFMData();
            if (e.target.closest('#export-rfm'))   this.exportChart('rfm-segments');
        });
    }

    /* ── data loading ── */
    async loadRFMData() {
        this.showLoading('正在加载RFM数据...');
        try {
            const days = document.getElementById('rfm-days') ? document.getElementById('rfm-days').value : 90;
            const res  = await fetch('/api/rfm/data?days=' + days).then(r => r.json());
            if (!res.success) throw new Error(res.error || '接口错误');
            this.rfmData = res.data;
            this.updateMetricCards();
            this.renderSegmentPie();
            this.renderSegmentComparison();
            this.renderRFMScatter();
            this.renderSegmentDetails();
            this.renderRecommendations();
        } catch (err) {
            console.error('RFM加载失败:', err);
            this.showError('数据加载失败: ' + err.message);
        }
    }

    /* ── update top metric cards ── */
    updateMetricCards() {
        const d = this.rfmData;
        const segs = d.segments || [];
        const total = d.total_users || 0;
        // high-value: segment names containing 高价值/冠军/忠诚
        const highNames = ['冠军客户','忠诚客户','高价值用户','忠诚用户'];
        const riskNames = ['流失风险','需关注','流失用户','已流失客户'];
        const highCnt = segs.filter(s => highNames.includes(s.segment_name || s.segment)).reduce((a,s)=>a+s.count,0);
        const riskCnt = segs.filter(s => riskNames.includes(s.segment_name || s.segment)).reduce((a,s)=>a+s.count,0);
        const avgMon  = segs.length ? (segs.reduce((a,s)=>a+(s.avg_monetary||s.M||0),0)/segs.length).toFixed(1) : 0;
        const _set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
        _set('.metric-card:nth-child(1) .metric-value', segs.length);
        _set('.metric-card:nth-child(2) .metric-value', highCnt.toLocaleString());
        _set('.metric-card:nth-child(2) .metric-change', `占比 ${total ? (highCnt/total*100).toFixed(1) : 0}%`);
        _set('.metric-card:nth-child(3) .metric-value', riskCnt.toLocaleString());
        _set('.metric-card:nth-child(4) .metric-value', avgMon);
    }

    /* ── Chart 1: Segment distribution pie ── */
    renderSegmentPie() {
        const el = document.getElementById('rfm-segments');
        if (!el) return;
        el.innerHTML = '';
        const chart = echarts.init(el);
        this._charts['rfm-segments'] = chart;
        const dist = this.rfmData.segment_distribution || [];
        chart.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c}人 ({d}%)' },
            legend: { orient: 'vertical', left: 10, top: 'center', type: 'scroll' },
            series: [{
                name: '用户分群', type: 'pie', radius: ['40%', '70%'],
                center: ['60%', '50%'],
                data: dist.map(d => ({ name: d.name, value: d.value,
                    itemStyle: { color: d.color || undefined } })),
                label: { formatter: '{b}\n{d}%' },
                emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.3)' } }
            }]
        });
        window.addEventListener('resize', () => chart.resize());
    }

    /* ── Chart 2: Segment comparison bar ── */
    renderSegmentComparison() {
        const el = document.getElementById('rfm-comparison');
        if (!el) return;
        el.innerHTML = '';
        const chart = echarts.init(el);
        this._charts['rfm-comparison'] = chart;
        const cmp  = this.rfmData.segment_comparison || {};
        const names = cmp.names || [];
        chart.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['平均频次','平均消费(元)','平均距今(天)'], top: 8 },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'category', data: names, axisLabel: { rotate: 15 } },
            yAxis: { type: 'value' },
            series: [
                { name: '平均频次',     type: 'bar', data: cmp.frequency || [], itemStyle: { color: '#5470C6' } },
                { name: '平均消费(元)', type: 'bar', data: cmp.monetary  || [], itemStyle: { color: '#91CC75' } },
                { name: '平均距今(天)', type: 'bar', data: cmp.recency   || [], itemStyle: { color: '#FAC858' } }
            ]
        });
        window.addEventListener('resize', () => chart.resize());
    }

    /* ── Chart 3: R vs F scatter (bubble = M) ── */
    renderRFMScatter() {
        const el = document.getElementById('rfm-matrix');
        if (!el) return;
        el.innerHTML = '';
        const chart = echarts.init(el);
        this._charts['rfm-matrix'] = chart;
        const rows = this.rfmData.rfm_matrix || [];
        // group by segment
        const groups = {};
        rows.forEach(r => {
            const k = r.seg || '其他';
            if (!groups[k]) groups[k] = [];
            groups[k].push([r.x, r.y, r.z]);
        });
        const colors = ['#5470C6','#91CC75','#FAC858','#EE6666','#73C0DE','#3BA272','#FC8452','#9A60B4'];
        const series = Object.entries(groups).map(([name, data], i) => ({
            name, type: 'scatter',
            data,
            symbolSize: d => Math.max(5, Math.min(40, Math.sqrt(d[2] || 1) * 2)),
            itemStyle: { color: colors[i % colors.length], opacity: 0.7 }
        }));
        chart.setOption({
            tooltip: { formatter: p => `${p.seriesName}<br/>距今: ${p.value[0]}天 | 频次: ${p.value[1]} | 消费: ¥${(p.value[2]||0).toFixed(0)}` },
            legend: { top: 8, type: 'scroll' },
            grid: { left: '8%', right: '4%', bottom: '8%', containLabel: true },
            xAxis: { name: '距今天数(R) ←越小越好', type: 'value', nameLocation: 'middle', nameGap: 30 },
            yAxis: { name: '购买频次(F)', type: 'value', nameLocation: 'middle', nameGap: 40 },
            series
        });
        window.addEventListener('resize', () => chart.resize());

        // Chart 4: trends placeholder — show segment bar
        const el2 = document.getElementById('rfm-trends');
        if (!el2) return;
        el2.innerHTML = '';
        const chart2 = echarts.init(el2);
        this._charts['rfm-trends'] = chart2;
        const dist = this.rfmData.segment_distribution || [];
        chart2.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: { type: 'category', data: dist.map(d => d.name), axisLabel: { rotate: 20 } },
            yAxis: { type: 'value', name: '用户数' },
            series: [{
                type: 'bar',
                data: dist.map((d, i) => ({ value: d.value,
                    itemStyle: { color: d.color || colors[i % colors.length] } })),
                label: { show: true, position: 'top', formatter: p => p.value.toLocaleString() }
            }]
        });
        window.addEventListener('resize', () => chart2.resize());
    }

    /* ── Segment detail cards ── */
    renderSegmentDetails() {
        const container = document.getElementById('segments-container');
        if (!container) return;
        const segments = this.rfmData.segments || [];
        if (!segments.length) { container.innerHTML = '<p style="color:#999;text-align:center">暂无分群数据</p>'; return; }
        const colors = ['#5470C6','#91CC75','#FAC858','#EE6666','#73C0DE','#3BA272','#FC8452','#9A60B4'];
        container.innerHTML = segments.map((s, i) => {
            const name = s.segment_name || s.segment || '';
            const color = s.color || colors[i % colors.length];
            const cnt  = (s.count || 0).toLocaleString();
            const pct  = s.pct != null ? s.pct : (this.rfmData.total_users ? (s.count / this.rfmData.total_users * 100).toFixed(1) : '—');
            const freq = s.avg_frequency != null ? s.avg_frequency : (s.F || '—');
            const mon  = s.avg_monetary  != null ? '¥' + s.avg_monetary.toLocaleString() : (s.M || '—');
            const rec  = s.avg_recency   != null ? s.avg_recency + '天' : (s.R || '—');
            return `<div class="segment-card" style="border-left:4px solid ${color};padding:14px 16px;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-weight:700;font-size:15px;color:${color}">${name}</span>
                    <span style="font-size:13px;color:#666">${cnt}人 (${pct}%)</span>
                </div>
                <div style="display:flex;gap:16px;font-size:12px;color:#888">
                    <span>平均频次: <b style="color:#333">${freq}</b></span>
                    <span>平均消费: <b style="color:#333">${mon}</b></span>
                    <span>距今: <b style="color:#333">${rec}</b></span>
                </div>
            </div>`;
        }).join('');
    }

    /* ── Recommendations ── */
    renderRecommendations() {
        const container = document.getElementById('recommendations-container');
        if (!container) return;
        const recs = {
            '冠军客户':  { icon: 'fa-crown',          color: '#5470C6', text: '给予VIP专属权益，邀请参与品牌共建，保持高频互动。' },
            '忠诚客户':  { icon: 'fa-heart',           color: '#91CC75', text: '推送升级奖励，引导成为品牌大使，提升消费品类广度。' },
            '潜力客户':  { icon: 'fa-seedling',        color: '#FAC858', text: '个性化商品推荐，限时折扣激励转化，培养复购习惯。' },
            '新客户':    { icon: 'fa-user-plus',       color: '#EE6666', text: '新人专属优惠，引导首购体验核心品类，建立品牌认知。' },
            '流失风险':  { icon: 'fa-exclamation-triangle', color: '#FC8452', text: '重点挽留！发送召回优惠券，主动触达了解流失原因。' },
            '需关注':    { icon: 'fa-bell',            color: '#9A60B4', text: '定期推送个性化内容，轻度刺激重新激活购买行为。' },
            '沉睡客户':  { icon: 'fa-moon',            color: '#ea7ccc', text: '大额唤醒优惠，强调品牌变化与新品，降低决策门槛。' },
            '已流失客户':{ icon: 'fa-times-circle',    color: '#73C0DE', text: '低成本维护，通过社交媒体保持曝光，等待时机重激活。' },
            '高价值用户':{ icon: 'fa-gem',             color: '#5470C6', text: '专属客服通道，高价值商品优先推送，增加粘性服务。' },
            '潜力用户':  { icon: 'fa-chart-line',      color: '#91CC75', text: '引导加购收藏，发送升级激励，缩短购买决策周期。' },
            '高消费用户':{ icon: 'fa-dollar-sign',     color: '#FAC858', text: '推送高客单价套餐，满额赠礼，强化消费金额认可感。' },
            '忠诚用户':  { icon: 'fa-star',            color: '#3BA272', text: '积分加速，专属节日关怀，维持稳定的购买节奏。' },
            '流失用户':  { icon: 'fa-user-times',      color: '#EE6666', text: '高价值流失用户重点召回，低价值降低运营成本。' },
            '一般用户':  { icon: 'fa-user',            color: '#aaa',    text: '常规营销推送，通过数据追踪逐步细化分群策略。' },
        };
        const segments = this.rfmData.segments || [];
        if (!segments.length) { container.innerHTML = '<p style="color:#999;text-align:center">暂无建议</p>'; return; }
        container.innerHTML = segments.map(s => {
            const name = s.segment_name || s.segment || '';
            const r = recs[name] || { icon: 'fa-lightbulb', color: '#aaa', text: '持续跟踪该分群，优化针对性运营策略。' };
            return `<div class="recommendation-card" style="background:#fff;border-radius:8px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${r.color}">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <i class="fas ${r.icon}" style="color:${r.color}"></i>
                    <strong style="color:${r.color}">${name}</strong>
                </div>
                <p style="font-size:13px;color:#666;margin:0">${r.text}</p>
            </div>`;
        }).join('');
    }

    /* ── export ── */
    exportChart(id) {
        const chart = this._charts[id];
        if (!chart) return;
        const url = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
        const a = Object.assign(document.createElement('a'), { href: url, download: 'rfm_analysis.png' });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
}
