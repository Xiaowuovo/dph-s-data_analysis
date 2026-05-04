/**
 * 图表管理器
 * 封装ECharts图表的创建、配置和管理
 */
import Config from '../core/config.js';
import Utils from '../core/utils.js';
import DataProcessor from './data-processor.js';
import EChartsUtils from './echarts-utils.js';

class ChartManager {
    constructor() {
        this.echartsUtils = EChartsUtils;
        this.dataProcessor = DataProcessor;
        this.charts = new Map();
        this.chartConfigs = {};

        this.initDefaultConfigs();
    }

    /**
     * 初始化默认图表配置
     */
    initDefaultConfigs() {
        this.chartConfigs = {
            line: this.getLineChartConfig(),
            bar: this.getBarChartConfig(),
            pie: this.getPieChartConfig(),
            scatter: this.getScatterChartConfig(),
            heatmap: this.getHeatmapChartConfig(),
            funnel: this.getFunnelChartConfig(),
            radar: this.getRadarChartConfig(),
            gauge: this.getGaugeChartConfig(),
            map: this.getMapChartConfig()
        };
    }

    /**
     * 创建图表
     */
    createChart(containerId, chartType, data, options = {}) {
        try {
            // 检查容器是否存在
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`图表容器 ${containerId} 不存在`);
                return null;
            }

            // 初始化图表
            const theme = options.theme || Config.chart.theme || 'custom';
            const chart = this.echartsUtils.initChart(containerId, theme);

            if (!chart) {
                console.error(`图表初始化失败: ${containerId}`);
                return null;
            }

            // 获取图表配置
            const chartConfig = this.getChartConfig(chartType, options);

            // 处理数据
            const chartData = this.processChartData(data, chartType, options);

            // 合并配置
            const finalOptions = this.mergeOptions(chartConfig, chartData, options);

            // 设置配置
            chart.setOption(finalOptions, true);

            // 保存图表引用
            this.charts.set(containerId, {
                instance: chart,
                type: chartType,
                options: finalOptions,
                data: chartData
            });

            // 添加事件监听
            this.bindChartEvents(chart, containerId, options);

            // 响应式处理
            this.setupResponsive(chart, containerId, options);

