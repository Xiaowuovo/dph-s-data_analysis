// static/js/rfm_analysis.js
class RFMAnalysisModule {
    constructor() {
        this.chartManager = new ChartManager();
        this.rfmData = new Map();
        this.analysisConfig = {
            segmentationMethod: 'kmeans',
            scoringMethod: 'quantile',
            segments: 5,
            metrics: ['recency', 'frequency', 'monetary']
        };
    }

    async init() {
        try {
            console.log('初始化RFM分析模块...');
            this.initRFMInterface();
            this.initRFMEventListeners();
            await this.loadRFMData();
            console.log('☑ RFM分析模块初始化完成');
        } catch (error) {
            console.error('✗ RFM模块初始化失败:', error);
            this.showError('RFM分析初始化失败: ' + error.message);
        }
    }

    initRFMInterface() {
        this.setupRFMContainers();
        this.setupRFMControls();
    }

    setupRFMContainers() {
        const containers = [
            {id: 'rfm-matrix', title: 'RFM用户矩阵', type: 'heatmap'},
            {id: 'rfm-segments', title: '用户分群分布', type: 'pie'},
            {id: 'rfm-trends', title: '分群趋势分析', type: 'line'},
            {id: 'rfm-comparison', title: '分群对比分析', type: 'bar'}
        ];

        containers.forEach(container => {
            const element = document.getElementById(container.id);
            if (element) {
                element.innerHTML = this.getRFMChartTemplate(container);
            }
        });
    }

    setupRFMControls() {
        const controls = document.getElementById('rfm-controls');
        if (!controls) return;

        controls.innerHTML = `
            <div class="control-section">
                <h4>RFM分析参数</h4>
                <div class="control-group">
                    <label>分群方法</label>
                    <select id="rfm-method" class="form-control">
                        <option value="quantile">分位数法</option>
                        <option value="kmeans">K均值聚类</option>
                        <option value="custom">自定义阈值</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>分群数量</label>
                    <select id="rfm-segments" class="form-control">
                        <option value="4">4分群</option>
                        <option value="5" selected>5分群</option>
                        <option value="8">8分群</option>
                    </select>
                </div>
            </div>
            
            <div class="control-section">
                <h4>权重设置</h4>
                <div class="control-group">
                    <label>最近性(R)权重</label>
                    <input type="range" id="r-weight" min="1" max="10" value="4" class="form-range">
                    <span id="r-value">4</span>
                </div>
                <div class="control-group">
                    <label>频次(F)权重</label>
                    <input type="range" id="f-weight" min="1" max="10" value="3" class="form-range">
                    <span id="f-value">3</span>
                </div>
                <div class="control-group">
                    <label>价值(M)权重</label>
                    <input type="range" id="m-weight" min="1" max="10" value="3" class="form-range">
                    <span id="m-value">3</span>
                </div>
            </div>

            <div class="control-actions">
                <button id="generate-rfm" class="btn btn-primary">
                    <i class="fas fa-calculator"></i> 生成RFM分析
                </button>
                <button id="export-rfm" class="btn btn-secondary">
                    <i class="fas fa-download"></i> 导出分析报告
                </button>
                <button id="reset-rfm" class="btn btn-outline">
                    <i class="fas fa-redo"></i> 重置参数
                </button>
            </div>
        `;
    }

    async loadRFMData() {
        try {
            this.showLoading('正在加载RFM数据...');
            const response = await API.get('/api/rfm/data');

            if (response.success) {
                this.rfmData = response.data;
                await this.generateRFMCharts();
                this.updateRFMInsights();
            }
            this.hideLoading();
        } catch (error) {
            console.error('RFM数据加载失败:', error);
            this.showError('RFM数据加载失败: ' + error.message);
        }
    }

    async generateRFMCharts() {
        const charts = [
            {id: 'rfm-matrix', type: 'heatmap', data: this.prepareRFMMatrix()},
            {id: 'rfm-segments', type: 'pie', data: this.prepareSegmentDistribution()},
            {id: 'rfm-trends', type: 'line', data: this.prepareSegmentTrends()},
            {id: 'rfm-comparison', type: 'bar', data: this.prepareSegmentComparison()}
        ];

        for (const chart of charts) {
            await this.renderRFMChart(chart);
        }
    }
}
