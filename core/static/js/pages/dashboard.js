/**
 * 仪表盘页面模块
 * 主控制面板，集成所有核心功能
 */
import ChartManager from '../lib/charts.js';
import DataProcessor from '../lib/data-processor.js';
import API from '../core/api.js';
import Auth from '../core/auth.js';
import Utils from '../core/utils.js';

class DashboardModule {
    constructor() {
        this.chartManager = new ChartManager();
        this.charts = new Map();
        this.dashboardData = {
            summary: null,
            charts: [],
            alerts: [],
            recentActivities: []
        };

        this.initDashboard();
    }

    /**
     * 初始化仪表盘
     */
    async initDashboard() {
        try {
            // 检查认证
            if (!Auth.isAuthenticated()) {
                window.location.hash = '#/login';
                return;
            }

            // 加载仪表盘数据
            await this.loadDashboardData();

            // 渲染仪表盘
            this.renderDashboard();

            // 初始化事件监听
            this.initEventListeners();

            // 启动实时更新
            this.startRealTimeUpdates();

        } catch (error) {
            console.error('仪表盘初始化失败:', error);
            this.showErrorMessage('仪表盘加载失败: ' + error.message);
        }
    }

    /**
     * 加载仪表盘数据
     */
    async loadDashboardData() {
        try {
            // 显示加载状态
            this.showLoading();

            // 并行加载所有数据
            const [summary, charts, alerts, activities] = await Promise.all([
                this.loadSummaryData(),
                this.loadChartData(),
                this.loadAlerts(),
                this.loadRecentActivities()
            ]);

            this.dashboardData = {
                summary,
                charts,
                alerts,
                recentActivities: activities
            };

            // 隐藏加载状态
            this.hideLoading();

        } catch (error) {
            console.error('加载仪表盘数据失败:', error);
            throw error;
        }
    }

    /**
     * 加载汇总数据
     */
    async loadSummaryData() {
        const response = await API.get('dashboard/summary');
        if (response.success) {
            return response.data;
        }
        throw new Error(response.message || '加载汇总数据失败');
    }

    /**
     * 加载图表数据
     */
    async loadChartData() {
        const chartConfigs = [
            {
                id: 'sales-trend',
                type: 'line',
                title: '销售趋势',
                endpoint: 'dashboard/charts/sales-trend',
                options: {
                    xField: 'date',
                    yField: 'amount',
                    seriesField: 'product_type'
                }
            },
            {
                id: 'category-distribution',
                type: 'pie',
                title: '品类分布',
                endpoint: 'dashboard/charts/category-dist',
                options: {
                    categoryField: 'category',
                    valueField: 'percentage'
                }
            },
            {
                id: 'region-performance',
                type: 'bar',
                title: '区域表现',
                endpoint: 'dashboard/charts/region-performance',
                options: {
                    xField: 'region',
                    yField: 'sales',
                    seriesField: 'product_line'
                }
            },
            {
                id: 'conversion-funnel',
                type: 'funnel',
                title: '转化漏斗',
                endpoint: 'dashboard/charts/conversion-funnel',
                options: {
                    categoryField: 'stage',
                    valueField: 'count'
                }
            }
        ];

        const chartPromises = chartConfigs.map(async (config) => {
            try {
                const response = await API.get(config.endpoint);
                if (response.success) {
                    return {
                        ...config,
                        data: response.data
                    };
                }
                return {
                    ...config,
                    data: [],
                    error: response.message
                };
            } catch (error) {
                return {
                    ...config,
                    data: [],
                    error: error.message
                };
            }
        });

        return await Promise.all(chartPromises);
    }

    /**
     * 加载警告信息
     */
    async loadAlerts() {
        const response = await API.get('dashboard/alerts');
        if (response.success) {
            return response.data;
        }
        return [];
    }

    /**
     * 加载最近活动
     */
    async loadRecentActivities() {
        const response = await API.get('dashboard/activities');
        if (response.success) {
            return response.data;
        }
        return [];
    }

    /**
     * 渲染仪表盘
     */
    renderDashboard() {
        this.renderSummaryCards();
        this.renderCharts();
        this.renderAlerts();
        this.renderRecentActivities();
        this.renderQuickActions();
    }

