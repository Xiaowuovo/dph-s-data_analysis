/**
 * 工具函数库
 * 提供通用的工具方法
 */
class Utils {
    /**
     * 格式化数字
     * @param {number} num - 要格式化的数字
     * @param {Object} options - 格式化选项
     * @returns {string} 格式化后的字符串
     */
    static formatNumber(num, options = {}) {
        if (num === null || num === undefined || isNaN(num)) return '0';

        const {
            decimals = 2,
            prefix = '',
            suffix = '',
            thousandSeparator = true
        } = options;

        // 处理小数
        let formatted = Number(num).toFixed(decimals);

        // 千分位分隔符
        if (thousandSeparator) {
            const parts = formatted.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            formatted = parts.join('.');
        }

        return `${prefix}${formatted}${suffix}`;
    }

    /**
     * 格式化日期
     * @param {Date|string} date - 日期
     * @param {string} format - 格式模板
     * @returns {string} 格式化后的日期字符串
     */
    static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        if (!date) return '';

        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const pad = (n) => String(n).padStart(2, '0');
        const pad3 = (n) => String(n).padStart(3, '0');

        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();
        const milliseconds = d.getMilliseconds();

        const replacements = {
            'YYYY': year,
            'YY': String(year).slice(-2),
            'MM': pad(month),
            'DD': pad(day),
            'HH': pad(hours),
            'mm': pad(minutes),
            'ss': pad(seconds),
            'SSS': pad3(milliseconds)
        };

        return format.replace(/YYYY|YY|MM|DD|HH|mm|ss|SSS/g, match => replacements[match]);
    }

    /**
     * 防抖函数
     * @param {Function} func - 要执行的函数
     * @param {number} wait - 等待时间(毫秒)
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     * @param {Function} func - 要执行的函数
     * @param {number} limit - 时间限制(毫秒)
     * @returns {Function} 节流后的函数
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * 深度克隆对象
     * @param {*} obj - 要克隆的对象
     * @returns {*} 克隆后的对象
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));

        const cloned = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟时间(毫秒)
     * @returns {Promise} 延迟完成的Promise
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 生成UUID
     * @returns {string} UUID字符串
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 验证邮箱格式
     * @param {string} email - 邮箱地址
     * @returns {boolean} 是否有效
     */
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * 验证手机号码
     * @param {string} phone - 手机号码
     * @returns {boolean} 是否有效
     */
    static validatePhone(phone) {
        const re = /^1[3-9]\d{9}$/;
        return re.test(phone);
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的文件大小
     */
    static getFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 格式化时间间隔
     * @param {Date|string} date - 过去的日期
     * @returns {string} 格式化的时间间隔
     */
    static formatTimeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diff = now.getTime() - past.getTime();

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        return '刚刚';
    }

    /**
     * 安全解析JSON
     * @param {string} str - JSON字符串
     * @param {*} defaultValue - 解析失败时的默认值
     * @returns {*} 解析结果或默认值
     */
    static safeParseJSON(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (error) {
            console.warn('JSON解析失败:', error);
            return defaultValue;
        }
    }

    /**
     * 将FormData转换为对象
     * @param {FormData} formData - FormData对象
     * @returns {Object} 转换后的对象
     */
    static formDataToObject(formData) {
        const obj = {};
        for (let [key, value] of formData.entries()) {
            obj[key] = value;
        }
        return obj;
    }

    /**
     * 下载文件
     * @param {string} url - 文件URL
     * @param {string} filename - 文件名
     */
    static downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * 复制文本到剪贴板
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 是否成功
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    }
}

export default Utils;
