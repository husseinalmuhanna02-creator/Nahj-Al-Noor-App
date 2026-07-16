import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import Fuse from 'fuse.js';
import { collection, addDoc, getDocs, query, where, writeBatch, doc, limit, getDocFromServer, orderBy, waitForPendingWrites } from 'firebase/firestore';
import { db, auth, resetFirestore, isFirebaseEnabled } from './firebase';
import { dailySupplications } from '../data/supplications';
import { shubuhatItems } from '../data/shubuhat';

// Configure PDF.js worker using local Vite asset URL to avoid cross-origin and iframe CORS Script Errors
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface SearchResult {
  bookId: string;
  bookTitle: string;
  pageNumber: number;
  snippet: string;
  url: string;
  category?: string;
  content?: string;
  score?: number;
  sectionName?: string;
  phase?: string;
}

export function normalizeArabic(text: string): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670]/g, "") // Remove all comprehensive harakat (Tashkeel)
    .replace(/[أإآٱ]/g, "ا") // Normalize all Alefs to ا
    .replace(/[ةه]/g, "ه") // Normalize Taa Marbuta and Haa to ه
    .replace(/[ىيیئ]/g, "ي") // Normalize Alef Maqsura, Ya, Persian Ya, and Ya with Hamza to ي
    .replace(/[كک]/g, "ك") // Normalize Arabic and Persian Kaf to ك
    .replace(/[ؤ]/g, "و") // Normalize Waw with Hamza to و
    .replace(/[ـ]/g, "") // Remove Tatweel (Kashida)
    .replace(/\s+/g, " ") // Normalize multiple spaces
    .trim()
    .toLowerCase();
}

export function normalizeText(str: string): string {
  return normalizeArabic(str);
}

export function checkArabicMatch(sourceText: string | undefined | null, queryStr: string): boolean {
  if (!queryStr) return true;
  if (!sourceText) return false;
  
  const normalizedSource = normalizeArabic(sourceText);
  const normalizedQuery = normalizeArabic(queryStr);
  
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return false;
  
  // Checking that every word in the search query exists in the source text
  return queryWords.every(word => normalizedSource.includes(word));
}

export function extractAllTextSegments(item: any): { sectionName: string; text: string; pageNumber?: number }[] {
  const segments: { sectionName: string; text: string; pageNumber?: number }[] = [];

  const processField = (value: any, defaultKey: string) => {
    if (!value) return;

    if (typeof value === 'string') {
      segments.push({ sectionName: defaultKey, text: value });
    } else if (Array.isArray(value)) {
      value.forEach((element, idx) => {
        if (!element) return;
        if (typeof element === 'string') {
          segments.push({ sectionName: `${defaultKey} - الفقرة ${idx + 1}`, text: element });
        } else if (typeof element === 'object') {
          const title = element.titleAr || element.title || element.header || `${defaultKey} ${idx + 1}`;
          const text = element.contentAr || element.content || element.text || element.body || '';
          const pageNum = element.pageNumber || element.pageNum || element.page;
          const pageNumParsed = typeof pageNum === 'number' ? pageNum : undefined;
          
          if (typeof text === 'string' && text) {
            segments.push({ sectionName: title, text: text, pageNumber: pageNumParsed });
          } else if (typeof element.textAr === 'string' && element.textAr) {
            segments.push({ sectionName: title, text: element.textAr, pageNumber: pageNumParsed });
          }
        }
      });
    }
  };

  processField(item.content, 'المحتوى');
  processField(item.contentAr, 'المحتوى');
  processField(item.chapters, 'الفصل');
  processField(item.text, 'النص');
  processField(item.textAr, 'النص');
  processField(item.pages, 'الصفحة');

  if (typeof item.description === 'string' && item.description) {
    segments.push({ sectionName: 'الوصف', text: item.description });
  }

  return segments;
}

