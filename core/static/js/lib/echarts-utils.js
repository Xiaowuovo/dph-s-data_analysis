/**
 * ECharts工具库
 * 提供ECharts相关的工具函数和主题配置
 */
import Config from '../core/config.js';

class EChartsUtils {
    constructor() {
        this.charts = new Map();
        this.themes = {
            light: this.createLightTheme(),
            dark: this.createDarkTheme(),
            custom: this.createCustomTheme()
        };

        this.initThemes();
    }

    /**
     * 初始化主题
     */
    initThemes() {
        Object.entries(this.themes).forEach(([name, theme]) => {
            if (window.echarts) {
                window.echarts.registerTheme(name, theme);
            }
        });
    }

    /**
     * 创建明亮主题
     */
    createLightTheme() {
        return {
            color: Config.chart.colors,
            backgroundColor: '#ffffff',
            textStyle: {
                color: '#333',
                fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
                fontSize: 12
            },
            title: {
                textStyle: {
                    color: '#333',
                    fontSize: 16,
                    fontWeight: 'bold'
                },
                subtextStyle: {
                    color: '#666',
                    fontSize: 12
                },
                left: 'center',
                padding: [10, 0, 10, 0]
            },
            legend: {
                type: 'scroll',
                orient: 'horizontal',
                left: 'center',
                top: 30,
                itemWidth: 20,
                itemHeight: 10,
                textStyle: {
                    fontSize: 12
                },
                pageIconColor: '#666',
                pageIconInactiveColor: '#ccc',
                pageTextStyle: {
                    color: '#666'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e4e7ed',
                borderWidth: 1,
                textStyle: {
                    color: '#333',
                    fontSize: 12
                },
                extraCssText: 'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);',
                trigger: 'axis',
                axisPointer: {
                    type: 'line',
                    lineStyle: {
                        color: '#6f068b',
                        width: 1
                    }
                }
            },
            grid: {
                left: 50,
                right: 20,
                top: 60,
                bottom: 40,
                containLabel: true
            },
            xAxis: {
                type: 'category',
                axisLine: {
                    lineStyle: {
                        color: '#e4e7ed'
                    }
                },
                axisTick: {
                    show: false
                },
                axisLabel: {
                    color: '#666',
                    fontSize: 12
                },
                splitLine: {
                    show: false
                }
            },
            yAxis: {
                type: 'value',
                axisLine: {
                    show: false
                },
                axisTick: {
                    show: false
                },
                axisLabel: {
                    color: '#666',
                    fontSize: 12
                },
                splitLine: {
                    lineStyle: {
                        color: '#f0f0f0',
                        type: 'dashed'
                    }
                }
            },
            toolbox: {
                feature: {
                    saveAsImage: {
                        title: '保存图片',
                        pixelRatio: 2
                    },
                    dataView: {
                        title: '数据视图',
                        readOnly: true,
                        lang: ['数据视图', '关闭', '刷新']
                    },
                    restore: {
                        title: '还原'
                    },
                    dataZoom: {
                        title: {
                            zoom: '区域缩放',
                            back: '还原缩放'
                        }
                    },
                    magicType: {
                        type: ['line', 'bar'],
                        title: {
                            line: '切换为折线图',
                            bar: '切换为柱状图'
                        }
                    }
                },
                right: 20,
                top: 10
            },
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: 0,
                    start: 0,
                    end: 100
                },
                {
                    type: 'slider',
                    xAxisIndex: 0,
                    start: 0,
                    end: 100,
                    bottom: 10,
                    height: 20,
                    backgroundColor: '#f5f5f5',
                    borderColor: '#e8e8e8',
                    fillerColor: 'rgba(111, 6, 139, 0.1)',
                    dataBackground: {
                        lineStyle: {
                            color: '#6f068b',
                            opacity: 0.3
                        },
                        areaStyle: {
                            color: '#6f068b',
                            opacity: 0.1
                        }
                    },
                    selectedDataBackground: {
                        lineStyle: {
                            color: '#6f068b',
                            opacity: 0.6
                        },
                        areaStyle: {
                            color: '#6f068b',
                            opacity: 0.3
                        }
                    },
                    handleSize: 20,
                    handleStyle: {
                        color: '#6f068b',
                        borderColor: '#6f068b',
                        borderWidth: 1
                    }
                }
            ],
            series: {
                bar: {
                    barWidth: '60%',
                    itemStyle: {
                        borderRadius: [2, 2, 0, 0]
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: 'rgba(0, 0, 0, 0.3)'
                        }
                    }
                },
                line: {
                    smooth: true,
                    lineStyle: {
                        width: 3
                    },
                    symbolSize: 8,
                    symbol: 'circle',
                    emphasis: {
                        focus: 'series',
                        itemStyle: {
                            borderWidth: 2,
                            borderColor: '#fff',
                            shadowBlur: 4,
                            shadowColor: 'rgba(0, 0, 0, 0.3)'
                        }
                    },
                    areaStyle: {
                        opacity: 0.1
                    }
                },
                pie: {
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    itemStyle: {
                        borderRadius: 6,
                        borderColor: '#fff',
                        borderWidth: 2
                    },
                    label: {
                        show: true,
                        formatter: '{b}: {d}%',
                        fontSize: 12
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                },
                scatter: {
                    symbolSize: 10,
                    emphasis: {
                        label: {
                            show: true,
                            formatter: function (param) {
                                return param.data[2];
                            },
                            position: 'top'
                        }
                    }
                }
            }
        };
    }

    /**
     * 创建深色主题
     */
    createDarkTheme() {
        const lightTheme = this.createLightTheme();
        return {
            ...lightTheme,
            backgroundColor: '#1e1e1e',
            textStyle: {
                ...lightTheme.textStyle,
                color: '#e0e0e0'
            },
            title: {
                ...lightTheme.title,
                textStyle: {
                    ...lightTheme.title.textStyle,
                    color: '#ffffff'
                },
                subtextStyle: {
                    ...lightTheme.title.subtextStyle,
                    color: '#b0b0b0'
                }
            },
            legend: {
                ...lightTheme.legend,
                textStyle: {
                    color: '#e0e0e0'
                },
                pageIconColor: '#b0b0b0',
                pageTextStyle: {
                    color: '#b0b0b0'
                }
            },
            tooltip: {
                ...lightTheme.tooltip,
                backgroundColor: 'rgba(40, 40, 40, 0.95)',
                borderColor: '#444',
                textStyle: {
                    color: '#e0e0e0'
                }
            },
            xAxis: {
                ...lightTheme.xAxis,
                axisLine: {
                    lineStyle: {
                        color: '#444'
                    }
                },
                axisLabel: {
                    color: '#b0b0b0'
                }
            },
            yAxis: {
                ...lightTheme.yAxis,
                axisLabel: {
                    color: '#b0b0b0'
                },
                splitLine: {
                    lineStyle: {
                        color: '#333'
                    }
                }
            },
            dataZoom: [
                {
                    ...lightTheme.dataZoom[0]
                },
                {
                    ...lightTheme.dataZoom[1],
                    backgroundColor: '#2a2a2a',
                    borderColor: '#444',
                    fillerColor: 'rgba(111, 6, 139, 0.2)',
                    handleStyle: {
                        color: '#6f068b',
                        borderColor: '#6f068b'
                    }
                }
            ]
        };
    }

    /**
     * 创建自定义主题
     */
    createCustomTheme() {
        return {
            ...this.createLightTheme(),
            color: [
                '#6f068b', '#4a0578', '#8a2be2', '#9370db',
                '#32cd32', '#ff7f50', '#6495ed', '#da70d6',
                '#20b2aa', '#ff6347', '#4682b4', '#dda0dd'
            ],
            backgroundColor: 'rgba(255, 255, 255, 0)',
            textStyle: {
                color: '#333',
                fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
                fontSize: 12
            }
        };
    }

    /**
     * 获取主题
     */
    getTheme(name = 'custom') {
        return this.themes[name] || this.themes.custom;
    }

    /**
     * 创建图表容器
     */
    createChartContainer(id, options = {}) {
        const { width = '100%', height = '400px', className = '' } = options;

        const container = document.getElementById(id);
        if (!container) {
            console.error(`图表容器 ${id} 不存在`);
            return null;
        }

        container.style.width = width;
        container.style.height = height;

        if (className) {
            container.className = className;
        }

        return container;
    }

    /**
     * 初始化图表
     */
    initChart(containerId, theme = 'custom') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`图表容器 ${containerId} 不存在`);
            return null;
        }

        const chart = echarts.init(container, theme);
        this.charts.set(containerId, chart);

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            chart.resize();
        });

        return chart;
    }

    /**
     * 销毁图表
     */
    disposeChart(containerId) {
        const chart = this.charts.get(containerId);
        if (chart && !chart.isDisposed()) {
            chart.dispose();
            this.charts.delete(containerId);
        }
    }

    /**
     * 销毁所有图表
     */
    disposeAllCharts() {
        this.charts.forEach((chart, containerId) => {
            if (!chart.isDisposed()) {
                chart.dispose();
            }
        });
        this.charts.clear();
    }

    /**
     * 设置图表主题
     */
    setTheme(containerId, themeName) {
        const chart = this.charts.get(containerId);
        if (chart) {
            const theme = this.getTheme(themeName);
            chart.dispose();
            const newChart = echarts.init(chart.getDom(), theme);
            this.charts.set(containerId, newChart);
            return newChart;
        }
        return null;
    }

    /**
     * 响应式调整图表大小
     */
    resizeChart(containerId) {
        const chart = this.charts.get(containerId);
        if (chart) {
            chart.resize();
        }
    }

    /**
     * 响应式调整所有图表大小
     */
    resizeAllCharts() {
        this.charts.forEach(chart => {
            chart.resize();
        });
    }

    /**
     * 导出图表为图片
     */
    exportChart(containerId, options = {}) {
        const chart = this.charts.get(containerId);
        if (!chart) {
            console.error(`图表 ${containerId} 不存在`);
            return null;
        }

        const defaultOptions = {
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#fff',
            fileName: `chart_${containerId}_${Date.now()}`
        };

        const exportOptions = { ...defaultOptions, ...options };

        const dataURL = chart.getDataURL(exportOptions);

        if (exportOptions.download !== false) {
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `${exportOptions.fileName}.${exportOptions.type}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        return dataURL;
    }

    /**
     * 导出所有图表
     */
    exportAllCharts(options = {}) {
        const chartsData = {};
        this.charts.forEach((chart, containerId) => {
            chartsData[containerId] = this.exportChart(containerId, {
                ...options,
                download: false
            });
        });
        return chartsData;
    }

    /**
     * 显示加载动画
     */
    showLoading(containerId, options = {}) {
        const chart = this.charts.get(containerId);
        if (chart) {
            const defaultOptions = {
                text: '加载中...',
                color: '#6f068b',
                textColor: '#333',
                maskColor: 'rgba(255, 255, 255, 0.8)',
                zlevel: 0
            };
            chart.showLoading({ ...defaultOptions, ...options });
        }
    }

    /**
     * 隐藏加载动画
     */
    hideLoading(containerId) {
        const chart = this.charts.get(containerId);
        if (chart) {
            chart.hideLoading();
        }
    }

    /**
     * 创建工具提示格式
     */
    createTooltipFormatter(type, params) {
        switch (type) {
            case 'currency':
                return (params) => {
                    const data = Array.isArray(params) ? params[0] : params;
                    return `
                        <div style="padding: 8px;">
                            <div style="font-weight: bold; margin-bottom: 4px;">${data.name || data.seriesName}</div>
                            <div>${data.seriesName}: ¥${data.value.toLocaleString()}</div>
                        </div>
                    `;
                };

            case 'percentage':
                return (params) => {
                    const data = Array.isArray(params) ? params[0] : params;
                    return `
                        <div style="padding: 8px;">
                            <div style="font-weight: bold; margin-bottom: 4px;">${data.name || data.seriesName}</div>
                            <div>${data.seriesName}: ${data.value}%</div>
                        </div>
                    `;
                };

            case 'multiSeries':
                return (params) => {
                    let html = `<div style="padding: 8px;">`;
                    params.forEach(param => {
                        const marker = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};margin-right:5px;"></span>`;
                        html += `
                            <div style="margin: 2px 0;">
                                ${marker} ${param.seriesName}: ${param.value}
                            </div>
                        `;
                    });
                    html += `</div>`;
                    return html;
                };

            default:
                return null;
        }
    }

    /**
     * 注册自定义主题
     */
    registerCustomTheme(name, themeConfig) {
        if (window.echarts) {
            window.echarts.registerTheme(name, {
                ...this.getTheme('custom'),
                ...themeConfig
            });
            this.themes[name] = themeConfig;
        }
    }

    /**
     * 获取所有可用主题
     */
    getAvailableThemes() {
        return Object.keys(this.themes);
    }

    /**
     * 清理不存在的图表
     */
    cleanupCharts() {
        this.charts.forEach((chart, containerId) => {
            const container = document.getElementById(containerId);
            if (!container || chart.isDisposed()) {
                this.charts.delete(containerId);
            }
        });
    }
}

// 创建ECharts工具实例
const echartsUtils = new EChartsUtils();

// 导出工具实例
export default echartsUtils;
