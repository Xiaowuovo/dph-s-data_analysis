/**
 * 数据处理工具
 * 提供数据清洗、转换、分析等功能
 */
import Utils from '../core/utils.js';

class DataProcessor {
    constructor() {
        this.dataCache = new Map();
        this.processors = new Map();

        this.registerDefaultProcessors();
    }

    /**
     * 注册默认处理器
     */
    registerDefaultProcessors() {
        this.registerProcessor('clean', this.cleanData.bind(this));
        this.registerProcessor('transform', this.transformData.bind(this));
        this.registerProcessor('aggregate', this.aggregateData.bind(this));
        this.registerProcessor('filter', this.filterData.bind(this));
        this.registerProcessor('sort', this.sortData.bind(this));
        this.registerProcessor('group', this.groupData.bind(this));
    }

    /**
     * 注册处理器
     */
    registerProcessor(name, processor) {
        this.processors.set(name, processor);
    }

    /**
     * 获取处理器
     */
    getProcessor(name) {
        return this.processors.get(name);
    }

    /**
     * 处理数据
     */
    process(data, pipeline) {
        if (!Array.isArray(pipeline)) {
            return data;
        }

        let result = data;

        for (const step of pipeline) {
            const { name, params = {} } = step;
            const processor = this.getProcessor(name);

            if (processor) {
                result = processor(result, params);
            } else {
                console.warn(`处理器 ${name} 未注册`);
            }
        }

        return result;
    }

    /**
     * 清理数据
     */
    cleanData(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        const {
            removeDuplicates = true,
            fillMissing = true,
            normalizeTypes = true,
            trimStrings = true
        } = options;

        let cleanedData = [...data];

        // 1. 移除重复项
        if (removeDuplicates) {
            cleanedData = this.removeDuplicates(cleanedData);
        }

        // 2. 填充缺失值
        if (fillMissing) {
            cleanedData = this.fillMissingValues(cleanedData, options.fillStrategy);
        }

        // 3. 标准化数据类型
        if (normalizeTypes) {
            cleanedData = this.normalizeDataTypes(cleanedData);
        }

        // 4. 修剪字符串
        if (trimStrings) {
            cleanedData = this.trimStringValues(cleanedData);
        }

        return cleanedData;
    }

    /**
     * 移除重复项
     */
    removeDuplicates(data) {
        if (!Array.isArray(data)) return data;

        const seen = new Set();
        const result = [];

        for (const item of data) {
            const key = JSON.stringify(item);
            if (!seen.has(key)) {
                seen.add(key);
                result.push(item);
            }
        }

        return result;
    }

    /**
     * 填充缺失值
     */
    fillMissingValues(data, strategy = 'mean') {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        const numericColumns = this.detectNumericColumns(data);
        const filledData = [...data];

        for (const column of numericColumns) {
            const values = filledData.map(row => row[column]).filter(val => val !== null && val !== undefined && !isNaN(val));

            if (values.length === 0) continue;

            let fillValue;
            switch (strategy) {
                case 'mean':
                    fillValue = values.reduce((sum, val) => sum + Number(val), 0) / values.length;
                    break;
                case 'median':
                    const sorted = [...values].sort((a, b) => a - b);
                    fillValue = sorted[Math.floor(sorted.length / 2)];
                    break;
                case 'mode':
                    const frequency = {};
                    values.forEach(val => {
                        frequency[val] = (frequency[val] || 0) + 1;
                    });
                    const maxFreq = Math.max(...Object.values(frequency));
                    fillValue = Object.keys(frequency).find(key => frequency[key] === maxFreq);
                    break;
                case 'zero':
                    fillValue = 0;
                    break;
                default:
                    fillValue = 0;
            }

            filledData.forEach(row => {
                if (row[column] === null || row[column] === undefined || isNaN(row[column])) {
                    row[column] = Number(fillValue);
                }
            });
        }

        return filledData;
    }

