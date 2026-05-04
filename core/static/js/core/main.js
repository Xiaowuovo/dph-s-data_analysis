/**
 * 主应用入口文件
 * 负责初始化整个应用
 */
import Config from './config.js';
import Utils from './utils.js';

class MainApp {
    constructor() {
        this.config = Config;
        this.utils = Utils;
        this.modules = new Map();
        this.initialized = false;

        // 全局状态
        this.state = {
            user: null,
            token: null,
            settings: {},
            loading: false,
            online: navigator.onLine
        };
    }

    /**
     * 初始化应用
     */
    async init() {
        if (this.initialized) {
            console.warn('应用已经初始化');
            return;
        }

        try {
            console.log('🐼 初始化淘宝用户行为分析系统...');

            // 1. 设置全局错误处理
            this.setupGlobalErrorHandling();

            // 2. 检查网络状态
            this.setupNetworkMonitoring();

            // 3. 从存储加载状态
            await this.loadStateFromStorage();

            // 4. 检查认证状态
            await this.checkAuthStatus();

            // 5. 加载用户设置
            await this.loadUserSettings();

            // 6. 初始化UI组件
            this.initUIComponents();

            // 7. 设置全局事件监听
            this.setupGlobalEventListeners();

            // 8. 加载当前页面模块
            await this.loadCurrentPageModule();

            // 9. 启动后台任务
            this.startBackgroundTasks();

            this.initialized = true;
            console.log('✅ 系统初始化完成');

            // 触发初始化完成事件
            this.emit('app:initialized');

        } catch (error) {
            console.error('❌ 系统初始化失败:', error);
            this.showFatalError('系统初始化失败: ' + error.message);
        }
    }

