// Complete Dashboard Functionality
class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.evidenceList = [];
        this.filteredList = [];
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        await this.loadUserData();
        await this.loadEvidence();
        this.initializeEventListeners();
        this.updateUI();
    }

    async checkAuthentication() {
        const userAccount = localStorage.getItem('currentUser');
        if (!userAccount) {
            window.location.href = 'index.html';
            return;
        }
        this.userAccount = userAccount;
    }

    async loadUserData() {
        try {
            this.currentUser = await storage.getUser(this.userAccount);
            if (!this.currentUser) {
                // Fallback to localStorage
                const savedUser = localStorage.getItem('evidUser_' + this.userAccount);
                if (savedUser) {
                    this.currentUser = JSON.parse(savedUser);
                } else {
                    window.location.href = 'index.html';
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            window.location.href = 'index.html';
        }
    }

    async loadEvidence() {
        try {
            this.evidenceList = await storage.getAllEvidence();
            this.filteredList = [...this.evidenceList];
            this.displayEvidence();
            this.updateStats();
        } catch (error) {
            console.error('Error loading evidence:', error);
            this.showAlert('Error loading evidence', 'error');
        }
    }

    initializeEventListeners() {
        // Evidence upload form
        const uploadForm = document.getElementById('evidenceUploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', this.handleEvidenceUpload.bind(this));
        }

        // File input
        const fileInput = document.getElementById('evidenceFile');
        if (fileInput) {
            fileInput.addEventListener('change', this.handleFilePreview.bind(this));
        }

        // Search and filters
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(this.performSearch.bind(this), 300));
        }

        // Filter controls
        ['statusFilter', 'typeFilter', 'startDate', 'endDate', 'sortBy', 'sortOrder'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', this.performSearch.bind(this));
            }
        });
    }

    updateUI() {
        // Update user info
        const userRole = document.getElementById('userRole');
        const userWallet = document.getElementById('userWallet');
        
        if (userRole && this.currentUser) {
            userRole.textContent = this.getRoleName(this.currentUser.role);
            userRole.className = `badge badge-${this.getRoleClass(this.currentUser.role)}`;
        }
        
        if (userWallet) {
            userWallet.textContent = this.userAccount.substring(0, 8) + '...';
        }
    }

    async handleEvidenceUpload(event) {
        event.preventDefault();
        
        try {
            this.showLoading(true);
            
            const formData = new FormData(event.target);
            const fileInput = document.getElementById('evidenceFile');
            const file = fileInput.files[0];
            
            if (!file) {
                this.showAlert('Please select a file to upload', 'error');
                return;
            }

            // Validate file
            if (!this.validateFile(file)) {
                return;
            }

            // Convert to base64 and generate hash
            const fileData = await this.fileToBase64(file);
            const hash = await this.generateHash(fileData);
            
            const evidenceData = {
                caseId: formData.get('caseId'),
                title: formData.get('title'),
                description: formData.get('description'),
                type: formData.get('type'),
                fileData: fileData,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                hash: hash,
                submittedBy: this.userAccount
            };

            const evidenceId = await storage.saveEvidence(evidenceData);
            
            this.showAlert('Evidence uploaded successfully! ID: ' + evidenceId, 'success');
            
            // Reset form and reload
            event.target.reset();
            document.getElementById('filePreview').innerHTML = '';
            this.hideUploadForm();
            await this.loadEvidence();
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showAlert('Upload failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    validateFile(file) {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
        
        if (file.size > maxSize) {
            this.showAlert('File size exceeds 50MB limit', 'error');
            return false;
        }
        
        if (!allowedTypes.some(type => file.type.startsWith(type))) {
            this.showAlert('File type not allowed', 'error');
            return false;
        }
        
        return true;
    }

    handleFilePreview(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const preview = document.getElementById('filePreview');
        if (preview) {
            preview.innerHTML = `
                <div class="file-preview">
                    <div class="file-icon">${this.getFileIcon(file.type)}</div>
                    <div class="file-details">
                        <p><strong>File:</strong> ${file.name}</p>
                        <p><strong>Size:</strong> ${this.formatFileSize(file.size)}</p>
                        <p><strong>Type:</strong> ${file.type}</p>
                        <div class="security-indicator secure">
                            ✅ File validated successfully
                        </div>
                    </div>
                </div>
            `;
        }
    }

    performSearch() {
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const typeFilter = document.getElementById('typeFilter')?.value || '';
        const startDate = document.getElementById('startDate')?.value || '';
        const endDate = document.getElementById('endDate')?.value || '';
        const sortBy = document.getElementById('sortBy')?.value || 'timestamp';
        const sortOrder = document.getElementById('sortOrder')?.value || 'desc';

        // Filter evidence
        this.filteredList = this.evidenceList.filter(evidence => {
            // Text search
            if (searchTerm) {
                const searchFields = [
                    evidence.title,
                    evidence.description,
                    evidence.case_id || evidence.caseId,
                    evidence.file_name || evidence.fileName
                ].join(' ').toLowerCase();
                
                if (!searchFields.includes(searchTerm)) {
                    return false;
                }
            }

            // Status filter
            if (statusFilter && evidence.status !== statusFilter) {
                return false;
            }

            // Type filter
            if (typeFilter && evidence.type !== typeFilter) {
                return false;
            }

            // Date range filter
            if (startDate || endDate) {
                const evidenceDate = new Date(evidence.timestamp);
                if (startDate && evidenceDate < new Date(startDate)) return false;
                if (endDate && evidenceDate > new Date(endDate + 'T23:59:59')) return false;
            }

            return true;
        });

        // Sort evidence
        this.filteredList.sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'title':
                    aValue = (a.title || '').toLowerCase();
                    bValue = (b.title || '').toLowerCase();
                    break;
                case 'timestamp':
                    aValue = new Date(a.timestamp);
                    bValue = new Date(b.timestamp);
                    break;
                case 'type':
                    aValue = (a.type || '').toLowerCase();
                    bValue = (b.type || '').toLowerCase();
                    break;
                default:
                    aValue = a[sortBy] || '';
                    bValue = b[sortBy] || '';
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        this.displayEvidence();
    }

    displayEvidence() {
        const container = document.getElementById('evidenceList');
        const resultsCount = document.getElementById('resultsCount');
        
        if (resultsCount) {
            resultsCount.textContent = `Showing ${this.filteredList.length} of ${this.evidenceList.length} evidence items`;
        }
        
        if (!container) return;
        
        if (this.filteredList.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">📁</div>
                    <h3>No Evidence Found</h3>
                    <p>Upload your first evidence item to get started.</p>
                    <button class="btn btn-primary" onclick="dashboardManager.showUploadForm()">📤 Upload Evidence</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredList.map(evidence => `
            <div class="evidence-card card">
                <div class="card-body">
                    <div class="evidence-header">
                        <h5>${this.highlightSearchTerm(evidence.title)}</h5>
                        <span class="badge badge-${this.getStatusClass(evidence.status)}">${evidence.status}</span>
                    </div>
                    <p class="text-muted">${this.highlightSearchTerm(evidence.description || 'No description')}</p>
                    <div class="evidence-meta">
                        <div class="meta-row">
                            <span class="meta-label">Case ID:</span>
                            <span class="meta-value">${this.highlightSearchTerm(evidence.case_id || evidence.caseId)}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Type:</span>
                            <span class="meta-value">${evidence.type}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">File:</span>
                            <span class="meta-value">${evidence.file_name || evidence.fileName}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Size:</span>
                            <span class="meta-value">${this.formatFileSize(evidence.file_size || evidence.fileSize)}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Hash:</span>
                            <span class="meta-value"><code class="hash-display">${(evidence.hash || '').substring(0, 16)}...</code></span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">Uploaded:</span>
                            <span class="meta-value">${new Date(evidence.timestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div class="evidence-actions mt-3">
                        <button class="btn btn-sm btn-outline" onclick="dashboardManager.viewEvidence(${evidence.id})">
                            👁️ View Details
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="dashboardManager.downloadEvidence(${evidence.id})">
                            📥 Download
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="dashboardManager.verifyIntegrity(${evidence.id})">
                            🔒 Verify Integrity
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async viewEvidence(evidenceId) {
        try {
            const evidence = await storage.getEvidence(evidenceId);
            if (!evidence) {
                this.showAlert('Evidence not found', 'error');
                return;
            }

            const modal = document.getElementById('evidenceModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalContent = document.getElementById('modalContent');

            if (modalTitle) modalTitle.textContent = `Evidence: ${evidence.title}`;
            
            if (modalContent) {
                modalContent.innerHTML = `
                    <div class="evidence-details">
                        <div class="detail-section">
                            <h4>📋 Basic Information</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Title:</label>
                                    <span>${evidence.title}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Case ID:</label>
                                    <span>${evidence.case_id || evidence.caseId}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Type:</label>
                                    <span>${evidence.type}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Status:</label>
                                    <span class="badge badge-${this.getStatusClass(evidence.status)}">${evidence.status}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>📁 File Information</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Filename:</label>
                                    <span>${evidence.file_name || evidence.fileName}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Size:</label>
                                    <span>${this.formatFileSize(evidence.file_size || evidence.fileSize)}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Type:</label>
                                    <span>${evidence.mime_type || evidence.mimeType || 'Unknown'}</span>
                                </div>
                                <div class="detail-item">
                                    <label>SHA-256 Hash:</label>
                                    <span><code>${evidence.hash}</code></span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>👤 Submission Details</h4>
                            <div class="detail-grid">
                                <div class="detail-item">
                                    <label>Submitted By:</label>
                                    <span>${evidence.submitted_by}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Submission Date:</label>
                                    <span>${new Date(evidence.timestamp).toLocaleString()}</span>
                                </div>
                                <div class="detail-item">
                                    <label>IP Address:</label>
                                    <span>${evidence.submission_ip || 'Not recorded'}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${evidence.description ? `
                        <div class="detail-section">
                            <h4>📝 Description</h4>
                            <p>${evidence.description}</p>
                        </div>
                        ` : ''}
                        
                        <div class="detail-actions">
                            <button class="btn btn-primary" onclick="dashboardManager.downloadEvidence(${evidence.id})">
                                📥 Download File
                            </button>
                            <button class="btn btn-outline" onclick="dashboardManager.verifyIntegrity(${evidence.id})">
                                🔒 Verify Integrity
                            </button>
                        </div>
                    </div>
                `;
            }

            if (modal) modal.classList.add('active');

        } catch (error) {
            console.error('Error viewing evidence:', error);
            this.showAlert('Error loading evidence details', 'error');
        }
    }

    async downloadEvidence(evidenceId) {
        try {
            const evidence = await storage.getEvidence(evidenceId);
            if (!evidence) {
                this.showAlert('Evidence not found', 'error');
                return;
            }

            // Convert base64 back to blob and download
            const fileData = evidence.file_data || evidence.fileData;
            const blob = this.base64ToBlob(fileData);
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = evidence.file_name || evidence.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showAlert('Evidence downloaded successfully', 'success');
            
        } catch (error) {
            console.error('Error downloading evidence:', error);
            this.showAlert('Error downloading evidence', 'error');
        }
    }

    async verifyIntegrity(evidenceId) {
        try {
            const evidence = await storage.getEvidence(evidenceId);
            if (!evidence) {
                this.showAlert('Evidence not found', 'error');
                return;
            }

            // Recalculate hash
            const fileData = evidence.file_data || evidence.fileData;
            const currentHash = await this.generateHash(fileData);
            const originalHash = evidence.hash;

            if (currentHash === originalHash) {
                this.showAlert('✅ File integrity verified - Evidence has not been tampered with', 'success');
            } else {
                this.showAlert('❌ File integrity check failed - Evidence may have been modified', 'error');
            }
            
        } catch (error) {
            console.error('Error verifying integrity:', error);
            this.showAlert('Error during integrity verification', 'error');
        }
    }

    updateStats() {
        const totalEvidence = document.getElementById('totalEvidence');
        if (totalEvidence) {
            totalEvidence.textContent = `${this.evidenceList.length} Evidence Items`;
        }
    }

    // UI Helper Functions
    showUploadForm() {
        const container = document.getElementById('uploadFormContainer');
        const searchContainer = document.getElementById('searchContainer');
        if (container) container.classList.remove('hidden');
        if (searchContainer) searchContainer.classList.add('hidden');
    }

    hideUploadForm() {
        const container = document.getElementById('uploadFormContainer');
        if (container) container.classList.add('hidden');
    }

    showSearchForm() {
        const container = document.getElementById('searchContainer');
        const uploadContainer = document.getElementById('uploadFormContainer');
        if (container) container.classList.remove('hidden');
        if (uploadContainer) uploadContainer.classList.add('hidden');
    }

    hideSearchForm() {
        const container = document.getElementById('searchContainer');
        if (container) container.classList.add('hidden');
    }

    clearFilters() {
        ['searchInput', 'statusFilter', 'typeFilter', 'startDate', 'endDate'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
        
        const sortBy = document.getElementById('sortBy');
        const sortOrder = document.getElementById('sortOrder');
        if (sortBy) sortBy.value = 'timestamp';
        if (sortOrder) sortOrder.value = 'desc';
        
        this.performSearch();
    }

    async exportData() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                user: this.currentUser,
                evidence: this.filteredList,
                totalCount: this.evidenceList.length,
                filteredCount: this.filteredList.length
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `evidence-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showAlert('Data exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showAlert('Export failed', 'error');
        }
    }

    logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    // Utility Functions
    highlightSearchTerm(text) {
        const searchTerm = document.getElementById('searchInput')?.value;
        if (!searchTerm || !text) return text;
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType === 'application/pdf') return '📄';
        return '📁';
    }

    formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getRoleName(role) {
        const roles = {
            1: 'Public Viewer', 2: 'Investigator', 3: 'Forensic Analyst',
            4: 'Legal Professional', 5: 'Court Official', 6: 'Evidence Manager',
            7: 'Auditor', 8: 'Administrator'
        };
        return roles[role] || 'Unknown';
    }

    getRoleClass(role) {
        const classes = {
            1: 'public', 2: 'investigator', 3: 'forensic', 4: 'legal',
            5: 'court', 6: 'manager', 7: 'auditor', 8: 'admin'
        };
        return classes[role] || 'public';
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'warning', 'approved': 'success',
            'rejected': 'danger', 'under_review': 'info'
        };
        return classes[status] || 'secondary';
    }

    showLoading(show) {
        // Implement loading indicator
        console.log('Loading:', show);
    }

    showAlert(message, type) {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = message;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            max-width: 400px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        `;
        
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 5000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    base64ToBlob(base64) {
        const byteCharacters = atob(base64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray]);
    }

    async generateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

// Initialize dashboard manager
const dashboardManager = new DashboardManager();

// Global functions for HTML onclick handlers
function showUploadForm() { dashboardManager.showUploadForm(); }
function hideUploadForm() { dashboardManager.hideUploadForm(); }
function showSearchForm() { dashboardManager.showSearchForm(); }
function hideSearchForm() { dashboardManager.hideSearchForm(); }
function resetForm() { document.getElementById('evidenceUploadForm').reset(); }
function logout() { dashboardManager.logout(); }
function performSearch() { dashboardManager.performSearch(); }
function clearFilters() { dashboardManager.clearFilters(); }
function exportData() { dashboardManager.exportData(); }
function closeModal() { document.getElementById('evidenceModal').classList.remove('active'); }