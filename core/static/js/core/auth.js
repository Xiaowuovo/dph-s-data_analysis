/**
 * 认证管理模块
 * 处理用户登录、注册、会话管理等
 */
import Config from './config.js';
import Utils from './utils.js';

class AuthManager {
    constructor() {
        this.token = null;
        this.user = null;
        this.sessionExpiry = null;
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        const token = this.getStoredToken();
        if (!token) {
            return false;
        }

        try {
            const isValid = await this.validateToken(token);
            if (isValid) {
                this.token = token;
                await this.loadUserProfile();
                return true;
            }
        } catch (error) {
            console.warn('Token验证失败:', error);
        }

        this.clearAuth();
        return false;
    }

    /**
     * 验证Token
     */
    async validateToken(token) {
        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.check}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 登录
     */
    async login(username, password, rememberMe = false) {
        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.login}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, rememberMe })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.token = data.token;
                this.user = data.user;
                this.sessionExpiry = data.expires_at ? new Date(data.expires_at) : null;

                this.saveAuthToStorage();
                this.setupAutoRefresh();

                return {
                    success: true,
                    user: data.user,
                    token: data.token
                };
            } else {
                return {
                    success: false,
                    message: data.message || '登录失败'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    /**
     * 注册
     */
    async register(userData) {
        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.register}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return {
                    success: true,
                    message: data.message || '注册成功'
                };
            } else {
                return {
                    success: false,
                    message: data.message || '注册失败',
                    errors: data.errors
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    /**
     * 登出
     */
    async logout() {
        try {
            if (this.token) {
                await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.logout}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.warn('登出请求失败:', error);
        } finally {
            this.clearAuth();
        }
    }

    /**
     * 获取用户资料
     */
    async loadUserProfile() {
        if (!this.token) return;

        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.profile}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.user = data.user;
                this.saveAuthToStorage();
            }
        } catch (error) {
            console.warn('加载用户资料失败:', error);
        }
    }

    /**
     * 更新用户资料
     */
    async updateProfile(profileData) {
        if (!this.token) {
            return { success: false, message: '未登录' };
        }

        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.profile}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.user = { ...this.user, ...profileData };
                this.saveAuthToStorage();

                return {
                    success: true,
                    message: data.message || '更新成功',
                    user: this.user
                };
            } else {
                return {
                    success: false,
                    message: data.message || '更新失败',
                    errors: data.errors
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    /**
     * 修改密码
     */
    async changePassword(currentPassword, newPassword) {
        if (!this.token) {
            return { success: false, message: '未登录' };
        }

        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.changePassword}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return {
                    success: true,
                    message: data.message || '密码修改成功'
                };
            } else {
                return {
                    success: false,
                    message: data.message || '密码修改失败',
                    errors: data.errors
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    /**
     * 重置密码
     */
    async resetPassword(email) {
        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.resetPassword}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return {
                    success: true,
                    message: data.message || '重置密码邮件已发送'
                };
            } else {
                return {
                    success: false,
                    message: data.message || '重置密码失败'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    /**
     * 验证重置密码Token
     */
    async verifyResetToken(token) {
        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.verifyResetToken}/${token}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 设置新密码
     */
    async setNewPassword(token, newPassword) {
        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.setNewPassword}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                return {
                    success: true,
                    message: data.message || '密码重置成功'
                };
            } else {
                return {
                    success: false,
                    message: data.message || '密码重置失败'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: '网络错误，请检查连接'
            };
        }
    }

    /**
     * 检查权限
     */
    hasPermission(permission) {
        if (!this.user || !this.user.permissions) {
            return false;
        }
        return this.user.permissions.includes(permission);
    }

    /**
     * 检查角色
     */
    hasRole(role) {
        if (!this.user || !this.user.roles) {
            return false;
        }
        return this.user.roles.includes(role);
    }

    /**
     * 获取存储的Token
     */
    getStoredToken() {
        return localStorage.getItem(Config.storage.keys.authToken) ||
               sessionStorage.getItem(Config.storage.keys.authToken);
    }

    /**
     * 获取存储的用户信息
     */
    getStoredUser() {
        const userJson = localStorage.getItem(Config.storage.keys.userInfo) ||
                        sessionStorage.getItem(Config.storage.keys.userInfo);
        return userJson ? JSON.parse(userJson) : null;
    }

    /**
     * 保存认证信息到存储
     */
    saveAuthToStorage() {
        if (this.token) {
            if (this.sessionExpiry && this.sessionExpiry > new Date()) {
                localStorage.setItem(Config.storage.keys.authToken, this.token);
            } else {
                sessionStorage.setItem(Config.storage.keys.authToken, this.token);
            }
        }

        if (this.user) {
            const userJson = JSON.stringify(this.user);
            localStorage.setItem(Config.storage.keys.userInfo, userJson);
        }
    }

    /**
     * 清除认证信息
     */
    clearAuth() {
        this.token = null;
        this.user = null;
        this.sessionExpiry = null;

        localStorage.removeItem(Config.storage.keys.authToken);
        localStorage.removeItem(Config.storage.keys.userInfo);
        sessionStorage.removeItem(Config.storage.keys.authToken);
        sessionStorage.removeItem(Config.storage.keys.userInfo);
    }

    /**
     * 设置自动刷新
     */
    setupAutoRefresh() {
        if (this.sessionExpiry) {
            const refreshTime = this.sessionExpiry.getTime() - 5 * 60 * 1000; // 提前5分钟刷新
            const now = Date.now();

            if (refreshTime > now) {
                const timeout = refreshTime - now;
                setTimeout(() => this.refreshToken(), timeout);
            }
        }
    }

    /**
     * 刷新Token
     */
    async refreshToken() {
        if (!this.token) return;

        try {
            const response = await fetch(`${Config.api.baseURL}${Config.api.endpoints.auth.refresh}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.token = data.token;
                this.sessionExpiry = data.expires_at ? new Date(data.expires_at) : null;
                this.saveAuthToStorage();
                this.setupAutoRefresh();
            } else {
                this.clearAuth();
                window.dispatchEvent(new CustomEvent('auth:expired'));
            }
        } catch (error) {
            console.warn('刷新Token失败:', error);
        }
    }

    /**
     * 检查会话是否有效
     */
    isSessionValid() {
        if (!this.token || !this.sessionExpiry) {
            return false;
        }
        return new Date() < this.sessionExpiry;
    }

    /**
     * 获取剩余会话时间（分钟）
     */
    getRemainingSessionTime() {
        if (!this.isSessionValid()) {
            return 0;
        }
        return Math.floor((this.sessionExpiry - new Date()) / 60000);
    }
}

// 创建认证管理器实例
const auth = new AuthManager();

// 导出认证管理器
export default auth;