    /**
     * 设置全局错误处理
     */
    setupGlobalErrorHandling() {
        // 全局错误捕获
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
            this.logError(event.error);

            if (this.config.error.showUser) {
                this.showNotification('系统错误', 'error');
            }
        });

        // 未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            this.logError(event.reason);
        });

        // 控制台错误重写
        const originalError = console.error;
        console.error = function(...args) {
            originalError.apply(console, args);
            // 可以在这里添加错误上报逻辑
        };
    }

    /**
     * 设置网络监控
     */
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.state.online = true;
            this.showNotification('网络已连接', 'success');
            this.emit('network:online');
        });

        window.addEventListener('offline', () => {
            this.state.online = false;
            this.showNotification('网络已断开', 'warning');
            this.emit('network:offline');
        });
    }

    /**
     * 从存储加载状态
     */
    async loadStateFromStorage() {
        try {
            const token = localStorage.getItem(this.config.storage.keys.authToken);
            const userInfo = localStorage.getItem(this.config.storage.keys.userInfo);
            const settings = localStorage.getItem(this.config.storage.keys.settings);

            if (token) this.state.token = token;
            if (userInfo) this.state.user = JSON.parse(userInfo);
            if (settings) this.state.settings = JSON.parse(settings);

        } catch (error) {
            console.warn('加载存储状态失败:', error);
            this.clearStorage();
        }
    }

    /**
     * 检查认证状态
     */
    async checkAuthStatus() {
        if (!this.state.token) {
            this.redirectToLogin();
            return false;
        }

        try {
            const auth = await import('./auth.js');
            const isValid = await auth.default.validateToken(this.state.token);

            if (!isValid) {
                this.logout();
                return false;
            }

            return true;

        } catch (error) {
            console.warn('Token验证失败:', error);
            this.logout();
            return false;
        }
    }

    /**
     * 加载用户设置
     */
    async loadUserSettings() {
        try {
            // 从API加载用户设置
            if (this.state.user) {
                const response = await fetch(`${this.config.api.baseURL}/api/user/settings`, {
                    headers: {
                        'Authorization': `Bearer ${this.state.token}`
                    }
                });

                if (response.ok) {
                    const settings = await response.json();
                    this.state.settings = { ...this.state.settings, ...settings };
                    this.saveStateToStorage();
                }
            }

            // 应用主题设置
            this.applyTheme();

        } catch (error) {
            console.warn('加载用户设置失败:', error);
        }
    }

    /**
     * 应用主题
     */
    applyTheme() {
        const theme = this.state.settings.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);

        if (window.echarts) {
            window.echarts.registerTheme('custom', this.getChartTheme(theme));
        }
    }

    /**
     * 初始化UI组件
     */
    initUIComponents() {
        // 初始化加载动画
        this.initLoadingOverlay();

        // 初始化通知系统
        this.initNotificationSystem();

        // 初始化模态框
        this.initModals();

        // 初始化工具提示
        this.initTooltips();

        // 初始化下拉菜单
        this.initDropdowns();
    }

    /**
     * 设置全局事件监听
     */
    setupGlobalEventListeners() {
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.emit('app:resume');
            } else {
                this.emit('app:pause');
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl + S 保存
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.emit('app:save');
            }

            // ESC 关闭模态框
            if (e.key === 'Escape') {
                this.emit('modal:close');
            }
        });
    }

    /**
     * 加载当前页面模块
     */
    async loadCurrentPageModule() {
        const page = this.getCurrentPage();
        const modulePath = `../pages/${page}.js`;

        try {
            console.log(`📄 加载页面模块: ${page}`);

            const module = await import(modulePath);
            if (module.default && typeof module.default.init === 'function') {
                await module.default.init();
                this.modules.set(page, module.default);
                console.log(`✅ 页面模块 ${page} 加载完成`);
            }

        } catch (error) {
            console.warn(`⚠️ 页面模块 ${page} 加载失败:`, error);

            // 回退到默认模块
            if (page !== 'dashboard') {
                await this.loadPageModule('dashboard');
            }
        }
    }

    /**
     * 获取当前页面名称
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const pageMap = {
            '/': 'dashboard',
            '/index': 'dashboard',
            '/login': 'login',
            '/register': 'register',
            '/query': 'query',
            '/visualization': 'visualization',
            '/analysis': 'analysis',
            '/user_analysis': 'user_analysis',
            '/time_pattern': 'time_pattern',
            '/rfm_analysis': 'rfm_analysis',
            '/recommendation': 'recommendation',
            '/upload': 'upload',
            '/settings': 'settings'
        };

        // 从路径中提取页面名称
        for (const [route, page] of Object.entries(pageMap)) {
            if (path === route || path.startsWith(route + '/')) {
                return page;
            }
        }

        return 'dashboard';
    }

    /**
     * 启动后台任务
     */
    startBackgroundTasks() {
        // 定期检查会话状态（每5分钟）
        this.backgroundIntervals.push(
            setInterval(() => this.checkSession(), 5 * 60 * 1000)
        );

        // 定期保存状态（每1分钟）
        this.backgroundIntervals.push(
            setInterval(() => this.saveStateToStorage(), 60 * 1000)
        );

        // 定期检查更新（每30分钟）
        this.backgroundIntervals.push(
            setInterval(() => this.checkForUpdates(), 30 * 60 * 1000)
        );
    }

    /**
     * 检查会话状态
     */
    async checkSession() {
        if (!this.state.token) return;

        try {
            const response = await fetch(`${this.config.api.baseURL}/api/auth/check`, {
                headers: {
                    'Authorization': `Bearer ${this.state.token}`
                }
            });

            if (!response.ok) {
                this.logout();
            }

        } catch (error) {
            console.warn('检查会话失败:', error);
        }
    }

    /**
     * 检查更新
     */
    async checkForUpdates() {
        try {
            const response = await fetch(`${this.config.api.baseURL}/api/app/version`);
            if (response.ok) {
                const data = await response.json();
                if (data.version !== this.config.app.version) {
                    this.showNotification('有新版本可用，请刷新页面', 'info');
                }
            }
        } catch (error) {
            // 静默失败
        }
    }

    /**
     * 登录
     */
    async login(username, password) {
        this.setLoading(true);

        try {
            const auth = await import('./auth.js');
            const result = await auth.default.login(username, password);

            if (result.success) {
                this.state.user = result.user;
                this.state.token = result.token;

                this.saveStateToStorage();
                this.showNotification('登录成功', 'success');
                this.redirectAfterLogin();

                return { success: true };
            } else {
                this.showNotification(result.message || '登录失败', 'error');
                return { success: false, message: result.message };
            }

        } catch (error) {
            console.error('登录错误:', error);
            this.showNotification('登录失败: ' + error.message, 'error');
            return { success: false, message: error.message };

        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 登出
     */
    logout() {
        this.state.user = null;
        this.state.token = null;

        this.clearStorage();
        this.redirectToLogin();

        this.showNotification('已退出登录', 'info');
    }

    /**
     * 保存状态到存储
     */
    saveStateToStorage() {
        try {
            if (this.state.token) {
                localStorage.setItem(this.config.storage.keys.authToken, this.state.token);
            }
            if (this.state.user) {
                localStorage.setItem(this.config.storage.keys.userInfo, JSON.stringify(this.state.user));
            }
            if (this.state.settings) {
                localStorage.setItem(this.config.storage.keys.settings, JSON.stringify(this.state.settings));
            }
        } catch (error) {
            console.warn('保存状态失败:', error);
        }
    }

    /**
     * 清除存储
     */
    clearStorage() {
        Object.values(this.config.storage.keys).forEach(key => {
            localStorage.removeItem(key);
        });
    }

    /**
     * 重定向到登录页
     */
    redirectToLogin() {
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }

    /**
     * 登录后重定向
     */
    redirectAfterLogin() {
        const returnUrl = sessionStorage.getItem('return_url') || '/';
        sessionStorage.removeItem('return_url');
        window.location.href = returnUrl;
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info', duration = 3000) {
        const event = new CustomEvent('notification:show', {
            detail: { message, type, duration }
        });
        window.dispatchEvent(event);
    }

    /**
     * 设置加载状态
     */
    setLoading(loading) {
        this.state.loading = loading;
        const event = new CustomEvent('loading:state', {
            detail: { loading }
        });
        window.dispatchEvent(event);
    }

    /**
     * 触发事件
     */
    emit(eventName, data = null) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    /**
     * 记录错误
     */
    logError(error) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            url: window.location.href,
            user: this.state.user ? this.state.user.id : 'anonymous'
        };

        // 可以在这里添加错误上报逻辑
        console.error('错误记录:', errorLog);
    }

    /**
     * 显示致命错误
     */
    showFatalError(message) {
        const errorHtml = `
            <div class="fatal-error">
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>系统错误</h3>
                    <p>${message}</p>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="btn btn-primary">
                            <i class="fas fa-redo"></i> 重新加载
                        </button>
                        <button onclick="window.history.back()" class="btn btn-secondary">
                            <i class="fas fa-arrow-left"></i> 返回上一页
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.innerHTML = errorHtml;
    }
}

// 创建全局应用实例
const app = new MainApp();

// 导出应用实例
export default app;

// 在全局对象上暴露app（可选）
if (window) {
    window.App = app;
}
