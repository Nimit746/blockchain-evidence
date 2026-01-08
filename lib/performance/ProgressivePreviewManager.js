/**
 * Progressive Evidence Preview System
 * Streaming and progressive loading for large files
 */

const sharp = require('sharp');
const crypto = require('crypto');

class ProgressivePreviewManager {
    constructor() {
        this.previewCache = new Map();
        this.streamingCache = new Map();
        this.supportedFormats = {
            image: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
            video: ['video/mp4', 'video/webm', 'video/avi', 'video/mov'],
            document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        };
        
        this.previewSizes = {
            thumbnail: { width: 150, height: 150, quality: 60 },
            small: { width: 400, height: 300, quality: 70 },
            medium: { width: 800, height: 600, quality: 80 },
            large: { width: 1200, height: 900, quality: 85 }
        };
        
        this.chunkSize = 64 * 1024; // 64KB chunks for streaming
    }

    /**
     * Generate progressive previews for evidence
     */
    async generateProgressivePreviews(evidenceId, fileBuffer, mimeType, filename) {
        try {
            const previews = {
                evidenceId,
                filename,
                mimeType,
                fileSize: fileBuffer.length,
                previews: {},
                metadata: {},
                generatedAt: new Date().toISOString()
            };

            if (this.isImageFile(mimeType)) {
                previews.previews = await this.generateImagePreviews(fileBuffer);
                previews.metadata = await this.extractImageMetadata(fileBuffer);
            } else if (this.isVideoFile(mimeType)) {
                previews.previews = await this.generateVideoPreviews(fileBuffer, filename);
                previews.metadata = await this.extractVideoMetadata(fileBuffer);
            } else if (this.isDocumentFile(mimeType)) {
                previews.previews = await this.generateDocumentPreviews(fileBuffer, mimeType);
                previews.metadata = await this.extractDocumentMetadata(fileBuffer, mimeType);
            }

            // Cache the previews
            this.previewCache.set(evidenceId, previews);

            return previews;

        } catch (error) {
            console.error('Failed to generate progressive previews:', error);
            throw error;
        }
    }