export function findBestSnippet(originalText: string, queryStr: string): { snippet: string, matchOffset: number } {
  const normalizedQuery = normalizeArabic(queryStr);
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) {
    return { snippet: originalText.slice(0, 150) + '...', matchOffset: 0 };
  }

  const parts = originalText.split(/[\n،.\n]+/).map(p => p.trim()).filter(p => p.length > 10);
  for (const part of parts) {
    if (checkArabicMatch(part, queryStr)) {
      const idx = originalText.indexOf(part);
      return { snippet: part.length > 180 ? part.substring(0, 180) + '...' : part, matchOffset: idx >= 0 ? idx : 0 };
    }
  }

  const words = originalText.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const windowWords = words.slice(i, i + 35);
    const windowText = windowWords.join(' ');
    if (checkArabicMatch(windowText, queryStr)) {
      const idx = originalText.indexOf(windowText);
      return { snippet: '...' + windowText.substring(0, 180) + '...', matchOffset: idx >= 0 ? idx : 0 };
    }
  }

  const firstWord = queryWords[0];
  const normalizedOriginal = normalizeArabic(originalText);
  const normIndex = normalizedOriginal.indexOf(firstWord);
  if (normIndex !== -1) {
    let normCount = 0;
    let origIndex = 0;
    while (origIndex < originalText.length && normCount < normIndex) {
      const originalChar = originalText[origIndex];
      const normalizedChar = normalizeArabic(originalChar);
      if (normalizedChar !== '') {
        normCount += normalizedChar.length;
      }
      origIndex++;
    }
    const start = Math.max(0, origIndex - 80);
    const end = Math.min(originalText.length, origIndex + 120);
    let snippet = originalText.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < originalText.length) snippet = snippet + '...';
    return { snippet, matchOffset: origIndex };
  }

  return { snippet: originalText.slice(0, 150) + '...', matchOffset: 0 };
}

export function findMatchInSegments(segments: { sectionName: string; text: string; pageNumber?: number }[], queryStr: string): { matchedSection: string, snippet: string, matchedText: string, pageNumber?: number } | null {
  for (const seg of segments) {
    if (!seg.text) continue;
    if (checkArabicMatch(seg.text, queryStr)) {
      const { snippet } = findBestSnippet(seg.text, queryStr);
      return {
        matchedSection: seg.sectionName,
        snippet: snippet,
        matchedText: seg.text,
        pageNumber: seg.pageNumber
      };
    }
  }
  return null;
}

function extractKeywords(text: string): string[] {
  const normalized = normalizeArabic(text);
  const words = Array.from(new Set(normalized.split(/\s+/).filter(w => w.length > 2)));
  return words.slice(0, 400); // Keep at most 400 keywords to strictly comply with Firestore validation rules (max 500)
}

class PDFSearchManager {
  private static staticQuotaExceeded = false;
  private indexingQueue: Set<string> = new Set();
  private onIndexingProgress?: (progress: { loaded: number, total: number, currentBook: string, bookId: string, phase: string, isResumed?: boolean }) => void;
  private developerMode = false;
  private ocrWorker: any = null;
  private workerUsageCount = 0;
  private fuseInstance: Fuse<SearchResult> | null = null;
  private localIndex: SearchResult[] = [];

  private checkQuotaGuard() {
    if (PDFSearchManager.staticQuotaExceeded) {
      throw new Error('QUOTA_EXCEEDED: لقد أوقفت قاعدة البيانات المزيد من الاتصالات وعمليات الأرشفة بسبب استنفاد حصة الاستخدام اليومية لـ Firestore (Quota Exceeded). سيتم حفظ التقدم تلقائياً، والرجاء الاستئناف غداً.');
    }
  }

  setDeveloperMode(enabled: boolean) {
    this.developerMode = enabled;
  }

  setProgressListener(listener: (progress: { loaded: number, total: number, currentBook: string, bookId: string, phase: string, isResumed?: boolean }) => void) {
    this.onIndexingProgress = listener;
  }

  private lastConnectivityCheck = 0;

  private async checkConnectivity(force = false): Promise<boolean> {
    const now = Date.now();
    // Only check connectivity every 45 seconds to save on reads/network, unless forced
    if (!force && (now - this.lastConnectivityCheck < 45000)) return true;

    if (!db) return false;
    
    // Do not use navigator.onLine as it can be highly unreliable inside sandboxes or iframe context.
    // Let getDocFromServer determine actual connectivity.

    let retries = 2;
    while (retries > 0) {
      try {
        // Use getDocFromServer to verify real connection with a looser check
        await getDocFromServer(doc(db, 'health_check', 'ping'));
        this.lastConnectivityCheck = now;
        return true;
      } catch (error: any) {
        retries--;
        const isTimeout = error.message?.includes('Backend didn\'t respond') || 
                          error.code === 'unavailable' ||
                          error.code === 'deadline-exceeded';
        
        if (isTimeout && retries > 0) {
          console.warn(`Connectivity check timeout, retrying... (${retries} left)`);
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          this.lastConnectivityCheck = now;
          return true;
        }
        console.warn("Firestore connectivity check failed:", error.message);
        break;
      }
    }
    return false;
  }

