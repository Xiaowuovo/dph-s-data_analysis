/**
 * 登录页面模块
 * 处理用户认证和登录
 */
import API from '../core/api.js';
import Utils from '../core/utils.js';
import Auth from '../core/auth.js';

class LoginModule {
    constructor() {
        this.loginForm = null;
        this.registerForm = null;
        this.forgotPasswordForm = null;
        this.currentView = 'login';
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('🔐 初始化登录模块...');

            // 检查是否已登录
            if (Auth.isAuthenticated()) {
                this.redirectToDashboard();
                return;
            }

            this.initUI();
            this.initEventListeners();
            this.setupFormValidation();

            console.log('✅ 登录模块初始化完成');
        } catch (error) {
            console.error('❌ 登录模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.setupLoginView();
    }

    /**
     * 设置登录视图
     */
    setupLoginView() {
        const container = document.getElementById('login-container');
        if (!container) return;

        container.innerHTML = `
            <div class="login-wrapper">
                <div class="login-header">
                    <div class="logo">
                        <i class="fas fa-chart-pie"></i>
                        <h1>数据智能分析平台</h1>
                    </div>
                    <p class="slogan">让数据洞察触手可及</p>
                </div>
                
                <div class="login-body">
                    <!-- 登录表单 -->
                    <form id="login-form" class="form-container active">
                        <h2>用户登录</h2>
                        
                        <div class="form-group">
                            <label for="login-username">用户名/邮箱</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-user"></i>
                                    </span>
                                </div>
                                <input type="text" 
                                       id="login-username" 
                                       class="form-control" 
                                       placeholder="请输入用户名或邮箱"
                                       required>
                            </div>
                            <div class="invalid-feedback">请输入有效的用户名或邮箱</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="login-password">密码</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-lock"></i>
                                    </span>
                                </div>
                                <input type="password" 
                                       id="login-password" 
                                       class="form-control" 
                                       placeholder="请输入密码"
                                       required>
                                <div class="input-group-append">
                                    <button type="button" class="btn btn-outline" id="toggle-password">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="invalid-feedback">请输入密码</div>
                        </div>
                        
                        <div class="form-options">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="remember-me">
                                <label class="form-check-label" for="remember-me">记住我</label>
                            </div>
                            <a href="javascript:void(0)" id="forgot-password-link">忘记密码？</a>
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-block" id="login-submit">
                            <span class="btn-text">登录</span>
                            <span class="spinner-border spinner-border-sm d-none" role="status"></span>
                        </button>
                        
                        <div class="login-divider">
                            <span>或</span>
                        </div>
                        
                        <div class="social-login">
                            <button type="button" class="btn btn-outline btn-social">
                                <i class="fab fa-google"></i> 使用Google登录
                            </button>
                            <button type="button" class="btn btn-outline btn-social">
                                <i class="fab fa-github"></i> 使用GitHub登录
                            </button>
                        </div>
                        
                        <div class="login-footer">
                            <p>还没有账号？ <a href="javascript:void(0)" id="register-link">立即注册</a></p>
                        </div>
                    </form>
                    
                    <!-- 注册表单 -->
                    <form id="register-form" class="form-container">
                        <h2>创建账号</h2>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="register-firstname">名字</label>
                                <input type="text" 
                                       id="register-firstname" 
                                       class="form-control" 
                                       placeholder="请输入名字"
                                       required>
                                <div class="invalid-feedback">请输入您的名字</div>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="register-lastname">姓氏</label>
                                <input type="text" 
                                       id="register-lastname" 
                                       class="form-control" 
                                       placeholder="请输入姓氏"
                                       required>
                                <div class="invalid-feedback">请输入您的姓氏</div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-email">邮箱地址</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-envelope"></i>
                                    </span>
                                </div>
                                <input type="email" 
                                       id="register-email" 
                                       class="form-control" 
                                       placeholder="请输入邮箱地址"
                                       required>
                            </div>
                            <div class="invalid-feedback">请输入有效的邮箱地址</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-username">用户名</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-at"></i>
                                    </span>
                                </div>
                                <input type="text" 
                                       id="register-username" 
                                       class="form-control" 
                                       placeholder="请输入用户名"
                                       required>
                            </div>
                            <div class="invalid-feedback">用户名至少3个字符</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-password">密码</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-lock"></i>
                                    </span>
                                </div>
                                <input type="password" 
                                       id="register-password" 
                                       class="form-control" 
                                       placeholder="请输入密码"
                                       required>
                            </div>
                            <div class="password-strength" id="password-strength">
                                <div class="strength-bar"></div>
                                <div class="strength-text">密码强度: 弱</div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-confirm-password">确认密码</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-lock"></i>
                                    </span>
                                </div>
                                <input type="password" 
                                       id="register-confirm-password" 
                                       class="form-control" 
                                       placeholder="请再次输入密码"
                                       required>
                            </div>
                            <div class="invalid-feedback">两次输入的密码不一致</div>
                        </div>
                        
                        <div class="form-group">
                            <div class="form-check">
                                <input type="checkbox" class="form-check-input" id="agree-terms" required>
                                <label class="form-check-label" for="agree-terms">
                                    我已阅读并同意 <a href="javascript:void(0)" id="terms-link">服务条款</a> 和 <a href="javascript:void(0)" id="privacy-link">隐私政策</a>
                                </label>
                            </div>
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-block" id="register-submit">
                            <span class="btn-text">注册</span>
                            <span class="spinner-border spinner-border-sm d-none" role="status"></span>
                        </button>
                        
                        <div class="register-footer">
                            <p>已有账号？ <a href="javascript:void(0)" id="back-to-login">返回登录</a></p>
                        </div>
                    </form>
                    
                    <!-- 忘记密码表单 -->
                    <form id="forgot-password-form" class="form-container">
                        <h2>重置密码</h2>
                        
                        <div class="form-group">
                            <label for="reset-email">邮箱地址</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">
                                        <i class="fas fa-envelope"></i>
                                    </span>
                                </div>
                                <input type="email" 
                                       id="reset-email" 
                                       class="form-control" 
                                       placeholder="请输入注册邮箱地址"
                                       required>
                            </div>
                            <div class="invalid-feedback">请输入有效的邮箱地址</div>
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-block" id="reset-submit">
                            <span class="btn-text">发送重置邮件</span>
                            <span class="spinner-border spinner-border-sm d-none" role="status"></span>
                        </button>
                        
                        <div class="reset-info">
                            <p><i class="fas fa-info-circle"></i> 我们将发送重置链接到您的邮箱</p>
                        </div>
                        
                        <div class="reset-footer">
                            <p><a href="javascript:void(0)" id="back-to-login-2">返回登录</a></p>
                        </div>
                    </form>
                </div>
                
                <div class="login-footer">
                    <p>© 2024 数据智能分析平台. 保留所有权利.</p>
                </div>
            </div>
        `;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 表单切换
        document.getElementById('register-link')?.addEventListener('click', () => {
            this.switchToView('register');
        });

        document.getElementById('forgot-password-link')?.addEventListener('click', () => {
            this.switchToView('forgot-password');
        });

        document.getElementById('back-to-login')?.addEventListener('click', () => {
            this.switchToView('login');
        });

        document.getElementById('back-to-login-2')?.addEventListener('click', () => {
            this.switchToView('login');
        });

        // 密码显示/隐藏切换
        document.getElementById('toggle-password')?.addEventListener('click', () => {
            this.togglePasswordVisibility();
        });

        // 密码强度检测
        document.getElementById('register-password')?.addEventListener('input', (e) => {
            this.checkPasswordStrength(e.target.value);
        });

        // 密码确认验证
        document.getElementById('register-confirm-password')?.addEventListener('input', (e) => {
            this.validatePasswordConfirm();
        });

        // 表单提交
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('forgot-password-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        // 社交登录
        document.querySelectorAll('.btn-social').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleSocialLogin(e.target.closest('.btn-social'));
            });
        });

        // 服务条款和隐私政策
        document.getElementById('terms-link')?.addEventListener('click', () => {
            this.showTermsModal();
        });

        document.getElementById('privacy-link')?.addEventListener('click', () => {
            this.showPrivacyModal();
        });
    }

    /**
     * 设置表单验证
     */
    setupFormValidation() {
        // 登录表单验证
        this.loginForm = {
            username: {
                element: document.getElementById('login-username'),
                validate: (value) => {
                    if (!value.trim()) return '请输入用户名或邮箱';
                    if (value.length < 3) return '用户名至少3个字符';
                    return null;
                }
            },
            password: {
                element: document.getElementById('login-password'),
                validate: (value) => {
                    if (!value) return '请输入密码';
                    if (value.length < 6) return '密码至少6个字符';
                    return null;
                }
            }
        };

        // 注册表单验证
        this.registerForm = {
            firstname: {
                element: document.getElementById('register-firstname'),
                validate: (value) => {
                    if (!value.trim()) return '请输入名字';
                    return null;
                }
            },
            lastname: {
                element: document.getElementById('register-lastname'),
                validate: (value) => {
                    if (!value.trim()) return '请输入姓氏';
                    return null;
                }
            },
            email: {
                element: document.getElementById('register-email'),
                validate: (value) => {
                    if (!value.trim()) return '请输入邮箱地址';
                    if (!this.isValidEmail(value)) return '请输入有效的邮箱地址';
                    return null;
                }
            },
            username: {
                element: document.getElementById('register-username'),
                validate: (value) => {
                    if (!value.trim()) return '请输入用户名';
                    if (value.length < 3) return '用户名至少3个字符';
                    if (!/^[a-zA-Z0-9_]+$/.test(value)) return '用户名只能包含字母、数字和下划线';
                    return null;
                }
            },
            password: {
                element: document.getElementById('register-password'),
                validate: (value) => {
                    if (!value) return '请输入密码';
                    if (value.length < 8) return '密码至少8个字符';
                    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
                        return '密码必须包含大小写字母和数字';
                    }
                    return null;
                }
            },
            confirmPassword: {
                element: document.getElementById('register-confirm-password'),
                validate: (value) => {
                    if (!value) return '请确认密码';
                    const password = document.getElementById('register-password').value;
                    if (value !== password) return '两次输入的密码不一致';
                    return null;
                }
            },
            agreeTerms: {
                element: document.getElementById('agree-terms'),
                validate: (checked) => {
                    if (!checked) return '请同意服务条款';
                    return null;
                }
            }
        };

        // 忘记密码表单验证
        this.forgotPasswordForm = {
            email: {
                element: document.getElementById('reset-email'),
                validate: (value) => {
                    if (!value.trim()) return '请输入邮箱地址';
                    if (!this.isValidEmail(value)) return '请输入有效的邮箱地址';
                    return null;
                }
            }
        };
    }

    /**
     * 验证邮箱格式
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * 切换视图
     */
    switchToView(view) {
        this.currentView = view;

        // 隐藏所有表单
        document.querySelectorAll('.form-container').forEach(form => {
            form.classList.remove('active');
        });

        // 显示选中的表单
        document.getElementById(`${view}-form`)?.classList.add('active');
    }

    /**
     * 切换密码可见性
     */
    togglePasswordVisibility() {
        const passwordInput = document.getElementById('login-password');
        const toggleButton = document.getElementById('toggle-password');
        const icon = toggleButton.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    /**
     * 检查密码强度
     */
    checkPasswordStrength(password) {
        const strengthBar = document.querySelector('.strength-bar');
        const strengthText = document.querySelector('.strength-text');

        if (!password) {
            strengthBar.style.width = '0%';
            strengthBar.className = 'strength-bar';
            strengthText.textContent = '密码强度: 弱';
            return;
        }

        let strength = 0;

        // 长度检查
        if (password.length >= 8) strength += 1;
        if (password.length >= 12) strength += 1;

        // 复杂度检查
        if (/[a-z]/.test(password)) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/\d/.test(password)) strength += 1;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 1;

        let width = 0;
        let level = '';
        let color = '';

        switch (strength) {
            case 0:
            case 1:
                width = 25;
                level = '弱';
                color = 'danger';
                break;
            case 2:
            case 3:
                width = 50;
                level = '中';
                color = 'warning';
                break;
            case 4:
                width = 75;
                level = '强';
                color = 'info';
                break;
            case 5:
            case 6:
                width = 100;
                level = '非常强';
                color = 'success';
                break;
        }

        strengthBar.style.width = `${width}%`;
        strengthBar.className = `strength-bar ${color}`;
        strengthText.textContent = `密码强度: ${level}`;
    }

    /**
     * 验证密码确认
     */
    validatePasswordConfirm() {
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const inputGroup = document.getElementById('register-confirm-password').closest('.input-group');

        if (confirmPassword && password !== confirmPassword) {
            inputGroup.classList.add('is-invalid');
        } else {
            inputGroup.classList.remove('is-invalid');
        }
    }

    /**
     * 处理登录
     */
    async handleLogin() {
        if (!this.validateForm('login')) {
            return;
        }

        try {
            this.setLoadingState('login', true);

            const credentials = {
                username: document.getElementById('login-username').value.trim(),
                password: document.getElementById('login-password').value,
                remember: document.getElementById('remember-me').checked
            };

            const response = await API.post('auth/login', credentials);

            if (response.success) {
                // 保存认证信息
                Auth.setToken(response.data.token);
                Auth.setUser(response.data.user);

                // 如果勾选了"记住我"
                if (credentials.remember) {
                    localStorage.setItem('remember_me', 'true');
                }

                Utils.showToast('登录成功！', 'success');
                this.redirectToDashboard();
            } else {
                throw new Error(response.message || '登录失败');
            }

        } catch (error) {
            console.error('登录失败:', error);
            this.showError('登录失败: ' + error.message);
        } finally {
            this.setLoadingState('login', false);
        }
    }

    /**
     * 处理注册
     */
    async handleRegister() {
        if (!this.validateForm('register')) {
            return;
        }

        try {
            this.setLoadingState('register', true);

            const userData = {
                firstname: document.getElementById('register-firstname').value.trim(),
                lastname: document.getElementById('register-lastname').value.trim(),
                email: document.getElementById('register-email').value.trim(),
                username: document.getElementById('register-username').value.trim(),
                password: document.getElementById('register-password').value
            };

            const response = await API.post('auth/register', userData);

            if (response.success) {
                Utils.showToast('注册成功！请登录您的账号', 'success');

                // 自动填充登录表单
                document.getElementById('login-username').value = userData.email;
                document.getElementById('login-password').value = '';

                // 切换到登录视图
                this.switchToView('login');
            } else {
                throw new Error(response.message || '注册失败');
            }

        } catch (error) {
            console.error('注册失败:', error);
            this.showError('注册失败: ' + error.message);
        } finally {
            this.setLoadingState('register', false);
        }
    }

    /**
     * 处理忘记密码
     */
    async handleForgotPassword() {
        if (!this.validateForm('forgot-password')) {
            return;
        }

        try {
            this.setLoadingState('reset', true);

            const email = document.getElementById('reset-email').value.trim();

            const response = await API.post('auth/forgot-password', { email });

            if (response.success) {
                Utils.showToast('重置邮件已发送，请检查您的邮箱', 'success');

                // 清空表单
                document.getElementById('reset-email').value = '';

                // 3秒后返回登录页面
                setTimeout(() => {
                    this.switchToView('login');
                }, 3000);
            } else {
                throw new Error(response.message || '发送重置邮件失败');
            }

        } catch (error) {
            console.error('发送重置邮件失败:', error);
            this.showError('发送失败: ' + error.message);
        } finally {
            this.setLoadingState('reset', false);
        }
    }

    /**
     * 处理社交登录
     */
    handleSocialLogin(button) {
        const provider = button.textContent.includes('Google') ? 'google' : 'github';

        Utils.showToast(`正在跳转到${provider}登录...`, 'info');

        // 这里可以实现OAuth登录逻辑
        // 暂时模拟跳转
        setTimeout(() => {
            this.showError('社交登录功能正在开发中，请使用账号密码登录');
        }, 1000);
    }

    /**
     * 验证表单
     */
    validateForm(formType) {
        let isValid = true;
        let form = null;

        switch (formType) {
            case 'login':
                form = this.loginForm;
                break;
            case 'register':
                form = this.registerForm;
                break;
            case 'forgot-password':
                form = this.forgotPasswordForm;
                break;
        }

        if (!form) return false;

        Object.keys(form).forEach(field => {
            const fieldConfig = form[field];
            const element = fieldConfig.element;
            const value = element.type === 'checkbox' ? element.checked : element.value;
            const error = fieldConfig.validate(value);

            const inputGroup = element.closest('.input-group') || element;

            if (error) {
                inputGroup.classList.add('is-invalid');
                const feedback = inputGroup.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.textContent = error;
                }
                isValid = false;
            } else {
                inputGroup.classList.remove('is-invalid');
            }
        });

        return isValid;
    }

    /**
     * 设置加载状态
     */
    setLoadingState(formType, isLoading) {
        let submitButton = null;

        switch (formType) {
            case 'login':
                submitButton = document.getElementById('login-submit');
                break;
            case 'register':
                submitButton = document.getElementById('register-submit');
                break;
            case 'reset':
                submitButton = document.getElementById('reset-submit');
                break;
        }

        if (!submitButton) return;

        const btnText = submitButton.querySelector('.btn-text');
        const spinner = submitButton.querySelector('.spinner-border');

        if (isLoading) {
            submitButton.disabled = true;
            btnText.classList.add('d-none');
            spinner.classList.remove('d-none');
        } else {
            submitButton.disabled = false;
            btnText.classList.remove('d-none');
            spinner.classList.add('d-none');
        }
    }

    /**
     * 重定向到仪表板
     */
    redirectToDashboard() {
        // 保存登录时间
        localStorage.setItem('last_login', new Date().toISOString());

        // 跳转到仪表板
        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);
    }

    /**
     * 显示服务条款弹窗
     */
    showTermsModal() {
        const termsContent = `
            <div class="terms-modal">
                <h3>服务条款</h3>
                <div class="terms-content">
                    <h4>1. 服务接受</h4>
                    <p>本条款规定了您使用数据智能分析平台（以下简称"本服务"）的条件。通过注册、登录或使用本服务，即表示您已阅读、理解并同意接受本条款的约束。</p>
                    
                    <h4>2. 使用条件</h4>
                    <p>您必须是具备完全民事行为能力的自然人、法人或其他组织。您必须确保所提供信息的真实性、准确性和完整性。</p>
                    
                    <h4>3. 用户责任</h4>
                    <p>您应对使用本服务过程中的所有行为负责，包括但不限于上传、发布、传播的内容。您同意不会：</p>
                    <ul>
                        <li>上传或传播任何非法、侵权、威胁、诽谤、淫秽、色情或其他不当内容</li>
                        <li>侵犯他人的知识产权、隐私权或其他合法权益</li>
                        <li>干扰或破坏本服务的正常运行</li>
                        <li>未经授权访问他人账户或系统</li>
                    </ul>
                    
                    <h4>4. 服务变更</h4>
                    <p>我们保留随时修改、暂停或终止本服务（或其中任何部分）的权利。我们将尽力提前通知用户，但不保证通知的及时性。</p>
                    
                    <h4>5. 免责声明</h4>
                    <p>本服务按"现状"提供，不提供任何形式的保证。我们不保证服务的无中断、及时、安全、准确。</p>
                    
                    <h4>6. 隐私保护</h4>
                    <p>我们非常重视用户的隐私保护，请同时阅读我们的隐私政策了解详细信息。</p>
                </div>
                <div class="terms-actions">
                    <button class="btn btn-primary" onclick="login.closeTermsModal()">我同意</button>
                    <button class="btn btn-outline" onclick="login.closeTermsModal()">不同意</button>
                </div>
            </div>
        `;

        Utils.showModal('服务条款', termsContent, { size: 'lg' });
    }

    /**
     * 显示隐私政策弹窗
     */
    showPrivacyModal() {
        const privacyContent = `
            <div class="privacy-modal">
                <h3>隐私政策</h3>
                <div class="privacy-content">
                    <h4>1. 信息收集</h4>
                    <p>我们收集的信息包括：</p>
                    <ul>
                        <li><strong>账户信息：</strong>注册时提供的姓名、邮箱、用户名等</li>
                        <li><strong>使用信息：</strong>使用本服务时产生的日志、操作记录等</li>
                        <li><strong>设备信息：</strong>设备类型、操作系统、浏览器信息等</li>
                        <li><strong>位置信息：</strong>您的大致位置（根据IP地址）</li>
                    </ul>
                    
                    <h4>2. 信息使用</h4>
                    <p>我们使用收集的信息用于：</p>
                    <ul>
                        <li>提供、维护和改进本服务</li>
                        <li>处理您的请求和查询</li>
                        <li>发送服务通知和更新</li>
                        <li>确保服务的安全性</li>
                        <li>分析使用情况以改进用户体验</li>
                    </ul>
                    
                    <h4>3. 信息共享</h4>
                    <p>我们不会将您的个人信息出售给第三方。仅在以下情况下共享信息：</p>
                    <ul>
                        <li>获得您的明确同意</li>
                        <li>遵守法律要求或法律程序</li>
                        <li>保护我们、用户或公众的权利、财产或安全</li>
                        <li>与服务提供商共享必要信息（受保密协议约束）</li>
                    </ul>
                    
                    <h4>4. 数据安全</h4>
                    <p>我们采取合理的技术和组织措施保护您的个人信息安全，包括加密、访问控制等。</p>
                    
                    <h4>5. 您的权利</h4>
                    <p>您可以：</p>
                    <ul>
                        <li>访问、更正或删除您的个人信息</li>
                        <li>限制或反对我们处理您的个人信息</li>
                        <li>数据可移植性</li>
                        <li>撤回同意（不影响撤回前的处理）</li>
                    </ul>
                    
                    <h4>6. 联系我们</h4>
                    <p>如有任何隐私相关问题，请联系：privacy@data-analytics.com</p>
                </div>
                <div class="privacy-actions">
                    <button class="btn btn-primary" onclick="login.closePrivacyModal()">我理解</button>
                </div>
            </div>
        `;

        Utils.showModal('隐私政策', privacyContent, { size: 'lg' });
    }

    /**
     * 关闭服务条款弹窗
     */
    closeTermsModal() {
        Utils.closeModal();
    }

    /**
     * 关闭隐私政策弹窗
     */
    closePrivacyModal() {
        Utils.closeModal();
    }

    /**
     * 显示错误
     */
    showError(message) {
        Utils.showToast(message, 'error');
    }
}

// 创建登录实例
const login = new LoginModule();

// 导出登录模块
export default LoginModule;