    /**
     * 渲染汇总卡片
     */
    renderSummaryCards() {
        const container = document.getElementById('summary-cards');
        if (!container || !this.dashboardData.summary) return;

        const cards = [
            {
                title: '总销售额',
                value: Utils.formatCurrency(this.dashboardData.summary.totalSales),
                icon: '💰',
                color: 'primary',
                change: this.dashboardData.summary.salesChange,
                trend: this.dashboardData.summary.salesTrend
            },
            {
                title: '订单数量',
                value: this.dashboardData.summary.totalOrders.toLocaleString(),
                icon: '📦',
                color: 'success',
                change: this.dashboardData.summary.ordersChange,
                trend: this.dashboardData.summary.ordersTrend
            },
            {
                title: '活跃用户',
                value: this.dashboardData.summary.activeUsers.toLocaleString(),
                icon: '👥',
                color: 'info',
                change: this.dashboardData.summary.usersChange,
                trend: this.dashboardData.summary.usersTrend
            },
            {
                title: '转化率',
                value: (this.dashboardData.summary.conversionRate * 100).toFixed(1) + '%',
                icon: '📈',
                color: 'warning',
                change: this.dashboardData.summary.conversionChange,
                trend: this.dashboardData.summary.conversionTrend
            }
        ];

        container.innerHTML = cards.map(card => `
            <div class="summary-card card-${card.color}">
                <div class="card-icon">${card.icon}</div>
                <div class="card-content">
                    <div class="card-title">${card.title}</div>
                    <div class="card-value">${card.value}</div>
                    <div class="card-trend ${card.trend}">
                        <span class="trend-icon">${card.trend === 'up' ? '↗' : '↘'}</span>
                        <span class="trend-value">${card.change}%</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染图表
     */
    renderCharts() {
        this.dashboardData.charts.forEach(chartConfig => {
            const containerId = `chart-${chartConfig.id}`;
            const container = document.getElementById(containerId);

            if (!container) {
                console.warn(`图表容器 ${containerId} 不存在`);
                return;
            }

            if (chartConfig.error) {
                container.innerHTML = `
                    <div class="chart-error">
                        <div class="error-icon">⚠️</div>
                        <div class="error-message">图表加载失败: ${chartConfig.error}</div>
                    </div>
                `;
                return;
            }

            try {
                const chart = this.chartManager.createChart(
                    containerId,
                    chartConfig.type,
                    chartConfig.data,
                    {
                        title: {
                            text: chartConfig.title,
                            left: 'center'
                        },
                        ...chartConfig.options
                    }
                );

                if (chart) {
                    this.charts.set(containerId, chart);
                }
            } catch (error) {
                console.error(`渲染图表 ${chartConfig.id} 失败:`, error);
                container.innerHTML = `
                    <div class="chart-error">
                        <div class="error-icon">❌</div>
                        <div class="error-message">图表渲染失败</div>
                    </div>
                `;
            }
        });
    }

    /**
     * 渲染警告信息
     */
    renderAlerts() {
        const container = document.getElementById('alerts-container');
        if (!container) return;

        if (!this.dashboardData.alerts || this.dashboardData.alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <div class="no-alerts-icon">✅</div>
                    <div class="no-alerts-message">暂无警告信息</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="alerts-list">
                ${this.dashboardData.alerts.map(alert => `
                    <div class="alert-item alert-${alert.level}">
                        <div class="alert-icon">
                            ${this.getAlertIcon(alert.level)}
                        </div>
                        <div class="alert-content">
                            <div class="alert-title">${alert.title}</div>
                            <div class="alert-message">${alert.message}</div>
                            <div class="alert-time">${Utils.formatTime(alert.timestamp)}</div>
                        </div>
                        <div class="alert-actions">
                            <button class="btn-alert-action" onclick="dashboard.handleAlertAction('${alert.id}', 'dismiss')">
                                忽略
                            </button>
                            <button class="btn-alert-action" onclick="dashboard.handleAlertAction('${alert.id}', 'view')">
                                查看
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * 获取警告图标
     */
    getAlertIcon(level) {
        const icons = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🔵',
            info: 'ℹ️'
        };
        return icons[level] || 'ℹ️';
    }

    /**
     * 渲染最近活动
     */
    renderRecentActivities() {
        const container = document.getElementById('activities-container');
        if (!container) return;

        if (!this.dashboardData.recentActivities || this.dashboardData.recentActivities.length === 0) {
            container.innerHTML = `
                <div class="no-activities">
                    <div class="no-activities-icon">📊</div>
                    <div class="no-activities-message">暂无活动记录</div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="activities-timeline">
                ${this.dashboardData.recentActivities.map(activity => `
                    <div class="timeline-item">
                        <div class="timeline-marker">
                            ${this.getActivityIcon(activity.type)}
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-title">${activity.title}</div>
                            <div class="timeline-desc">${activity.description}</div>
                            <div class="timeline-meta">
                                <span class="timeline-user">${activity.user}</span>
                                <span class="timeline-time">${Utils.formatTime(activity.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * 获取活动图标
     */
    getActivityIcon(type) {
        const icons = {
            upload: '📤',
            analysis: '📊',
            export: '📥',
            login: '🔐',
            query: '🔍',
            setting: '⚙️',
            user: '👤',
            system: '💻'
        };
        return icons[type] || '📋';
    }

    /**
     * 渲染快速操作
     */
    renderQuickActions() {
        const container = document.getElementById('quick-actions');
        if (!container) return;

        const actions = [
            {
                id: 'upload-data',
                title: '上传数据',
                icon: '📤',
                color: 'primary',
                description: '上传新的数据文件',
                action: 'upload'
            },
            {
                id: 'run-analysis',
                title: '运行分析',
                icon: '📊',
                color: 'success',
                description: '执行数据分析',
                action: 'analyze'
            },
            {
                id: 'generate-report',
                title: '生成报告',
                icon: '📄',
                color: 'info',
                description: '创建分析报告',
                action: 'report'
            },
            {
                id: 'export-data',
                title: '导出数据',
                icon: '📥',
                color: 'warning',
                description: '导出分析结果',
                action: 'export'
            }
        ];

        container.innerHTML = actions.map(action => `
            <div class="quick-action action-${action.color}" onclick="dashboard.performAction('${action.action}')">
                <div class="action-icon">${action.icon}</div>
                <div class="action-content">
                    <div class="action-title">${action.title}</div>
                    <div class="action-desc">${action.description}</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 刷新按钮
        document.getElementById('refresh-dashboard')?.addEventListener('click', () => {
            this.refreshDashboard();
        });

        // 导出按钮
        document.getElementById('export-dashboard')?.addEventListener('click', () => {
            this.exportDashboard();
        });

        // 设置按钮
        document.getElementById('dashboard-settings')?.addEventListener('click', () => {
            this.showSettings();
        });

        // 全屏切换
        document.getElementById('toggle-fullscreen')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // 实时更新切换
        document.getElementById('toggle-realtime')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startRealTimeUpdates();
            } else {
                this.stopRealTimeUpdates();
            }
        });
    }

    /**
     * 刷新仪表盘
     */
    async refreshDashboard() {
        try {
            this.showLoading('正在刷新数据...');
            await this.loadDashboardData();
            this.renderDashboard();
            Utils.showToast('仪表盘已刷新', 'success');
        } catch (error) {
            console.error('刷新仪表盘失败:', error);
            Utils.showToast('刷新失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 导出仪表盘
     */
    async exportDashboard() {
        try {
            this.showLoading('正在导出...');

            const exportData = {
                summary: this.dashboardData.summary,
                timestamp: new Date().toISOString(),
                charts: []
            };

            // 导出图表为图片
            for (const [containerId, chart] of this.charts) {
                const imageData = this.chartManager.exportChart(containerId, { download: false });
                exportData.charts.push({
                    id: containerId,
                    dataUrl: imageData
                });
            }

            // 创建导出文件
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard_export_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showToast('仪表盘导出成功', 'success');

        } catch (error) {
            console.error('导出仪表盘失败:', error);
            Utils.showToast('导出失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 显示设置
     */
    showSettings() {
        const settings = {
            refreshInterval: localStorage.getItem('dashboard_refresh_interval') || '300',
            realtimeUpdates: localStorage.getItem('dashboard_realtime_updates') === 'true',
            theme: localStorage.getItem('dashboard_theme') || 'light',
            chartAnimation: localStorage.getItem('chart_animation') !== 'false'
        };

        const modalContent = `
            <div class="settings-modal">
                <h3>仪表盘设置</h3>
                <div class="settings-group">
                    <label>刷新间隔（秒）</label>
                    <input type="number" id="refresh-interval" value="${settings.refreshInterval}" min="30" max="3600">
                </div>
                <div class="settings-group">
                    <label>
                        <input type="checkbox" id="realtime-updates" ${settings.realtimeUpdates ? 'checked' : ''}>
                        启用实时更新
                    </label>
                </div>
                <div class="settings-group">
                    <label>主题</label>
                    <select id="dashboard-theme">
                        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>浅色</option>
                        <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>深色</option>
                        <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>自动</option>
                    </select>
                </div>
                <div class="settings-group">
                    <label>
                        <input type="checkbox" id="chart-animation" ${settings.chartAnimation ? 'checked' : ''}>
                        图表动画
                    </label>
                </div>
                <div class="settings-actions">
                    <button class="btn-save" onclick="dashboard.saveSettings()">保存</button>
                    <button class="btn-cancel" onclick="dashboard.closeSettings()">取消</button>
                </div>
            </div>
        `;

        Utils.showModal('仪表盘设置', modalContent);
    }

    /**
     * 保存设置
     */
    saveSettings() {
        const refreshInterval = document.getElementById('refresh-interval').value;
        const realtimeUpdates = document.getElementById('realtime-updates').checked;
        const theme = document.getElementById('dashboard-theme').value;
        const chartAnimation = document.getElementById('chart-animation').checked;

        localStorage.setItem('dashboard_refresh_interval', refreshInterval);
        localStorage.setItem('dashboard_realtime_updates', realtimeUpdates);
        localStorage.setItem('dashboard_theme', theme);
        localStorage.setItem('chart_animation', chartAnimation);

        // 应用设置
        this.applySettings();

        Utils.showToast('设置已保存', 'success');
        Utils.closeModal();
    }

    /**
     * 应用设置
     */
    applySettings() {
        const refreshInterval = parseInt(localStorage.getItem('dashboard_refresh_interval') || '300');
        const realtimeUpdates = localStorage.getItem('dashboard_realtime_updates') === 'true';
        const theme = localStorage.getItem('dashboard_theme') || 'light';
        const chartAnimation = localStorage.getItem('chart_animation') !== 'false';

        // 更新刷新间隔
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        if (refreshInterval > 0) {
            this.refreshInterval = setInterval(() => {
                this.refreshDashboard();
            }, refreshInterval * 1000);
        }

        // 更新主题
        document.documentElement.setAttribute('data-theme', theme);

        // 更新实时更新
        const toggle = document.getElementById('toggle-realtime');
        if (toggle) {
            toggle.checked = realtimeUpdates;
        }

        if (realtimeUpdates) {
            this.startRealTimeUpdates();
        } else {
            this.stopRealTimeUpdates();
        }

        // 更新图表动画
        this.charts.forEach(chart => {
            if (chartAnimation) {
                chart.setOption({ animation: true });
            } else {
                chart.setOption({ animation: false });
            }
        });
    }

    /**
     * 关闭设置
     */
    closeSettings() {
        Utils.closeModal();
    }

    /**
     * 处理警告操作
     */
    async handleAlertAction(alertId, action) {
        try {
            if (action === 'dismiss') {
                const response = await API.post('alerts/dismiss', { alertId });
                if (response.success) {
                    Utils.showToast('警告已忽略', 'success');
                    this.refreshDashboard();
                }
            } else if (action === 'view') {
                // 跳转到相关页面
                window.location.hash = '#/alerts';
            }
        } catch (error) {
            console.error('处理警告失败:', error);
            Utils.showToast('操作失败: ' + error.message, 'error');
        }
    }

    /**
     * 执行快速操作
     */
    performAction(action) {
        switch (action) {
            case 'upload':
                window.location.hash = '#/upload';
                break;
            case 'analyze':
                window.location.hash = '#/analysis';
                break;
            case 'report':
                this.generateReport();
                break;
            case 'export':
                this.exportData();
                break;
        }
    }

    /**
     * 生成报告
     */
    async generateReport() {
        try {
            this.showLoading('正在生成报告...');

            const response = await API.post('reports/generate', {
                type: 'dashboard',
                data: this.dashboardData
            });

            if (response.success) {
                Utils.showToast('报告生成成功', 'success');
                // 可以在这里提供下载链接
                window.open(response.data.downloadUrl, '_blank');
            } else {
                throw new Error(response.message);
            }

        } catch (error) {
            console.error('生成报告失败:', error);
            Utils.showToast('报告生成失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
            this.showLoading('正在导出数据...');

            const exportData = {
                summary: this.dashboardData.summary,
                charts: this.dashboardData.charts.map(chart => ({
                    title: chart.title,
                    data: chart.data
                })),
                timestamp: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dashboard_data_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showToast('数据导出成功', 'success');

        } catch (error) {
            console.error('导出数据失败:', error);
            Utils.showToast('导出失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 开始实时更新
     */
    startRealTimeUpdates() {
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
        }

        this.realtimeInterval = setInterval(async () => {
            try {
                await this.updateRealtimeData();
            } catch (error) {
                console.error('实时更新失败:', error);
            }
        }, 10000); // 每10秒更新一次
    }

    /**
     * 停止实时更新
     */
    stopRealTimeUpdates() {
        if (this.realtimeInterval) {
            clearInterval(this.realtimeInterval);
            this.realtimeInterval = null;
        }
    }

    /**
     * 更新实时数据
     */
    async updateRealtimeData() {
        try {
            const response = await API.get('dashboard/realtime');
            if (response.success) {
                this.updateDashboardWithRealtimeData(response.data);
            }
        } catch (error) {
            console.error('获取实时数据失败:', error);
        }
    }

    /**
     * 用实时数据更新仪表盘
     */
    updateDashboardWithRealtimeData(realtimeData) {
        // 更新汇总数据
        if (realtimeData.summary) {
            Object.assign(this.dashboardData.summary, realtimeData.summary);
            this.renderSummaryCards();
        }

        // 更新图表数据
        if (realtimeData.charts) {
            realtimeData.charts.forEach(chartUpdate => {
                const chartConfig = this.dashboardData.charts.find(c => c.id === chartUpdate.id);
                if (chartConfig) {
                    chartConfig.data = chartUpdate.data;
                    this.updateChart(chartConfig.id, chartUpdate.data);
                }
            });
        }

        // 显示更新提示
        this.showRealtimeUpdateNotification();
    }

    /**
     * 更新图表
     */
    updateChart(chartId, newData) {
        const containerId = `chart-${chartId}`;
        this.chartManager.updateChartData(containerId, newData);
    }

    /**
     * 显示实时更新通知
     */
    showRealtimeUpdateNotification() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();

        const notification = document.createElement('div');
        notification.className = 'realtime-notification';
        notification.innerHTML = `
            <span>数据已更新: ${timeString}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;

        const container = document.getElementById('notification-area');
        if (container) {
            container.appendChild(notification);
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    /**
     * 切换全屏
     */
    toggleFullscreen() {
        const elem = document.documentElement;

        if (!document.fullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '加载中...') {
        let loading = document.getElementById('dashboard-loading');

        if (!loading) {
            loading = document.createElement('div');
            loading.id = 'dashboard-loading';
            loading.className = 'dashboard-loading';
            document.body.appendChild(loading);
        }

        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            </div>
        `;
        loading.style.display = 'flex';
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.getElementById('dashboard-loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * 显示错误信息
     */
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'dashboard-error';
        errorDiv.innerHTML = `
            <div class="error-content">
                <div class="error-icon">❌</div>
                <div class="error-message">${message}</div>
                <button class="btn-retry" onclick="dashboard.initDashboard()">重试</button>
            </div>
        `;

        const container = document.getElementById('dashboard-container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(errorDiv);
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.stopRealTimeUpdates();

        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.charts.forEach(chart => {
            chart.dispose();
        });
        this.charts.clear();
    }
}

// 创建仪表盘实例
const dashboard = new DashboardModule();

// 导出仪表盘模块
export default DashboardModule;