  async isAdmin(): Promise<boolean> {
    if (this.developerMode) return true;
    try {
      const user = auth?.currentUser;
      if (!user) return false;
      const adminEmails = ['hsynalmhnh224@gmail.com', 'husseinalmuhanna02@gmail.com'];
      return adminEmails.includes(user.email || '');
    } catch {
      return false;
    }
  }

  private async getOCRWorker() {
    if (!this.ocrWorker) {
      this.ocrWorker = await createWorker('ara'); 
      this.workerUsageCount = 0;
    }
    
    // Periodically restart worker to prevent memory accumulation in Tesseract
    if (this.workerUsageCount > 100) {
      console.log("Terminating OCR worker for memory maintenance...");
      await this.ocrWorker.terminate();
      this.ocrWorker = await createWorker('ara');
      this.workerUsageCount = 0;
    }
    
    return this.ocrWorker;
  }

  private saveLocalProgress(bookId: string, page: number) {
    try {
      const progressMap = JSON.parse(localStorage.getItem('indexing_progress_v2') || '{}');
      progressMap[bookId] = page;
      localStorage.setItem('indexing_progress_v2', JSON.stringify(progressMap));
    } catch (e) {
      console.warn("Failed to save local progress", e);
    }
  }

  private getLocalProgress(bookId: string): number {
    try {
      const progressMap = JSON.parse(localStorage.getItem('indexing_progress_v2') || '{}');
      return progressMap[bookId] || 0;
    } catch {
      return 0;
    }
  }

  async isIndexed(bookId: string): Promise<boolean> {
    try {
      if (!db) return false;
      const q = query(collection(db, 'search_indexes'), where('bookId', '==', bookId), limit(1));
      const snap = await getDocs(q); 
      return !snap.empty;
    } catch {
      return false;
    }
  }

  async clearBookIndex(bookId: string) {
    this.checkQuotaGuard();
    if (!db) return;
    
    try {
      let deletedCount = 0;
      while (true) {
        const q = query(
          collection(db, 'search_indexes'), 
          where('bookId', '==', bookId),
          limit(100)
        );
        const snap = await getDocs(q);
        if (snap.empty) break;

        const batch = writeBatch(db);
        snap.docs.forEach(doc => batch.delete(doc.ref));
        
        try {
          await batch.commit();
          // Ensure deleting is physically committed on the server to prevent offline queue buildup
          await Promise.race([
            waitForPendingWrites(db),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_WRITING_TO_SERVER')), 8000))
          ]);
        } catch (commitError: any) {
          const isQuotaOrTimeout = commitError.code === 'resource-exhausted' || 
                                   commitError.message?.includes('Quota exceeded') || 
                                   commitError.message?.includes('resource-exhausted') ||
                                   commitError.message?.includes('exhausted') ||
                                   commitError.message === 'TIMEOUT_WRITING_TO_SERVER';
          if (isQuotaOrTimeout) {
            PDFSearchManager.staticQuotaExceeded = true;
            throw new Error('QUOTA_EXCEEDED_OR_TIMEOUT: تم استهلاك حصة العمليات اليومية أو انقطع الاتصال بالخادم. تم إيقاف عملية التهيئة لسلامة قاعدة البيانات.');
          }
          throw commitError;
        }
        
        deletedCount += snap.size;
        console.log(`Deleted ${deletedCount} entries for ${bookId}...`);
        
        if (snap.size < 100) break;
        
        // Larger delay during deletion
        await new Promise(r => setTimeout(r, 1000));
      }
      console.log(`Cleared existing index for ${bookId}`);
    } catch (error) {
      console.error(`Failed to clear index for ${bookId}:`, error);
      throw error;
    }
  }