    /**
     * Generate image previews at different sizes
     */
    async generateImagePreviews(fileBuffer) {
        const previews = {};

        try {
            const image = sharp(fileBuffer);
            const metadata = await image.metadata();

            for (const [sizeName, config] of Object.entries(this.previewSizes)) {
                try {
                    const preview = await image
                        .resize(config.width, config.height, {
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .jpeg({ quality: config.quality })
                        .toBuffer();

                    previews[sizeName] = {
                        buffer: preview,
                        size: preview.length,
                        width: config.width,
                        height: config.height,
                        format: 'jpeg',
                        base64: `data:image/jpeg;base64,${preview.toString('base64')}`
                    };
                } catch (sizeError) {
                    console.warn(`Failed to generate ${sizeName} preview:`, sizeError);
                }
            }

            // Generate progressive JPEG for streaming
            if (metadata.width > 800 || metadata.height > 600) {
                const progressive = await image
                    .jpeg({ 
                        quality: 85, 
                        progressive: true,
                        mozjpeg: true 
                    })
                    .toBuffer();

                previews.progressive = {
                    buffer: progressive,
                    size: progressive.length,
                    format: 'progressive-jpeg'
                };
            }

        } catch (error) {
            console.error('Failed to generate image previews:', error);
        }

        return previews;
    }

    /**
     * Generate video previews (thumbnails and segments)
     */
    async generateVideoPreviews(fileBuffer, filename) {
        const previews = {};

        try {
            // Mock video preview generation
            // In production, use ffmpeg to extract frames and create thumbnails
            
            // Generate thumbnail from first frame
            previews.thumbnail = {
                buffer: null, // Would contain actual thumbnail
                size: 0,
                width: 320,
                height: 240,
                format: 'jpeg',
                timestamp: '00:00:01'
            };

            // Generate preview segments for scrubbing
            previews.segments = [];
            const segmentCount = 10;
            
            for (let i = 0; i < segmentCount; i++) {
                previews.segments.push({
                    index: i,
                    timestamp: `00:00:${String(i * 6).padStart(2, '0')}`,
                    thumbnail: null, // Would contain segment thumbnail
                    size: 0
                });
            }

            // Generate low-resolution preview video
            previews.lowRes = {
                buffer: null, // Would contain low-res video
                size: 0,
                width: 480,
                height: 360,
                bitrate: '500k',
                format: 'mp4'
            };

        } catch (error) {
            console.error('Failed to generate video previews:', error);
        }

        return previews;
    }

    /**
     * Generate document previews (page thumbnails)
     */
    async generateDocumentPreviews(fileBuffer, mimeType) {
        const previews = {};

        try {
            if (mimeType === 'application/pdf') {
                // Mock PDF preview generation
                // In production, use pdf2pic or similar library
                
                previews.pages = [];
                const pageCount = 5; // Mock page count
                
                for (let i = 0; i < pageCount; i++) {
                    previews.pages.push({
                        pageNumber: i + 1,
                        thumbnail: null, // Would contain page thumbnail
                        size: 0,
                        width: 200,
                        height: 280
                    });
                }

                previews.firstPage = {
                    buffer: null, // Would contain first page as image
                    size: 0,
                    width: 600,
                    height: 800,
                    format: 'png'
                };
            }

        } catch (error) {
            console.error('Failed to generate document previews:', error);
        }

        return previews;
    }

    /**
     * Stream large file in chunks
     */
    async streamFile(evidenceId, fileBuffer, startByte = 0, endByte = null) {
        try {
            const totalSize = fileBuffer.length;
            const actualEndByte = endByte || Math.min(startByte + this.chunkSize - 1, totalSize - 1);
            
            if (startByte >= totalSize) {
                throw new Error('Start byte exceeds file size');
            }

            const chunk = fileBuffer.slice(startByte, actualEndByte + 1);
            
            const streamInfo = {
                evidenceId,
                chunkSize: chunk.length,
                startByte,
                endByte: actualEndByte,
                totalSize,
                isComplete: actualEndByte >= totalSize - 1,
                progress: Math.round((actualEndByte / totalSize) * 100),
                chunk
            };

            // Cache streaming info
            const streamKey = `${evidenceId}_${startByte}`;
            this.streamingCache.set(streamKey, streamInfo);

            return streamInfo;

        } catch (error) {
            console.error('Failed to stream file:', error);
            throw error;
        }
    }

    /**
     * Get adaptive preview based on connection speed and device
     */
    async getAdaptivePreview(evidenceId, connectionSpeed = 'fast', deviceType = 'desktop') {
        try {
            const previews = this.previewCache.get(evidenceId);
            if (!previews) {
                throw new Error('Previews not found');
            }

            let selectedPreview;

            // Select appropriate preview based on connection and device
            if (connectionSpeed === 'slow' || deviceType === 'mobile') {
                selectedPreview = previews.previews.thumbnail || previews.previews.small;
            } else if (connectionSpeed === 'medium') {
                selectedPreview = previews.previews.small || previews.previews.medium;
            } else {
                selectedPreview = previews.previews.medium || previews.previews.large;
            }

            return {
                evidenceId,
                selectedSize: this.getPreviewSize(selectedPreview, previews.previews),
                preview: selectedPreview,
                adaptiveReason: `Optimized for ${connectionSpeed} connection on ${deviceType}`,
                alternatives: Object.keys(previews.previews),
                metadata: previews.metadata
            };

        } catch (error) {
            console.error('Failed to get adaptive preview:', error);
            throw error;
        }
    }

    /**
     * Generate lazy loading manifest
     */
    async generateLazyLoadingManifest(evidenceId, fileBuffer, mimeType) {
        try {
            const manifest = {
                evidenceId,
                mimeType,
                totalSize: fileBuffer.length,
                loadingStrategy: this.determineLoadingStrategy(fileBuffer.length, mimeType),
                chunks: [],
                previews: [],
                metadata: {}
            };

            // Generate chunk manifest for large files
            if (fileBuffer.length > 1024 * 1024) { // > 1MB
                const chunkCount = Math.ceil(fileBuffer.length / this.chunkSize);
                
                for (let i = 0; i < chunkCount; i++) {
                    const startByte = i * this.chunkSize;
                    const endByte = Math.min(startByte + this.chunkSize - 1, fileBuffer.length - 1);
                    
                    manifest.chunks.push({
                        index: i,
                        startByte,
                        endByte,
                        size: endByte - startByte + 1,
                        priority: i === 0 ? 'high' : 'normal' // First chunk has high priority
                    });
                }
            }

            // Generate preview manifest
            const previews = await this.generateProgressivePreviews(evidenceId, fileBuffer, mimeType, 'evidence');
            manifest.previews = Object.keys(previews.previews).map(size => ({
                size,
                width: previews.previews[size].width,
                height: previews.previews[size].height,
                fileSize: previews.previews[size].size,
                format: previews.previews[size].format
            }));

            manifest.metadata = previews.metadata;

            return manifest;

        } catch (error) {
            console.error('Failed to generate lazy loading manifest:', error);
            throw error;
        }
    }

    /**
     * Preload critical content
     */
    async preloadCriticalContent(evidenceId, fileBuffer, mimeType) {
        try {
            const critical = {
                evidenceId,
                mimeType,
                content: {}
            };

            if (this.isImageFile(mimeType)) {
                // Preload thumbnail and small preview
                const previews = await this.generateImagePreviews(fileBuffer);
                critical.content.thumbnail = previews.thumbnail;
                critical.content.small = previews.small;
            } else if (this.isVideoFile(mimeType)) {
                // Preload first frame thumbnail
                const previews = await this.generateVideoPreviews(fileBuffer, 'video');
                critical.content.thumbnail = previews.thumbnail;
            } else if (this.isDocumentFile(mimeType)) {
                // Preload first page
                const previews = await this.generateDocumentPreviews(fileBuffer, mimeType);
                critical.content.firstPage = previews.firstPage;
            }

            // Always preload first chunk for streaming
            const firstChunk = await this.streamFile(evidenceId, fileBuffer, 0, this.chunkSize - 1);
            critical.content.firstChunk = {
                size: firstChunk.chunkSize,
                progress: firstChunk.progress
            };

            return critical;

        } catch (error) {
            console.error('Failed to preload critical content:', error);
            throw error;
        }
    }

    // Helper methods
    isImageFile(mimeType) {
        return this.supportedFormats.image.includes(mimeType);
    }

    isVideoFile(mimeType) {
        return this.supportedFormats.video.includes(mimeType);
    }

    isDocumentFile(mimeType) {
        return this.supportedFormats.document.includes(mimeType);
    }

    getPreviewSize(selectedPreview, allPreviews) {
        for (const [size, preview] of Object.entries(allPreviews)) {
            if (preview === selectedPreview) {
                return size;
            }
        }
        return 'unknown';
    }

    determineLoadingStrategy(fileSize, mimeType) {
        if (fileSize < 100 * 1024) { // < 100KB
            return 'immediate';
        } else if (fileSize < 1024 * 1024) { // < 1MB
            return 'progressive';
        } else if (this.isImageFile(mimeType)) {
            return 'progressive_image';
        } else if (this.isVideoFile(mimeType)) {
            return 'streaming_video';
        } else {
            return 'chunked';
        }
    }

    async extractImageMetadata(fileBuffer) {
        try {
            const metadata = await sharp(fileBuffer).metadata();
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                colorSpace: metadata.space,
                channels: metadata.channels,
                density: metadata.density,
                hasAlpha: metadata.hasAlpha,
                isAnimated: metadata.pages > 1
            };
        } catch (error) {
            return {};
        }
    }

    async extractVideoMetadata(fileBuffer) {
        // Mock video metadata extraction
        return {
            duration: 120, // seconds
            width: 1920,
            height: 1080,
            frameRate: 30,
            bitrate: '2000k',
            codec: 'h264',
            hasAudio: true
        };
    }

    async extractDocumentMetadata(fileBuffer, mimeType) {
        // Mock document metadata extraction
        return {
            pageCount: 5,
            format: mimeType,
            hasText: true,
            hasImages: true,
            isSearchable: true
        };
    }

    /**
     * Clean up cached previews
     */
    cleanupCache(maxAge = 3600000) { // 1 hour default
        const now = Date.now();
        
        for (const [key, data] of this.previewCache.entries()) {
            const age = now - new Date(data.generatedAt).getTime();
            if (age > maxAge) {
                this.previewCache.delete(key);
            }
        }

        for (const [key, data] of this.streamingCache.entries()) {
            // Clean up streaming cache more aggressively (5 minutes)
            if (now - data.timestamp > 300000) {
                this.streamingCache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        let totalPreviewSize = 0;
        let totalStreamingSize = 0;

        for (const data of this.previewCache.values()) {
            for (const preview of Object.values(data.previews)) {
                totalPreviewSize += preview.size || 0;
            }
        }

        for (const data of this.streamingCache.values()) {
            totalStreamingSize += data.chunkSize || 0;
        }

        return {
            previewCache: {
                entries: this.previewCache.size,
                totalSize: totalPreviewSize,
                averageSize: this.previewCache.size > 0 ? totalPreviewSize / this.previewCache.size : 0
            },
            streamingCache: {
                entries: this.streamingCache.size,
                totalSize: totalStreamingSize,
                averageSize: this.streamingCache.size > 0 ? totalStreamingSize / this.streamingCache.size : 0
            },
            totalMemoryUsage: totalPreviewSize + totalStreamingSize
        };
    }
}

module.exports = ProgressivePreviewManager;