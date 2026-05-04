// visualization.js - 电商用户行为数据可视化模块
import ChartManager from '../lib/charts.js';
import DataProcessor from '../lib/data-processor.js';
import API from '../core/api.js';
import Utils from '../core/utils.js';

/**
 * 数据可视化模块 - 处理数据图表生成和可视化展示
 */
class VisualizationModule {
    constructor() {
        this.chartManager = new ChartManager();
        this.currentCharts = new Map();
        this.visualizationConfig = {
            dataSource: 'database',
            chartType: 'line',
            timeRange: 'last7days',
            metrics: [],
            dimensions: [],
            filters: {}
        };
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('初始化可视化模块...');
            this.initUI();
            this.initEventListeners();
            await this.loadVisualizationData();
            console.log('☑ 可视化模块初始化完成');
        } catch (error) {
            console.error('✗ 可视化模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.setupChartContainers();
        this.setupControlPanel();
    }

    /**
     * 设置图表容器
     */
    setupChartContainers() {
        const charts = [
            {id: 'chart-trend', title: '趋势分析', type: 'line'},
            {id: 'chart-distribution', title: '分布分析', type: 'bar'},
            {id: 'chart-comparison', title: '对比分析', type: 'pie'},
            {id: 'chart-correlation', title: '关联分析', type: 'scatter'}
        ];

        charts.forEach(chart => {
            const container = document.getElementById(chart.id);
            if (container) {
                container.innerHTML = `
                    <div class="chart-header">
                        <h4>${chart.title}</h4>
                        <div class="chart-actions">
                            <button class="btn-chart-action" onclick="visualization.exportChart('${chart.id}')">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn-chart-action" onclick="visualization.toggleFullscreen('${chart.id}')">
                                <i class="fas fa-expand"></i>
                            </button>
                        </div>
                    </div>
                    <div class="chart-body" id="${chart.id}-body"></div>
                `;
            }
        });
    }

    /**
     * 设置控制面板
     */
    setupControlPanel() {
        const panel = document.getElementById('visualization-controls');
        if (!panel) return;

        panel.innerHTML = `
            <div class="control-section">
                <h4>数据源</h4>
                <div class="control-group">
                    <label>数据源类型</label>
                    <select id="data-source" class="form-control">
                        <option value="database">数据库</option>
                        <option value="csv">CSV文件</option>
                        <option value="api">API接口</option>
                    </select>
                </div>
                <div class="control-group" id="csv-upload" style="display: none;">
                    <label>上传CSV文件</label>
                    <input type="file" id="csv-file" accept=".csv" class="form-control">
                </div>
            </div>
            
            <div class="control-section">
                <h4>时间范围</h4>
                <div class="control-group">
                    <label>时间范围</label>
                    <select id="time-range" class="form-control">
                        <option value="today">今天</option>
                        <option value="yesterday">昨天</option>
                        <option value="last7days" selected>最近7天</option>
                        <option value="last30days">最近30天</option>
                        <option value="custom">自定义</option>
                    </select>
                </div>
                <div class="control-group" id="custom-date" style="display: none;">
                    <div class="date-inputs">
                        <input type="date" id="start-date" class="form-control">
                        <span>至</span>
                        <input type="date" id="end-date" class="form-control">
                    </div>
                </div>
            </div>
            
            <div class="control-section">
                <h4>图表设置</h4>
                <div class="control-group">
                    <label>图表类型</label>
                    <select id="chart-type" class="form-control">
                        <option value="line">折线图</option>
                        <option value="bar">柱状图</option>
                        <option value="pie">饼图</option>
                        <option value="scatter">散点图</option>
                        <option value="heatmap">热力图</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>指标选择</label>
                    <div id="metrics-selector" class="multi-select">
                        <!-- 指标将通过JS动态生成 -->
                    </div>
                </div>
                <div class="control-group">
                    <label>维度选择</label>
                    <div id="dimensions-selector" class="multi-select">
                        <!-- 维度将通过JS动态生成 -->
                    </div>
                </div>
            </div>
            
            <div class="control-actions">
                <button id="generate-charts" class="btn btn-primary">
                    <i class="fas fa-chart-line"></i> 生成图表
                </button>
                <button id="export-all" class="btn btn-secondary">
                    <i class="fas fa-download"></i> 导出所有
                </button>
                <button id="reset-visualization" class="btn btn-outline">
                    <i class="fas fa-redo"></i> 重置
                </button>
            </div>
        `;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 数据源切换
        document.getElementById('data-source')?.addEventListener('change', (e) => {
            this.toggleDataSource(e.target.value);
        });

        // 时间范围切换
        document.getElementById('time-range')?.addEventListener('change', (e) => {
            this.toggleCustomDate(e.target.value === 'custom');
        });

        // 生成图表
        document.getElementById('generate-charts')?.addEventListener('click', () => {
            this.generateCharts();
        });

        // 导出所有图表
        document.getElementById('export-all')?.addEventListener('click', () => {
            this.exportAllCharts();
        });

        // 重置可视化
        document.getElementById('reset-visualization')?.addEventListener('click', () => {
            this.resetVisualization();
        });
    }

    /**
     * 加载可视化数据
     */
    async loadVisualizationData() {
        try {
            this.showLoading('正在加载数据...');
            const response = await API.get('visualization/data');

            if (response.success) {
                this.updateControls(response.data);
                await this.generateInitialCharts();
                this.hideLoading();
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showError('数据加载失败: ' + error.message);
        }
    }

    /**
     * 更新控制面板
     */
    updateControls(data) {
        this.updateMetricsSelector(data.metrics);
        this.updateDimensionsSelector(data.dimensions);
    }

    /**
     * 更新指标选择器
     */
    updateMetricsSelector(metrics) {
        const container = document.getElementById('metrics-selector');
        if (!container) return;

        container.innerHTML = metrics.map(metric => `
            <label class="checkbox-item">
                <input type="checkbox" name="metrics" value="${metric.id}">
                <span>${metric.name}</span>
            </label>
        `).join('');
    }

    /**
     * 更新维度选择器
     */
    updateDimensionsSelector(dimensions) {
        const container = document.getElementById('dimensions-selector');
        if (!container) return;

        container.innerHTML = dimensions.map(dimension => `
            <label class="checkbox-item">
                <input type="checkbox" name="dimensions" value="${dimension.id}">
                <span>${dimension.name}</span>
            </label>
        `).join('');
    }


    /**
     * 生成单个图表
     */
    async generateChart(config) {
        try {
            const response = await API.get(config.endpoint);
            if (response.success) {
                this.renderChart(config.id, config.type, response.data, config.options);
            }
        } catch (error) {
            console.error(`生成图表 ${config.id} 失败:`, error);
        }
    }

    /**
     * 渲染图表
     */
    renderChart(containerId, type, data, options = {}) {
        const chartId = `${containerId}-body`;
        const chart = this.chartManager.createChart(chartId, type, data, options);
        if (chart) {
            this.currentCharts.set(chartId, chart);
        }
    }

    /**
     * 切换数据源显示
     */
    toggleDataSource(source) {
        const csvUpload = document.getElementById('csv-upload');
        if (csvUpload) {
            csvUpload.style.display = source === 'csv' ? 'block' : 'none';
        }
    }

    /**
     * 切换自定义日期
     */
    toggleCustomDate(show) {
        const customDate = document.getElementById('custom-date');
        if (customDate) {
            customDate.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * 生成图表
     */
    async generateCharts() {
        try {
            this.showLoading('正在生成图表...');
            const config = this.getVisualizationConfig();
            const response = await API.post('visualization/generate', config);

            if (response.success) {
                this.renderAllCharts(response.data);
            }

            this.hideLoading();
        } catch (error) {
            console.error('生成图表失败:', error);
            this.showError('图表生成失败: ' + error.message);
        }
    }

    /**
     * 获取可视化配置
     */
    getVisualizationConfig() {
        return {
            dataSource: document.getElementById('data-source').value,
            timeRange: document.getElementById('time-range').value,
            chartType: document.getElementById('chart-type').value,
            metrics: this.getSelectedValues('metrics'),
            dimensions: this.getSelectedValues('dimensions'),
            filters: this.getFilters()
        };
    }

    /**
     * 获取选中的值
     */
    getSelectedValues(name) {
        const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * 获取筛选条件
     */
    getFilters() {
        const filters = {};
        // 这里可以添加更多筛选逻辑
        return filters;
    }

    /**
     * 渲染所有图表
     */
    renderAllCharts(chartData) {
        Object.entries(chartData).forEach(([chartId, data]) => {
            this.updateChart(chartId, data);
        });
    }

    /**
     * 更新图表
     */
    updateChart(chartId, data) {
        const chart = this.currentCharts.get(`${chartId}-body`);
        if (chart) {
            this.chartManager.updateChartData(`${chartId}-body`, data);
        }
    }

    /**
     * 导出单个图表
     */
    exportChart(chartId) {
        const fullChartId = `${chartId}-body`;
        this.chartManager.exportChart(fullChartId, {
            fileName: `chart_${chartId}_${Date.now()}`
        });
    }

    /**
     * 导出所有图表
     */
    exportAllCharts() {
        this.currentCharts.forEach((chart, chartId) => {
            this.chartManager.exportChart(chartId, {
                fileName: `chart_${chartId.replace('-body', '')}_${Date.now()}`
            });
        });
    }

    /**
     * 重置可视化
     */
    resetVisualization() {
        this.currentCharts.forEach(chart => {
            chart.dispose();
        });
        this.currentCharts.clear();

        // 重置表单
        document.getElementById('visualization-form')?.reset();
    }

    /**
     * 切换全屏
     */
    toggleFullscreen(chartId) {
        const element = document.getElementById(`${chartId}-body`);
        if (!element) return;

        if (!document.fullscreenElement) {
            element.requestFullscreen?.() ||
            element.webkitRequestFullscreen?.() ||
            element.msRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() ||
            document.webkitExitFullscreen?.() ||
            document.msExitFullscreen?.();
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '处理中...') {
        // 实现加载状态显示
        console.log('显示加载状态:', message);
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        // 实现加载状态隐藏
        console.log('隐藏加载状态');
    }

    /**
     * 显示错误
     */
    showError(message) {
        Utils.showToast(message, 'error');
    }
}

// 创建可视化实例
const visualization = new VisualizationModule();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    visualization.init();
});

// 导出可视化模块
export default VisualizationModule;
