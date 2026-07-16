
/**
 * Service to manage offline audio caching using the Cache API.
 */
const CACHE_NAME = 'nahj-al-nur-audio-v1';

export const offlineAudioService = {
  /**
   * Checks if an audio URL is available in the offline cache.
   */
  async isDownloaded(url: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(url);
      return !!response;
    } catch (error: any) {
      console.error('Offline service error:', error?.message || error);
      return false;
    }
  },

  /**
   * Downloads and saves an audio file to the cache.
   */
  async downloadAudio(url: string, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      
      // Use fetch to get the file with progress tracking if possible
      // Note: simple download for now as full progress tracking requires a manual fetch loop
      if (onProgress) onProgress(10); // Simple start indicator
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch audio');
      
      await cache.put(url, response);
      if (onProgress) onProgress(100);
      
      return true;
    } catch (error: any) {
      console.error('Download error:', error?.message || error);
      return false;
    }
  },

  /**
   * Removes an audio file from the offline cache.
   */
  async removeAudio(url: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      return await cache.delete(url);
    } catch (error: any) {
      console.error('Delete error:', error?.message || error);
      return false;
    }
  },

  /**
   * Gets the audio source URL. Returns a blob URL if cached, or the original URL.
   */
  async getAudioSource(url: string): Promise<string> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        return URL.createObjectURL(blob);
      }
    } catch (error: any) {
      console.error('Fetch from cache error:', error?.message || error);
    }
    return url;
  }
};