            return chart;

        } catch (error) {
            console.error(`创建图表失败 ${containerId}:`, error);
            return null;
        }
    }

    /**
     * 更新图表数据
     */
    updateChartData(containerId, newData, options = {}) {
        const chartInfo = this.charts.get(containerId);
        if (!chartInfo || !chartInfo.instance) {
            console.error(`图表不存在: ${containerId}`);
            return false;
        }

        try {
            const chart = chartInfo.instance;
            const chartData = this.processChartData(newData, chartInfo.type, options);

            // 更新数据
            chart.setOption({
                dataset: chartData.dataset,
                series: chartData.series
            }, {
                notMerge: options.replace || false
            });

            // 更新存储的数据
            chartInfo.data = chartData;
            chartInfo.options = this.mergeOptions(chartInfo.options, chartData, options);

            return true;

        } catch (error) {
            console.error(`更新图表数据失败 ${containerId}:`, error);
            return false;
        }
    }

    /**
     * 更新图表配置
     */
    updateChartOptions(containerId, newOptions) {
        const chartInfo = this.charts.get(containerId);
        if (!chartInfo || !chartInfo.instance) {
            console.error(`图表不存在: ${containerId}`);
            return false;
        }

        try {
            const chart = chartInfo.instance;
            const mergedOptions = this.mergeOptions(chartInfo.options, chartInfo.data, newOptions);

            chart.setOption(mergedOptions, true);
            chartInfo.options = mergedOptions;

            return true;

        } catch (error) {
            console.error(`更新图表配置失败 ${containerId}:`, error);
            return false;
        }
    }

    /**
     * 处理图表数据
     */
    processChartData(data, chartType, options = {}) {
        if (!data) {
            return {
                dataset: { source: [] },
                series: []
            };
        }

        const {
            xField = 'x',
            yField = 'y',
            seriesField = null,
            categoryField = null,
            valueField = 'value',
            timeField = 'time',
            dimensions = [],
            metrics = []
        } = options;

        let processedData = {
            dataset: { source: [] },
            series: []
        };

        try {
            switch (chartType) {
                case 'line':
                case 'bar':
                    processedData = this.processLineBarData(data, xField, yField, seriesField, options);
                    break;

                case 'pie':
                case 'funnel':
                    processedData = this.processPieFunnelData(data, categoryField, valueField, options);
                    break;

                case 'scatter':
                    processedData = this.processScatterData(data, xField, yField, seriesField, options);
                    break;

                case 'heatmap':
                    processedData = this.processHeatmapData(data, xField, yField, valueField, options);
                    break;

                case 'radar':
                    processedData = this.processRadarData(data, dimensions, metrics, options);
                    break;

                case 'gauge':
                    processedData = this.processGaugeData(data, valueField, options);
                    break;

                default:
                    processedData = this.processGenericData(data, options);
            }
        } catch (error) {
            console.error('数据处理失败:', error);
        }

        return processedData;
    }

    /**
     * 处理折线图/柱状图数据
     */
    processLineBarData(data, xField, yField, seriesField, options) {
        const processedData = {
            dataset: { source: [] },
            series: []
        };

        if (Array.isArray(data) && data.length > 0) {
            if (seriesField) {
                // 多系列数据
                const seriesGroups = {};
                const categories = new Set();

                data.forEach(item => {
                    const seriesName = item[seriesField];
                    const xValue = item[xField];
                    const yValue = item[yField];

                    if (!seriesGroups[seriesName]) {
                        seriesGroups[seriesName] = {};
                    }

                    seriesGroups[seriesName][xValue] = yValue;
                    categories.add(xValue);
                });

                // 构建数据集
                const sortedCategories = Array.from(categories).sort();
                const datasetSource = [['category', ...Object.keys(seriesGroups)]];

                sortedCategories.forEach(category => {
                    const row = [category];
                    Object.keys(seriesGroups).forEach(series => {
                        row.push(seriesGroups[series][category] || 0);
                    });
                    datasetSource.push(row);
                });

                processedData.dataset.source = datasetSource;

                // 构建系列
                Object.keys(seriesGroups).forEach((series, index) => {
                    processedData.series.push({
                        name: series,
                        type: options.chartType || 'line',
                        encode: {
                            x: 'category',
                            y: series
                        }
                    });
                });

            } else {
                // 单系列数据
                const sortedData = [...data].sort((a, b) => {
                    if (a[xField] < b[xField]) return -1;
                    if (a[xField] > b[xField]) return 1;
                    return 0;
                });

                const datasetSource = [[xField, yField]];
                sortedData.forEach(item => {
                    datasetSource.push([item[xField], item[yField]]);
                });

                processedData.dataset.source = datasetSource;

                processedData.series = [{
                    name: yField,
                    type: options.chartType || 'line',
                    encode: {
                        x: xField,
                        y: yField
                    }
                }];
            }
        }

        return processedData;
    }

    /**
     * 处理饼图/漏斗图数据
     */
    processPieFunnelData(data, categoryField, valueField, options) {
        const processedData = {
            dataset: { source: [] },
            series: []
        };

        if (Array.isArray(data) && data.length > 0) {
            const datasetSource = [[categoryField || 'category', valueField || 'value']];

            data.forEach(item => {
                datasetSource.push([
                    item[categoryField] || item.name,
                    item[valueField] || item.value
                ]);
            });

            processedData.dataset.source = datasetSource;

            processedData.series = [{
                type: options.chartType || 'pie',
                encode: {
                    itemName: categoryField || 'category',
                    value: valueField || 'value'
                },
                radius: options.radius || ['40%', '70%'],
                label: {
                    show: options.showLabel !== false,
                    formatter: options.labelFormatter || '{b}: {c} ({d}%)'
                }
            }];
        }

        return processedData;
    }

    /**
     * 处理散点图数据
     */
    processScatterData(data, xField, yField, seriesField, options) {
        const processedData = {
            dataset: { source: [] },
            series: []
        };

        if (Array.isArray(data) && data.length > 0) {
            if (seriesField) {
                const seriesGroups = {};

                data.forEach(item => {
                    const seriesName = item[seriesField];
                    if (!seriesGroups[seriesName]) {
                        seriesGroups[seriesName] = [];
                    }
                    seriesGroups[seriesName].push([item[xField], item[yField]]);
                });

                Object.entries(seriesGroups).forEach(([seriesName, seriesData]) => {
                    processedData.series.push({
                        name: seriesName,
                        type: 'scatter',
                        data: seriesData,
                        symbolSize: options.symbolSize || 10
                    });
                });

            } else {
                const scatterData = data.map(item => [item[xField], item[yField]]);

                processedData.series = [{
                    type: 'scatter',
                    data: scatterData,
                    symbolSize: options.symbolSize || 10
                }];
            }
        }

        return processedData;
    }

    /**
     * 处理热力图数据
     */
    processHeatmapData(data, xField, yField, valueField, options) {
        const processedData = {
            dataset: { source: [] },
            series: []
        };

        if (Array.isArray(data) && data.length > 0) {
            const xCategories = new Set();
            const yCategories = new Set();
            const dataMap = {};

            data.forEach(item => {
                const x = item[xField];
                const y = item[yField];
                const value = item[valueField];

                xCategories.add(x);
                yCategories.add(y);

                if (!dataMap[x]) {
                    dataMap[x] = {};
                }
                dataMap[x][y] = value;
            });

            const xArray = Array.from(xCategories);
            const yArray = Array.from(yCategories);

            const datasetSource = [['x', ...yArray]];

            xArray.forEach(x => {
                const row = [x];
                yArray.forEach(y => {
                    row.push(dataMap[x]?.[y] || 0);
                });
                datasetSource.push(row);
            });

            processedData.dataset.source = datasetSource;

            processedData.series = [{
                type: 'heatmap',
                encode: {
                    x: 'x',
                    y: 'y',
                    value: 'value'
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }];
        }

        return processedData;
    }

    /**
     * 处理雷达图数据
     */
    processRadarData(data, dimensions, metrics, options) {
        const processedData = {
            dataset: { source: [] },
            series: [],
            radar: {
                indicator: []
            }
        };

        if (Array.isArray(data) && data.length > 0) {
            // 构建指标
            dimensions.forEach(dimension => {
                const values = data.map(item => item[dimension]).filter(val => val !== undefined);
                if (values.length > 0) {
                    const max = Math.max(...values) * 1.2; // 增加20%的余量
                    processedData.radar.indicator.push({
                        name: dimension,
                        max: max
                    });
                }
            });

            // 构建数据集
            const datasetSource = [['product', ...dimensions]];

            metrics.forEach(metric => {
                const row = [metric];
                dimensions.forEach(dimension => {
                    const item = data.find(d => d.name === dimension);
                    row.push(item ? item[metric] : 0);
                });
                datasetSource.push(row);
            });

            processedData.dataset.source = datasetSource;

            // 构建系列
            processedData.series = [{
                type: 'radar',
                encode: {
                    itemName: 'product',
                    value: dimensions
                }
            }];
        }

        return processedData;
    }

    /**
     * 处理仪表盘数据
     */
    processGaugeData(data, valueField, options) {
        const processedData = {
            series: []
        };

        if (Array.isArray(data) && data.length > 0) {
            const value = data[0][valueField] || 0;

            processedData.series = [{
                type: 'gauge',
                detail: {
                    formatter: options.formatter || '{value}',
                    fontSize: 20
                },
                data: [{
                    value: value,
                    name: options.name || '值'
                }],
                min: options.min || 0,
                max: options.max || 100,
                splitNumber: options.splitNumber || 10,
                axisLine: {
                    lineStyle: {
                        width: 10
                    }
                },
                pointer: {
                    length: '60%',
                    width: 4
                }
            }];
        }

        return processedData;
    }

    /**
     * 处理通用数据
     */
    processGenericData(data, options) {
        if (Array.isArray(data) && data.length > 0) {
            if (Array.isArray(data[0])) {
                // 二维数组
                return {
                    dataset: { source: data },
                    series: [{
                        type: options.type || 'line'
                    }]
                };
            } else {
                // 对象数组
                const keys = Object.keys(data[0]);
                const datasetSource = [keys];

                data.forEach(item => {
                    const row = keys.map(key => item[key]);
                    datasetSource.push(row);
                });

                return {
                    dataset: { source: datasetSource },
                    series: keys.slice(1).map(key => ({
                        name: key,
                        type: options.type || 'line'
                    }))
                };
            }
        }

        return {
            dataset: { source: [] },
            series: []
        };
    }

    /**
     * 获取图表配置
     */
    getChartConfig(chartType, options = {}) {
        const baseConfig = this.chartConfigs[chartType] || this.chartConfigs.line;

        // 深拷贝配置
        const config = JSON.parse(JSON.stringify(baseConfig));

        // 应用自定义配置
        if (options.title) {
            config.title = { ...config.title, ...options.title };
        }

        if (options.legend) {
            config.legend = { ...config.legend, ...options.legend };
        }

        if (options.tooltip) {
            config.tooltip = { ...config.tooltip, ...options.tooltip };
        }

        if (options.grid) {
            config.grid = { ...config.grid, ...options.grid };
        }

        if (options.xAxis) {
            config.xAxis = { ...config.xAxis, ...options.xAxis };
        }

        if (options.yAxis) {
            config.yAxis = { ...config.yAxis, ...options.yAxis };
        }

        if (options.series) {
            if (Array.isArray(config.series)) {
                config.series = config.series.map((series, index) => ({
                    ...series,
                    ...(options.series[index] || options.series)
                }));
            } else {
                config.series = { ...config.series, ...options.series };
            }
        }

        if (options.visualMap) {
            config.visualMap = { ...config.visualMap, ...options.visualMap };
        }

        if (options.dataZoom) {
            config.dataZoom = options.dataZoom;
        }

        if (options.toolbox) {
            config.toolbox = { ...config.toolbox, ...options.toolbox };
        }

        return config;
    }

    /**
     * 获取折线图配置
     */
    getLineChartConfig() {
        return {
            title: {
                text: '折线图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'line'
                }
            },
            legend: {
                data: [],
                top: 30
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
                boundaryGap: false
            },
            yAxis: {
                type: 'value'
            },
            series: [],
            toolbox: {
                feature: {
                    saveAsImage: {},
                    dataView: {},
                    restore: {},
                    dataZoom: {}
                }
            }
        };
    }

    /**
     * 获取柱状图配置
     */
    getBarChartConfig() {
        const config = this.getLineChartConfig();
        config.series = [{
            type: 'bar',
            barWidth: '60%',
            itemStyle: {
                borderRadius: [2, 2, 0, 0]
            }
        }];
        return config;
    }

    /**
     * 获取饼图配置
     */
    getPieChartConfig() {
        return {
            title: {
                text: '饼图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                top: 'center'
            },
            series: [{
                name: '数据',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 6,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    formatter: '{b}: {d}%'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                labelLine: {
                    show: true
                }
            }],
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            }
        };
    }

    /**
     * 获取散点图配置
     */
    getScatterChartConfig() {
        return {
            title: {
                text: '散点图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: function (params) {
                    return `${params.seriesName}<br/>X: ${params.value[0]}<br/>Y: ${params.value[1]}`;
                }
            },
            legend: {
                data: [],
                top: 30
            },
            xAxis: {
                type: 'value',
                scale: true
            },
            yAxis: {
                type: 'value',
                scale: true
            },
            series: []
        };
    }

    /**
     * 获取热力图配置
     */
    getHeatmapChartConfig() {
        return {
            title: {
                text: '热力图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                position: 'top',
                formatter: function (params) {
                    return `${params.data[0]}<br/>${params.data[1]}: ${params.data[2]}`;
                }
            },
            grid: {
                left: 60,
                right: 20,
                top: 60,
                bottom: 40
            },
            xAxis: {
                type: 'category',
                data: [],
                splitArea: {
                    show: true
                }
            },
            yAxis: {
                type: 'category',
                data: [],
                splitArea: {
                    show: true
                }
            },
            visualMap: {
                min: 0,
                max: 100,
                calculable: true,
                orient: 'vertical',
                left: 'right',
                top: 'center',
                inRange: {
                    color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
                }
            },
            series: [{
                name: '热力图',
                type: 'heatmap',
                data: [],
                label: {
                    show: true
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };
    }

    /**
     * 获取漏斗图配置
     */
    getFunnelChartConfig() {
        return {
            title: {
                text: '漏斗图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b} : {c} ({d}%)'
            },
            legend: {
                data: [],
                top: 30
            },
            series: [{
                name: '漏斗图',
                type: 'funnel',
                left: '10%',
                top: 60,
                bottom: 60,
                width: '80%',
                min: 0,
                max: 100,
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 2,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{b}: {c}'
                },
                labelLine: {
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: 'solid'
                    }
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 1
                },
                emphasis: {
                    label: {
                        fontSize: 16
                    }
                }
            }]
        };
    }

    /**
     * 获取雷达图配置
     */
    getRadarChartConfig() {
        return {
            title: {
                text: '雷达图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item'
            },
            legend: {
                data: [],
                top: 30
            },
            radar: {
                indicator: []
            },
            series: [{
                name: '雷达图',
                type: 'radar',
                data: []
            }]
        };
    }

    /**
     * 获取仪表盘配置
     */
    getGaugeChartConfig() {
        return {
            title: {
                text: '仪表盘',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                formatter: '{a} <br/>{b} : {c}'
            },
            series: [{
                name: '仪表盘',
                type: 'gauge',
                detail: {
                    formatter: '{value}',
                    fontSize: 20,
                    fontWeight: 'bold'
                },
                data: [{
                    value: 50,
                    name: '完成率'
                }],
                min: 0,
                max: 100,
                splitNumber: 10,
                axisLine: {
                    lineStyle: {
                        width: 10,
                        color: [
                            [0.3, '#67e0e3'],
                            [0.7, '#37a2da'],
                            [1, '#fd666d']
                        ]
                    }
                },
                axisTick: {
                    distance: -15,
                    length: 8,
                    lineStyle: {
                        color: '#fff',
                        width: 2
                    }
                },
                splitLine: {
                    distance: -20,
                    length: 15,
                    lineStyle: {
                        color: '#fff',
                        width: 3
                    }
                },
                pointer: {
                    length: '60%',
                    width: 4
                },
                anchor: {
                    show: true,
                    showAbove: true,
                    size: 20,
                    itemStyle: {
                        borderWidth: 8
                    }
                },
                title: {
                    show: true,
                    offsetCenter: [0, '70%'],
                    fontSize: 16
                },
                detail: {
                    valueAnimation: true,
                    fontSize: 30,
                    offsetCenter: [0, '40%']
                }
            }]
        };
    }

    /**
     * 获取地图配置
     */
    getMapChartConfig() {
        return {
            title: {
                text: '地图',
                left: 'center',
                textStyle: {
                    fontSize: 18,
                    fontWeight: 'bold'
                }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}'
            },
            visualMap: {
                min: 0,
                max: 1000,
                left: 'left',
                top: 'bottom',
                text: ['高', '低'],
                calculable: true,
                inRange: {
                    color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695']
                }
            },
            series: [{
                name: '地图',
                type: 'map',
                mapType: 'china',
                roam: false,
                label: {
                    show: true
                },
                emphasis: {
                    label: {
                        show: true
                    }
                }
            }]
        };
    }

    /**
     * 合并配置
     */
    mergeOptions(baseConfig, chartData, options) {
        const merged = JSON.parse(JSON.stringify(baseConfig));

        // 合并数据集
        if (chartData.dataset) {
            merged.dataset = chartData.dataset;
        }

        // 合并系列
        if (chartData.series && chartData.series.length > 0) {
            if (Array.isArray(merged.series)) {
                merged.series = chartData.series.map((series, index) => ({
                    ...(merged.series[index] || {}),
                    ...series
                }));
            } else {
                merged.series = chartData.series;
            }
        }

        // 合并雷达图指标
        if (chartData.radar && chartData.radar.indicator) {
            merged.radar = merged.radar || {};
            merged.radar.indicator = chartData.radar.indicator;
        }

        // 应用自定义配置
        if (options.custom) {
            Object.assign(merged, options.custom);
        }

        return merged;
    }

    /**
     * 绑定图表事件
     */
    bindChartEvents(chart, containerId, options) {
        if (!chart || !options.events) return;

        Object.entries(options.events).forEach(([eventName, handler]) => {
            chart.on(eventName, (params) => {
                if (typeof handler === 'function') {
                    handler(params, chart, containerId);
                }
            });
        });
    }

    /**
     * 设置响应式
     */
    setupResponsive(chart, containerId, options) {
        if (options.responsive !== false) {
            const resizeHandler = () => {
                chart.resize();
            };

            window.addEventListener('resize', resizeHandler);

            // 存储事件处理器以便清理
            if (!this.chartEventHandlers) {
                this.chartEventHandlers = new Map();
            }
            this.chartEventHandlers.set(containerId, resizeHandler);
        }
    }

    /**
     * 销毁图表
     */
    disposeChart(containerId) {
        const chartInfo = this.charts.get(containerId);
        if (chartInfo && chartInfo.instance) {
            chartInfo.instance.dispose();
        }

        // 清理事件监听
        if (this.chartEventHandlers && this.chartEventHandlers.has(containerId)) {
            const handler = this.chartEventHandlers.get(containerId);
            window.removeEventListener('resize', handler);
            this.chartEventHandlers.delete(containerId);
        }

        this.charts.delete(containerId);
    }

    /**
     * 销毁所有图表
     */
    disposeAllCharts() {
        this.charts.forEach((chartInfo, containerId) => {
            this.disposeChart(containerId);
        });

        if (this.chartEventHandlers) {
            this.chartEventHandlers.clear();
        }
    }

    /**
     * 导出图表
     */
    exportChart(containerId, options = {}) {
        const chartInfo = this.charts.get(containerId);
        if (!chartInfo || !chartInfo.instance) {
            console.error(`图表不存在: ${containerId}`);
            return null;
        }

        const exportOptions = {
            type: options.type || 'png',
            pixelRatio: options.pixelRatio || 2,
            backgroundColor: options.backgroundColor || '#fff',
            fileName: options.fileName || `chart_${containerId}_${Date.now()}`
        };

        return this.echartsUtils.exportChart(containerId, exportOptions);
    }

    /**
     * 显示加载动画
     */
    showLoading(containerId, options = {}) {
        this.echartsUtils.showLoading(containerId, options);
    }

    /**
     * 隐藏加载动画
     */
    hideLoading(containerId) {
        this.echartsUtils.hideLoading(containerId);
    }

    /**
     * 获取图表实例
     */
    getChart(containerId) {
        const chartInfo = this.charts.get(containerId);
        return chartInfo ? chartInfo.instance : null;
    }

    /**
     * 获取所有图表
     */
    getAllCharts() {
        return this.charts;
    }

    /**
     * 清除所有图表
     */
    clearAllCharts() {
        this.disposeAllCharts();
    }
}

// 创建图表管理器实例
const chartManager = new ChartManager();

// 导出图表管理器
export default chartManager;
