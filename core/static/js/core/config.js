/**
 * 系统配置文件
 * 集中管理所有配置项
 */
const Config = {
    // 应用信息
    app: {
        name: '淘宝用户行为分析系统',
        version: '1.0.0',
        debug: process.env.NODE_ENV !== 'production',
        author: '淘宝分析团队',
        copyright: '© 2023 版权所有'
    },

    // API配置
    api: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:5000',
        endpoints: {
            auth: {
                login: '/api/auth/login',
                logout: '/api/auth/logout',
                register: '/api/auth/register',
                profile: '/api/auth/profile'
            },
            data: {
                upload: '/api/data/upload',
                query: '/api/data/query',
                stats: '/api/data/stats',
                export: '/api/data/export'
            },
            analysis: {
                rfm: '/api/analysis/rfm',
                timePattern: '/api/analysis/time-pattern',
                userProfile: '/api/analysis/user-profile',
                behavior: '/api/analysis/behavior',
                recommendation: '/api/analysis/recommendation'
            },
            visualization: {
                generate: '/api/visualization/generate',
                charts: '/api/visualization/charts',
                export: '/api/visualization/export'
            }
        },
        timeout: 30000,
        retry: {
            maxAttempts: 3,
            delay: 1000
        }
    },

    // 图表配置
    chart: {
        theme: 'light',
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        responsive: true,
        colors: [
            '#5470c6', '#91cc75', '#fac858', '#ee6666',
            '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
            '#ea7ccc', '#97b552', '#95706d', '#dc69aa'
        ],
        themeColors: {
            primary: '#6f068b',
            secondary: '#4a0578',
            success: '#28a745',
            warning: '#ffc107',
            danger: '#dc3545',
            info: '#17a2b8',
            light: '#f8f9fa',
            dark: '#343a40'
        }
    },

    // 存储配置
    storage: {
        prefix: 'taobao_',
        type: 'localStorage',
        expiry: {
            session: 2 * 60 * 60 * 1000, // 2小时
            day: 24 * 60 * 60 * 1000,    // 24小时
            week: 7 * 24 * 60 * 60 * 1000 // 7天
        },
        keys: {
            authToken: 'auth_token',
            userInfo: 'user_info',
            settings: 'app_settings',
            history: 'search_history',
            favorites: 'favorite_charts'
        }
    },

    // 分页配置
    pagination: {
        defaultPageSize: 20,
        pageSizes: [10, 20, 50, 100],
        maxPageSize: 1000
    },

    // 上传配置
    upload: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: [
            '.csv',
            '.xlsx',
            '.xls',
            '.json',
            '.txt'
        ],
        maxFiles: 10,
        chunkSize: 5 * 1024 * 1024, // 5MB
        concurrency: 3
    },

    // 查询配置
    query: {
        maxResults: 10000,
        timeout: 60000,
        cacheDuration: 5 * 60 * 1000 // 5分钟
    },

    // 可视化配置
    visualization: {
        types: [
            { value: 'line', label: '折线图', icon: 'chart-line' },
            { value: 'bar', label: '柱状图', icon: 'chart-bar' },
            { value: 'pie', label: '饼图', icon: 'chart-pie' },
            { value: 'scatter', label: '散点图', icon: 'chart-scatter' },
            { value: 'heatmap', label: '热力图', icon: 'fire' },
            { value: 'funnel', label: '漏斗图', icon: 'filter' },
            { value: 'radar', label: '雷达图', icon: 'draw-polygon' },
            { value: 'gauge', label: '仪表盘', icon: 'tachometer-alt' }
        ],
        timeRanges: [
            { value: 'today', label: '今天' },
            { value: 'yesterday', label: '昨天' },
            { value: 'last7days', label: '最近7天' },
            { value: 'last30days', label: '最近30天' },
            { value: 'this_month', label: '本月' },
            { value: 'last_month', label: '上月' },
            { value: 'custom', label: '自定义' }
        ],
        dataSources: [
            { value: 'database', label: '数据库', icon: 'database' },
            { value: 'csv', label: 'CSV文件', icon: 'file-csv' },
            { value: 'api', label: 'API接口', icon: 'plug' }
        ]
    },

    // 日期格式配置
    dateFormat: {
        display: 'YYYY-MM-DD HH:mm:ss',
        input: 'YYYY-MM-DD',
        month: 'YYYY-MM',
        year: 'YYYY',
        time: 'HH:mm:ss'
    },

    // 通知配置
    notification: {
        duration: 5000,
        position: 'top-right',
        maxNotifications: 5
    },

    // 错误处理配置
    error: {
        showUser: true,
        logToConsole: true,
        maxRetry: 3
    },

    // 性能配置
    performance: {
        enableMonitoring: true,
        sampleRate: 0.1,
        reportThreshold: 2000
    }
};

// 开发环境特殊配置
if (process.env.NODE_ENV === 'development') {
    Config.api.baseURL = 'http://localhost:5000';
    Config.app.debug = true;
    Config.error.logToConsole = true;
}

// 生产环境特殊配置
if (process.env.NODE_ENV === 'production') {
    Config.api.baseURL = 'https://api.yourdomain.com';
    Config.app.debug = false;
    Config.error.showUser = false;
    Config.performance.enableMonitoring = true;
}

export default Config;
