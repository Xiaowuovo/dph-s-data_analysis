// static/js/analysis.js
// 电商消费者购物行为可视化系统 - 分析页面交互逻辑

document.addEventListener('DOMContentLoaded', function() {
    // 数值动画效果
    function animateValue(element, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const value = Math.floor(progress * (end - start) + start);
            element.textContent = value.toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // 页面加载时的动画效果
    setTimeout(() => {
        const metrics = document.querySelectorAll('.metric-value');
        metrics.forEach(metric => {
            const currentText = metric.textContent;
            if (currentText.includes(',')) {
                const numericValue = parseInt(currentText.replace(/,/g, ''));
                metric.textContent = '0';
                animateValue(metric, 0, numericValue, 2000);
            }
        });
    }, 500);

    // 交互效果 - 矩阵单元格点击
    const matrixCells = document.querySelectorAll('.matrix-cell');
    matrixCells.forEach(cell => {
        cell.addEventListener('click', function() {
            // 移除其他单元格的激活状态
            matrixCells.forEach(c => c.classList.remove('active'));
            // 添加当前单元格激活状态
            this.classList.add('active');

            // 可以在这里添加详细数据展示逻辑
            const cellType = this.classList[1];
            showCellDetails(cellType);
        });
    });

    // 显示单元格详情函数
    function showCellDetails(cellType) {
        // 这里可以添加AJAX请求获取详细数据
        console.log('点击了:', cellType);
        // 实际应用中可以通过AJAX加载详细数据
    }

    // 图表容器初始化（如果使用ECharts）
    function initCharts() {
        // 检查是否加载了ECharts
        if (typeof echarts !== 'undefined') {
            // 初始化转化漏斗图表
            initFunnelChart();
            // 初始化RFM矩阵图表
            initRFMChart();
        }
    }

    // 初始化转化漏斗图表
    function initFunnelChart() {
        funnelChart = echarts.init(document.getElementById('funnel-chart'));
        const option = {
            // ECharts配置选项
        };
        funnelChart.setOption(option);
    }

    // 页面滚动动画效果
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // 观察需要动画的元素
    const animateElements = document.querySelectorAll('.metric-card, .analysis-section');
    animateElements.forEach(el => observer.observe(el));

    // 数据自动刷新（如果需要）
    function startAutoRefresh() {
        setInterval(() => {
            // 每5分钟刷新一次数据
            refreshData();
        }, 300000);
    }

    // 数据刷新函数
    function refreshData() {
        fetch('/api/analysis/latest')
            .then(response => response.json())
            .then(data => {
                updateDashboard(data);
            })
            .catch(error => {
                console.error('数据刷新失败:', error);
            });
    }

    // 初始化所有功能
    initCharts();
});

// CSS动画类
const style = document.createElement('style');
style.textContent = `
    .animate-in {
        animation: fadeInUp 0.6s ease-out;
    }
    
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .matrix-cell.active {
        transform: scale(1.05);
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        z-index: 10;
    }
`;
document.head.appendChild(style);
