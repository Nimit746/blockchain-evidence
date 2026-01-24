// GitHub Releases API utility
class GitHubReleases {
    constructor(owner, repo) {
        this.owner = owner;
        this.repo = repo;
        this.apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        this.cacheKey = `github_release_${owner}_${repo}`;
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }

    getCachedData() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;
            
            const { data, timestamp } = JSON.parse(cached);
            const isExpired = Date.now() - timestamp > this.cacheExpiry;
            
            return isExpired ? null : data;
        } catch (error) {
            return null;
        }
    }

    setCachedData(data) {
        try {
            const cacheData = { data, timestamp: Date.now() };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Cache write error:', error);
        }
    }

    async fetchLatestRelease() {
        const cachedData = this.getCachedData();
        if (cachedData) return cachedData;

        try {
            const response = await fetch(this.apiUrl);
            
            if (!response.ok) {
                if (response.status === 404) throw new Error('No releases found');
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const data = await response.json();
            
            const processedData = {
                version: data.tag_name,
                name: data.name,
                publishedAt: data.published_at,
                body: data.body,
                htmlUrl: data.html_url,
                assets: data.assets.map(asset => ({
                    name: asset.name,
                    downloadUrl: asset.browser_download_url,
                    size: asset.size
                }))
            };

            this.setCachedData(processedData);
            return processedData;
        } catch (error) {
            throw error;
        }
    }
}

const githubReleases = new GitHubReleases('Gooichand', 'blockchain-evidence');