    /**
     * 标准化数据类型
     */
    normalizeDataTypes(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        return data.map(row => {
            const normalizedRow = {};

            for (const [key, value] of Object.entries(row)) {
                if (value === null || value === undefined) {
                    normalizedRow[key] = value;
                } else if (typeof value === 'string') {
                    // 尝试转换为数字
                    const num = Number(value);
                    if (!isNaN(num) && value.trim() !== '') {
                        normalizedRow[key] = num;
                    } else {
                        // 尝试转换为布尔值
                        if (value.toLowerCase() === 'true' || value === '1') {
                            normalizedRow[key] = true;
                        } else if (value.toLowerCase() === 'false' || value === '0') {
                            normalizedRow[key] = false;
                        } else {
                            // 尝试转换为日期
                            const date = new Date(value);
                            if (!isNaN(date.getTime())) {
                                normalizedRow[key] = date;
                            } else {
                                normalizedRow[key] = value;
                            }
                        }
                    }
                } else {
                    normalizedRow[key] = value;
                }
            }

            return normalizedRow;
        });
    }

    /**
     * 修剪字符串
     */
    trimStringValues(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        return data.map(row => {
            const trimmedRow = {};

            for (const [key, value] of Object.entries(row)) {
                if (typeof value === 'string') {
                    trimmedRow[key] = value.trim();
                } else {
                    trimmedRow[key] = value;
                }
            }

            return trimmedRow;
        });
    }

    /**
     * 转换数据格式
     */
    transformData(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        const {
            columns = [],
            mappings = {},
            calculations = [],
            renameColumns = {}
        } = options;

        let transformedData = [...data];

        // 1. 重命名列
        if (Object.keys(renameColumns).length > 0) {
            transformedData = this.renameColumns(transformedData, renameColumns);
        }

        // 2. 列映射
        if (Object.keys(mappings).length > 0) {
            transformedData = this.applyMappings(transformedData, mappings);
        }

        // 3. 计算新列
        if (calculations.length > 0) {
            transformedData = this.applyCalculations(transformedData, calculations);
        }

        // 4. 选择列
        if (columns.length > 0) {
            transformedData = this.selectColumns(transformedData, columns);
        }

        return transformedData;
    }

    /**
     * 重命名列
     */
    renameColumns(data, renameMap) {
        return data.map(row => {
            const newRow = {};
            for (const [oldKey, newKey] of Object.entries(renameMap)) {
                if (oldKey in row) {
                    newRow[newKey] = row[oldKey];
                }
            }
            return { ...row, ...newRow };
        });
    }

    /**
     * 应用映射
     */
    applyMappings(data, mappings) {
        return data.map(row => {
            const mappedRow = { ...row };

            for (const [column, mapping] of Object.entries(mappings)) {
                if (column in mappedRow) {
                    const value = mappedRow[column];
                    if (mapping[value] !== undefined) {
                        mappedRow[column] = mapping[value];
                    }
                }
            }

            return mappedRow;
        });
    }

    /**
     * 应用计算
     */
    applyCalculations(data, calculations) {
        return data.map(row => {
            const calculatedRow = { ...row };

            for (const calc of calculations) {
                const { name, expression, dependencies = [] } = calc;

                try {
                    const context = {};
                    dependencies.forEach(dep => {
                        if (dep in row) {
                            context[dep] = row[dep];
                        }
                    });

                    // 简单的表达式计算
                    if (typeof expression === 'function') {
                        calculatedRow[name] = expression(context);
                    } else if (typeof expression === 'string') {
                        calculatedRow[name] = this.evaluateExpression(expression, context);
                    }
                } catch (error) {
                    console.warn(`计算列 ${name} 失败:`, error);
                    calculatedRow[name] = null;
                }
            }

            return calculatedRow;
        });
    }

    /**
     * 选择列
     */
    selectColumns(data, columns) {
        return data.map(row => {
            const selectedRow = {};
            columns.forEach(col => {
                if (col in row) {
                    selectedRow[col] = row[col];
                }
            });
            return selectedRow;
        });
    }

