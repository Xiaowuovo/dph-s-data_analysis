/**
 * 数据上传页面模块
 * 处理数据文件上传和处理
 */
import API from '../core/api.js';
import Utils from '../core/utils.js';
import DataProcessor from '../lib/data-processor.js';

class UploadModule {
    constructor() {
        this.dataProcessor = new DataProcessor();
        this.uploadQueue = [];
        this.currentFile = null;
        this.processedData = null;
        this.uploadConfig = {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: ['.csv', '.json', '.xlsx', '.xls', '.txt'],
            chunkSize: 5 * 1024 * 1024 // 5MB chunks
        };
    }

    /**
     * 初始化模块
     */
    async init() {
        try {
            console.log('📤 初始化上传模块...');

            this.initUI();
            this.initEventListeners();
            this.initFileDropzone();
            this.loadUploadHistory();

            console.log('✅ 上传模块初始化完成');
        } catch (error) {
            console.error('❌ 上传模块初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    /**
     * 初始化界面
     */
    initUI() {
        this.setupUploadArea();
        this.setupFileList();
        this.setupProcessingOptions();
        this.setupPreviewArea();
    }

    /**
     * 设置上传区域
     */
    setupUploadArea() {
        const container = document.getElementById('upload-container');
        if (!container) return;

        container.innerHTML = `
            <div class="upload-wrapper">
                <div class="upload-header">
                    <h2><i class="fas fa-cloud-upload-alt"></i> 数据上传</h2>
                    <p>支持 CSV, JSON, Excel, TXT 文件格式，最大 100MB</p>
                </div>
                
                <div class="upload-area" id="dropzone">
                    <div class="dropzone-content">
                        <i class="fas fa-file-upload"></i>
                        <h4>拖拽文件到此处或点击选择</h4>
                        <p>支持 CSV, JSON, Excel, TXT 格式</p>
                        <input type="file" id="file-input" multiple 
                               accept=".csv,.json,.xlsx,.xls,.txt">
                        <label for="file-input" class="btn btn-primary">
                            <i class="fas fa-folder-open"></i> 选择文件
                        </label>
                    </div>
                </div>
                
                <div class="upload-queue" id="upload-queue">
                    <h5>上传队列</h5>
                    <div class="queue-list" id="queue-list">
                        <div class="empty-queue">
                            <i class="fas fa-inbox"></i>
                            <p>暂无文件</p>
                        </div>
                    </div>
                </div>
                
                <div class="upload-options">
                    <div class="option-row">
                        <h5>数据处理选项</h5>
                        <button class="btn btn-sm" id="clear-queue">
                            <i class="fas fa-trash"></i> 清空队列
                        </button>
                    </div>
                    
                    <div class="processing-options" id="processing-options">
                        <!-- 处理选项将通过JS动态生成 -->
                    </div>
                    
                    <div class="upload-actions">
                        <button class="btn btn-primary" id="start-process" disabled>
                            <i class="fas fa-cogs"></i> 处理文件
                        </button>
                        <button class="btn btn-success" id="start-upload" disabled>
                            <i class="fas fa-cloud-upload"></i> 开始上传
                        </button>
                    </div>
                </div>
                
                <div class="preview-area" id="preview-area">
                    <div class="preview-header">
                        <h5>数据预览</h5>
                        <div class="preview-actions">
                            <button class="btn btn-sm" id="toggle-preview">
                                <i class="fas fa-eye"></i> 显示/隐藏
                            </button>
                        </div>
                    </div>
                    <div class="preview-content" id="preview-content">
                        <div class="empty-preview">
                            <i class="fas fa-table"></i>
                            <p>选择文件后预览数据</p>
                        </div>
                    </div>
                </div>
                
                <div class="upload-history" id="upload-history">
                    <div class="history-header">
                        <h5><i class="fas fa-history"></i> 上传历史</h5>
                        <button class="btn btn-sm" id="refresh-history">
                            <i class="fas fa-sync"></i> 刷新
                        </button>
                    </div>
                    <div class="history-list" id="history-list">
                        <!-- 历史记录将通过JS动态加载 -->
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 设置文件列表
     */
    setupFileList() {
        const queueList = document.getElementById('queue-list');
        if (!queueList) return;

        queueList.innerHTML = `
            <div class="empty-queue">
                <i class="fas fa-inbox"></i>
                <p>暂无文件</p>
            </div>
        `;
    }

    /**
     * 设置处理选项
     */
    setupProcessingOptions() {
        const optionsContainer = document.getElementById('processing-options');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = `
            <div class="form-group">
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="remove-duplicates" checked>
                    <label class="form-check-label" for="remove-duplicates">移除重复行</label>
                </div>
            </div>
            
            <div class="form-group">
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="fill-missing" checked>
                    <label class="form-check-label" for="fill-missing">填充缺失值</label>
                </div>
            </div>
            
            <div class="form-group">
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="normalize-data">
                    <label class="form-check-label" for="normalize-data">数据标准化</label>
                </div>
            </div>
            
            <div class="form-group">
                <div class="form-check">
                    <input type="checkbox" class="form-check-input" id="detect-outliers">
                    <label class="form-check-label" for="detect-outliers">异常值检测</label>
                </div>
            </div>
            
            <div class="form-group">
                <label for="encoding-select">文件编码</label>
                <select id="encoding-select" class="form-control form-control-sm">
                    <option value="utf-8" selected>UTF-8</option>
                    <option value="gbk">GBK</option>
                    <option value="gb2312">GB2312</option>
                    <option value="ascii">ASCII</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="delimiter-select">分隔符 (CSV)</label>
                <select id="delimiter-select" class="form-control form-control-sm">
                    <option value="," selected>逗号 (,)</option>
                    <option value=";">分号 (;)</option>
                    <option value="\t">制表符 (\\t)</option>
                    <option value="|">竖线 (|)</option>
                </select>
            </div>
        `;
    }

    /**
     * 设置预览区域
     */
    setupPreviewArea() {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent) return;

        previewContent.innerHTML = `
            <div class="empty-preview">
                <i class="fas fa-table"></i>
                <p>选择文件后预览数据</p>
            </div>
        `;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 文件选择
        document.getElementById('file-input')?.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // 处理按钮
        document.getElementById('start-process')?.addEventListener('click', () => {
            this.processFiles();
        });

        // 上传按钮
        document.getElementById('start-upload')?.addEventListener('click', () => {
            this.uploadFiles();
        });

        // 清空队列
        document.getElementById('clear-queue')?.addEventListener('click', () => {
            this.clearUploadQueue();
        });

        // 切换预览
        document.getElementById('toggle-preview')?.addEventListener('click', () => {
            this.togglePreview();
        });

        // 刷新历史
        document.getElementById('refresh-history')?.addEventListener('click', () => {
            this.loadUploadHistory();
        });
    }

    /**
     * 初始化文件拖放区域
     */
    initFileDropzone() {
        const dropzone = document.getElementById('dropzone');
        if (!dropzone) return;

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            this.handleFileSelect(files);
        });

        // 点击整个区域选择文件
        dropzone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                document.getElementById('file-input').click();
            }
        });
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(files) {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            this.addFileToQueue(file);
        });

        this.updateQueueUI();
        this.updateButtonStates();
    }

    /**
     * 添加文件到队列
     */
    addFileToQueue(file) {
        // 验证文件类型
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.uploadConfig.allowedTypes.includes(fileExt)) {
            this.showError(`不支持的文件类型: ${fileExt}。支持的类型: ${this.uploadConfig.allowedTypes.join(', ')}`);
            return;
        }

        // 验证文件大小
        if (file.size > this.uploadConfig.maxFileSize) {
            this.showError(`文件大小超过限制: ${file.name} (${this.formatFileSize(file.size)})。最大支持: ${this.formatFileSize(this.uploadConfig.maxFileSize)}`);
            return;
        }

        const fileId = Date.now() + Math.random().toString(36).substr(2, 9);

        this.uploadQueue.push({
            id: fileId,
            file: file,
            name: file.name,
            size: file.size,
            type: file.type || this.getFileType(file.name),
            status: 'pending', // pending, processing, processed, error, uploaded
            progress: 0,
            error: null,
            processedData: null,
            previewData: null
        });

        Utils.showToast(`已添加文件: ${file.name}`, 'success');
    }

    /**
     * 获取文件类型
     */
    getFileType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const types = {
            'csv': 'text/csv',
            'json': 'application/json',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'txt': 'text/plain'
        };
        return types[ext] || 'application/octet-stream';
    }

    /**
     * 更新队列UI
     */
    updateQueueUI() {
        const queueList = document.getElementById('queue-list');
        if (!queueList) return;

        if (this.uploadQueue.length === 0) {
            queueList.innerHTML = `
                <div class="empty-queue">
                    <i class="fas fa-inbox"></i>
                    <p>暂无文件</p>
                </div>
            `;
            return;
        }

        queueList.innerHTML = this.uploadQueue.map(file => `
            <div class="queue-item ${file.status}" data-file-id="${file.id}">
                <div class="file-info">
                    <div class="file-icon">
                        <i class="${this.getFileIcon(file.type)}"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-meta">
                            <span class="file-size">${this.formatFileSize(file.size)}</span>
                            <span class="file-type">${this.getFileTypeName(file.type)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="file-status">
                    ${file.status === 'pending' ? `
                        <span class="status-badge pending">等待处理</span>
                    ` : file.status === 'processing' ? `
                        <div class="status-processing">
                            <div class="progress" style="width: 100px;">
                                <div class="progress-bar" 
                                     style="width: ${file.progress}%"></div>
                            </div>
                            <span>${file.progress}%</span>
                        </div>
                    ` : file.status === 'processed' ? `
                        <span class="status-badge success">处理完成</span>
                    ` : file.status === 'error' ? `
                        <span class="status-badge error">处理失败</span>
                        <button class="btn btn-sm btn-icon" onclick="upload.retryFile('${file.id}')" title="重试">
                            <i class="fas fa-redo"></i>
                        </button>
                    ` : file.status === 'uploaded' ? `
                        <span class="status-badge success">已上传</span>
                    ` : ''}
                    
                    ${file.status !== 'processing' ? `
                        <button class="btn btn-sm btn-icon" onclick="upload.removeFile('${file.id}')" title="移除">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // 绑定预览事件
        document.querySelectorAll('.queue-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.file-status button')) {
                    const fileId = item.dataset.fileId;
                    this.previewFile(fileId);
                }
            });
        });
    }

    /**
     * 获取文件图标
     */
    getFileIcon(fileType) {
        if (fileType.includes('csv') || fileType.includes('excel') || fileType.includes('sheet')) {
            return 'fas fa-file-csv';
        } else if (fileType.includes('json')) {
            return 'fas fa-file-code';
        } else if (fileType.includes('text')) {
            return 'fas fa-file-alt';
        } else {
            return 'fas fa-file';
        }
    }

    /**
     * 获取文件类型名称
     */
    getFileTypeName(fileType) {
        if (fileType.includes('csv')) {
            return 'CSV';
        } else if (fileType.includes('json')) {
            return 'JSON';
        } else if (fileType.includes('excel') || fileType.includes('sheet')) {
            return 'Excel';
        } else if (fileType.includes('text')) {
            return 'Text';
        } else {
            return '文件';
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 更新按钮状态
     */
    updateButtonStates() {
        const processBtn = document.getElementById('start-process');
        const uploadBtn = document.getElementById('start-upload');

        if (!processBtn || !uploadBtn) return;

        const hasFiles = this.uploadQueue.length > 0;
        const allProcessed = this.uploadQueue.every(file => file.status === 'processed');
        const hasProcessed = this.uploadQueue.some(file => file.status === 'processed');

        processBtn.disabled = !hasFiles;
        uploadBtn.disabled = !hasProcessed;
    }

    /**
     * 处理文件
     */
    async processFiles() {
        if (this.uploadQueue.length === 0) {
            this.showError('请先选择要处理的文件');
            return;
        }

        try {
            this.showProcessing('正在处理文件...');

            const options = this.getProcessingOptions();

            for (const fileInfo of this.uploadQueue) {
                if (fileInfo.status === 'pending' || fileInfo.status === 'error') {
                    await this.processSingleFile(fileInfo, options);
                }
            }

            Utils.showToast('所有文件处理完成', 'success');
            this.updateQueueUI();
            this.updateButtonStates();

        } catch (error) {
            console.error('处理文件失败:', error);
            this.showError('处理失败: ' + error.message);
        } finally {
            this.hideProcessing();
        }
    }

    /**
     * 获取处理选项
     */
    getProcessingOptions() {
        return {
            removeDuplicates: document.getElementById('remove-duplicates').checked,
            fillMissing: document.getElementById('fill-missing').checked,
            normalize: document.getElementById('normalize-data').checked,
            detectOutliers: document.getElementById('detect-outliers').checked,
            encoding: document.getElementById('encoding-select').value,
            delimiter: document.getElementById('delimiter-select').value
        };
    }

    /**
     * 处理单个文件
     */
    async processSingleFile(fileInfo, options) {
        try {
            // 更新状态
            fileInfo.status = 'processing';
            this.updateQueueUI();

            // 读取文件
            const fileContent = await this.readFile(fileInfo.file);

            // 根据文件类型处理
            let processedData;

            if (fileInfo.type.includes('csv') || fileInfo.type.includes('text')) {
                processedData = await this.dataProcessor.processCSV(fileContent, options);
            } else if (fileInfo.type.includes('json')) {
                processedData = await this.dataProcessor.processJSON(fileContent, options);
            } else if (fileInfo.type.includes('excel') || fileInfo.type.includes('sheet')) {
                processedData = await this.dataProcessor.processExcel(fileContent, options);
            } else {
                throw new Error('不支持的文件类型');
            }

            // 应用处理选项
            if (options.removeDuplicates) {
                processedData = this.dataProcessor.removeDuplicates(processedData);
            }

            if (options.fillMissing) {
                processedData = this.dataProcessor.fillMissingValues(processedData);
            }

            if (options.normalize) {
                processedData = this.dataProcessor.normalizeData(processedData);
            }

            if (options.detectOutliers) {
                const outliers = this.dataProcessor.detectOutliers(processedData);
                fileInfo.outliers = outliers;
            }

            // 保存处理结果
            fileInfo.processedData = processedData;
            fileInfo.previewData = processedData.slice(0, 10); // 前10行用于预览
            fileInfo.status = 'processed';
            fileInfo.progress = 100;

            Utils.showToast(`文件处理完成: ${fileInfo.name}`, 'success');

        } catch (error) {
            console.error(`处理文件失败 ${fileInfo.name}:`, error);
            fileInfo.status = 'error';
            fileInfo.error = error.message;
            this.showError(`处理失败 ${fileInfo.name}: ${error.message}`);
        }
    }

    /**
     * 读取文件
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result);
            };

            reader.onerror = (e) => {
                reject(new Error('读取文件失败'));
            };

            if (file.type.includes('text') || file.type.includes('csv') || file.type.includes('json')) {
                reader.readAsText(file, 'UTF-8');
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * 上传文件
     */
    async uploadFiles() {
        const processedFiles = this.uploadQueue.filter(file => file.status === 'processed');

        if (processedFiles.length === 0) {
            this.showError('没有可上传的文件，请先处理文件');
            return;
        }

        try {
            this.showUploading('正在上传文件...');

            for (const fileInfo of processedFiles) {
                await this.uploadSingleFile(fileInfo);
            }

            Utils.showToast('所有文件上传成功', 'success');
            this.loadUploadHistory(); // 刷新历史记录

        } catch (error) {
            console.error('上传文件失败:', error);
            this.showError('上传失败: ' + error.message);
        } finally {
            this.hideUploading();
        }
    }

    /**
     * 上传单个文件
     */
    async uploadSingleFile(fileInfo) {
        try {
            // 更新状态
            fileInfo.status = 'uploading';
            fileInfo.progress = 0;
            this.updateQueueUI();

            // 准备上传数据
            const uploadData = {
                filename: fileInfo.name,
                size: fileInfo.size,
                type: fileInfo.type,
                processedData: fileInfo.processedData,
                previewData: fileInfo.previewData,
                outliers: fileInfo.outliers || null
            };

            // 模拟上传进度
            const totalSize = JSON.stringify(uploadData).length;
            let uploaded = 0;

            const progressInterval = setInterval(() => {
                uploaded += totalSize * 0.1; // 模拟进度
                fileInfo.progress = Math.min(Math.round((uploaded / totalSize) * 100), 100);
                this.updateQueueUI();

                if (fileInfo.progress >= 100) {
                    clearInterval(progressInterval);
                }
            }, 200);

            // 上传到服务器
            const response = await API.post('data/upload', uploadData, {
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    fileInfo.progress = progress;
                    this.updateQueueUI();
                }
            });

            clearInterval(progressInterval);

            if (response.success) {
                fileInfo.status = 'uploaded';
                fileInfo.uploadId = response.data.uploadId;
                fileInfo.uploadTime = new Date().toISOString();

                Utils.showToast(`上传成功: ${fileInfo.name}`, 'success');
            } else {
                throw new Error(response.message || '上传失败');
            }

        } catch (error) {
            console.error(`上传文件失败 ${fileInfo.name}:`, error);
            fileInfo.status = 'error';
            fileInfo.error = error.message;
            this.showError(`上传失败 ${fileInfo.name}: ${error.message}`);
        }
    }

    /**
     * 预览文件
     */
    previewFile(fileId) {
        const fileInfo = this.uploadQueue.find(file => file.id === fileId);
        if (!fileInfo) return;

        const previewContent = document.getElementById('preview-content');
        if (!previewContent) return;

        if (!fileInfo.previewData && fileInfo.status !== 'processed' && fileInfo.status !== 'uploaded') {
            previewContent.innerHTML = `
                <div class="empty-preview">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>请先处理文件以预览数据</p>
                </div>
            `;
            return;
        }

        if (fileInfo.previewData && fileInfo.previewData.length > 0) {
            this.renderDataPreview(fileInfo);
        } else {
            previewContent.innerHTML = `
                <div class="empty-preview">
                    <i class="fas fa-table"></i>
                    <p>暂无预览数据</p>
                </div>
            `;
        }

        // 显示预览区域
        document.getElementById('preview-area')?.classList.add('active');
    }

    /**
     * 渲染数据预览
     */
    renderDataPreview(fileInfo) {
        const previewContent = document.getElementById('preview-content');
        if (!previewContent) return;

        const data = fileInfo.previewData;
        const headers = Object.keys(data[0] || {});

        let tableHTML = `
            <div class="preview-header">
                <h6>${fileInfo.name}</h6>
                <span class="file-info">${data.length} 行, ${headers.length} 列</span>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            ${headers.map(header => `<th>${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.slice(0, 50).forEach(row => { // 最多显示50行
            tableHTML += `
                <tr>
                    ${headers.map(header => `<td>${this.formatCellValue(row[header])}</td>`).join('')}
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        if (data.length > 50) {
            tableHTML += `
                <div class="preview-footer">
                    <p>显示前 50 行，共 ${data.length} 行</p>
                </div>
            `;
        }

        if (fileInfo.outliers && fileInfo.outliers.length > 0) {
            tableHTML += `
                <div class="outliers-section">
                    <h6><i class="fas fa-exclamation-triangle"></i> 检测到异常值</h6>
                    <div class="outliers-info">
                        <p>在 ${fileInfo.outliers.length} 行中检测到异常值</p>
                        <button class="btn btn-sm btn-outline" onclick="upload.viewOutliers('${fileInfo.id}')">
                            查看详情
                        </button>
                    </div>
                </div>
            `;
        }

        previewContent.innerHTML = tableHTML;
    }

    /**
     * 格式化单元格值
     */
    formatCellValue(value) {
        if (value === null || value === undefined) {
            return '<span class="null-value">NULL</span>';
        }

        if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return value.toString();
            } else {
                return value.toFixed(4);
            }
        }

        if (typeof value === 'boolean') {
            return value ? '✓' : '✗';
        }

        if (typeof value === 'string') {
            if (value.length > 50) {
                return value.substring(0, 50) + '...';
            }
        }

        return value;
    }

    /**
     * 查看异常值
     */
    viewOutliers(fileId) {
        const fileInfo = this.uploadQueue.find(file => file.id === fileId);
        if (!fileInfo || !fileInfo.outliers) return;

        const outliers = fileInfo.outliers;
        let outliersHTML = `
            <div class="outliers-modal">
                <h5>异常值检测结果</h5>
                <p>在文件 <strong>${fileInfo.name}</strong> 中检测到 ${outliers.length} 个异常值</p>
                
                <div class="outliers-stats">
                    <div class="stat-item">
                        <div class="stat-value">${outliers.length}</div>
                        <div class="stat-label">异常值总数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${((outliers.length / fileInfo.processedData.length) * 100).toFixed(2)}%</div>
                        <div class="stat-label">异常值比例</div>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>行号</th>
                                <th>字段</th>
                                <th>异常值</th>
                                <th>正常范围</th>
                                <th>偏差</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        outliers.slice(0, 20).forEach(outlier => { // 最多显示20个
            outliersHTML += `
                <tr>
                    <td>${outlier.row}</td>
                    <td>${outlier.field}</td>
                    <td>${outlier.value}</td>
                    <td>${outlier.range}</td>
                    <td>${outlier.deviation}</td>
                </tr>
            `;
        });

        outliersHTML += `
                        </tbody>
                    </table>
                </div>
                
                ${outliers.length > 20 ? `
                    <p class="text-muted">显示前 20 个异常值，共 ${outliers.length} 个</p>
                ` : ''}
                
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="upload.handleOutliers('${fileId}', 'remove')">
                        移除异常值
                    </button>
                    <button class="btn btn-outline" onclick="upload.handleOutliers('${fileId}', 'keep')">
                        保留异常值
                    </button>
                    <button class="btn btn-outline" onclick="Utils.closeModal()">
                        取消
                    </button>
                </div>
            </div>
        `;

        Utils.showModal('异常值检测', outliersHTML, { size: 'lg' });
    }

    /**
     * 处理异常值
     */
    handleOutliers(fileId, action) {
        const fileInfo = this.uploadQueue.find(file => file.id === fileId);
        if (!fileInfo) return;

        if (action === 'remove') {
            // 移除异常值
            this.dataProcessor.removeOutliers(fileInfo.processedData, fileInfo.outliers);
            Utils.showToast('异常值已移除', 'success');
        } else {
            // 保留异常值
            Utils.showToast('已保留异常值', 'info');
        }

        fileInfo.outliers = [];
        this.renderDataPreview(fileInfo);
        Utils.closeModal();
    }

    /**
     * 移除文件
     */
    removeFile(fileId) {
        this.uploadQueue = this.uploadQueue.filter(file => file.id !== fileId);
        this.updateQueueUI();
        this.updateButtonStates();
        Utils.showToast('文件已移除', 'info');
    }

    /**
     * 重试文件
     */
    retryFile(fileId) {
        const fileInfo = this.uploadQueue.find(file => file.id === fileId);
        if (!fileInfo) return;

        fileInfo.status = 'pending';
        fileInfo.error = null;
        this.updateQueueUI();
        Utils.showToast('文件已添加到重试队列', 'info');
    }

    /**
     * 清空上传队列
     */
    clearUploadQueue() {
        if (this.uploadQueue.length === 0) {
            this.showError('上传队列已为空');
            return;
        }

        if (confirm('确定要清空上传队列吗？')) {
            this.uploadQueue = [];
            this.updateQueueUI();
            this.updateButtonStates();
            this.clearPreview();
            Utils.showToast('上传队列已清空', 'info');
        }
    }

    /**
     * 切换预览显示
     */
    togglePreview() {
        const previewArea = document.getElementById('preview-area');
        if (previewArea) {
            previewArea.classList.toggle('collapsed');
        }
    }

    /**
     * 清空预览
     */
    clearPreview() {
        const previewContent = document.getElementById('preview-content');
        if (previewContent) {
            previewContent.innerHTML = `
                <div class="empty-preview">
                    <i class="fas fa-table"></i>
                    <p>选择文件后预览数据</p>
                </div>
            `;
        }
    }

    /**
     * 加载上传历史
     */
    async loadUploadHistory() {
        try {
            const historyList = document.getElementById('history-list');
            if (!historyList) return;

            // 显示加载状态
            historyList.innerHTML = `
                <div class="loading-history">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                    <span>正在加载历史记录...</span>
                </div>
            `;

            // 获取上传历史
            const response = await API.get('data/upload-history');

            if (response.success && response.data.length > 0) {
                this.renderUploadHistory(response.data);
            } else {
                historyList.innerHTML = `
                    <div class="empty-history">
                        <i class="fas fa-history"></i>
                        <p>暂无上传历史</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error('加载上传历史失败:', error);
            const historyList = document.getElementById('history-list');
            if (historyList) {
                historyList.innerHTML = `
                    <div class="error-history">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>加载历史记录失败</p>
                        <button class="btn btn-sm btn-outline" onclick="upload.loadUploadHistory()">重试</button>
                    </div>
                `;
            }
        }
    }

    /**
     * 渲染上传历史
     */
    renderUploadHistory(history) {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;

        historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-file-info">
                    <div class="file-icon">
                        <i class="${this.getFileIcon(item.type)}"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${item.filename}</div>
                        <div class="file-meta">
                            <span class="file-size">${this.formatFileSize(item.size)}</span>
                            <span class="upload-time">${this.formatTime(item.upload_time)}</span>
                        </div>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-icon" onclick="upload.downloadFile('${item.id}')" title="下载">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-icon" onclick="upload.deleteHistory('${item.id}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 1天内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else if (diff < 604800000) { // 1周内
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(fileId) {
        try {
            Utils.showToast('正在下载文件...', 'info');

            const response = await API.get(`data/download/${fileId}`, null, {
                responseType: 'blob'
            });

            if (response.success) {
                // 创建下载链接
                const url = window.URL.createObjectURL(response.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = `processed_${fileId}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                Utils.showToast('文件下载成功', 'success');
            }
        } catch (error) {
            console.error('下载文件失败:', error);
            this.showError('下载失败: ' + error.message);
        }
    }

    /**
     * 删除历史记录
     */
    async deleteHistory(historyId) {
        if (!confirm('确定要删除这条上传记录吗？')) {
            return;
        }

        try {
            const response = await API.delete(`data/upload-history/${historyId}`);
            if (response.success) {
                Utils.showToast('删除成功', 'success');
                this.loadUploadHistory(); // 重新加载历史记录
            }
        } catch (error) {
            console.error('删除历史记录失败:', error);
            this.showError('删除失败: ' + error.message);
        }
    }

    /**
     * 显示处理中状态
     */
    showProcessing(message) {
        const processing = document.createElement('div');
        processing.className = 'processing-overlay';
        processing.innerHTML = `
            <div class="processing-content">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="processing-text">${message}</div>
            </div>
        `;
        document.body.appendChild(processing);
    }

    /**
     * 隐藏处理中状态
     */
    hideProcessing() {
        const processing = document.querySelector('.processing-overlay');
        if (processing) {
            processing.remove();
        }
    }

    /**
     * 显示上传中状态
     */
    showUploading(message) {
        const uploading = document.createElement('div');
        uploading.className = 'uploading-overlay';
        uploading.innerHTML = `
            <div class="uploading-content">
                <div class="spinner-border text-primary" role="status"></div>
                <div class="uploading-text">${message}</div>
                <div class="uploading-progress">
                    <div class="progress">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(uploading);

        // 更新进度条
        const progressBar = uploading.querySelector('.progress-bar');
        const updateProgress = () => {
            const uploadedFiles = this.uploadQueue.filter(file =>
                file.status === 'uploaded' || file.status === 'error'
            ).length;
            const totalFiles = this.uploadQueue.length;
            const progress = totalFiles > 0 ? (uploadedFiles / totalFiles) * 100 : 0;
            progressBar.style.width = `${progress}%`;
        };

        this.progressInterval = setInterval(updateProgress, 100);
    }

    /**
     * 隐藏上传中状态
     */
    hideUploading() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        const uploading = document.querySelector('.uploading-overlay');
        if (uploading) {
            uploading.remove();
        }
    }

    /**
     * 显示错误
     */
    showError(message) {
        Utils.showToast(message, 'error');
    }
}

// 创建上传实例
const upload = new UploadModule();

// 导出上传模块
export default UploadModule;
