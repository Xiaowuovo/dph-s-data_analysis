/**
 * 数据查询页面模块
 * 提供高级数据查询和筛选功能
 */
import DataProcessor from '../lib/data-processor.js';
import API from '../core/api.js';
import Utils from '../core/utils.js';

class QueryModule {
    constructor() {
        this.dataProcessor = new DataProcessor();
        this.currentQuery = null;
        this.queryResults = [];
        this.queryHistory = [];
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('🔍 初始化查询模块...');

            this.initUI();
            this.initEventListeners();
            await this.loadQueryHistory();

            console.log('✅ 查询模块初始化完成');
        } catch (error) {
            console.error('❌ 查询模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.renderQueryBuilder();
        this.renderResultsTable();
        this.renderQueryHistory();
    }

    /**
     * 渲染查询构建器
     */
    renderQueryBuilder() {
        const container = document.getElementById('query-builder');
        if (!container) return;

        container.innerHTML = `
            <div class="query-form">
                <div class="form-section">
                    <h4>📁 数据表</h4>
                    <div class="form-group">
                        <label>选择数据表</label>
                        <select id="table-select" class="form-control">
                            <option value="">请选择数据表</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-section">
                    <h4>📊 字段选择</h4>
                    <div class="form-group">
                        <label>选择字段</label>
                        <div id="field-selector" class="multi-select">
                            <!-- 字段将通过JS动态加载 -->
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h4>🔍 筛选条件</h4>
                    <div id="filter-container" class="filter-container">
                        <div class="filter-group">
                            <div class="filter-row">
                                <select class="filter-field form-control">
                                    <option value="">选择字段</option>
                                </select>
                                <select class="filter-operator form-control">
                                    <option value="=">等于</option>
                                    <option value="!=">不等于</option>
                                    <option value=">">大于</option>
                                    <option value=">=">大于等于</option>
                                    <option value="<">小于</option>
                                    <option value="<=">小于等于</option>
                                    <option value="like">包含</option>
                                </select>
                                <input type="text" class="filter-value form-control" placeholder="值">
                                <button class="btn-remove-filter" onclick="query.removeFilter(this)">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <button class="btn-add-filter" onclick="query.addFilter()">
                        <i class="fas fa-plus"></i> 添加筛选条件
                    </button>
                </div>
                
                <div class="form-section">
                    <h4>📈 排序设置</h4>
                    <div id="sort-container" class="sort-container">
                        <div class="sort-row">
                            <select class="sort-field form-control">
                                <option value="">选择字段</option>
                            </select>
                            <select class="sort-order form-control">
                                <option value="asc">升序</option>
                                <option value="desc">降序</option>
                            </select>
                            <button class="btn-remove-sort" onclick="query.removeSort(this)">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <button class="btn-add-sort" onclick="query.addSort()">
                        <i class="fas fa-plus"></i> 添加排序
                    </button>
                </div>
                
                <div class="form-actions">
                    <button id="execute-query" class="btn btn-primary">
                        <i class="fas fa-play"></i> 执行查询
                    </button>
                    <button id="save-query" class="btn btn-secondary">
                        <i class="fas fa-save"></i> 保存查询
                    </button>
                    <button id="reset-query" class="btn btn-outline">
                        <i class="fas fa-redo"></i> 重置
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 渲染结果表格
     */
    renderResultsTable() {
        const container = document.getElementById('query-results');
        if (!container) return;

        container.innerHTML = `
            <div class="results-container">
                <div class="results-header">
                    <h4>查询结果</h4>
                    <div class="results-actions">
                        <button id="export-results" class="btn btn-sm">
                            <i class="fas fa-download"></i> 导出
                        </button>
                        <button id="copy-results" class="btn btn-sm">
                            <i class="fas fa-copy"></i> 复制
                        </button>
                    </div>
                </div>
                <div class="results-content">
                    <div id="results-table" class="results-table">
                        <div class="no-results">暂无查询结果</div>
                    </div>
                </div>
                <div class="results-footer">
                    <div id="results-info" class="results-info">0 条记录</div>
                    <div class="results-pagination">
                        <button class="btn-pagination" disabled>上一页</button>
                        <span class="page-info">第 1 页</span>
                        <button class="btn-pagination" disabled>下一页</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染查询历史
     */
    renderQueryHistory() {
        const container = document.getElementById('query-history');
        if (!container) return;

        container.innerHTML = `
            <div class="history-container">
                <div class="history-header">
                    <h4>查询历史</h4>
                    <button class="btn-clear-history" onclick="query.clearHistory()">
                        <i class="fas fa-trash"></i> 清空
                    </button>
                </div>
                <div class="history-list" id="history-list">
                    <div class="no-history">暂无查询历史</div>
                </div>
            </div>
        `;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 数据表选择
        document.getElementById('table-select')?.addEventListener('change', (e) => {
            this.onTableChange(e.target.value);
        });

        // 执行查询
        document.getElementById('execute-query')?.addEventListener('click', () => {
            this.executeQuery();
        });

        // 保存查询
        document.getElementById('save-query')?.addEventListener('click', () => {
            this.saveQuery();
        });

        // 重置查询
        document.getElementById('reset-query')?.addEventListener('click', () => {
            this.resetQuery();
        });

        // 导出结果
        document.getElementById('export-results')?.addEventListener('click', () => {
            this.exportResults();
        });

        // 复制结果
        document.getElementById('copy-results')?.addEventListener('click', () => {
            this.copyResults();
        });
    }

    /**
     * 数据表变更处理
     */
    async onTableChange(tableName) {
        if (!tableName) return;

        try {
            this.showLoading('正在加载表结构...');
            await this.loadTableStructure(tableName);
            this.hideLoading();
        } catch (error) {
            console.error('加载表结构失败:', error);
            this.showError('表结构加载失败: ' + error.message);
        }
    }

    /**
     * 加载表结构
     */
    async loadTableStructure(tableName) {
        const response = await API.get(`query/tables/${tableName}/structure`);
        if (response.success) {
            this.updateFieldSelector(response.data.fields);
        }
    }

    /**
     * 更新字段选择器
     */
    updateFieldSelector(fields) {
        const selector = document.getElementById('field-selector');
        if (!selector) return;

        selector.innerHTML = fields.map(field => `
            <label class="checkbox-item">
                <input type="checkbox" name="fields" value="${field.name}">
                <span>${field.name} (${field.type})</span>
            </label>
        `).join('');
    }

    /**
     * 添加筛选条件
     */
    addFilter() {
        const container = document.getElementById('filter-container');
        if (!container) return;

        const filterRow = document.createElement('div');
        filterRow.className = 'filter-row';
        filterRow.innerHTML = `
            <select class="filter-field form-control">
                <option value="">选择字段</option>
            </select>
            <select class="filter-operator form-control">
                <option value="=">等于</option>
                <option value="!=">不等于</option>
                <option value=">">大于</option>
                <option value=">=">大于等于</option>
                <option value="<">小于</option>
                <option value="<=">小于等于</option>
                <option value="like">包含</option>
            </select>
            <input type="text" class="filter-value form-control" placeholder="值">
            <button class="btn-remove-filter" onclick="query.removeFilter(this)">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(filterRow);
    }

    /**
     * 移除筛选条件
     */
    removeFilter(button) {
        const row = button.closest('.filter-row');
        if (row) {
            row.remove();
        }
    }

    /**
     * 添加排序
     */
    addSort() {
        const container = document.getElementById('sort-container');
        if (!container) return;

        const sortRow = document.createElement('div');
        sortRow.className = 'sort-row';
        sortRow.innerHTML = `
            <select class="sort-field form-control">
                <option value="">选择字段</option>
            </select>
            <select class="sort-order form-control">
                <option value="asc">升序</option>
                <option value="desc">降序</option>
            </select>
            <button class="btn-remove-sort" onclick="query.removeSort(this)">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(sortRow);
    }

    /**
     * 移除排序
     */
    removeSort(button) {
        const row = button.closest('.sort-row');
        if (row) {
            row.remove();
        }
    }

    /**
     * 执行查询
     */
    async executeQuery() {
        try {
            this.showLoading('正在执行查询...');

            const query = this.buildQuery();
            const response = await API.post('query/execute', query);

            if (response.success) {
                this.queryResults = response.data.results;
                this.displayResults(this.queryResults);
                this.addToHistory(query);
            }

            this.hideLoading();
        } catch (error) {
            console.error('查询执行失败:', error);
            this.showError('查询失败: ' + error.message);
        }
    }

    /**
     * 构建查询对象
     */
    buildQuery() {
        return {
            table: document.getElementById('table-select').value,
            fields: this.getSelectedFields(),
            filters: this.getFilters(),
            sorts: this.getSorts(),
            limit: 1000
        };
    }

    /**
     * 获取选中字段
     */
    getSelectedFields() {
        const checkboxes = document.querySelectorAll('input[name="fields"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * 获取筛选条件
     */
    getFilters() {
        const filters = [];
        const rows = document.querySelectorAll('.filter-row');

        rows.forEach(row => {
            const field = row.querySelector('.filter-field').value;
            const operator = row.querySelector('.filter-operator').value;
            const value = row.querySelector('.filter-value').value;

            if (field && operator && value) {
                filters.push({ field, operator, value });
            }
        });

        return filters;
    }

    /**
     * 获取排序条件
     */
    getSorts() {
        const sorts = [];
        const rows = document.querySelectorAll('.sort-row');

        rows.forEach(row => {
            const field = row.querySelector('.sort-field').value;
            const order = row.querySelector('.sort-order').value;

            if (field && order) {
                sorts.push({ field, order });
            }
        });

        return sorts;
    }

    /**
     * 显示查询结果
     */
    displayResults(results) {
        const container = document.getElementById('results-table');
        if (!container) return;

        if (!results || results.length === 0) {
            container.innerHTML = '<div class="no-results">暂无查询结果</div>';
            return;
        }

        const headers = Object.keys(results[0]);
        const tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${results.map(row => `
                        <tr>
                            ${headers.map(header => `<td>${row[header]}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;

        // 更新结果信息
        this.updateResultsInfo(results.length);
    }

    /**
     * 更新结果信息
     */
    updateResultsInfo(count) {
        const info = document.getElementById('results-info');
        if (info) {
            info.textContent = `${count} 条记录`;
        }
    }

    /**
     * 添加到历史记录
     */
    addToHistory(query) {
        const historyItem = {
            id: Date.now(),
            query,
            timestamp: new Date().toISOString(),
            resultCount: this.queryResults.length
        };

        this.queryHistory.unshift(historyItem);
        this.saveQueryHistory();
        this.updateHistoryList();
    }

    /**
     * 保存查询历史
     */
    saveQueryHistory() {
        localStorage.setItem('query_history', JSON.stringify(this.queryHistory.slice(0, 50)));
    }

    /**
     * 加载查询历史
     */
    async loadQueryHistory() {
        try {
            const history = localStorage.getItem('query_history');
            if (history) {
                this.queryHistory = JSON.parse(history);
                this.updateHistoryList();
            }
        } catch (error) {
            console.error('加载查询历史失败:', error);
        }
    }

    /**
     * 更新历史列表
     */
    updateHistoryList() {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (this.queryHistory.length === 0) {
            container.innerHTML = '<div class="no-history">暂无查询历史</div>';
            return;
        }

        container.innerHTML = this.queryHistory.map(item => `
            <div class="history-item" onclick="query.loadHistoryQuery(${item.id})">
                <div class="history-query">${this.formatQuery(item.query)}</div>
                <div class="history-meta">
                    <span class="history-time">${Utils.formatTimeAgo(item.timestamp)}</span>
                    <span class="history-count">${item.resultCount} 条结果</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * 格式化查询显示
     */
    formatQuery(query) {
        if (!query) return '';
        return `SELECT ${query.fields.join(', ')} FROM ${query.table}`;
    }

    /**
     * 加载历史查询
     */
    loadHistoryQuery(id) {
        const item = this.queryHistory.find(h => h.id === id);
        if (item) {
            this.loadQuery(item.query);
        }
    }

    /**
     * 加载查询配置
     */
    loadQuery(query) {
        // 实现加载查询配置到界面
    }

    /**
     * 保存查询
     */
    async saveQuery() {
        try {
            const query = this.buildQuery();
            const response = await API.post('query/save', query);

            if (response.success) {
                Utils.showToast('查询已保存', 'success');
            }
        } catch (error) {
            console.error('保存查询失败:', error);
            this.showError('保存失败: ' + error.message);
        }
    }

    /**
     * 重置查询
     */
    resetQuery() {
        document.getElementById('table-select').value = '';
        document.getElementById('field-selector').innerHTML = '';
        document.getElementById('filter-container').innerHTML = '';
        document.getElementById('sort-container').innerHTML = '';
        this.queryResults = [];
        this.displayResults([]);
    }

    /**
     * 导出结果
     */
    exportResults() {
        if (this.queryResults.length === 0) {
            this.showError('没有可导出的数据');
            return;
        }

        const csv = this.convertToCSV(this.queryResults);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 转换为CSV
     */
    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const rows = data.map(row =>
            headers.map(header => JSON.stringify(row[header] || '')).join(',')
        );

        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * 复制结果
     */
    async copyResults() {
        if (this.queryResults.length === 0) {
            this.showError('没有可复制的数据');
            return;
        }

        const csv = this.convertToCSV(this.queryResults);
        try {
            await navigator.clipboard.writeText(csv);
            Utils.showToast('结果已复制到剪贴板', 'success');
        } catch (error) {
            console.error('复制失败:', error);
            this.showError('复制失败');
        }
    }

    /**
     * 清空历史
     */
    clearHistory() {
        this.queryHistory = [];
        this.saveQueryHistory();
        this.updateHistoryList();
    }

    /**
     * 显示加载状态
     */
    showLoading(message) {
        // 实现加载状态显示
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        // 实现加载状态隐藏
    }

    /**
     * 显示错误
     */
    showError(message) {
        Utils.showToast(message, 'error');
    }
}

// 创建查询实例
const query = new QueryModule();

// 导出查询模块
export default QueryModule;