    /**
     * 聚合数据
     */
    aggregateData(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        const {
            groupBy = [],
            aggregations = {},
            sortBy = null,
            sortOrder = 'desc',
            limit = null
        } = options;

        // 分组数据
        const groups = this.groupData(data, groupBy);

        // 应用聚合函数
        const aggregatedData = [];

        for (const [groupKey, groupData] of Object.entries(groups)) {
            const aggregatedRow = {};

            // 添加分组键
            if (groupBy.length === 1) {
                aggregatedRow[groupBy[0]] = groupKey;
            } else {
                const keys = groupKey.split('|');
                groupBy.forEach((col, index) => {
                    aggregatedRow[col] = keys[index];
                });
            }

            // 应用聚合
            for (const [column, aggregation] of Object.entries(aggregations)) {
                const values = groupData.map(row => row[column]).filter(val => val !== null && val !== undefined);

                if (values.length === 0) {
                    aggregatedRow[column] = null;
                    continue;
                }

                switch (aggregation) {
                    case 'sum':
                        aggregatedRow[column] = values.reduce((sum, val) => sum + Number(val), 0);
                        break;
                    case 'average':
                    case 'mean':
                        aggregatedRow[column] = values.reduce((sum, val) => sum + Number(val), 0) / values.length;
                        break;
                    case 'median':
                        const sorted = [...values].sort((a, b) => a - b);
                        aggregatedRow[column] = sorted[Math.floor(sorted.length / 2)];
                        break;
                    case 'min':
                        aggregatedRow[column] = Math.min(...values);
                        break;
                    case 'max':
                        aggregatedRow[column] = Math.max(...values);
                        break;
                    case 'count':
                        aggregatedRow[column] = values.length;
                        break;
                    case 'distinct':
                        aggregatedRow[column] = new Set(values).size;
                        break;
                    case 'first':
                        aggregatedRow[column] = values[0];
                        break;
                    case 'last':
                        aggregatedRow[column] = values[values.length - 1];
                        break;
                    default:
                        aggregatedRow[column] = values[0];
                }
            }

            aggregatedData.push(aggregatedRow);
        }

        // 排序
        if (sortBy) {
            aggregatedData.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];

                if (sortOrder === 'desc') {
                    return bVal - aVal;
                } else {
                    return aVal - bVal;
                }
            });
        }

        // 限制数量
        if (limit && limit > 0) {
            return aggregatedData.slice(0, limit);
        }

        return aggregatedData;
    }

    /**
     * 过滤数据
     */
    filterData(data, conditions = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }

        if (Object.keys(conditions).length === 0) {
            return data;
        }

        return data.filter(row => {
            for (const [column, condition] of Object.entries(conditions)) {
                if (!this.checkCondition(row[column], condition)) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * 检查条件
     */
    checkCondition(value, condition) {
        if (typeof condition === 'function') {
            return condition(value);
        }

        if (Array.isArray(condition)) {
            return condition.includes(value);
        }

        if (condition && typeof condition === 'object') {
            const operators = Object.keys(condition);

            for (const op of operators) {
                switch (op) {
                    case '$eq':
                        if (value !== condition[op]) return false;
                        break;
                    case '$ne':
                        if (value === condition[op]) return false;
                        break;
                    case '$gt':
                        if (value <= condition[op]) return false;
                        break;
                    case '$gte':
                        if (value < condition[op]) return false;
                        break;
                    case '$lt':
                        if (value >= condition[op]) return false;
                        break;
                    case '$lte':
                        if (value > condition[op]) return false;
                        break;
                    case '$in':
                        if (!Array.isArray(condition[op]) || !condition[op].includes(value)) return false;
                        break;
                    case '$nin':
                        if (Array.isArray(condition[op]) && condition[op].includes(value)) return false;
                        break;
                    case '$regex':
                        const regex = new RegExp(condition[op]);
                        if (!regex.test(value)) return false;
                        break;
                    case '$contains':
                        if (typeof value !== 'string' || !value.includes(condition[op])) return false;
                        break;
                }
            }
            return true;
        }

        return value === condition;
    }

    /**
     * 排序数据
     */
    sortData(data, sortBy = []) {
        if (!Array.isArray(data) || data.length === 0 || sortBy.length === 0) {
            return data;
        }

        return [...data].sort((a, b) => {
            for (const sortItem of sortBy) {
                const { field, order = 'asc' } = sortItem;
                const aVal = a[field];
                const bVal = b[field];

                if (aVal === bVal) continue;

                if (order === 'asc') {
                    return aVal < bVal ? -1 : 1;
                } else {
                    return aVal > bVal ? -1 : 1;
                }
            }
            return 0;
        });
    }

    /**
     * 分组数据
     */
    groupData(data, groupBy = []) {
        if (!Array.isArray(data) || data.length === 0 || groupBy.length === 0) {
            return { '': data };
        }

        const groups = {};

        data.forEach(row => {
            const groupKey = groupBy.map(col => row[col]).join('|');

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }

            groups[groupKey].push(row);
        });

        return groups;
    }

    /**
     * 检测数值列
     */
    detectNumericColumns(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        const numericColumns = new Set();

        data.forEach(row => {
            for (const [key, value] of Object.entries(row)) {
                if (value !== null && value !== undefined && !isNaN(value) && typeof value !== 'boolean') {
                    numericColumns.add(key);
                }
            }
        });

        return Array.from(numericColumns);
    }

    /**
     * 评估表达式
     */
    evaluateExpression(expression, context) {
        try {
            // 创建安全的计算环境
            const safeContext = Object.create(null);
            Object.keys(context).forEach(key => {
                if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
                    safeContext[key] = context[key];
                }
            });

            // 使用Function构造函数创建安全的计算函数
            const func = new Function(...Object.keys(safeContext), `return ${expression}`);
            return func(...Object.values(safeContext));
        } catch (error) {
            console.error('表达式计算失败:', error, expression, context);
            return null;
        }
    }

    /**
     * 缓存数据
     */
    cacheData(key, data, ttl = 5 * 60 * 1000) { // 5分钟默认缓存
        const cacheItem = {
            data,
            timestamp: Date.now(),
            ttl
        };
        this.dataCache.set(key, cacheItem);

        // 清理过期缓存
        setTimeout(() => {
            this.dataCache.delete(key);
        }, ttl);

        return data;
    }

    /**
     * 获取缓存数据
     */
    getCachedData(key) {
        const cacheItem = this.dataCache.get(key);

        if (!cacheItem) {
            return null;
        }

        const now = Date.now();
        if (now - cacheItem.timestamp > cacheItem.ttl) {
            this.dataCache.delete(key);
            return null;
        }

        return cacheItem.data;
    }

    /**
     * 清理缓存
     */
    clearCache(key = null) {
        if (key) {
            this.dataCache.delete(key);
        } else {
            this.dataCache.clear();
        }
    }

    /**
     * 数据统计
     */
    getStatistics(data, column) {
        if (!Array.isArray(data) || data.length === 0 || !column) {
            return null;
        }

        const values = data
            .map(row => row[column])
            .filter(val => val !== null && val !== undefined && !isNaN(val))
            .map(Number);

        if (values.length === 0) {
            return null;
        }

        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;

        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        const min = Math.min(...values);
        const max = Math.max(...values);

        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            count: values.length,
            sum,
            mean,
            median,
            min,
            max,
            range: max - min,
            variance,
            stdDev,
            q1: sorted[Math.floor(sorted.length * 0.25)],
            q3: sorted[Math.floor(sorted.length * 0.75)],
            iqr: sorted[Math.floor(sorted.length * 0.75)] - sorted[Math.floor(sorted.length * 0.25)]
        };
    }

    /**
     * 转换数据为图表格式
     */
    convertToChartData(data, xField, yField, seriesField = null) {
        if (!Array.isArray(data) || data.length === 0) {
            return { xAxis: [], series: [] };
        }

        if (seriesField) {
            const seriesMap = new Map();

            data.forEach(item => {
                const seriesName = item[seriesField] || 'Unknown';
                if (!seriesMap.has(seriesName)) {
                    seriesMap.set(seriesName, []);
                }
                seriesMap.get(seriesName).push([item[xField], item[yField]]);
            });

            const series = Array.from(seriesMap.entries()).map(([name, data]) => ({
                name,
                type: 'line',
                data: data.sort((a, b) => a[0] - b[0])
            }));

            return { series };

        } else {
            const chartData = data
                .map(item => [item[xField], item[yField]])
                .sort((a, b) => a[0] - b[0]);

            return {
                series: [{
                    name: yField,
                    type: 'line',
                    data: chartData
                }]
            };
        }
    }

    /**
     * 转换数据为饼图格式
     */
    convertToPieData(data, nameField, valueField) {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        return data.map(item => ({
            name: item[nameField],
            value: item[valueField]
        }));
    }
}

// 创建数据处理实例
const dataProcessor = new DataProcessor();

// 导出处理器实例
export default dataProcessor;
