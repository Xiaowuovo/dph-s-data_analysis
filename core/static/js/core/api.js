
/**
 * API接口封装
 * 统一处理所有API请求
 */
import Config from './config.js';
import Utils from './utils.js';

class API {
    constructor() {
        this.baseURL = Config.api.baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        this.interceptors = {
            request: [],
            response: []
        };
    }

    /**
     * 设置认证token
     */
    setAuthToken(token) {
        if (token) {
            this.defaultHeaders['Authorization'] = `Bearer ${token}`;
        } else {
            delete this.defaultHeaders['Authorization'];
        }
    }

    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    /**
     * 执行请求
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method,
            headers: { ...this.defaultHeaders, ...options.headers },
            timeout: options.timeout || Config.api.timeout
        };

        // 处理请求数据
        if (data) {
            if (data instanceof FormData) {
                delete config.headers['Content-Type'];
                config.body = data;
            } else {
                config.body = JSON.stringify(data);
            }
        }

        // 应用请求拦截器
        let requestConfig = config;
        for (const interceptor of this.interceptors.request) {
            requestConfig = await interceptor(requestConfig);
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestConfig.timeout);

            requestConfig.signal = controller.signal;
            const response = await fetch(url, requestConfig);

            clearTimeout(timeoutId);

            // 应用响应拦截器
            let processedResponse = response;
            for (const interceptor of this.interceptors.response) {
                processedResponse = await interceptor(processedResponse);
            }

            return await this.handleResponse(processedResponse);

        } catch (error) {
            return this.handleError(error, url);
        }
    }

    /**
     * 处理响应
     */
    async handleResponse(response) {
        const contentType = response.headers.get('content-type');

        if (!response.ok) {
            const error = await this.parseError(response);
            throw error;
        }

        if (contentType && contentType.includes('application/json')) {
            return response.json();
        } else if (contentType && contentType.includes('text/')) {
            return response.text();
        } else if (contentType && contentType.includes('application/octet-stream')) {
            return response.blob();
        } else {
            return response;
        }
    }

    /**
     * 解析错误
     */
    async parseError(response) {
        try {
            const errorData = await response.json();
            return {
                status: response.status,
                message: errorData.message || '请求失败',
                errors: errorData.errors,
                url: response.url
            };
        } catch (e) {
            return {
                status: response.status,
                message: `请求失败: ${response.statusText}`,
                url: response.url
            };
        }
    }

    /**
     * 处理错误
     */
    handleError(error, url) {
        console.error('API请求失败:', error);

        if (error.name === 'AbortError') {
            throw {
                status: 408,
                message: '请求超时',
                url
            };
        } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw {
                status: 0,
                message: '网络连接失败',
                url
            };
        } else {
            throw {
                status: 500,
                message: error.message || '未知错误',
                url
            };
        }
    }

    /**
     * GET请求
     */
    async get(endpoint, params = {}, options = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request('GET', url, null, options);
    }

    /**
     * POST请求
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    /**
     * PUT请求
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    /**
     * PATCH请求
     */
    async patch(endpoint, data = {}, options = {}) {
        return this.request('PATCH', endpoint, data, options);
    }

    /**
     * DELETE请求
     */
    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    /**
     * 文件上传
     */
    async upload(endpoint, file, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (event) => {
                if (onProgress && event.lengthComputable) {
                    const percent = Math.round((event.loaded * 100) / event.total);
                    onProgress(percent);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (e) {
                        reject({ message: '响应解析失败' });
                    }
                } else {
                    reject({
                        status: xhr.status,
                        message: xhr.statusText
                    });
                }
            });

            xhr.addEventListener('error', () => {
                reject({ message: '上传失败' });
            });

            xhr.addEventListener('abort', () => {
                reject({ message: '上传取消' });
            });

            xhr.open('POST', `${this.baseURL}${endpoint}`);

            // 设置认证头
            if (this.defaultHeaders.Authorization) {
                xhr.setRequestHeader('Authorization', this.defaultHeaders.Authorization);
            }

            xhr.send(formData);
        });
    }

    /**
     * 下载文件
     */
    async download(endpoint, filename, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseURL}${endpoint}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': this.defaultHeaders.Authorization || ''
            }
        });

        if (!response.ok) {
            throw new Error('下载失败');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }
}

// 创建API实例
const api = new API();

// 导出API实例
export default api;
