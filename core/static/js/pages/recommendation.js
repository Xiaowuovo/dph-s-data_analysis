/**
 * 智能推荐页面模块
 * 提供个性化推荐和智能建议
 */
import API from '../core/api.js';
import Utils from '../core/utils.js';

class RecommendationModule {
    constructor() {
        this.recommendations = null;
        this.userProfile = null;
        this.recommendationFilters = {
            type: 'all',
            priority: 'all',
            status: 'unread'
        };
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('🤖 初始化推荐模块...');

            this.initUI();
            this.initEventListeners();
            await this.loadRecommendations();
            await this.loadUserProfile();

            console.log('✅ 推荐模块初始化完成');
        } catch (error) {
            console.error('❌ 推荐模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.setupRecommendationFilters();
        this.setupRecommendationList();
        this.setupProfileSection();
    }

    /**
     * 设置推荐过滤器
     */
    setupRecommendationFilters() {
        const container = document.getElementById('recommendation-filters');
        if (!container) return;

        container.innerHTML = `
            <div class="filters-container">
                <div class="filter-section">
                    <h5>📊 推荐类型</h5>
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-filter-type="all" data-type="all">
                            <i class="fas fa-star"></i> 全部推荐
                        </button>
                        <button class="filter-btn" data-filter-type="type" data-type="insight">
                            <i class="fas fa-lightbulb"></i> 数据洞察
                        </button>
                        <button class="filter-btn" data-filter-type="type" data-type="action">
                            <i class="fas fa-bolt"></i> 行动建议
                        </button>
                        <button class="filter-btn" data-filter-type="type" data-type="alert">
                            <i class="fas fa-exclamation-circle"></i> 预警提示
                        </button>
                        <button class="filter-btn" data-filter-type="type" data-type="opportunity">
                            <i class="fas fa-chart-line"></i> 商业机会
                        </button>
                    </div>
                </div>
                
                <div class="filter-section">
                    <h5>🔍 优先级</h5>
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-filter-priority="all" data-priority="all">
                            <i class="fas fa-filter"></i> 全部
                        </button>
                        <button class="filter-btn" data-filter-priority="priority" data-priority="high">
                            <span class="priority-badge high"></span> 高优先级
                        </button>
                        <button class="filter-btn" data-filter-priority="priority" data-priority="medium">
                            <span class="priority-badge medium"></span> 中优先级
                        </button>
                        <button class="filter-btn" data-filter-priority="priority" data-priority="low">
                            <span class="priority-badge low"></span> 低优先级
                        </button>
                    </div>
                </div>
                
                <div class="filter-section">
                    <h5>📁 状态</h5>
                    <div class="filter-buttons">
                        <button class="filter-btn active" data-filter-status="unread">
                            <i class="fas fa-envelope"></i> 未读
                        </button>
                        <button class="filter-btn" data-filter-status="read">
                            <i class="fas fa-envelope-open"></i> 已读
                        </button>
                        <button class="filter-btn" data-filter-status="completed">
                            <i class="fas fa-check-circle"></i> 已完成
                        </button>
                        <button class="filter-btn" data-filter-status="dismissed">
                            <i class="fas fa-times-circle"></i> 已忽略
                        </button>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button id="refresh-recommendations" class="btn btn-sm">
                        <i class="fas fa-sync-alt"></i> 刷新推荐
                    </button>
                    <button id="mark-all-read" class="btn btn-sm">
                        <i class="fas fa-check-double"></i> 标记全部已读
                    </button>
                    <button id="generate-new" class="btn btn-primary btn-sm">
                        <i class="fas fa-magic"></i> 生成新推荐
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 设置推荐列表
     */
    setupRecommendationList() {
        const container = document.getElementById('recommendation-list');
        if (!container) return;

        container.innerHTML = `
            <div class="recommendation-header">
                <h3>📈 智能推荐</h3>
                <div class="recommendation-stats">
                    <span class="stat-item">
                        <i class="fas fa-lightbulb"></i>
                        <span id="total-count">0</span> 条推荐
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-clock"></i>
                        <span id="unread-count">0</span> 条未读
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-fire"></i>
                        <span id="high-priority-count">0</span> 条高优先级
                    </span>
                </div>
            </div>
            
            <div class="recommendation-sorting">
                <select id="sort-by" class="form-control form-control-sm">
                    <option value="date">按时间排序</option>
                    <option value="priority">按优先级排序</option>
                    <option value="type">按类型排序</option>
                </select>
                <select id="sort-order" class="form-control form-control-sm">
                    <option value="desc">最新优先</option>
                    <option value="asc">最旧优先</option>
                </select>
            </div>
            
            <div class="recommendation-items" id="recommendation-items">
                <!-- 推荐项将在这里动态生成 -->
                <div class="loading-recommendations">
                    <div class="spinner-border" role="status">
                        <span class="sr-only">加载中...</span>
                    </div>
                    <p>正在加载智能推荐...</p>
                </div>
            </div>
            
            <div class="recommendation-footer">
                <button id="load-more" class="btn btn-outline btn-block" disabled>
                    <i class="fas fa-plus"></i> 加载更多
                </button>
            </div>
        `;
    }

    /**
     * 设置个人资料部分
     */
    setupProfileSection() {
        const container = document.getElementById('recommendation-profile');
        if (!container) return;

        container.innerHTML = `
            <div class="profile-container">
                <div class="profile-header">
                    <h4>👤 个性化设置</h4>
                    <button id="edit-profile" class="btn btn-sm">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                </div>
                
                <div class="profile-info">
                    <div class="profile-avatar">
                        <div class="avatar-placeholder">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="avatar-info">
                            <h5 id="user-name">加载中...</h5>
                            <p id="user-role">数据分析师</p>
                        </div>
                    </div>
                    
                    <div class="profile-stats">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="total-recommendations">0</div>
                                <div class="stat-label">总推荐数</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="completed-recommendations">0</div>
                                <div class="stat-label">已采纳</div>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-bolt"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="impact-score">0</div>
                                <div class="stat-label">影响分</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="profile-preferences">
                    <h5>偏好设置</h5>
                    <div class="preferences-grid">
                        <div class="preference-item">
                            <label class="switch">
                                <input type="checkbox" id="pref-insights" checked>
                                <span class="slider"></span>
                            </label>
                            <span>数据洞察</span>
                        </div>
                        <div class="preference-item">
                            <label class="switch">
                                <input type="checkbox" id="pref-alerts" checked>
                                <span class="slider"></span>
                            </label>
                            <span>系统预警</span>
                        </div>
                        <div class="preference-item">
                            <label class="switch">
                                <input type="checkbox" id="pref-opportunities" checked>
                                <span class="slider"></span>
                            </label>
                            <span>商业机会</span>
                        </div>
                        <div class="preference-item">
                            <label class="switch">
                                <input type="checkbox" id="pref-weekly-digest" checked>
                                <span class="slider"></span>
                            </label>
                            <span>每周摘要</span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-ai-model">
                    <h5>AI模型偏好</h5>
                    <div class="model-selector">
                        <select id="ai-model" class="form-control">
                            <option value="balanced">平衡模式（推荐）</option>
                            <option value="conservative">保守模式</option>
                            <option value="aggressive">激进模式</option>
                            <option value="custom">自定义配置</option>
                        </select>
                    </div>
                </div>
                
                <div class="profile-actions">
                    <button id="save-preferences" class="btn btn-primary btn-sm">
                        <i class="fas fa-save"></i> 保存设置
                    </button>
                    <button id="reset-preferences" class="btn btn-outline btn-sm">
                        <i class="fas fa-undo"></i> 恢复默认
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 过滤器点击
        document.querySelectorAll('[data-filter-type]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterByType(e.currentTarget.dataset.type);
            });
        });

        document.querySelectorAll('[data-filter-priority]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterByPriority(e.currentTarget.dataset.priority);
            });
        });

        document.querySelectorAll('[data-filter-status]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterByStatus(e.currentTarget.dataset.status);
            });
        });

        // 排序选择
        document.getElementById('sort-by')?.addEventListener('change', () => {
            this.sortRecommendations();
        });

        document.getElementById('sort-order')?.addEventListener('change', () => {
            this.sortRecommendations();
        });

        // 按钮点击
        document.getElementById('refresh-recommendations')?.addEventListener('click', () => {
            this.loadRecommendations();
        });

        document.getElementById('mark-all-read')?.addEventListener('click', () => {
            this.markAllAsRead();
        });

        document.getElementById('generate-new')?.addEventListener('click', () => {
            this.generateNewRecommendations();
        });

        document.getElementById('load-more')?.addEventListener('click', () => {
            this.loadMoreRecommendations();
        });

        // 个人资料
        document.getElementById('edit-profile')?.addEventListener('click', () => {
            this.editProfile();
        });

        document.getElementById('save-preferences')?.addEventListener('click', () => {
            this.savePreferences();
        });

        document.getElementById('reset-preferences')?.addEventListener('click', () => {
            this.resetPreferences();
        });

        // AI模型选择
        document.getElementById('ai-model')?.addEventListener('change', () => {
            this.onModelChange();
        });
    }

    /**
     * 加载推荐
     */
    async loadRecommendations() {
        try {
            this.showLoading('正在加载智能推荐...');

            const response = await API.get('recommendations', this.recommendationFilters);
            if (response.success) {
                this.recommendations = response.data;
                this.displayRecommendations();
                this.updateStats();
            }

            this.hideLoading();
        } catch (error) {
            console.error('加载推荐失败:', error);
            this.showError('加载失败: ' + error.message);
        }
    }

    /**
     * 加载用户资料
     */
    async loadUserProfile() {
        try {
            const response = await API.get('user/profile');
            if (response.success) {
                this.userProfile = response.data;
                this.updateProfile();
            }
        } catch (error) {
            console.error('加载用户资料失败:', error);
        }
    }

    /**
     * 显示推荐
     */
    displayRecommendations() {
        if (!this.recommendations || this.recommendations.length === 0) {
            document.getElementById('recommendation-items').innerHTML = `
                <div class="no-recommendations">
                    <i class="fas fa-robot"></i>
                    <h3>暂无推荐</h3>
                    <p>没有找到符合筛选条件的推荐，请尝试修改筛选条件。</p>
                    <button id="generate-first" class="btn btn-primary">
                        <i class="fas fa-magic"></i> 生成第一条推荐
                    </button>
                </div>
            `;

            document.getElementById('generate-first')?.addEventListener('click', () => {
                this.generateNewRecommendations();
            });

            return;
        }

        const itemsHTML = this.recommendations.map((rec, index) => `
            <div class="recommendation-item ${rec.status} ${rec.priority}" 
                 data-id="${rec.id}" 
                 data-priority="${rec.priority}">
                <div class="recommendation-header">
                    <div class="recommendation-type ${rec.type}">
                        <i class="${this.getRecommendationIcon(rec.type)}"></i>
                        <span>${this.getRecommendationType(rec.type)}</span>
                    </div>
                    <div class="recommendation-meta">
                        <span class="timestamp">${this.formatTime(rec.created_at)}</span>
                        <span class="priority-badge ${rec.priority}">${rec.priority}</span>
                        ${rec.is_new ? '<span class="badge new">新</span>' : ''}
                    </div>
                </div>
                
                <div class="recommendation-content">
                    <h4>${rec.title}</h4>
                    <p>${rec.description}</p>
                    
                    ${rec.insights ? `
                        <div class="recommendation-insights">
                            <h5><i class="fas fa-chart-bar"></i> 数据洞察</h5>
                            <ul>
                                ${rec.insights.map(insight => `
                                    <li>${insight}</li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${rec.actions && rec.actions.length > 0 ? `
                        <div class="recommendation-actions">
                            <h5><i class="fas fa-bolt"></i> 建议行动</h5>
                            <div class="action-buttons">
                                ${rec.actions.map((action, i) => `
                                    <button class="action-btn ${action.type}" 
                                            data-rec-id="${rec.id}" 
                                            data-action-index="${i}">
                                        <i class="${this.getActionIcon(action.type)}"></i>
                                        ${action.text}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${rec.metrics ? `
                        <div class="recommendation-metrics">
                            <h5><i class="fas fa-chart-line"></i> 影响评估</h5>
                            <div class="metrics-grid">
                                ${rec.metrics.map(metric => `
                                    <div class="metric-item">
                                        <div class="metric-name">${metric.name}</div>
                                        <div class="metric-value ${metric.trend}">
                                            ${metric.value}
                                            ${metric.trend === 'positive' ? '↑' : metric.trend === 'negative' ? '↓' : '→'}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <div class="recommendation-footer">
                    <div class="recommendation-tags">
                        ${rec.tags.map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                    </div>
                    <div class="recommendation-actions">
                        <button class="btn btn-sm btn-icon" onclick="recommendation.markAsRead('${rec.id}')" title="标记为已读">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" onclick="recommendation.dismiss('${rec.id}')" title="忽略">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" onclick="recommendation.save('${rec.id}')" title="保存">
                            <i class="fas fa-bookmark"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" onclick="recommendation.share('${rec.id}')" title="分享">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('recommendation-items').innerHTML = itemsHTML;

        // 绑定操作按钮事件
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recId = e.currentTarget.dataset.recId;
                const actionIndex = parseInt(e.currentTarget.dataset.actionIndex);
                this.performAction(recId, actionIndex);
            });
        });

        // 绑定点击事件展开详情
        document.querySelectorAll('.recommendation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn') &&
                    !e.target.closest('.recommendation-actions button')) {
                    this.toggleRecommendationDetail(e.currentTarget);
                }
            });
        });
    }

    /**
     * 获取推荐图标
     */
    getRecommendationIcon(type) {
        const icons = {
            'insight': 'fas fa-lightbulb',
            'action': 'fas fa-bolt',
            'alert': 'fas fa-exclamation-circle',
            'opportunity': 'fas fa-chart-line',
            'system': 'fas fa-cog',
            'data': 'fas fa-database'
        };
        return icons[type] || 'fas fa-star';
    }

    /**
     * 获取推荐类型名称
     */
    getRecommendationType(type) {
        const types = {
            'insight': '数据洞察',
            'action': '行动建议',
            'alert': '预警提示',
            'opportunity': '商业机会',
            'system': '系统提示',
            'data': '数据更新'
        };
        return types[type] || '推荐';
    }

    /**
     * 获取操作图标
     */
    getActionIcon(type) {
        const icons = {
            'primary': 'fas fa-play',
            'success': 'fas fa-check',
            'warning': 'fas fa-exclamation',
            'danger': 'fas fa-times',
            'info': 'fas fa-info',
            'secondary': 'fas fa-arrow-right'
        };
        return icons[type] || 'fas fa-play';
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 1天内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else if (diff < 604800000) { // 1周内
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    /**
     * 更新统计信息
     */
    updateStats() {
        if (!this.recommendations) return;

        const totalCount = this.recommendations.length;
        const unreadCount = this.recommendations.filter(r => r.status === 'unread').length;
        const highPriorityCount = this.recommendations.filter(r => r.priority === 'high').length;

        document.getElementById('total-count').textContent = totalCount;
        document.getElementById('unread-count').textContent = unreadCount;
        document.getElementById('high-priority-count').textContent = highPriorityCount;

        // 更新个人资料统计
        document.getElementById('total-recommendations').textContent = totalCount;

        const completedCount = this.recommendations.filter(r => r.status === 'completed').length;
        document.getElementById('completed-recommendations').textContent = completedCount;

        // 计算影响分
        const impactScore = this.calculateImpactScore();
        document.getElementById('impact-score').textContent = impactScore;
    }

    /**
     * 计算影响分
     */
    calculateImpactScore() {
        if (!this.recommendations) return 0;

        let score = 0;
        this.recommendations.forEach(rec => {
            if (rec.metrics) {
                rec.metrics.forEach(metric => {
                    if (metric.impact) {
                        score += metric.impact;
                    }
                });
            }

            if (rec.status === 'completed') {
                score += 10; // 完成加分
            }
        });

        return score;
    }

    /**
     * 更新个人资料
     */
    updateProfile() {
        if (!this.userProfile) return;

        document.getElementById('user-name').textContent =
            this.userProfile.name || '用户';
        document.getElementById('user-role').textContent =
            this.userProfile.role || '数据分析师';

        // 更新偏好设置
        if (this.userProfile.preferences) {
            const prefs = this.userProfile.preferences;
            document.getElementById('pref-insights').checked = prefs.insights !== false;
            document.getElementById('pref-alerts').checked = prefs.alerts !== false;
            document.getElementById('pref-opportunities').checked = prefs.opportunities !== false;
            document.getElementById('pref-weekly-digest').checked = prefs.weeklyDigest !== false;
        }

        if (this.userProfile.aiModel) {
            document.getElementById('ai-model').value = this.userProfile.aiModel;
        }
    }

    /**
     * 按类型筛选
     */
    filterByType(type) {
        this.recommendationFilters.type = type;

        // 更新按钮状态
        document.querySelectorAll('[data-filter-type]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-type="${type}"]`)?.classList.add('active');

        this.applyFilters();
    }

    /**
     * 按优先级筛选
     */
    filterByPriority(priority) {
        this.recommendationFilters.priority = priority;

        // 更新按钮状态
        document.querySelectorAll('[data-filter-priority]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-priority="${priority}"]`)?.closest('.filter-btn')?.classList.add('active');

        this.applyFilters();
    }

    /**
     * 按状态筛选
     */
    filterByStatus(status) {
        this.recommendationFilters.status = status;

        // 更新按钮状态
        document.querySelectorAll('[data-filter-status]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter-status="${status}"]`)?.classList.add('active');

        this.applyFilters();
    }

    /**
     * 应用筛选
     */
    applyFilters() {
        this.loadRecommendations();
    }

    /**
     * 排序推荐
     */
    sortRecommendations() {
        if (!this.recommendations) return;

        const sortBy = document.getElementById('sort-by').value;
        const sortOrder = document.getElementById('sort-order').value;

        this.recommendations.sort((a, b) => {
            let aVal, bVal;

            switch (sortBy) {
                case 'date':
                    aVal = new Date(a.created_at).getTime();
                    bVal = new Date(b.created_at).getTime();
                    break;
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    aVal = priorityOrder[a.priority] || 0;
                    bVal = priorityOrder[b.priority] || 0;
                    break;
                case 'type':
                    aVal = a.type;
                    bVal = b.type;
                    break;
                default:
                    return 0;
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });

        this.displayRecommendations();
    }

    /**
     * 标记为已读
     */
    async markAsRead(recommendationId) {
        try {
            const response = await API.post(`recommendations/${recommendationId}/read`);
            if (response.success) {
                // 更新本地数据
                const rec = this.recommendations.find(r => r.id === recommendationId);
                if (rec) {
                    rec.status = 'read';
                    rec.is_new = false;
                }

                this.displayRecommendations();
                this.updateStats();

                Utils.showToast('已标记为已读', 'success');
            }
        } catch (error) {
            console.error('标记为已读失败:', error);
            this.showError('操作失败: ' + error.message);
        }
    }

    /**
     * 标记全部为已读
     */
    async markAllAsRead() {
        try {
            this.showLoading('正在标记全部为已读...');

            const response = await API.post('recommendations/mark-all-read');
            if (response.success) {
                // 更新本地数据
                this.recommendations.forEach(rec => {
                    rec.status = 'read';
                    rec.is_new = false;
                });

                this.displayRecommendations();
                this.updateStats();

                Utils.showToast('全部推荐已标记为已读', 'success');
            }

            this.hideLoading();
        } catch (error) {
            console.error('标记全部为已读失败:', error);
            this.showError('操作失败: ' + error.message);
        }
    }

    /**
     * 忽略推荐
     */
    async dismiss(recommendationId) {
        try {
            const response = await API.post(`recommendations/${recommendationId}/dismiss`);
            if (response.success) {
                // 从本地数据中移除
                this.recommendations = this.recommendations.filter(r => r.id !== recommendationId);

                this.displayRecommendations();
                this.updateStats();

                Utils.showToast('推荐已忽略', 'info');
            }
        } catch (error) {
            console.error('忽略推荐失败:', error);
            this.showError('操作失败: ' + error.message);
        }
    }

    /**
     * 保存推荐
     */
    async save(recommendationId) {
        try {
            const response = await API.post(`recommendations/${recommendationId}/save`);
            if (response.success) {
                Utils.showToast('推荐已保存到收藏', 'success');
            }
        } catch (error) {
            console.error('保存推荐失败:', error);
            this.showError('保存失败: ' + error.message);
        }
    }

    /**
     * 分享推荐
     */
    async share(recommendationId) {
        const rec = this.recommendations.find(r => r.id === recommendationId);
        if (!rec) return;

        const shareUrl = `${window.location.origin}/share/recommendation/${recommendationId}`;
        const shareText = `${rec.title} - ${rec.description}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: '智能推荐分享',
                    text: shareText,
                    url: shareUrl
                });
                Utils.showToast('分享成功', 'success');
            } catch (error) {
                console.error('分享失败:', error);
                this.copyShareLink(shareUrl);
            }
        } else {
            this.copyShareLink(shareUrl);
        }
    }

    /**
     * 复制分享链接
     */
    copyShareLink(url) {
        navigator.clipboard.writeText(url).then(() => {
            Utils.showToast('链接已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            this.showError('复制失败: ' + err.message);
        });
    }

    /**
     * 执行操作
     */
    async performAction(recommendationId, actionIndex) {
        const rec = this.recommendations.find(r => r.id === recommendationId);
        if (!rec || !rec.actions || !rec.actions[actionIndex]) return;

        const action = rec.actions[actionIndex];

        try {
            this.showLoading(`正在执行: ${action.text}...`);

            const response = await API.post(`recommendations/${recommendationId}/action`, {
                action: action
            });

            if (response.success) {
                // 标记为已完成
                rec.status = 'completed';

                this.displayRecommendations();
                this.updateStats();

                Utils.showToast(`操作完成: ${action.text}`, 'success');

                // 如果有下一步操作
                if (response.data.next_step) {
                    setTimeout(() => {
                        this.showNextStep(response.data.next_step);
                    }, 1000);
                }
            }

            this.hideLoading();
        } catch (error) {
            console.error('执行操作失败:', error);
            this.showError('操作失败: ' + error.message);
        }
    }

    /**
     * 显示下一步
     */
    showNextStep(nextStep) {
        Utils.showModal('下一步操作', `
            <div class="next-step-modal">
                <h5>${nextStep.title}</h5>
                <p>${nextStep.description}</p>
                ${nextStep.actions ? `
                    <div class="next-step-actions">
                        ${nextStep.actions.map((action, i) => `
                            <button class="btn btn-${action.type || 'primary'} btn-sm" 
                                    onclick="recommendation.handleNextStepAction(${i})">
                                ${action.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `);
    }

    /**
     * 处理下一步操作
     */
    handleNextStepAction(index) {
        Utils.closeModal();
        Utils.showToast(`执行下一步操作 ${index + 1}`, 'info');
    }

    /**
     * 切换推荐详情
     */
    toggleRecommendationDetail(element) {
        element.classList.toggle('expanded');
    }

    /**
     * 生成新推荐
     */
    async generateNewRecommendations() {
        try {
            this.showLoading('正在生成智能推荐...');

            const response = await API.post('recommendations/generate');
            if (response.success) {
                Utils.showToast('新推荐已生成', 'success');
                await this.loadRecommendations();
            }

            this.hideLoading();
        } catch (error) {
            console.error('生成推荐失败:', error);
            this.showError('生成失败: ' + error.message);
        }
    }

    /**
     * 加载更多推荐
     */
    async loadMoreRecommendations() {
        // 这里可以实现分页加载逻辑
        Utils.showToast('加载更多功能开发中', 'info');
    }

    /**
     * 编辑个人资料
     */
    editProfile() {
        Utils.showModal('编辑个人资料', `
            <div class="edit-profile-modal">
                <form id="profile-form">
                    <div class="form-group">
                        <label for="edit-name">姓名</label>
                        <input type="text" id="edit-name" class="form-control" 
                               value="${this.userProfile?.name || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-role">职位</label>
                        <input type="text" id="edit-role" class="form-control" 
                               value="${this.userProfile?.role || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-email">邮箱</label>
                        <input type="email" id="edit-email" class="form-control" 
                               value="${this.userProfile?.email || ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-company">公司</label>
                        <input type="text" id="edit-company" class="form-control" 
                               value="${this.userProfile?.company || ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-industry">行业</label>
                        <select id="edit-industry" class="form-control">
                            <option value="">请选择行业</option>
                            <option value="tech" ${this.userProfile?.industry === 'tech' ? 'selected' : ''}>科技</option>
                            <option value="finance" ${this.userProfile?.industry === 'finance' ? 'selected' : ''}>金融</option>
                            <option value="retail" ${this.userProfile?.industry === 'retail' ? 'selected' : ''}>零售</option>
                            <option value="manufacturing" ${this.userProfile?.industry === 'manufacturing' ? 'selected' : ''}>制造</option>
                            <option value="healthcare" ${this.userProfile?.industry === 'healthcare' ? 'selected' : ''}>医疗</option>
                        </select>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">保存</button>
                        <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">取消</button>
                    </div>
                </form>
            </div>
        `);

        // 绑定表单提交
        document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProfile();
        });
    }

    /**
     * 保存个人资料
     */
    async saveProfile() {
        try {
            const profileData = {
                name: document.getElementById('edit-name').value,
                role: document.getElementById('edit-role').value,
                email: document.getElementById('edit-email').value,
                company: document.getElementById('edit-company').value,
                industry: document.getElementById('edit-industry').value
            };

            const response = await API.post('user/profile/update', profileData);
            if (response.success) {
                this.userProfile = { ...this.userProfile, ...profileData };
                this.updateProfile();
                Utils.closeModal();
                Utils.showToast('个人资料已更新', 'success');
            }
        } catch (error) {
            console.error('保存个人资料失败:', error);
            this.showError('保存失败: ' + error.message);
        }
    }

    /**
     * 保存偏好设置
     */
    async savePreferences() {
        try {
            const preferences = {
                insights: document.getElementById('pref-insights').checked,
                alerts: document.getElementById('pref-alerts').checked,
                opportunities: document.getElementById('pref-opportunities').checked,
                weeklyDigest: document.getElementById('pref-weekly-digest').checked
            };

            const aiModel = document.getElementById('ai-model').value;

            const response = await API.post('user/preferences/update', {
                preferences,
                aiModel
            });

            if (response.success) {
                Utils.showToast('偏好设置已保存', 'success');
            }
        } catch (error) {
            console.error('保存偏好设置失败:', error);
            this.showError('保存失败: ' + error.message);
        }
    }

    /**
     * 重置偏好设置
     */
    resetPreferences() {
        if (confirm('确定要重置偏好设置到默认值吗？')) {
            document.getElementById('pref-insights').checked = true;
            document.getElementById('pref-alerts').checked = true;
            document.getElementById('pref-opportunities').checked = true;
            document.getElementById('pref-weekly-digest').checked = true;
            document.getElementById('ai-model').value = 'balanced';

            Utils.showToast('偏好设置已重置', 'info');
        }
    }

    /**
     * AI模型变更
     */
    onModelChange() {
        const model = document.getElementById('ai-model').value;
        const modelText = {
            'balanced': '平衡模式',
            'conservative': '保守模式',
            'aggressive': '激进模式',
            'custom': '自定义配置'
        }[model];

        Utils.showToast(`已切换到${modelText}`, 'info');
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

// 创建推荐实例
const recommendation = new RecommendationModule();

// 导出推荐模块
export default RecommendationModule;
