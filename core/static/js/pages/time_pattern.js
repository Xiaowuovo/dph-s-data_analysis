/**
 * 时间模式分析页面模块
 * 分析时间相关的模式和趋势
 */
import ChartManager from '../lib/charts.js';
import DataProcessor from '../lib/data-processor.js';
import API from '../core/api.js';
import Utils from '../core/utils.js';

class TimePatternModule {
    constructor() {
        this.chartManager = new ChartManager();
        this.dataProcessor = new DataProcessor();
        this.timeData = null;
        this.patterns = {};
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('⏰ 初始化时间模式分析模块...');

            this.initUI();
            this.initEventListeners();
            await this.loadTimeData();

            console.log('✅ 时间模式分析模块初始化完成');
        } catch (error) {
            console.error('❌ 时间模式分析模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.setupTimeControls();
        this.setupPatternDetector();
        this.setupTrendAnalysis();
    }

    /**
     * 设置时间控制面板
     */
    setupTimeControls() {
        const container = document.getElementById('time-controls');
        if (!container) return;

        container.innerHTML = `
            <div class="control-panel">
                <div class="control-section">
                    <h4>📅 时间范围</h4>
                    <div class="control-group">
                        <label>开始日期</label>
                        <input type="date" id="start-date" class="form-control" value="${this.getDateOffset(30)}">
                    </div>
                    
                    <div class="control-group">
                        <label>结束日期</label>
                        <input type="date" id="end-date" class="form-control" value="${this.getTodayDate()}">
                    </div>
                    
                    <div class="control-group">
                        <label>时间粒度</label>
                        <select id="time-granularity" class="form-control">
                            <option value="hour">小时</option>
                            <option value="day">天</option>
                            <option value="week" selected>周</option>
                            <option value="month">月</option>
                            <option value="quarter">季度</option>
                            <option value="year">年</option>
                        </select>
                    </div>
                </div>
                
                <div class="control-section">
                    <h4>📊 分析指标</h4>
                    <div class="control-group">
                        <label>选择指标</label>
                        <select id="time-metric" class="form-control">
                            <option value="count">计数</option>
                            <option value="sum">求和</option>
                            <option value="avg" selected>平均值</option>
                            <option value="max">最大值</option>
                            <option value="min">最小值</option>
                        </select>
                    </div>
                    
                    <div class="control-group">
                        <label>数值字段</label>
                        <select id="value-field" class="form-control">
                            <option value="value">数值</option>
                            <option value="amount">金额</option>
                            <option value="quantity">数量</option>
                        </select>
                    </div>
                </div>
                
                <div class="control-section">
                    <h4>🔍 分析类型</h4>
                    <div class="control-group">
                        <label>分析模式</label>
                        <select id="pattern-type" class="form-control">
                            <option value="trend">趋势分析</option>
                            <option value="seasonal">季节性分析</option>
                            <option value="cycle">周期性分析</option>
                            <option value="anomaly">异常检测</option>
                        </select>
                    </div>
                    
                    <div class="control-group">
                        <label>平滑处理</label>
                        <select id="smoothing" class="form-control">
                            <option value="none">无平滑</option>
                            <option value="ma3">3点移动平均</option>
                            <option value="ma7" selected>7点移动平均</option>
                            <option value="ma30">30点移动平均</option>
                        </select>
                    </div>
                </div>
                
                <div class="control-actions">
                    <button id="analyze-time" class="btn btn-primary">
                        <i class="fas fa-chart-line"></i> 开始分析
                    </button>
                    <button id="export-patterns" class="btn btn-secondary">
                        <i class="fas fa-download"></i> 导出结果
                    </button>
                    <button id="reset-time" class="btn btn-outline">
                        <i class="fas fa-redo"></i> 重置
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 设置模式检测器
     */
    setupPatternDetector() {
        const container = document.getElementById('pattern-detector');
        if (!container) return;

        container.innerHTML = `
            <div class="detector-container">
                <div class="detector-header">
                        <h4>🔍 模式检测</h4>
                        <button id="detect-patterns" class="btn btn-sm">
                            <i class="fas fa-search"></i> 检测模式
                        </button>
                </div>
                
                <div class="detector-grid">
                    <div class="detector-card">
                        <div class="detector-icon trend">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="detector-info">
                            <h5>趋势模式</h5>
                            <p id="trend-pattern">未检测</p>
                        </div>
                    </div>
                    
                    <div class="detector-card">
                        <div class="detector-icon seasonal">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <div class="detector-info">
                            <h5>季节性模式</h5>
                            <p id="seasonal-pattern">未检测</p>
                        </div>
                    </div>
                    
                    <div class="detector-card">
                        <div class="detector-icon cycle">
                            <i class="fas fa-sync-alt"></i>
                        </div>
                        <div class="detector-info">
                            <h5>周期性模式</h5>
                            <p id="cycle-pattern">未检测</p>
                        </div>
                    </div>
                    
                    <div class="detector-card">
                        <div class="detector-icon anomaly">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="detector-info">
                            <h5>异常点</h5>
                            <p id="anomaly-count">0 个</p>
                        </div>
                    </div>
                </div>
                
                <div class="pattern-details" id="pattern-details">
                    <div class="no-details">暂无详细信息</div>
                </div>
            </div>
        `;
    }

    /**
     * 设置趋势分析
     */
    setupTrendAnalysis() {
        const container = document.getElementById('trend-analysis');
        if (!container) return;

        container.innerHTML = `
            <div class="trend-container">
                <div class="trend-header">
                    <h4>📈 趋势分析</h4>
                    <div class="trend-actions">
                        <button id="forecast-trend" class="btn btn-sm">
                            <i class="fas fa-chart-line"></i> 趋势预测
                        </button>
                        <button id="compare-periods" class="btn btn-sm">
                            <i class="fas fa-exchange-alt"></i> 周期对比
                        </button>
                    </div>
                </div>
                
                <div class="trend-charts">
                    <div class="chart-container">
                        <div class="chart-header">原始数据</div>
                        <div class="chart-body" id="original-chart"></div>
                    </div>
                    
                    <div class="chart-container">
                        <div class="chart-header">趋势分解</div>
                        <div class="chart-body" id="decomposition-chart"></div>
                    </div>
                    
                    <div class="chart-container full-width">
                        <div class="chart-header">预测结果</div>
                        <div class="chart-body" id="forecast-chart"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 开始分析
        document.getElementById('analyze-time')?.addEventListener('click', () => {
            this.analyzeTimePatterns();
        });

        // 导出结果
        document.getElementById('export-patterns')?.addEventListener('click', () => {
            this.exportPatterns();
        });

        // 重置
        document.getElementById('reset-time')?.addEventListener('click', () => {
            this.resetAnalysis();
        });

        // 检测模式
        document.getElementById('detect-patterns')?.addEventListener('click', () => {
            this.detectPatterns();
        });

        // 趋势预测
        document.getElementById('forecast-trend')?.addEventListener('click', () => {
            this.forecastTrend();
        });

        // 周期对比
        document.getElementById('compare-periods')?.addEventListener('click', () => {
            this.comparePeriods();
        });
    }

    /**
     * 加载时间数据
     */
    async loadTimeData() {
        try {
            this.showLoading('正在加载时间序列数据...');

            const response = await API.get('time-pattern/data');
            if (response.success) {
                this.timeData = response.data;
                this.displayInitialCharts();
            }

            this.hideLoading();
        } catch (error) {
            console.error('加载时间数据失败:', error);
            this.showError('数据加载失败: ' + error.message);
        }
    }

    /**
     * 显示初始图表
     */
    displayInitialCharts() {
        if (!this.timeData || this.timeData.length === 0) {
            this.showMessage('暂无时间序列数据');
            return;
        }

        this.createOriginalChart();
    }

    /**
     * 创建原始数据图表
     */
    createOriginalChart() {
        if (!this.timeData) return;

        const chartData = this.timeData.map(item => ({
            time: item.time,
            value: item.value
        }));

        this.chartManager.createChart('original-chart', 'line', chartData, {
            title: {
                text: '原始时间序列',
                left: 'center'
            },
            xAxis: {
                type: 'category',
                data: chartData.map(d => d.time),
                axisLabel: {
                    rotate: 45
                }
            },
            yAxis: {
                type: 'value',
                name: '数值'
            },
            series: [{
                name: '原始数据',
                type: 'line',
                data: chartData.map(d => d.value),
                smooth: true
            }],
            tooltip: {
                trigger: 'axis'
            }
        });
    }

    /**
     * 分析时间模式
     */
    async analyzeTimePatterns() {
        try {
            this.showLoading('正在分析时间模式...');

            const params = this.getAnalysisParams();
            const response = await API.post('time-pattern/analyze', params);

            if (response.success) {
                this.patterns = response.data.patterns;
                this.displayPatternResults();
                this.createDecompositionChart();
            }

            this.hideLoading();
        } catch (error) {
            console.error('时间模式分析失败:', error);
            this.showError('分析失败: ' + error.message);
        }
    }

    /**
     * 获取分析参数
     */
    getAnalysisParams() {
        return {
            startDate: document.getElementById('start-date').value,
            endDate: document.getElementById('end-date').value,
            granularity: document.getElementById('time-granularity').value,
            metric: document.getElementById('time-metric').value,
            valueField: document.getElementById('value-field').value,
            patternType: document.getElementById('pattern-type').value,
            smoothing: document.getElementById('smoothing').value
        };
    }

    /**
     * 显示模式结果
     */
    displayPatternResults() {
        // 更新模式检测卡片
        if (this.patterns.trend) {
            document.getElementById('trend-pattern').textContent = this.patterns.trend;
        }

        if (this.patterns.seasonal) {
            document.getElementById('seasonal-pattern').textContent = this.patterns.seasonal;
        }

        if (this.patterns.cycle) {
            document.getElementById('cycle-pattern').textContent = this.patterns.cycle;
        }

        if (this.patterns.anomalies) {
            document.getElementById('anomaly-count').textContent = `${this.patterns.anomalies.length} 个`;
        }

        // 更新模式详情
        this.updatePatternDetails();
    }

    /**
     * 更新模式详情
     */
    updatePatternDetails() {
        const container = document.getElementById('pattern-details');
        if (!container) return;

        if (!this.patterns || Object.keys(this.patterns).length === 0) {
            container.innerHTML = '<div class="no-details">暂无详细信息</div>';
            return;
        }

        const details = [];

        if (this.patterns.trendAnalysis) {
            details.push(`
                <div class="detail-section">
                    <h5>趋势分析</h5>
                    <p>${this.patterns.trendAnalysis}</p>
                </div>
            `);
        }

        if (this.patterns.seasonalAnalysis) {
            details.push(`
                <div class="detail-section">
                    <h5>季节性分析</h5>
                    <p>${this.patterns.seasonalAnalysis}</p>
                </div>
            `);
        }

        if (this.patterns.cycleAnalysis) {
            details.push(`
                <div class="detail-section">
                    <h5>周期性分析</h5>
                    <p>${this.patterns.cycleAnalysis}</p>
                </div>
            `);
        }

        if (this.patterns.anomalies && this.patterns.anomalies.length > 0) {
            const anomaliesHTML = this.patterns.anomalies.map(anomaly => `
                <div class="anomaly-item">
                    <span class="anomaly-time">${anomaly.time}</span>
                    <span class="anomaly-value">${anomaly.value.toFixed(2)}</span>
                    <span class="anomaly-deviation">偏差: ${(anomaly.deviation * 100).toFixed(1)}%</span>
                </div>
            `).join('');

            details.push(`
                <div class="detail-section">
                    <h5>异常点检测</h5>
                    <div class="anomaly-list">${anomaliesHTML}</div>
                </div>
            `);
        }

        container.innerHTML = details.join('');
    }

    /**
     * 创建分解图表
     */
    createDecompositionChart() {
        if (!this.patterns.decomposition) return;

        const { trend, seasonal, residual } = this.patterns.decomposition;

        const option = {
            title: {
                text: '时间序列分解',
                left: 'center'
            },
            tooltip: {
                trigger: 'axis'
            },
            grid: [
                { left: '10%', right: '10%', top: '15%', height: '20%' },
                { left: '10%', right: '10%', top: '40%', height: '20%' },
                { left: '10%', right: '10%', top: '65%', height: '20%' }
            ],
            xAxis: [
                { gridIndex: 0, data: trend.map((_, i) => i) },
                { gridIndex: 1, data: seasonal.map((_, i) => i) },
                { gridIndex: 2, data: residual.map((_, i) => i) }
            ],
            yAxis: [
                { gridIndex: 0, name: '趋势' },
                { gridIndex: 1, name: '季节性' },
                { gridIndex: 2, name: '残差' }
            ],
            series: [
                {
                    name: '趋势',
                    type: 'line',
                    xAxisIndex: 0,
                    yAxisIndex: 0,
                    data: trend,
                    smooth: true
                },
                {
                    name: '季节性',
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: seasonal,
                    smooth: true
                },
                {
                    name: '残差',
                    type: 'line',
                    xAxisIndex: 2,
                    yAxisIndex: 2,
                    data: residual,
                    smooth: true
                }
            ]
        };

        this.chartManager.setOption('decomposition-chart', option);
    }

    /**
     * 检测模式
     */
    async detectPatterns() {
        try {
            this.showLoading('正在检测模式...');

            const response = await API.post('time-pattern/detect', {
                timeData: this.timeData
            });

            if (response.success) {
                this.patterns = { ...this.patterns, ...response.data };
                this.displayPatternResults();
            }

            this.hideLoading();
        } catch (error) {
            console.error('模式检测失败:', error);
            this.showError('模式检测失败: ' + error.message);
        }
    }

    /**
     * 趋势预测
     */
    async forecastTrend() {
        try {
            this.showLoading('正在进行趋势预测...');

            const periods = parseInt(prompt('请输入预测周期数:', '12')) || 12;
            const response = await API.post('time-pattern/forecast', {
                timeData: this.timeData,
                periods: periods
            });

            if (response.success) {
                this.displayForecastResults(response.data);
            }

            this.hideLoading();
        } catch (error) {
            console.error('趋势预测失败:', error);
            this.showError('趋势预测失败: ' + error.message);
        }
    }

    /**
     * 显示预测结果
     */
    displayForecastResults(forecastData) {
        if (!forecastData || !forecastData.historical || !forecastData.forecast) {
            this.showError('预测数据格式错误');
            return;
        }

        const historical = forecastData.historical;
        const forecast = forecastData.forecast;
        const confidence = forecastData.confidence;

        const allData = [...historical, ...forecast];
        const allTimes = allData.map((_, i) => i);

        const seriesData = [
            {
                name: '历史数据',
                type: 'line',
                data: historical,
                smooth: true
            },
            {
                name: '预测数据',
                type: 'line',
                data: allData.map((_, i) => i < historical.length ? null : forecast[i - historical.length]),
                smooth: true,
                lineStyle: {
                    type: 'dashed'
                }
            }
        ];

        if (confidence) {
            const upper = allData.map((_, i) =>
                i < historical.length ? null : forecast[i - historical.length] + confidence
            );
            const lower = allData.map((_, i) =>
                i < historical.length ? null : forecast[i - historical.length] - confidence
            );

            seriesData.push({
                name: '置信区间',
                type: 'line',
                data: upper,
                smooth: true,
                lineStyle: {
                    opacity: 0
                },
                areaStyle: {
                    color: 'rgba(135, 206, 250, 0.3)'
                },
                stack: 'confidence'
            });

            seriesData.push({
                name: '置信区间',
                type: 'line',
                data: lower,
                smooth: true,
                lineStyle: {
                    opacity: 0
                },
                areaStyle: {
                    color: 'rgba(135, 206, 250, 0.3)'
                },
                stack: 'confidence'
            });
        }

        this.chartManager.createChart('forecast-chart', 'line', seriesData, {
            title: {
                text: '趋势预测结果',
                left: 'center'
            },
            xAxis: {
                type: 'category',
                data: allTimes,
                axisLabel: {
                    rotate: 45
                }
            },
            yAxis: {
                type: 'value',
                name: '预测值'
            },
            series: seriesData,
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                data: ['历史数据', '预测数据', '置信区间']
            }
        });
    }