  private async getDirectUrl(url: string): Promise<string> {
    const fileId = url.match(/\/d\/([^/]+)/)?.[1];
    if (fileId) {
       return `/api/proxy?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${fileId}`)}`;
    }
    return `/api/proxy?url=${encodeURIComponent(url.replace('/view', '/preview'))}`;
  }

  async indexBook(bookId: string, bookTitle: string, url: string, forceReset = false) {
    if (this.indexingQueue.has(bookId)) return;
    if (!(await this.isAdmin())) return;
    this.checkQuotaGuard();

    // 1. Check local progress first (for instant resumption after crash)
    let startPage = this.getLocalProgress(bookId) + 1;
    let isResumed = startPage > 1;

    // 2. Cross-verify with Firestore if local is empty (or as a safety backup)
    if (!db) return;
    
    // Initial heartbeat
    if (!(await this.checkConnectivity())) {
      throw new Error('تعذر الاتصال بخادم قاعدة البيانات. يرجى التحقق من جودة الإنترنت.');
    }

    if (forceReset) {
      await this.clearBookIndex(bookId);
      startPage = 1;
      isResumed = false;
      localStorage.removeItem(`indexing_progress_v2_${bookId}`); // Old key clean if any
      this.saveLocalProgress(bookId, 0);
    } else {
      // Find last indexed page using ONLY 1 read (optimized for quota)
      let resumeRetries = 3;
      while (resumeRetries > 0) {
        try {
          const q = query(
            collection(db, 'search_indexes'),
            where('bookId', '==', bookId),
            orderBy('pageNumber', 'desc'),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const firestorePage = snap.docs[0].data().pageNumber + 1;
            // Use the furthest known page to ensure no duplication
            if (firestorePage > startPage) {
              startPage = firestorePage;
              isResumed = true;
            }
            console.log(`Verified resume point for ${bookTitle}: Page ${startPage}`);
          }
          break;
        } catch (e: any) {
          resumeRetries--;
          const isNetworkError = e.message?.includes('Backend didn\'t respond') || e.code === 'unavailable';
          if (isNetworkError && resumeRetries > 0) {
            console.warn(`Resume check failed due to network, retrying in 10s...`);
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }
          break;
        }
      }
    }

    this.indexingQueue.add(bookId);
    console.log(`Starting OCR & Text Indexing: ${bookTitle}`);

    try {
      const directUrl = await this.getDirectUrl(url);
      
      const loadingTask = pdfjsLib.getDocument(directUrl);
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      if (startPage > totalPages) {
        console.log(`${bookTitle} is already fully indexed.`);
        return;
      }

      if (isResumed && this.onIndexingProgress) {
        this.onIndexingProgress({ loaded: startPage - 1, total: totalPages, currentBook: bookTitle, bookId, phase: 'Resuming...', isResumed: true });
      }

      let pendingBatch: { id: string; indexData: any; pageNumber: number }[] = [];

      for (let i = startPage; i <= totalPages; i++) {

        const page = await pdf.getPage(i);
        
        // 1. Try Text Extraction
        const textContent = await page.getTextContent();
        let originalText = textContent.items.map((item: any) => (item as any).str).join(' ');
        let phase = "Text Extraction";

        // 2. Perform OCR if text is empty (Image-based PDF)
        if (originalText.trim().length < 10) {
          phase = "OCR Processing";
          if (this.onIndexingProgress) {
            this.onIndexingProgress({ loaded: i, total: totalPages, currentBook: bookTitle, bookId, phase });
          }
          
          let canvas: HTMLCanvasElement | null = document.createElement('canvas');
          let context: CanvasRenderingContext2D | null = canvas.getContext('2d');
          
          try {
            const viewport = page.getViewport({ scale: 2.0 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context!, viewport, canvas: canvas as any }).promise;
            const worker = await this.getOCRWorker();
            const { data: { text } } = await worker.recognize(canvas);
            originalText = text;
            
            this.workerUsageCount++;
          } catch (ocrError) {
            console.warn(`OCR failed for page ${i} of ${bookTitle}:`, ocrError);
          } finally {
            if (canvas) {
              if (context) context.clearRect(0, 0, canvas.width, canvas.height);
              canvas.width = 0;
              canvas.height = 0;
            }
            canvas = null;
            context = null;
          }
        }

        let normalized = normalizeArabic(originalText);
        let keywords = extractKeywords(originalText);

        const indexData = {
          bookId,
          bookTitle,
          pageNumber: i,
          content: normalized,
          originalContent: originalText,
          keywords,
          url,
          phase,
          indexedAt: new Date().toISOString()
        };

        const newDocId = doc(collection(db, 'search_indexes')).id;
        pendingBatch.push({
          id: newDocId,
          indexData,
          pageNumber: i
        });

        if (pendingBatch.length >= 5 || i === totalPages) {
          let batchSuccess = false;
          try {
            const batch = writeBatch(db);
            for (const item of pendingBatch) {
              const docRef = doc(collection(db, 'search_indexes'), item.id);
              batch.set(docRef, item.indexData);
            }
            await batch.commit();

            await Promise.race([
              waitForPendingWrites(db),
              new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_WRITING_TO_SERVER')), 15000))
            ]);

            batchSuccess = true;
          } catch (err: any) {
            console.error(`Error committing batch at page ${i}:`, err);
            
            const isResourceExhausted = err.code === 'resource-exhausted' || 
                                       err.message?.includes('Quota exceeded') || 
                                       err.message?.includes('resource-exhausted') ||
                                       err.message?.includes('exhausted');
            const isTimeout = err.message === 'TIMEOUT_WRITING_TO_SERVER';

            if (isResourceExhausted) {
              PDFSearchManager.staticQuotaExceeded = true;
              // Reset Firestore to discard any stuck queued writes in memory and free resources
              resetFirestore().catch(e => console.warn("Failed to reset Firestore after exhaustion:", e));
              throw new Error('QUOTA_EXCEEDED: لقد وصلت إلى الحد الأقصى اليومي للعمليات المسموح بها في قاعدة البيانات (Firestore Daily Quota) أو تم تقييد الكتابة. يرجى المحاولة لاحقاً حيث تم حفظ تقدمك بأمان.');
            }
            if (isTimeout) {
              throw new Error('TIMEOUT_WRITING: فشل الاتصال بالخادم ولم يتمكن من تأكيد كتابة البيانات. يرجى التحقق من الشبكة وإعادة المحاولة.');
            }
            throw err;
          }

          if (batchSuccess) {
            for (const item of pendingBatch) {
              this.saveLocalProgress(bookId, item.pageNumber);
            }
            pendingBatch = [];
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (this.onIndexingProgress) {
          this.onIndexingProgress({ loaded: i, total: totalPages, currentBook: bookTitle, bookId, phase });
        }

        // Clean up page resources immediately
        page.cleanup();
        (originalText as any) = null;
        (normalized as any) = null;
      }
      
      // Cleanup PDF object
      await pdf.destroy();
      loadingTask.destroy();
    } catch (error) {
      console.error(`Indexing failed for ${bookTitle}:`, error);
      throw error; 
    } finally {
      this.indexingQueue.delete(bookId);
    }
  }


  async indexTextContent(itemId: string, title: string, content: string, url?: string, category?: string) {
    if (!(await this.isAdmin())) return;
    this.checkQuotaGuard();
    if (!db) return;

    // Check if already indexed to save quota
    try {
      const q = query(collection(db, 'search_indexes'), where('bookId', '==', itemId), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`${title} is already indexed.`);
        return;
      }
    } catch (e) {
      console.warn("Could not check if text is indexed", e);
    }

    try {
      if (this.onIndexingProgress) {
        this.onIndexingProgress({ currentBook: title, loaded: 1, total: 1, bookId: itemId, phase: 'Static Text' });
      }
      
      let normalized = normalizeArabic(content);
      if (normalized.length > 95000) {
        normalized = normalized.slice(0, 95000);
      }
      let originalContent = content;
      if (originalContent.length > 145000) {
        originalContent = originalContent.slice(0, 145000);
      }

      const keywords = extractKeywords(originalContent);
      
      await addDoc(collection(db, 'search_indexes'), {
        bookId: itemId,
        bookTitle: title,
        pageNumber: 0,
        content: normalized,
        originalContent: originalContent,
        keywords,
        url: url || '',
        category: category || 'text',
        phase: 'Static Text',
        indexedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`Error indexing text ${title}:`, error);
      const isResourceExhausted = error.code === 'resource-exhausted' || 
                                 error.message?.includes('Quota exceeded') || 
                                 error.message?.includes('resource-exhausted') ||
                                 error.message?.includes('exhausted');
      if (isResourceExhausted) {
        PDFSearchManager.staticQuotaExceeded = true;
        // Reset Firestore to discard any stuck queued writes in memory and free resources
        resetFirestore().catch(e => console.warn("Failed to reset Firestore after exhaustion:", e));
        throw new Error('QUOTA_EXCEEDED: لقد تم إيقاف المزيد من العمليات بسبب تجازو حصة الاستخدام (Firestore Daily Quota).');
      }
      throw error;
    }
  }

  async search(queryStr: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const normalizedQuery = normalizeArabic(queryStr);
    if (!normalizedQuery) return [];

    // 1. Search locally in dailySupplications
    try {
      dailySupplications.forEach(dup => {
        const title = dup.titleAr || dup.title || 'دعاء / زيارة';
        const segments = extractAllTextSegments(dup);
        const match = findMatchInSegments(segments, queryStr);
        if (match) {
          results.push({
            bookId: dup.id || 'dua-local',
            bookTitle: title,
            pageNumber: match.pageNumber || 1,
            snippet: match.snippet,
            category: 'dua',
            content: match.matchedText,
            phase: 'local',
            sectionName: match.matchedSection,
          } as any);
        } else if (checkArabicMatch(title, queryStr)) {
          results.push({
            bookId: dup.id || 'dua-local',
            bookTitle: title,
            pageNumber: 1,
            snippet: dup.description || title,
            category: 'dua',
            content: dup.description || title,
            phase: 'local',
            sectionName: 'العنوان',
          } as any);
        }
      });
    } catch (e) {
      console.warn('Local supplications search error:', e);
    }

    // 2. Search locally in shubuhatItems
    try {
      shubuhatItems.forEach(item => {
        const title = item.titleAr || item.title || 'شبهة / بحث';
        const segments = extractAllTextSegments(item);
        const match = findMatchInSegments(segments, queryStr);
        if (match) {
          results.push({
            bookId: item.id || 'research-local',
            bookTitle: title,
            pageNumber: match.pageNumber || 1,
            snippet: match.snippet,
            category: 'research',
            content: match.matchedText,
            phase: 'local',
            sectionName: match.matchedSection,
          } as any);
        } else if (checkArabicMatch(title, queryStr)) {
          results.push({
            bookId: item.id || 'research-local',
            bookTitle: title,
            pageNumber: 1,
            snippet: item.description || title,
            category: 'research',
            content: item.description || title,
            phase: 'local',
            sectionName: 'العنوان',
          } as any);
        }
      });
    } catch (e) {
      console.warn('Local shubuhat search error:', e);
    }

    // 3. Search in Firestore if available and enabled
    if (db && isFirebaseEnabled && isFirebaseEnabled()) {
      const searchWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
      if (searchWords.length > 0) {
        const queryWord = searchWords.find(w => w.length > 2) || searchWords[0];
        try {
          const q = query(
            collection(db, 'search_indexes'),
            where('keywords', 'array-contains', queryWord),
            limit(400)
          );

          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
            const data = doc.data();
            const rawOriginal = data.originalContent !== undefined && data.originalContent !== null ? data.originalContent : '';
            const rawContent = data.content !== undefined && data.content !== null ? data.content : '';
            const bookContent = String(rawOriginal || rawContent || '');
            
            if (checkArabicMatch(bookContent, queryStr)) {
              const { snippet } = findBestSnippet(bookContent, queryStr);
              results.push({
                bookId: data.bookId,
                bookTitle: data.bookTitle,
                pageNumber: data.pageNumber,
                snippet: snippet,
                url: data.url,
                category: data.category || 'books',
                content: bookContent,
                phase: data.phase || 'cloud',
                sectionName: data.sectionName || `الصفحة ${data.pageNumber}`
              } as any);
            }
          });
        } catch (error) {
          console.error('Firestore search failed, returning local results only:', error);
        }
      }
    }

    // Remove duplicates by bookId, pageNumber/sectionName, and snippet prefix
    const seen = new Set<string>();
    const uniqueResults = results.filter(item => {
      const key = `${item.bookId}-${item.pageNumber}-${item.sectionName || ''}-${item.snippet.slice(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueResults;
  }

  private createSnippet(content: string, index: number, query: string): string {
    const start = Math.max(0, index - 80);
    const end = Math.min(content.length, index + query.length + 80);
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
  }
}

export const searchManager = new PDFSearchManager();
