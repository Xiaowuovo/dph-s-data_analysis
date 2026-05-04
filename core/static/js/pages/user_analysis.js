/**
 * 用户分析页面模块
 * 用户画像、行为分析和用户分群
 */
import ChartManager from '../lib/charts.js';
import DataProcessor from '../lib/data-processor.js';
import API from '../core/api.js';
import Utils from '../core/utils.js';

class UserAnalysisModule {
    constructor() {
        this.chartManager = new ChartManager();
        this.dataProcessor = new DataProcessor();
        this.userData = null;
        this.userSegments = {};
        this.clusteringResults = null;
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('👥 初始化用户分析模块...');

            this.initUI();
            this.initEventListeners();
            await this.loadUserData();

            console.log('✅ 用户分析模块初始化完成');
        } catch (error) {
            console.error('❌ 用户分析模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.setupAnalysisControls();
        this.setupUserPortrait();
        this.setupSegmentationPanel();
        this.setupBehaviorAnalysis();
    }

    /**
     * 设置分析控制面板
     */
    setupAnalysisControls() {
        const container = document.getElementById('user-controls');
        if (!container) return;

        container.innerHTML = `
            <div class="control-panel">
                <div class="control-section">
                    <h4>👤 用户群体</h4>
                    <div class="control-group">
                        <label>用户分层</label>
                        <select id="user-tier" class="form-control">
                            <option value="all">全部用户</option>
                            <option value="new">新用户</option>
                            <option value="active">活跃用户</option>
                            <option value="vip">VIP用户</option>
                            <option value="dormant">沉默用户</option>
                        </select>
                    </div>
                    
                    <div class="control-group">
                        <label>注册时间</label>
                        <div class="date-range">
                            <input type="date" id="reg-start" class="form-control" value="${this.getDateOffset(365)}">
                            <span>至</span>
                            <input type="date" id="reg-end" class="form-control" value="${this.getTodayDate()}">
                        </div>
                    </div>
                </div>
                
                <div class="control-section">
                    <h4>📈 分析维度</h4>
                    <div class="dimension-grid">
                        <div class="dimension-item">
                            <label>
                                <input type="checkbox" id="dim-behavior" checked>
                                <span>行为分析</span>
                            </label>
                        </div>
                        <div class="dimension-item">
                            <label>
                                <input type="checkbox" id="dim-demographic" checked>
                                <span>人口属性</span>
                            </label>
                        </div>
                        <div class="dimension-item">
                            <label>
                                <input type="checkbox" id="dim-consume" checked>
                                <span>消费特征</span>
                            </label>
                        </div>
                        <div class="dimension-item">
                            <label>
                                <input type="checkbox" id="dim-preference" checked>
                                <span>偏好分析</span>
                            </label>
                        </div>
                        <div class="dimension-item">
                            <label>
                                <input type="checkbox" id="dim-clustering">
                                <span>用户分群</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="control-section">
                    <h4>🎯 分群设置</h4>
                    <div class="clustering-controls">
                        <div class="control-group">
                            <label>聚类算法</label>
                            <select id="clustering-algo" class="form-control">
                                <option value="kmeans">K-Means</option>
                                <option value="dbscan">DBSCAN</option>
                                <option value="hierarchical">层次聚类</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label>聚类数量</label>
                            <input type="range" id="cluster-count" class="form-control" min="2" max="10" value="4">
                            <span id="cluster-value" class="range-value">4</span>
                        </div>
                    </div>
                </div>
                
                <div class="control-actions">
                    <button id="analyze-users" class="btn btn-primary">
                        <i class="fas fa-users"></i> 开始分析
                    </button>
                    <button id="export-users" class="btn btn-secondary">
                        <i class="fas fa-download"></i> 导出结果
                    </button>
                    <button id="create-segment" class="btn btn-success">
                        <i class="fas fa-user-plus"></i> 创建分群
                    </button>
                </div>
            </div>
        `;

        // 绑定聚类数量显示
        const clusterSlider = document.getElementById('cluster-count');
        const clusterValue = document.getElementById('cluster-value');
        if (clusterSlider && clusterValue) {
            clusterSlider.addEventListener('input', (e) => {
                clusterValue.textContent = e.target.value;
            });
        }
    }

    /**
     * 设置用户画像面板
     */
    setupUserPortrait() {
        const container = document.getElementById('user-portrait');
        if (!container) return;

        container.innerHTML = `
            <div class="portrait-container">
                <div class="portrait-header">
                    <h4>👤 用户画像</h4>
                    <div class="portrait-stats">
                        <div class="stat-item">
                            <div class="stat-label">用户总数</div>
                            <div class="stat-value" id="total-users">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">活跃用户</div>
                            <div class="stat-value" id="active-users">0</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">平均价值</div>
                            <div class="stat-value" id="avg-value">¥0</div>
                        </div>
                    </div>
                </div>
                
                <div class="portrait-grid">
                    <div class="portrait-card">
                        <div class="portrait-title">性别分布</div>
                        <div class="portrait-chart" id="gender-chart"></div>
                    </div>
                    
                    <div class="portrait-card">
                        <div class="portrait-title">年龄分布</div>
                        <div class="portrait-chart" id="age-chart"></div>
                    </div>
                    
                    <div class="portrait-card">
                        <div class="portrait-title">地域分布</div>
                        <div class="portrait-chart" id="region-chart"></div>
                    </div>
                    
                    <div class="portrait-card">
                        <div class="portrait-title">设备分布</div>
                        <div class="portrait-chart" id="device-chart"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 设置分群面板
     */
    setupSegmentationPanel() {
        const container = document.getElementById('user-segments');
        if (!container) return;

        container.innerHTML = `
            <div class="segments-container">
                <div class="segments-header">
                    <h4>👥 用户分群</h4>
                    <div class="segments-actions">
                        <button id="refresh-clusters" class="btn btn-sm">
                            <i class="fas fa-sync-alt"></i> 重新聚类
                        </button>
                    </div>
                </div>
                
                <div class="clusters-view" id="clusters-view">
                    <div class="no-clusters">暂无聚类结果</div>
                </div>
                
                <div class="segment-details" id="segment-details">
                    <div class="no-segment">请选择一个分群查看详情</div>
                </div>
            </div>
        `;
    }

    /**
     * 设置行为分析面板
     */
    setupBehaviorAnalysis() {
        const container = document.getElementById('behavior-analysis');
        if (!container) return;

        container.innerHTML = `
            <div class="behavior-container">
                <div class="behavior-header">
                    <h4>📊 行为分析</h4>
                    <div class="behavior-tabs">
                        <button class="tab-btn active" data-tab="frequency">使用频率</button>
                        <button class="tab-btn" data-tab="duration">使用时长</button>
                        <button class="tab-btn" data-tab="engagement">参与度</button>
                        <button class="tab-btn" data-tab="retention">留存率</button>
                    </div>
                </div>
                
                <div class="behavior-content">
                    <div class="tab-content active" id="frequency-tab">
                        <div class="behavior-chart" id="frequency-chart"></div>
                    </div>
                    <div class="tab-content" id="duration-tab">
                        <div class="behavior-chart" id="duration-chart"></div>
                    </div>
                    <div class="tab-content" id="engagement-tab">
                        <div class="behavior-chart" id="engagement-chart"></div>
                    </div>
                    <div class="tab-content" id="retention-tab">
                        <div class="behavior-chart" id="retention-chart"></div>
                    </div>
                </div>
                
                <div class="behavior-insights" id="behavior-insights">
                    <div class="insight-header">🔍 行为洞察</div>
                    <div class="insight-content" id="insight-content">
                        正在分析行为数据...
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
        document.getElementById('analyze-users')?.addEventListener('click', () => {
            this.analyzeUsers();
        });

        // 导出结果
        document.getElementById('export-users')?.addEventListener('click', () => {
            this.exportUserAnalysis();
        });

        // 创建分群
        document.getElementById('create-segment')?.addEventListener('click', () => {
            this.createUserSegment();
        });

        // 重新聚类
        document.getElementById('refresh-clusters')?.addEventListener('click', () => {
            this.refreshClusters();
        });

        // 标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchBehaviorTab(tab);
            });
        });

        // 用户分层变化
        document.getElementById('user-tier')?.addEventListener('change', () => {
            this.updateUserTier();
        });
    }

    /**
     * 加载用户数据
     */
    async loadUserData() {
        try {
            this.showLoading('正在加载用户数据...');

            const response = await API.get('users/data');
            if (response.success) {
                this.userData = response.data;
                this.displayUserStats();
                this.createInitialCharts();
            }

            this.hideLoading();
        } catch (error) {
            console.error('加载用户数据失败:', error);
            this.showError('数据加载失败: ' + error.message);
        }
    }

    /**
     * 显示用户统计
     */
    displayUserStats() {
        if (!this.userData || this.userData.length === 0) {
            this.updateUserCounts(0, 0, 0);
            return;
        }

        const totalUsers = this.userData.length;
        const activeUsers = this.userData.filter(user =>
            user.last_active && this.daysSince(user.last_active) <= 7
        ).length;
        const avgValue = this.calculateAvgValue();

        this.updateUserCounts(totalUsers, activeUsers, avgValue);
    }

    /**
     * 更新用户数量显示
     */
    updateUserCounts(total, active, avgValue) {
        document.getElementById('total-users').textContent = total.toLocaleString();
        document.getElementById('active-users').textContent = active.toLocaleString();
        document.getElementById('avg-value').textContent = `¥${avgValue.toLocaleString()}`;
    }

    /**
     * 计算平均价值
     */
    calculateAvgValue() {
        if (!this.userData || this.userData.length === 0) return 0;

        const totalValue = this.userData.reduce((sum, user) =>
            sum + (user.total_spent || 0), 0
        );
        return Math.round(totalValue / this.userData.length);
    }

    /**
     * 计算天数差
     */
    daysSince(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    /**
     * 创建初始图表
     */
    createInitialCharts() {
        this.createGenderChart();
        this.createAgeChart();
        this.createRegionChart();
        this.createDeviceChart();
    }

    /**
     * 创建性别分布图
     */
    createGenderChart() {
        if (!this.userData) return;

        const genderData = this.userData.reduce((acc, user) => {
            const gender = user.gender || 'unknown';
            acc[gender] = (acc[gender] || 0) + 1;
            return acc;
        }, {});

        const data = Object.entries(genderData).map(([gender, count]) => ({
            name: this.getGenderLabel(gender),
            value: count
        }));

        this.chartManager.createChart('gender-chart', 'pie', data, {
            title: {
                text: '',
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            series: [{
                name: '性别分布',
                type: 'pie',
                radius: '70%',
                data: data
            }]
        });
    }

    /**
     * 获取性别标签
     */
    getGenderLabel(gender) {
        const labels = {
            'male': '男性',
            'female': '女性',
            'unknown': '未知'
        };
        return labels[gender] || gender;
    }

    /**
     * 创建年龄分布图
     */
    createAgeChart() {
        if (!this.userData) return;

        const ageGroups = {
            '0-18': 0,
            '19-25': 0,
            '26-35': 0,
            '36-45': 0,
            '46-60': 0,
            '60+': 0
        };

        this.userData.forEach(user => {
            const age = user.age || 0;
            if (age <= 18) ageGroups['0-18']++;
            else if (age <= 25) ageGroups['19-25']++;
            else if (age <= 35) ageGroups['26-35']++;
            else if (age <= 45) ageGroups['36-45']++;
            else if (age <= 60) ageGroups['46-60']++;
            else ageGroups['60+']++;
        });

        const data = Object.entries(ageGroups).map(([range, count]) => ({
            name: range,
            value: count
        }));

        this.chartManager.createChart('age-chart', 'bar', data, {
            title: {
                text: '',
                left: 'center'
            },
            xAxis: {
                type: 'category',
                data: data.map(d => d.name)
            },
            yAxis: {
                type: 'value'
            },
            series: [{
                name: '年龄分布',
                type: 'bar',
                data: data.map(d => d.value)
            }]
        });
    }

    /**
     * 创建地域分布图
     */
    createRegionChart() {
        if (!this.userData) return;

        const regionData = this.userData.reduce((acc, user) => {
            const region = user.region || '未知';
            acc[region] = (acc[region] || 0) + 1;
            return acc;
        }, {});

        // 取前10个地区
        const sortedRegions = Object.entries(regionData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const data = sortedRegions.map(([region, count]) => ({
            name: region,
            value: count
        }));

        this.chartManager.createChart('region-chart', 'pie', data, {
            title: {
                text: '',
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            legend: {
                orient: 'vertical',
                right: 10,
                top: 'center'
            },
            series: [{
                name: '地域分布',
                type: 'pie',
                radius: '50%',
                data: data
            }]
        });
    }

    /**
     * 创建设备分布图
     */
    createDeviceChart() {
        if (!this.userData) return;

        const deviceData = this.userData.reduce((acc, user) => {
            const device = user.device || 'unknown';
            acc[device] = (acc[device] || 0) + 1;
            return acc;
        }, {});

        const data = Object.entries(deviceData).map(([device, count]) => ({
            name: this.getDeviceLabel(device),
            value: count
        }));

        this.chartManager.createChart('device-chart', 'pie', data, {
            title: {
                text: '',
                left: 'center'
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c} ({d}%)'
            },
            series: [{
                name: '设备分布',
                type: 'pie',
                radius: '70%',
                data: data
            }]
        });
    }

    /**
     * 获取设备标签
     */
    getDeviceLabel(device) {
        const labels = {
            'ios': 'iOS',
            'android': 'Android',
            'web': 'Web',
            'unknown': '未知'
        };
        return labels[device] || device;
    }

    /**
     * 分析用户
     */
    async analyzeUsers() {
        try {
            this.showLoading('正在分析用户...');

            const params = this.getAnalysisParams();
            const response = await API.post('users/analyze', params);

            if (response.success) {
                this.updateAnalysisResults(response.data);
            }

            this.hideLoading();
        } catch (error) {
            console.error('用户分析失败:', error);
            this.showError('分析失败: ' + error.message);
        }
    }

    /**
     * 获取分析参数
     */
    getAnalysisParams() {
        return {
            tier: document.getElementById('user-tier').value,
            regStart: document.getElementById('reg-start').value,
            regEnd: document.getElementById('reg-end').value,
            dimensions: {
                behavior: document.getElementById('dim-behavior').checked,
                demographic: document.getElementById('dim-demographic').checked,
                consume: document.getElementById('dim-consume').checked,
                preference: document.getElementById('dim-preference').checked,
                clustering: document.getElementById('dim-clustering').checked
            },
            clustering: {
                algorithm: document.getElementById('clustering-algo').value,
                clusters: parseInt(document.getElementById('cluster-count').value)
            }
        };
    }

    /**
     * 更新分析结果
     */
    updateAnalysisResults(data) {
        this.userSegments = data.segments || {};
        this.clusteringResults = data.clustering || null;

        this.displaySegmentationResults();
        this.updateBehaviorAnalysis(data.behavior);
        this.generateInsights(data.insights);
    }

    /**
     * 显示分群结果
     */
    displaySegmentationResults() {
        if (!this.clusteringResults) {
            document.getElementById('clusters-view').innerHTML =
                '<div class="no-clusters">暂无聚类结果</div>';
            return;
        }

        const clustersHTML = this.clusteringResults.clusters.map((cluster, index) => {
            return `
                <div class="cluster-card" onclick="userAnalysis.selectCluster(${index})">
                    <div class="cluster-header">
                        <h5>分群 ${index + 1}</h5>
                        <span class="cluster-size">${cluster.size} 人</span>
                    </div>
                    <div class="cluster-stats">
                        <div class="stat-item">
                            <div class="stat-label">平均年龄</div>
                            <div class="stat-value">${cluster.avgAge ? cluster.avgAge.toFixed(1) : '-'}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">平均价值</div>
                            <div class="stat-value">¥${cluster.avgValue ? cluster.avgValue.toFixed(0) : '-'}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('clusters-view').innerHTML = clustersHTML;
    }

    /**
     * 选择分群
     */
    selectCluster(clusterIndex) {
        if (!this.clusteringResults || !this.clusteringResults.clusters[clusterIndex]) {
            return;
        }

        const cluster = this.clusteringResults.clusters[clusterIndex];
        this.showClusterDetails(cluster);
    }

    /**
     * 显示分群详情
     */
    showClusterDetails(cluster) {
        const detailsHTML = `
            <div class="cluster-details">
                <h5>分群详情</h5>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">分群大小</div>
                        <div class="detail-value">${cluster.size} 人</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">平均年龄</div>
                        <div class="detail-value">${cluster.avgAge ? cluster.avgAge.toFixed(1) : '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">平均价值</div>
                        <div class="detail-value">¥${cluster.avgValue ? cluster.avgValue.toFixed(0) : '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">活跃度</div>
                        <div class="detail-value">${cluster.activityLevel || '-'}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h6>特征描述</h6>
                    <p>${cluster.description || '暂无描述'}</p>
                </div>
                
                <div class="detail-section">
                    <h6>用户特征</h6>
                    <ul class="feature-list">
                        ${cluster.features ? cluster.features.map(feature => `
                            <li>${feature}</li>
                        `).join('') : '<li>暂无特征</li>'}
                    </ul>
                </div>
                
                <div class="detail-section">
                    <h6>推荐策略</h6>
                    <ul class="strategy-list">
                        ${cluster.strategies ? cluster.strategies.map(strategy => `
                            <li>${strategy}</li>
                        `).join('') : '<li>暂无策略</li>'}
                    </ul>
                </div>
            </div>
        `;

        document.getElementById('segment-details').innerHTML = detailsHTML;
    }

    /**
     * 更新行为分析
     */
    updateBehaviorAnalysis(behaviorData) {
        if (!behaviorData) return;

        this.createFrequencyChart(behaviorData.frequency);
        this.createDurationChart(behaviorData.duration);
        this.createEngagementChart(behaviorData.engagement);
        this.createRetentionChart(behaviorData.retention);
    }

    /**
     * 创建使用频率图表
     */
    createFrequencyChart(frequencyData) {
        if (!frequencyData) return;

        this.chartManager.createChart('frequency-chart', 'line', frequencyData, {
            title: {
                text: '用户使用频率',
                left: 'center'
            },
            xAxis: {
                type: 'category',
                data: frequencyData.labels || []
            },
            yAxis: {
                type: 'value',
                name: '使用次数'
            },
            series: [{
                name: '使用频率',
                type: 'line',
                data: frequencyData.values || [],
                smooth: true
            }]
        });
    }

    /**
     * 创建使用时长图表
     */
    createDurationChart(durationData) {
        if (!durationData) return;

        this.chartManager.createChart('duration-chart', 'bar', durationData, {
            title: {
                text: '用户使用时长',
                left: 'center'
            },
            xAxis: {
                type: 'category',
                data: durationData.labels || []
            },
            yAxis: {
                type: 'value',
                name: '时长(分钟)'
            },
            series: [{
                name: '使用时长',
                type: 'bar',
                data: durationData.values || []
            }]
        });
    }

    /**
     * 创建参与度图表
     */
    createEngagementChart(engagementData) {
        if (!engagementData) return;

        this.chartManager.createChart('engagement-chart', 'scatter', engagementData, {
            title: {
                text: '用户参与度',
                left: 'center'
            },
            xAxis: {
                name: '访问次数',
                type: 'value'
            },
            yAxis: {
                name: '互动次数',
                type: 'value'
            },
            series: [{
                name: '参与度',
                type: 'scatter',
                data: engagementData.points || [],
                symbolSize: 10
            }]
        });
    }

    /**
     * 创建留存率图表
     */
    createRetentionChart(retentionData) {
        if (!retentionData) return;

        this.chartManager.createChart('retention-chart', 'line', retentionData, {
            title: {
                text: '用户留存率',
                left: 'center'
            },
            xAxis: {
                type: 'category',
                data: retentionData.days || [],
                name: '天数'
            },
            yAxis: {
                type: 'value',
                name: '留存率(%)',
                min: 0,
                max: 100
            },
            series: [{
                name: '留存率',
                type: 'line',
                data: retentionData.rates || [],
                smooth: true
            }]
        });
    }

    /**
     * 切换行为标签
     */
    switchBehaviorTab(tab) {
        // 更新激活状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // 激活选中的标签
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        document.getElementById(`${tab}-tab`)?.classList.add('active');
    }

    /**
     * 生成洞察
     */
    generateInsights(insights) {
        const container = document.getElementById('insight-content');
        if (!container) return;

        if (!insights || insights.length === 0) {
            container.innerHTML = '<div class="no-insights">暂无洞察</div>';
            return;
        }

        const insightsHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <div class="insight-icon">${this.getInsightIcon(insight.type)}</div>
                <div class="insight-text">${insight.text}</div>
            </div>
        `).join('');

        container.innerHTML = insightsHTML;
    }

    /**
     * 获取洞察图标
     */
    getInsightIcon(type) {
        const icons = {
            'trend': '📈',
            'warning': '⚠️',
            'opportunity': '🎯',
            'info': 'ℹ️',
            'success': '✅'
        };
        return icons[type] || '💡';
    }

    /**
     * 更新用户分层
     */
    updateUserTier() {
        const tier = document.getElementById('user-tier').value;
        this.filterUsersByTier(tier);
    }

    /**
     * 按用户分层筛选
     */
    filterUsersByTier(tier) {
        if (!this.userData) return;

        let filteredData = [...this.userData];

        switch (tier) {
            case 'new':
                filteredData = filteredData.filter(user =>
                    user.reg_date && this.daysSince(user.reg_date) <= 30
                );
                break;
            case 'active':
                filteredData = filteredData.filter(user =>
                    user.last_active && this.daysSince(user.last_active) <= 7
                );
                break;
            case 'vip':
                filteredData = filteredData.filter(user =>
                    user.level === 'vip' || (user.total_spent || 0) > 1000
                );
                break;
            case 'dormant':
                filteredData = filteredData.filter(user =>
                    user.last_active && this.daysSince(user.last_active) > 90
                );
                break;
        }

        this.updateFilteredCharts(filteredData);
    }

    /**
     * 更新筛选后的图表
     */
    updateFilteredCharts(filteredData) {
        // 这里可以重新创建图表显示筛选后的数据
        console.log('筛选后用户数:', filteredData.length);
    }

    /**
     * 刷新聚类
     */
    async refreshClusters() {
        try {
            this.showLoading('正在重新聚类...');

            const params = this.getAnalysisParams();
            const response = await API.post('users/cluster', params);

            if (response.success) {
                this.clusteringResults = response.data;
                this.displaySegmentationResults();
            }

            this.hideLoading();
        } catch (error) {
            console.error('重新聚类失败:', error);
            this.showError('重新聚类失败: ' + error.message);
        }
    }

    /**
     * 创建用户分群
     */
    async createUserSegment() {
        try {
            const segmentName = prompt('请输入分群名称:', '新建分群');
            if (!segmentName) return;

            const description = prompt('请输入分群描述:', '');

            this.showLoading('正在创建分群...');

            const response = await API.post('users/segment', {
                name: segmentName,
                description: description,
                criteria: this.getCurrentFilterCriteria(),
                users: this.getCurrentUserIds()
            });

            if (response.success) {
                Utils.showToast('分群创建成功', 'success');
            }

            this.hideLoading();
        } catch (error) {
            console.error('创建分群失败:', error);
            this.showError('创建分群失败: ' + error.message);
        }
    }

    /**
     * 获取当前筛选条件
     */
    getCurrentFilterCriteria() {
        return {
            tier: document.getElementById('user-tier').value,
            regStart: document.getElementById('reg-start').value,
            regEnd: document.getElementById('reg-end').value
        };
    }

    /**
     * 获取当前用户ID
     */
    getCurrentUserIds() {
        if (!this.userData) return [];
        return this.userData.map(user => user.id);
    }

    /**
     * 导出用户分析
     */
    exportUserAnalysis() {
        if (!this.userData || this.userData.length === 0) {
            this.showError('没有可导出的数据');
            return;
        }

        const exportData = {
            summary: {
                totalUsers: this.userData.length,
                activeUsers: this.userData.filter(u => this.daysSince(u.last_active) <= 7).length,
                avgValue: this.calculateAvgValue()
            },
            segments: this.userSegments,
            clusters: this.clusteringResults,
            timestamp: new Date().toISOString()
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user_analysis_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
     * 显示错误
     */
    showError(message) {
        Utils.showToast(message, 'error');
    }
}

// 创建用户分析实例
const userAnalysis = new UserAnalysisModule();

// 导出用户分析模块
export default UserAnalysisModule;
