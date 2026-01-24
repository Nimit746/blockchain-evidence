// Latest Release Component
class LatestReleaseComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.isLoading = false;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    renderLoading() {
        return `
            <div class="latest-release-card loading">
                <div class="release-header">
                    <div class="loading-skeleton title-skeleton"></div>
                    <div class="loading-skeleton version-skeleton"></div>
                </div>
                <div class="loading-skeleton content-skeleton"></div>
                <div class="loading-skeleton button-skeleton"></div>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class="latest-release-card error">
                <div class="release-header">
                    <i data-lucide="alert-circle" class="error-icon"></i>
                    <h3>Release Information Unavailable</h3>
                </div>
                <p class="error-message">${message}</p>
                <a href="https://github.com/Gooichand/blockchain-evidence/releases" 
                   target="_blank" class="btn btn-outline">
                    <i data-lucide="external-link"></i>
                    View on GitHub
                </a>
            </div>
        `;
    }

    renderRelease(release) {
        const assets = release.assets.length > 0 ? 
            release.assets.map(asset => `
                <a href="${asset.downloadUrl}" class="download-asset" target="_blank">
                    <i data-lucide="download"></i>
                    ${asset.name}
                    <span class="asset-size">(${this.formatFileSize(asset.size)})</span>
                </a>
            `).join('') : '';

        return `
            <div class="latest-release-card">
                <div class="release-header">
                    <div class="release-info">
                        <h3>Latest Release</h3>
                        <div class="version-badge">${release.version}</div>
                    </div>
                    <div class="release-date">
                        <i data-lucide="calendar"></i>
                        ${this.formatDate(release.publishedAt)}
                    </div>
                </div>
                
                <div class="release-content">
                    <h4 class="release-name">${release.name || release.version}</h4>
                    ${release.body ? `
                        <div class="release-notes">
                            <h5>Release Notes:</h5>
                            <div class="notes-content">${this.formatReleaseNotes(release.body)}</div>
                        </div>
                    ` : ''}
                </div>

                <div class="release-actions">
                    ${assets ? `
                        <div class="download-section">
                            <h5>Downloads:</h5>
                            <div class="download-assets">
                                ${assets}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="action-buttons">
                        <a href="${release.htmlUrl}" target="_blank" class="btn btn-primary">
                            <i data-lucide="external-link"></i>
                            View Release
                        </a>
                        <a href="https://github.com/Gooichand/blockchain-evidence/releases" 
                           target="_blank" class="btn btn-outline">
                            <i data-lucide="list"></i>
                            All Releases
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    formatReleaseNotes(notes) {
        // Convert markdown-style formatting to HTML
        return notes
            .replace(/### (.*)/g, '<h6>$1</h6>')
            .replace(/## (.*)/g, '<h5>$1</h5>')
            .replace(/# (.*)/g, '<h4>$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/- (.*)/g, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gm, '<p>$1</p>')
            .replace(/<p><li>/g, '<ul><li>')
            .replace(/<\/li><\/p>/g, '</li></ul>');
    }

    async render() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.container.innerHTML = this.renderLoading();

        try {
            const release = await githubReleases.fetchLatestRelease();
            this.container.innerHTML = this.renderRelease(release);
        } catch (error) {
            let message = 'Unable to fetch release information.';
            if (error.message === 'No releases found') {
                message = 'No releases have been published yet.';
            }
            this.container.innerHTML = this.renderError(message);
        } finally {
            this.isLoading = false;
            // Re-initialize Lucide icons for new content
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
}

// Initialize component when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const releaseComponent = new LatestReleaseComponent('latest-release-container');
    releaseComponent.render();
});