    /**
     * 周期对比
     */
    async comparePeriods() {
        try {
            this.showLoading('正在对比周期...');

            const periods = ['day', 'week', 'month'];
            const results = {};

            for (const period of periods) {
                const response = await API.post('time-pattern/compare', {
                    timeData: this.timeData,
                    period: period
                });

                if (response.success) {
                    results[period] = response.data;
                }
            }

            this.displayPeriodComparison(results);
            this.hideLoading();
        } catch (error) {
            console.error('周期对比失败:', error);
            this.showError('周期对比失败: ' + error.message);
        }
    }

    /**
     * 显示周期对比
     */
    displayPeriodComparison(results) {
        const container = document.createElement('div');
        container.className = 'comparison-modal';

        let comparisonHTML = '<div class="comparison-grid">';

        Object.entries(results).forEach(([period, data]) => {
            comparisonHTML += `
                <div class="comparison-card">
                    <h5>${this.getPeriodLabel(period)}对比</h5>
                    <div class="comparison-stats">
                        <div class="stat-row">
                            <span>变化率:</span>
                            <span class="${data.changeRate >= 0 ? 'positive' : 'negative'}">
                                ${(data.changeRate * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div class="stat-row">
                            <span>平均差:</span>
                            <span>${data.meanDifference.toFixed(2)}</span>
                        </div>
                        <div class="stat-row">
                            <span>相关性:</span>
                            <span>${data.correlation.toFixed(3)}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        comparisonHTML += '</div>';
        container.innerHTML = comparisonHTML;

        Utils.showModal('周期对比分析', container.innerHTML);
    }

    /**
     * 获取周期标签
     */
    getPeriodLabel(period) {
        const labels = {
            'day': '日',
            'week': '周',
            'month': '月',
            'quarter': '季度',
            'year': '年'
        };
        return labels[period] || period;
    }

    /**
     * 导出模式
     */
    exportPatterns() {
        if (!this.patterns || Object.keys(this.patterns).length === 0) {
            this.showError('没有可导出的分析结果');
            return;
        }

        const dataStr = JSON.stringify(this.patterns, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `time_patterns_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 重置分析
     */
    resetAnalysis() {
        // 重置表单
        document.getElementById('start-date').value = this.getDateOffset(30);
        document.getElementById('end-date').value = this.getTodayDate();
        document.getElementById('time-granularity').value = 'week';
        document.getElementById('time-metric').value = 'avg';
        document.getElementById('value-field').value = 'value';
        document.getElementById('pattern-type').value = 'trend';
        document.getElementById('smoothing').value = 'ma7';

        // 重置显示
        this.patterns = {};
        document.getElementById('trend-pattern').textContent = '未检测';
        document.getElementById('seasonal-pattern').textContent = '未检测';
        document.getElementById('cycle-pattern').textContent = '未检测';
        document.getElementById('anomaly-count').textContent = '0 个';
        document.getElementById('pattern-details').innerHTML = '<div class="no-details">暂无详细信息</div>';
    }

    /**
     * 获取今天日期
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * 获取偏移日期
     */
    getDateOffset(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    }

    /**
     * 显示加载状态
     */
    showLoading(message) {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
        document.body.appendChild(loading);
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.querySelector('.loading-overlay');
        if (loading) {
            loading.remove();
        }
    }

    /**
     * 显示消息
     */
    showMessage(message) {
        Utils.showToast(message, 'info');
    }

    /**
     * 显示错误
     */
    showError(message) {
        Utils.showToast(message, 'error');
    }
}

// 创建时间模式分析实例
const timePattern = new TimePatternModule();

// 导出时间模式分析模块
export default TimePatternModule;
