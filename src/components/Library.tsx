import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { dailySupplications } from '../data/supplications';
import { libraryBooks } from '../data/library';
import { shubuhatItems } from '../data/shubuhat';
import { Supplication, LibraryItem } from '../types';
import { useApp } from '../context/AppContext';
import { fetchBooksFromFirebase } from '../services/libraryService';
import { fetchShubuhatFromFirebase } from '../services/shubhatService';
import { resetFirestore, auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import SmartPDFViewer from './SmartPDFViewer';
import { searchManager, SearchResult, normalizeArabic, checkArabicMatch } from '../services/searchService';
import { 
  Book, 
  BookOpen, 
  ChevronDown,
  ChevronLeft, 
  FileText, 
  Library as LibraryIcon, 
  Search, 
  Sparkles,
  Type, 
  X,
  User,
  Tag,
  Download,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  CloudDownload,
  Trash2,
  CheckCircle2,
  Loader2,
  Lock,
  Unlock
} from 'lucide-react';
import { offlineAudioService } from '../services/offlineAudio';

// --- Shared Components ---

const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <motion.div
    whileHover={onClick ? { scale: 1.01, translateY: -2 } : undefined}
    whileTap={onClick ? { scale: 0.98 } : undefined}
    onClick={onClick}
    className={`bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl transition-all ${className} ${onClick ? 'cursor-pointer' : ''}`}
  >
    {children}
  </motion.div>
);

const HighlightMatchedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <>{text}</>;
  
  // Create a normalized version of the query to match against
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return <>{text}</>;
  
  // For display purposes, we'll try to find the query in the text
  // This is tricky with Arabic normalization, but we can do a best-effort exact match highlight
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').split(/\s+/).filter(w => w.length > 1).join('|')})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = query.split(/\s+/).filter(w => w.length > 1).some(word => 
          part.toLowerCase().includes(word.toLowerCase()) || 
          normalizeArabic(part).includes(normalizeArabic(word))
        );
        
        return isMatch ? (
          <mark key={i} className="bg-orange-500/40 text-white font-bold rounded-sm px-0.5 no-underline">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
};

const SupplicationItem: React.FC<{
  item: Supplication;
  onClick: () => void;
  isOnline: boolean;
}> = ({ item, onClick, isOnline }) => {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (item.audioUrl) {
        const downloaded = await offlineAudioService.isDownloaded(item.audioUrl);
        setIsDownloaded(downloaded);
      }
    };
    checkStatus();
    
    // Refresh status when window becomes online/offline or when storage changes
    const handleStatusUpdate = () => checkStatus();
    window.addEventListener('online', handleStatusUpdate);
    window.addEventListener('focus', handleStatusUpdate);
    
    return () => {
      window.removeEventListener('online', handleStatusUpdate);
      window.removeEventListener('focus', handleStatusUpdate);
    };
  }, [item.audioUrl]);

  const handleOfflineSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.audioUrl) return;

    if (isDownloaded) {
      if (window.confirm('هل تريد حذف الملف الصوتي من جهازك؟')) {
        await offlineAudioService.removeAudio(item.audioUrl);
        setIsDownloaded(false);
      }
    } else {
      setIsDownloading(true);
      const success = await offlineAudioService.downloadAudio(item.audioUrl);
      if (success) {
        setIsDownloaded(true);
      }
      setIsDownloading(false);
    }
  };

  return (
    <GlassCard onClick={onClick} className="p-4 flex items-center justify-between group">
      <div className="flex items-center gap-2">
        <ChevronLeft size={18} className="text-white/20 group-hover:text-blue-400 transition-colors" />
        
        {item.audioUrl && (
          <button
            onClick={handleOfflineSave}
            disabled={isDownloading}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 border ${
              isDownloaded 
                ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                : 'bg-white/5 border-white/10 text-white/40 hover:text-blue-400 hover:border-blue-400/30'
            }`}
            title={isDownloaded ? "محمل (اضغط للحذف)" : "تحميل للتشغيل بدون انترنت"}
          >
            {isDownloading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isDownloaded ? (
              <CloudDownload size={14} />
            ) : (
              <Download size={14} />
            )}
          </button>
        )}
      </div>

      <div className="flex-1 text-right mr-4">
        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">{item.title || item.titleAr}</h4>
        <div className="flex items-center justify-end gap-2">
          {isDownloaded && <span className="text-[8px] text-green-500 font-bold bg-green-500/10 px-1 rounded">متاح أوفلاين</span>}
          <p className="text-[10px] text-white/40 uppercase font-mono">{item.category}</p>
        </div>
      </div>
      
      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0">
        {item.category === 'أدعية' ? <FileText size={20} /> : <BookOpen size={20} />}
      </div>
    </GlassCard>
  );
};

// Helper function to remove diacritics and normalize Arabic letters for local search
export function normalizeText(text: string): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670]/g, "") // Remove all diacritics (tashkeel)
    .replace(/[أإآٱ]/g, "ا")             // Convert all shapes of Alef to bare Alef
    .replace(/[ةه]/g, "ه")                // Convert Taa Marbuta and Haa to regular Haa
    .replace(/[ىيئ]/g, "ي")               // Normalize Alef Maqsura and Ya
    .replace(/\s+/g, " ")                 // Normalize spacing
    .trim()
    .toLowerCase();
}

export function normalizeArabicLocal(text: string): string {
  return normalizeText(text);
}

export function checkArabicMatchLocal(sourceText: string | undefined | null, queryStr: string): boolean {
  if (!queryStr) return true;
  if (!sourceText) return false;
  
  const normalizedSource = normalizeArabicLocal(sourceText);
  const normalizedQuery = normalizeArabicLocal(queryStr);
  
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return false;
  
  // Checking that every word in the search query exists in the source text
  return queryWords.every(word => normalizedSource.includes(word));
}

const Library: React.FC = () => {
  const { settings, registerBackHandler } = useApp();
  const isAr = settings.language === 'ar';
  const [selectedSupplication, setSelectedSupplication] = useState<Supplication | null>(null);
  const [activePdf, setActivePdf] = useState<{ url: string; title: string; page?: number } | null>(null);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  // Back button registrations for native platforms
  useEffect(() => {
    if (activePdf) {
      const cleanup = registerBackHandler(() => {
        setActivePdf(null);
        return true;
      });
      return () => cleanup();
    }
  }, [activePdf, registerBackHandler]);

  useEffect(() => {
    if (selectedSupplication) {
      const cleanup = registerBackHandler(() => {
        setSelectedSupplication(null);
        return true;
      });
      return () => cleanup();
    }
  }, [selectedSupplication, registerBackHandler]);

  useEffect(() => {
    if (expandedBookId) {
      const cleanup = registerBackHandler(() => {
        setExpandedBookId(null);
        return true;
      });
      return () => cleanup();
    }
  }, [expandedBookId, registerBackHandler]);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const [isContentSearching, setIsContentSearching] = useState(false);
  const [contentSearchResults, setContentSearchResults] = useState<SearchResult[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    let unsubscribe: any = null;
    const initAuthListener = () => {
      if (auth) {
        unsubscribe = auth.onAuthStateChanged((user: any) => {
          setCurrentUser(user);
          if (user && !user.isAnonymous) {
            const adminEmails = ['hsynalmhnh224@gmail.com', 'husseinalmuhanna02@gmail.com'];
            setIsAdmin(adminEmails.includes(user.email || ''));
          } else if (!isDeveloperMode) {
            setIsAdmin(false);
          }
        });
      }
    };
    initAuthListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isDeveloperMode]);
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [indexingHistory, setIndexingHistory] = useState<{ id: string; title: string; loaded: number; total: number; status: 'pending' | 'indexing' | 'completed' | 'error'; phase?: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'أدعية' | 'زيارات' | 'كتب' | 'شبهات وردود'>('all');
  const [isDeepCleaned, setIsDeepCleaned] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<{ bookTitle: string; page: number } | null>(null);
  
  // Persisted indexing status to resume after crash
  const [indexedStatus, setIndexedStatus] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('library_indexed_status');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('library_indexed_status', JSON.stringify(indexedStatus));
  }, [indexedStatus]);

  const clearIndexingStatus = async () => {
    // 1. Immediate UI Confirmation
    if (window.confirm('⚠️ تنبيه: هل أنت متأكد من مسح سجل الأرشفة بشكل نهائي؟ سيتم تدمير كافة البيانات التالفة من الذاكرة العميقة (IndexedDB) وتصفير العدادات والبدء من جديد.')) {
      try {
        // 2. Immediate UI Reset (React State)
        // We set these BEFORE the async cleanup to ensure the UI updates instantly as requested
        setIndexedStatus({});
        setIndexingHistory([]);
        setIsIndexing(false);
        setContentSearchResults([]);
        setIsDeepCleaned(true); // Visual indicator success color
        
        // Clear Persistence
        localStorage.removeItem('library_indexed_status');
        
        // Reset Firestore instance to clear any pending write-stream queues in memory
        try {
          await resetFirestore();
        } catch (dbError) {
          console.warn('Could not reset Firestore:', dbError);
        }
        
        // 3. Deep Async Cleanup for IndexedDB
        const dbNamesToDelete = ['tesseract', 'firebase-firestore', 'firebase-auth'];
        
        // Try to get dynamic database list if supported
        if (window.indexedDB && (window.indexedDB as any).databases) {
          try {
            const dbs = await (window.indexedDB as any).databases();
            dbs.forEach((db: any) => { if(db.name) dbNamesToDelete.push(db.name); });
          } catch (dbError) {
            console.warn('Could not list databases:', dbError);
          }
        }

        // Perform deletions with handled events
        for (const name of [...new Set(dbNamesToDelete)]) {
          await new Promise((resolve) => {
            try {
              const req = window.indexedDB.deleteDatabase(name);
              
              req.onsuccess = () => {
                console.log(`Successfully deleted DB: ${name}`);
                resolve(true);
              };
              
              req.onblocked = () => {
                console.warn(`Deletion of DB ${name} is blocked by an open connection.`);
                // We resolve anyway to continue to next DB, but the connection might still be open
                resolve(false);
              };
              
              req.onerror = () => {
                console.error(`Error deleting DB: ${name}`);
                resolve(false);
              };
              
              // Safety timeout for the promise
              setTimeout(() => resolve(false), 2000);
            } catch (e) {
              console.error(`Sync error deleting DB ${name}:`, e);
              resolve(false);
            }
          });
        }
        
        // 4. Clear Service Worker Caches
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
          } catch (cacheError) {
            console.warn('Cache clear failed:', cacheError);
          }
        }

        // 5. Visual indicators reset after heartbeat
        setTimeout(() => {
          setIsDeepCleaned(false);
        }, 3000);
        
      } catch (error: any) {
        console.error('Deep clean error:', error);
        alert(`حدث خطأ أثناء التنظيف الشامل: ${error.message}`);
        setIsDeepCleaned(false);
      }
    }
  };

  // Helper to generate Bihar al-Anwar volumes dynamically
  const generateWasailVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'wasail_al_shia');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1hUCNrgMzMIMAGEstlatMFBIxc5GymJOQ/preview',
      1: 'https://drive.google.com/file/d/1VkzRwo3UkRvxsxU9h_5R-9OVjMtAKEx3/preview',
      2: 'https://drive.google.com/file/d/1svO8RXLzSHss-rc7HDjyLQWM_K9ioOXE/preview',
      3: 'https://drive.google.com/file/d/1xXT43W_9-MMwtKazgx7WYeW6axrrMqcq/preview',
      4: 'https://drive.google.com/file/d/1brVMAW-0DLfoywcaFBMj5aL1t0ZohkZc/preview',
      5: 'https://drive.google.com/file/d/1sqgJLRk7VUzysRW6D-4N4OyArFB4pwaF/preview',
      6: 'https://drive.google.com/file/d/1HT_82476YHmW57Ymaqss01yltOmt4lDp/preview',
      7: 'https://drive.google.com/file/d/1duZvmeL0FC6NnvUTwyZwXo9aqEYrURDg/preview',
      8: 'https://drive.google.com/file/d/18ntK7bGqXEcBKidHtHPNqecx7xf3rVxF/preview',
      9: 'https://drive.google.com/file/d/1G1Skyimd71oLjvbB44Eza8R3QRQwpgCV/preview',
      10: 'https://drive.google.com/file/d/1TlfeA9DN8PXgDkutad3H4qfCKjqm9BV-/preview',
      11: 'https://drive.google.com/file/d/1NZ1RTT5bBa8DlA_5ayCgRkV3w0tUd3Eg/preview',
      12: 'https://drive.google.com/file/d/18z3dH5y6lSAvZagBv2DSuBnnZ3kRvQ0O/preview',
      13: 'https://drive.google.com/file/d/1duxLwsfe62ler0oPid2kGKBN1CfP8XZ-/preview',
      14: 'https://drive.google.com/file/d/1t9UXPZzp6IfD_fL2bUJKBGMrbXQg0QA4/preview',
      15: 'https://drive.google.com/file/d/1PcThRpU7kL89zq8wq-I5wfc_aw8Cp7_o/preview',
      16: 'https://drive.google.com/file/d/1mfcJCH91su2RmNyGwIsPo2NM5U4M14kZ/preview',
      17: 'https://drive.google.com/file/d/1iNrAg2wdCAtJq22zcIu1FzjtqUiySDAN/preview',
      18: 'https://drive.google.com/file/d/1Z87P-cPWTzJ5iaESzT-sv9HAwI5yy9BM/preview',
      19: 'https://drive.google.com/file/d/1T0sdFeNS00LuJzQsY70IQEKWyHq_KbO2/preview',
      20: 'https://drive.google.com/file/d/1_4MuYifjvrgwfnbse1WMeUACRJrBKHna/preview',
      21: 'https://drive.google.com/file/d/13ZwYZH9zpMR9XSMymNitW0rLa8EBjKu-/preview',
      22: 'https://drive.google.com/file/d/1mohnBrtLHXBA04lsdXt6MHGs48iRd1Yy/preview',
      23: 'https://drive.google.com/file/d/1UfJPvjCHM6Vdk58KcpcR0uMgWGnTa_nk/preview',
      24: 'https://drive.google.com/file/d/1MKSiSIEEotT0Ug-uzP-Pvk-CpHlYhWE_/preview',
      25: 'https://drive.google.com/file/d/1e5giqvNhVk9K3q0MbBgRahS2kDoc7TGY/preview',
      26: 'https://drive.google.com/file/d/1fwp963R_a0phwOApyHM-_3eIRnsUBBur/preview',
      27: 'https://drive.google.com/file/d/1wWe5RCls2utJ3rN1RrIug0UFWAvlLQhW/preview',
      28: 'https://drive.google.com/file/d/1mIMuE6Gjsif7yKiqoZ6RLbCXLnBFjzo4/preview',
      29: 'https://drive.google.com/file/d/1tgcoIx6Pch08My0r3rqDdkNz1E4yco_U/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `wasail_${i + 1}`,
      title: `وسائل الشيعة - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'وسائل الشيعة'
    }));
  };

  const wasailVolumes = useMemo(() => generateWasailVolumes(30), []);

  // Helper to generate Mustadrak al-Wasa'il volumes dynamically
  const generateMustadrakVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'mustadrak_al_wasail');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/137kZ-5oB4Up1rsgyID4wFfplxsGcVrs-/preview',
      1: 'https://drive.google.com/file/d/1OI-M_kz7JZnFalmCL99zgJUNfTOyuT3N/preview',
      2: 'https://drive.google.com/file/d/1fEDWg1W6PlXhk5AkvVVF99PH_VgmFrf4/preview',
      3: 'https://drive.google.com/file/d/1gC7hSFNTHj_bI4xcN_IfuJZ4slRn-BQm/preview',
      4: 'https://drive.google.com/file/d/1Nq4aYWCAYumfs_BY9_g5ezeGZvCPy4EZ/preview',
      5: 'https://drive.google.com/file/d/1C9i3LAIGr25IjfwTQ0BBglUrt6DTgsc6/preview',
      6: 'https://drive.google.com/file/d/1VUMAQYXPgYfH8K4zDF71SlOU-S9tc3A8/preview',
      7: 'https://drive.google.com/file/d/1sFeTkKeFrFWpvwYg9cBhQguTkamTKVGt/preview',
      8: 'https://drive.google.com/file/d/1C56gw5S-8N5L__cWOMllMopeeOgKg0F1/preview',
      9: 'https://drive.google.com/file/d/1H3-60uM25VM0BneCRFFy6J5_sYNXfP0Q/preview',
      10: 'https://drive.google.com/file/d/1n77yqFRDSFBWjAaXKYLjaxMmGYAS__wD/preview',
      11: 'https://drive.google.com/file/d/11ENgDzkXJbyNprlykwdBoeQ6AJlfDq-d/preview',
      12: 'https://drive.google.com/file/d/1nXLInJTtu3Wkc_-D8FIARC4hZCwAB1uJ/preview',
      13: 'https://drive.google.com/file/d/1gmVPhw-tGSfz8wClM-jponsqeWCvCnAc/preview',
      14: 'https://drive.google.com/file/d/1BzVIGG3nTlxcznmiWHxFMTTudLVCzFlj/preview',
      15: 'https://drive.google.com/file/d/1VNe6YhR5CVQkZSwqpxlY0ThSEJ5l6ach/preview',
      16: 'https://drive.google.com/file/d/1vEKXubEOBumG-dYEWhDcIE4v7BtMdu2l/preview',
      17: 'https://drive.google.com/file/d/1Ywjw-Mnhe0U143ZTFKwS1DyYzsduxNbL/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `mustadrak_${i + 1}`,
      title: `مستدرك الوسائل - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'مستدرك الوسائل'
    }));
  };

  const mustadrakVolumes = useMemo(() => generateMustadrakVolumes(18), []);

  // Helper to generate Tahdhib al-Ahkam volumes dynamically
  const generateTahdhibVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'tahdhib_al_ahkam');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1diftsXd_cgtoOwzZkPai8xBu05sfYfwP/preview',
      1: 'https://drive.google.com/file/d/1uK8iOM9ypvGHmjXeBcpzd74vFZrBOX2-/preview',
      2: 'https://drive.google.com/file/d/1cD2TxswgCPv6UQh9AZoFIkX22ReDzOCS/preview',
      3: 'https://drive.google.com/file/d/1bpSlWOZuQy3xGQhQapzR8BU2qriZipHd/preview',
      4: 'https://drive.google.com/file/d/17JYXx8Y7aSw-7eO0ge7ehu8NzTKcUmlr/preview',
      5: 'https://drive.google.com/file/d/1isSYHafB6bf_cv_gnz3W8k9Z4-DqCSj5/preview',
      6: 'https://drive.google.com/file/d/1RQuMXVx5nyuu892UU1JMNZsVbXzD9gpz/preview',
      7: 'https://drive.google.com/file/d/1Yz9tykm11yxyLOhFe5gErQjEzXvDczvv/preview',
      8: 'https://drive.google.com/file/d/1UCBK8EhMt-HOYD9bg4xJDthg_VNccWg5/preview',
      9: 'https://drive.google.com/file/d/1ZTUXDUE6RVJDpbL3ZYwmczLY_wM7iFoH/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `tahdhib_${i + 1}`,
      title: `تهذيب الأحكام - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'تهذيب الأحكام'
    }));
  };

  const tahdhibVolumes = useMemo(() => generateTahdhibVolumes(10), []);

  // Helper to generate Al-Irshad volumes dynamically
  const generateIrshadVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'al_irshad_mufid');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1eGzp62MBkvyOQ5kWzADtaJn9JjBiljJV/preview',
      1: 'https://drive.google.com/file/d/1fD0HnntHqiI6VftfPk8gWfOunoKQCpNw/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `irshad_${i + 1}`,
      title: `كتاب الإرشاد - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'كتب'
    }));
  };

  const irshadVolumes = useMemo(() => generateIrshadVolumes(2), []);

  // Helper to generate Rasail fi al-Ghaiba volumes dynamically
  const generateGhaibaVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'rasail_fi_al_ghaiba');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1jg0-9d1g-eiHW4ESUrleFvbf9eha6GoL/preview',
      1: 'https://drive.google.com/file/d/1ce_JzOvUKU074u5FA_AJ5rTcBJ-4LZv7/preview',
      2: 'https://drive.google.com/file/d/1HFCCFr4PA6Vt7MNPfAj9emKJ6wxizmhi/preview',
      3: 'https://drive.google.com/file/d/1x0SbKPsYa7jPg3axI6ApU0GLBSZNxnk-/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `ghaiba_${i + 1}`,
      title: `رسائل في الغيبة - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'الغيبة'
    }));
  };

  const ghaibaVolumes = useMemo(() => generateGhaibaVolumes(4), []);

  const generateBiharVolumes = (count: number) => {
    const biharDb = libraryBooks.find(b => b.id === 'bihar_al_anwar');
    if (biharDb?.subItems && biharDb.subItems.length > 0) {
      return biharDb.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1ywHUjo0A9-bXDOGpv2ioAcgOzhDZlhzS/preview',
      1: 'https://drive.google.com/file/d/1EAnveY4CE12iBMsoLCOZ9F-7vbea4cVj/preview',
      2: 'https://drive.google.com/file/d/1t--DlU2tOdnwpdy4Ib1U4LX-c3b4cGyl/preview',
      3: 'https://drive.google.com/file/d/131AsSnZj8nZ0DfX3YSBWMFWU1QTvP4z-/preview',
      4: 'https://drive.google.com/file/d/1l3qWj8Whv_lpim6p7pwzV0YUKFa1RhX6/preview',
      5: 'https://drive.google.com/file/d/1iie68ysnnatn_bysh_nigIghjtidSN-i/preview',
      6: 'https://drive.google.com/file/d/1LaZLSz4vs3S3knPUzNGucnJsx6Y2WbBH/preview',
      7: 'https://drive.google.com/file/d/1_-JAPPW0dXjajFEDp9MvcgcNGGJI6Kg0/preview',
      8: 'https://drive.google.com/file/d/1Uw25JDeGh74fA60CzR-Sn7Sju2PQTnP4/preview',
      9: 'https://drive.google.com/file/d/1qorXKDKlxucgYqbTV30_-nAmC-eYiVbp/preview',
      10: 'https://drive.google.com/file/d/1PZd3r-d1ZaVWRn92AYyPHxAZ-MwN4j9i/preview',
      11: 'https://drive.google.com/file/d/1GLD-wZzLPwGWN8GXTzonm2xwlAQ1sjfQ/preview',
      12: 'https://drive.google.com/file/d/1vA0HY_2o4PPJ-JmbkVJXDRxV3ybEA2Xr/preview',
      13: 'https://drive.google.com/file/d/1pIuK9Ix9ywwwEpchsnE8qiS0kCTX9jwo/preview',
      14: 'https://drive.google.com/file/d/1OJ55PdI5Fq5AggwTdhQ8TUI8kG1XnKsx/preview',
      15: 'https://drive.google.com/file/d/1bySfqpMbJ2h6C24gRfEjPkk2_ind8DRP/preview',
      16: 'https://drive.google.com/file/d/1TSf3PWskzWx0t7DWvkAiYKbyLcb94w5u/preview',
      17: 'https://drive.google.com/file/d/18gz2arS_ATdzvHQlC3058f4XFT4LRXat/preview',
      18: 'https://drive.google.com/file/d/1xuC_YiftFcsVDuVTqQkygikocBeSEeXC/preview',
      19: 'https://drive.google.com/file/d/1qC94nJ6NyQkaVrB33Nx0IMgkQX-Asi2a/preview',
      20: 'https://drive.google.com/file/d/1LyMX810xWuf11TkWIbPdGdEJBD6yQzvE/preview',
      21: 'https://drive.google.com/file/d/1fx2IUlyFJmsk9K4fE2dDZZOdMjAHOQIn/preview',
      22: 'https://drive.google.com/file/d/1cHNlCrQTxWrWVb4e3ag9OLz4Si1v75Sz/preview',
      23: 'https://drive.google.com/file/d/15IS3Xne8SDPZWeNzSRD0-Qc8bO0wjtxU/preview',
      24: 'https://drive.google.com/file/d/1vOE--ymfMS4ZsEqJfMxVGXTwmUSxlK7E/preview',
      25: 'https://drive.google.com/file/d/1PNZT3ae3H9ZUadg4bc2mmYLuIazEAq84/preview',
      26: 'https://drive.google.com/file/d/1jA2fe8gdvZf6ReZHqsIMs8YQ3gtMH95a/preview',
      27: 'https://drive.google.com/file/d/1PDksgDp3o66xnb45sSWEZhQz3Ow_Xmh0/preview',
      28: 'https://drive.google.com/file/d/1i9osBr0gezMHSTJImX8pnE7DYVL7GWjR/preview',
      29: 'https://drive.google.com/file/d/1bcLRyVo5ur2FYl5HIHyfgFhqh1tp2ruq/preview',
      30: 'https://drive.google.com/file/d/1oeMXbbb24KYEA1SjF-5TBk-RwpL-91ux/preview',
      31: 'https://drive.google.com/file/d/1drp6DYrlzmJUv8Trfz3xErnoRoxMgjWn/preview',
      32: 'https://drive.google.com/file/d/1Cu8pLICfoSXh8vC91zTCF1KV49x8DmIT/preview',
      33: 'https://drive.google.com/file/d/1RyGGJ91IgyKle06VB6xc02I-40gMPEDt/preview',
      34: 'https://drive.google.com/file/d/1_vxV1rQ6FwaWjbmjDENjXEKlgaGzDg1Z/preview',
      35: 'https://drive.google.com/file/d/17A3lhlD6AfJLBh6BuKY926mL_1MI80DE/preview',
      36: 'https://drive.google.com/file/d/1y0wORT8IHXlyy52YAern5Dy-qZVzs8HU/preview',
      37: 'https://drive.google.com/file/d/1Cavvv3mYG_EMKpr5yl-frexbSXjtDmxp/preview',
      38: 'https://drive.google.com/file/d/1acXkU41E0dxqZyyqcoZt-dB0_X53MvKN/preview',
      39: 'https://drive.google.com/file/d/1hOeZOa9GIMFSObx6ClyrZ9JjDO3STOUK/preview',
      40: 'https://drive.google.com/file/d/1wUMy5A-XF3mtc-uQ7zLudUqqhjMB590s/preview',
      41: 'https://drive.google.com/file/d/12PpLEdI1GKx9WdO5gnfBrbtZcyKEaY_3/preview',
      42: 'https://drive.google.com/file/d/1MALFa-036WWBIXlvTlZ3OpgH7K-UVqW9/preview',
      43: 'https://drive.google.com/file/d/1gJNvf1sQIhvgJac-IJPxjVNwBJ77lB-H/preview',
      44: 'https://drive.google.com/file/d/1Nkb46XoOYtuRAEmrkWWP5Q9E6DX4TZ0g/preview',
      45: 'https://drive.google.com/file/d/1ksjwHTZvojbgqF3oOPivJlGLF00Hkrta/preview',
      46: 'https://drive.google.com/file/d/1uuSWVOCtQte2gt2GEtKfHOLlDiM9Ctyk/preview',
      47: 'https://drive.google.com/file/d/1F_Gc_V3nuBlQn5vOudQ0JtFvTrF7KHoa/preview',
      48: 'https://drive.google.com/file/d/1i4yY0tu3SCzB8OM7rXZIQ-X8mwtEu4wl/preview',
      49: 'https://drive.google.com/file/d/1jI5s0xHezI7R7ojp_l8Vk5asbLqv3Uaw/preview',
      50: 'https://drive.google.com/file/d/1S0S-1gpU_5Qu4OHzoHFjjNv_a6dZHg0s/preview',
      51: 'https://drive.google.com/file/d/1WdPrIo98nRn1gXIeTG_G85HCrfi4GBS-/preview',
      52: 'https://drive.google.com/file/d/1sR4DQlOtGRUDg_tY3aE-gP840eOHXbhf/preview',
      53: 'https://drive.google.com/file/d/15V_otQGrRfVKWJTGXz3gi_qP1m-tmrxB/preview',
      54: 'https://drive.google.com/file/d/11SLKwpFxnwn08ArByaMUSSvBAs88XEtM/preview',
      55: 'https://drive.google.com/file/d/1yhxGkT8oUsFuC5HmWQ5XhUv1IrPuGbdY/preview',
      56: 'https://drive.google.com/file/d/1b2qniAB7LnpgxKigoLrGaOaS3ZEoLsaM/preview',
      57: 'https://drive.google.com/file/d/1w-XP0GgqVzpCDqbZD3nI9ZWl3GN4W78i/preview',
      58: 'https://drive.google.com/file/d/1RKDx2Gc9wM_ZCaPrcDR2Ia-xggEdKE8M/preview',
      59: 'https://drive.google.com/file/d/1R6Ll8Czz-KJLCR8bNyhlZmQ_pccQ08Xl/preview',
      60: 'https://drive.google.com/file/d/1BITW1a24mcapmuvttlnZ7hUBJpWaJ_LI/preview',
      61: 'https://drive.google.com/file/d/18uvrUdpbhC6CoCro4-ILKFy-opHoZnzR/preview',
      62: 'https://drive.google.com/file/d/1rYrtH2zC6UFXQm-YSx4ltT6rbZ5Uh3Ew/preview',
      63: 'https://drive.google.com/file/d/1llgMmEzljzYOdGhbmQALQ2sP_kTv_0m6/preview',
      64: 'https://drive.google.com/file/d/1XJ7ftPwe0vb6hI9dO6qOUdMZoNAGfkPs/preview',
      65: 'https://drive.google.com/file/d/1gqGkNRrKEV2S-I4xDnu8Ac0ZjwyUiLgc/preview',
      66: 'https://drive.google.com/file/d/1_9C06SZEbQc_HySFIrmef4ax3Le6Ny2N/preview',
      67: 'https://drive.google.com/file/d/10ymdDYDVRsuNsd7uMDPSLZaJLERm6r01/preview',
      68: 'https://drive.google.com/file/d/1RJlgny09wl7Ij5EqIOqKWfNI9GcUjkig/preview',
      69: 'https://drive.google.com/file/d/1khP9q2aAUoc88CKc3rb8Z-EE2emNv1T_/preview',
      70: 'https://drive.google.com/file/d/1Kl2EFu_TKHSa_GK0buMtR4xM75NT3ErF/preview',
      71: 'https://drive.google.com/file/d/1DSkQw9flpZhQVdTO_xgiXL0cegjlHGGD/preview',
      72: 'https://drive.google.com/file/d/1a-7vLl2q25qD5ZEivWPeBgSEGUCXato8/preview',
      73: 'https://drive.google.com/file/d/13O3nRiuH7LkE0lhwRgpRXTHr67fjHSW0/preview',
      74: 'https://drive.google.com/file/d/1J82edBea1IU-P2O4uKyRYtgGMFX0fpfu/preview',
      75: 'https://drive.google.com/file/d/1WGj9tDkt4dIIrXxGBx50tltPS09zsYCH/preview',
      76: 'https://drive.google.com/file/d/1gc8Gsq2oLRnPiCF-4PWu394rhlpPRGBR/preview',
      77: 'https://drive.google.com/file/d/16G29Qrr2bk9kXLQ0yW9CXs0q02i_kSR_/preview',
      78: 'https://drive.google.com/file/d/1pTxtRfnj2DkVbp3BZcrYmElZUj8SedIR/preview',
      79: 'https://drive.google.com/file/d/1Qz9J5iWnKkrJ3A8Z3OuMoUwX83FXVZOF/preview',
      80: 'https://drive.google.com/file/d/1Gfll4M7qD6fm_DHvt1MURgUOowTrCPZc/preview',
      81: 'https://drive.google.com/file/d/1tyWVmshnDbs2yxfm82JrqAiRfvJk2r3B/preview',
      82: 'https://drive.google.com/file/d/1eXZVPds2BG8P6ctsn8aFXKiN6hZyxglH/preview',
      83: 'https://drive.google.com/file/d/170e9P7b5ogn6GuWDKp1YJxJDGeZ2B3GC/preview',
      84: 'https://drive.google.com/file/d/1ky-VAeEagy-UUE7H-Xb0scYKuMJqVNrG/preview',
      85: 'https://drive.google.com/file/d/1m5V-ODtsuzapbCBbc8CBplNwkDPiDaxp/preview',
      86: 'https://drive.google.com/file/d/1BhTIxFm83DQs5vU1e7m_hpKxtcPgv1jw/preview',
      87: 'https://drive.google.com/file/d/1lEQ-kIABOGdN2S6hovDKc4wRASo1uEqf/preview',
      88: 'https://drive.google.com/file/d/16b3awMG1CJ60WV0QVBAnG-lA0Pfnuja-/preview',
      89: 'https://drive.google.com/file/d/1M9hJZLdGnxdFyDZozCT6aB4DkSZzun7y/preview',
      90: 'https://drive.google.com/file/d/1UlB6p7b3kzgBoU0MHk5TgJK6ZTDmfFmF/preview',
      91: 'https://drive.google.com/file/d/1YTCqmxnLbz4eio540hJ6mgGZK5rTFS2-/preview',
      92: 'https://drive.google.com/file/d/1LI5DfX4HTy3kJK5-XRUdSm75pzOPJRSx/preview',
      93: 'https://drive.google.com/file/d/1kFW7LBw6O2qsyhcxkihUMoYcTuXCueZy/preview',
      94: 'https://drive.google.com/file/d/1VI7RnKmSbgPjLcX5qN5rUaqbLS9Lhlq1/preview',
      95: 'https://drive.google.com/file/d/1UGoC9vqyh32M2TnzJejeMXYG9mZYKwIT/preview',
      96: 'https://drive.google.com/file/d/15SxaUMSITOoqyrXzDTQq2KSJ-5m7Vi-w/preview',
      97: 'https://drive.google.com/file/d/1KqxgshTXbD0sX8gLrvUoF15GuDHNgONd/preview',
      98: 'https://drive.google.com/file/d/10x_UKiywuJfJQ6OH_Vy3q8owsUOC4wVW/preview',
      99: 'https://drive.google.com/file/d/1_4IfA05MgBVv6RgzGKXppdyKyMrXOdev/preview',
      100: 'https://drive.google.com/file/d/1tJc2Iwpttzom0nCLlnuDenbv6ZJ5za4w/preview',
      101: 'https://drive.google.com/file/d/1K_obc30e5yLbuiCaUn2XB3p3WYhfclkC/preview',
      102: 'https://drive.google.com/file/d/1czZLsNV3ivHJ52P7Sn09vpovw9sT3Yl_/preview',
      103: 'https://drive.google.com/file/d/1rGiqkf9-GlLENNR3InuzTLJUsBF8sH6P/preview',
      104: 'https://drive.google.com/file/d/1LfPtkI0GQ5scTiMWGeoqBqY3Qs-xF352/preview',
      105: 'https://drive.google.com/file/d/1Xt5AbT7wZLoM9Rqpc_RoFq1dd32TzRlR/preview',
      106: 'https://drive.google.com/file/d/1VrQoE50vqEkwc6i9UHA76OKQZ_8iykTS/preview',
      107: 'https://drive.google.com/file/d/1aBL4_I81YhgW10FtnI24ZYy_n6oQlg7N/preview',
      108: 'https://drive.google.com/file/d/15JAFZjYke7mhp5p7k9h8W6C_8rtynPNB/preview',
      109: 'https://drive.google.com/file/d/1J_9PUEErfBG-iLnQncc7N9J0HU2O1X2D/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `bihar_${i + 1}`,
      title: `بحار الأنوار - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'بحار الأنوار'
    }));
  };

  const biharVolumes = useMemo(() => generateBiharVolumes(110), []); // Show up to Volume 110 (Juz 110)

  // Helper to generate Sharh Nahj al-Balagha volumes dynamically
  const generateSharhNahjVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'sharh_nahj_balagha');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/12OK9DI32mgGBr3fplyiwLoyLfEQ950g1/preview',
      1: 'https://drive.google.com/file/d/1WX4v5qwbtpc1jaGSxh-NniCeBkBd6C0I/preview',
      2: 'https://drive.google.com/file/d/1-BmRzLGJWDWB_XoKQACsup4d0HfqOdq4/preview',
      3: 'https://drive.google.com/file/d/1Ty42MuM5IK-BAP-tiCGShJ-xkAQNnuRo/preview',
      4: 'https://drive.google.com/file/d/1s1ZEkF7-iez06k3NoLacHv4I0YFu_VPh/preview',
      5: 'https://drive.google.com/file/d/1lvJaK5ra7X_79WNyTejhB1YjIJ-I-vh5/preview',
      6: 'https://drive.google.com/file/d/1PkXChpRJ2Zs4fAJNS7Me64Qrq7flsOPi/preview',
      7: 'https://drive.google.com/file/d/1a-LzpuT-iDP2ZC4sYZJddxC6THjr5Frt/preview',
      8: 'https://drive.google.com/file/d/13_hxUlJmP5jpgNoMflwC2As_1zkJDqCk/preview',
      9: 'https://drive.google.com/file/d/1p-0-58hoYnFnI_Gl5aaJ4YToebHWpU_4/preview',
      10: 'https://drive.google.com/file/d/1Vxt-L9y0XUXPG1MIQkOqwsBsSC26dsYz/preview',
      11: 'https://drive.google.com/file/d/1SeCt4vCt2vmvneqm5LN1_RkiYPE5zo4-/preview',
      12: 'https://drive.google.com/file/d/1Njln-p4dWTUFZzJnC9r9MnMO83TOtm2-/preview',
      13: 'https://drive.google.com/file/d/1P28B_QXaOqxKYbuRGPhbo01SooSG932W/preview',
      14: 'https://drive.google.com/file/d/1JgC5iNUMesF6ePwLGP9oN2KHsRM7c7zc/preview',
      15: 'https://drive.google.com/file/d/1YqnwE1wAu8tuJPlv4-HKo3RCuOGN9eIN/preview',
      16: 'https://drive.google.com/file/d/1u6Zdfo9dQk3PknY3DYeJvIoC_87-E-rW/preview',
      17: 'https://drive.google.com/file/d/1lB33cD1vLuoN4xL05tkXVdFcvflGS9RL/preview',
      18: 'https://drive.google.com/file/d/15dC1FG1BWchVtXtB2P6RtkXIhhPkTsO-/preview',
      19: 'https://drive.google.com/file/d/1XSA9ENIuUagYaucSIvdpQzMhxcLofwcj/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `sharh_nahj_${i + 1}`,
      title: `شرح نهج البلاغة - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'شرح نهج البلاغة'
    }));
  };

  const sharhNahjVolumes = useMemo(() => generateSharhNahjVolumes(20), []); // 20 volumes as requested

  // Helper to generate Istibsar volumes dynamically
  const generateIstibsarVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'al_istibsar_tusi');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1bNHX0pWSAua3VcTC9hf4CdOQ-LCB5WYs/preview',
      1: 'https://drive.google.com/file/d/1-mWU4hi3s-ObV_5mvcrzvskYEWygFT7Z/preview',
      2: 'https://drive.google.com/file/d/1gC5n3PsQrI7IHExwvjHuNuw05asCW2ZY/preview',
      3: 'https://drive.google.com/file/d/1IMb9h7ioTIobSAmoS0Kv5_oRE751hXU0/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `istibsar_${i + 1}`,
      title: `الاستبصار - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'الاستبصار'
    }));
  };

  const istibsarVolumes = useMemo(() => generateIstibsarVolumes(4), []);
  
  // Helper to generate Madinat al-Ma'ajiz volumes dynamically
  const generateMadinatVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'madinat_al_maajiz');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1R7Nqjl6hc08kaVhIjArfKEzH-OM3Wrua/preview',
      1: 'https://drive.google.com/file/d/12gcw0jlhiMIOUx0QwIQEB7CkFD2gXE5K/preview',
      2: 'https://drive.google.com/file/d/1-OejJ4oN4-8l_t0O140SNTXK00bxQ3Id/preview',
      3: 'https://drive.google.com/file/d/1E3gkXVXFl__HJmDAyKC0dnsKq4UVkRGN/preview',
      4: 'https://drive.google.com/file/d/1vkQ_H2GxJjl-m0XeK9X0jM8v3QwSYckG/preview',
      5: 'https://drive.google.com/file/d/16QTaqTk5LjT1mbbgjJSXgggMczef7VGg/preview',
      6: 'https://drive.google.com/file/d/1PGpJdbl32SXXyU7bFtAfDCWOt46yE7y3/preview',
      7: 'https://drive.google.com/file/d/1vbKLaAfD43S746Z-PAtySxTxj5cfJ5Kn/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `madinat_${i + 1}`,
      title: `مدينة المعاجز - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'مدينة المعاجز'
    }));
  };

  const madinatVolumes = useMemo(() => generateMadinatVolumes(8), []);
  const tawhidBook = {
    id: 'tawhid_saduq',
    title: 'كتاب التوحيد',
    author: 'الشيخ الصدوق',
    url: 'https://drive.google.com/file/d/137ATBJ_j5se97wocVobZiAxeW1oBAQB2/preview',
    category: 'كتب'
  };

  const logicBooks = [
    {
      id: 'logic_muzaffar',
      title: 'كتاب المنطق',
      author: 'الشيخ المظفر',
      url: 'https://drive.google.com/file/d/1OilCS5W8aWTI2Jg9QtyU3l4sVmWRb1B0/preview',
      category: 'كتب'
    },
    {
      id: 'islah_logic',
      title: 'إصلاح المنطق',
      author: 'ابن السكيت الأهوازي',
      url: 'https://drive.google.com/file/d/1QNiyrbikOlsVKBM_exu2UJEuOAUth_8q/preview',
      category: 'كتب'
    }
  ];

  const wakeupBook = {
    id: 'wakeup_haja',
    title: 'الإيقاظ من الهجعة بالبرهان على الرجعة',
    author: 'الشيخ الحر العاملي',
    url: 'https://drive.google.com/file/d/1eMdbcKuvjhsEVJkqvgoAa7d1fgquXL6W/preview',
    category: 'كتب'
  };

  // Helper to generate Uyun Akhbar al-Rida volumes dynamically
  const generateUyunVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'uyun_al_rida');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1h17LSCT1olgaoAgBbuQ0lmeB6IDjaYy_/preview',
      1: 'https://drive.google.com/file/d/1uBb0unrzyTAlKO-7m5Dp1WtgXoja9TlB/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `uyun_${i + 1}`,
      title: `عيون أخبار الرضا - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'عيون أخبار الرضا'
    }));
  };

  const uyunVolumes = useMemo(() => generateUyunVolumes(2), []);

  // Helper to generate Al-Tafsir al-Safi volumes dynamically
  const generateSafiVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'tafsir_safi');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/16XzQKRnoKcQinrrlhJJXIbic9FER6JQc/preview',
      1: 'https://drive.google.com/file/d/11cssTuYnWznLPf0scXrBOLb3O8ua130N/preview',
      2: 'https://drive.google.com/file/d/1EmYMKAFW72B8ieDJpXGDz3rvGjy1sIsX/preview',
      3: 'https://drive.google.com/file/d/1_XPADLLITHN-HEfGWofMN2aYJGX5WcPF/preview',
      4: 'https://drive.google.com/file/d/11oL-9ZUCQawuXTjEgR5GJgyLlLn9cC27/preview',
      5: 'https://drive.google.com/file/d/1f3K2vjH_HzDPgLXZxYoR8YjA6rUObzvP/preview',
      6: 'https://drive.google.com/file/d/13K2ppPc25ROJk5GsEMb7QMMFHKZWD7EG/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `safi_${i + 1}`,
      title: `التفسير الصافي - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'التفسير الصافي'
    }));
  };

  const safiVolumes = useMemo(() => generateSafiVolumes(7), []);
  
  // Helper to generate Al-Burhan volumes dynamically
  const generateBurhanVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'tafsir_burhan');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1eP8JRkR2-7GSSVykMNa2t-MB2SZqYKBu/preview',
      1: 'https://drive.google.com/file/d/116ZyNkmUZscpNUR_EAcIscz8KEhPXa-V/preview',
      2: 'https://drive.google.com/file/d/1juTbT0cSx3ZL2yydRDsG75aSUK1z7_9T/preview',
      3: 'https://drive.google.com/file/d/1zADRIhaAw8vqTbcly1LaA6RkI4MMoqzX/preview',
      4: 'https://drive.google.com/file/d/10RyJ84gAtOrH9MA1E_JAVP14W4PJL-tu/preview',
      5: 'https://drive.google.com/file/d/1PrExh_4CUhWejQQO_-xjo94Y9xUv3OOz/preview',
      6: 'https://drive.google.com/file/d/1k4CWLzuG173rGpfRjVx78yibO3JcuTOY/preview',
      7: 'https://drive.google.com/file/d/1wZ9X1USWs7QV2Pre5QR0GQJsDtM8GjTP/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `burhan_${i + 1}`,
      title: `تفسير البرهان - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'تفسير البرهان'
    }));
  };

  const burhanVolumes = useMemo(() => generateBurhanVolumes(8), []);

  // Helper to generate Tafsir al-Qummi volumes dynamically
  const generateQummiVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'tafsir_qummi');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1J4sl63RqBhHnTaoo7EutHss3Er1ozdPA/preview',
      1: 'https://drive.google.com/file/d/1jXbiCdg0bwMBfuyTX7kshx_FLPFvccek/preview',
      2: 'https://drive.google.com/file/d/1Qsjusb7Ovhim8AeWG-jct4AKpclyoH0r/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `qummi_${i + 1}`,
      title: `تفسير القمي - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'تفسير القمي'
    }));
  };

  const qummiVolumes = useMemo(() => generateQummiVolumes(3), []);

  // Helper to generate Al-Ihtijaj volumes dynamically
  const generateIhtijajVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'ihtijaj_tabarsi');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1_GAHV7PxNO8z3QWXZrUrqRoOgO9VDzs3/preview',
      1: 'https://drive.google.com/file/d/1JugXYNkGucjIZAMqcwYCFEl3BOeNzbkN/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `ihtijaj_${i + 1}`,
      title: `كتاب الاحتجاج - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'كتاب الاحتجاج'
    }));
  };

  const ihtijajVolumes = useMemo(() => generateIhtijajVolumes(2), []);
  
  // Helper to generate Mir'at al-Uqul volumes dynamically
  const generateMiratVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'mirat_al_uqul');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1OfYFl2IwdbqB1reXS3Q0V-HCkChW_3JH/preview',
      1: 'https://drive.google.com/file/d/1hRzbeAGbARmx4-_neOOejffVhz-RtoGd/preview',
      2: 'https://drive.google.com/file/d/1NGtafjies0RQDG4zgLSKJ1MA2c5iyegZ/preview',
      3: 'https://drive.google.com/file/d/1LeeK46EL-8S77kwFrpsaG0DpMUztojQW/preview',
      4: 'https://drive.google.com/file/d/11b_Z26IfTebJaPsCTTOLP4Q3ZRWfvJUp/preview',
      5: 'https://drive.google.com/file/d/1hrCmg3Ki8U04dJac1N8a3mDDS53XLzjs/preview',
      6: 'https://drive.google.com/file/d/1oy3CCtJFez65uCpIrUp0lpg0MgtGMYA_/preview',
      7: 'https://drive.google.com/file/d/1p0eo4c05mWdxdXRhPEABmsiqfsG2OXHm/preview',
      8: 'https://drive.google.com/file/d/1fRHMENgRwq_uEXFH6oStcRxnCzF1HQB-/preview',
      9: 'https://drive.google.com/file/d/1Mb_qRHJ_ENx6wT3PFnsJ_Po1O3p2ZDxo/preview',
      10: 'https://drive.google.com/file/d/1nC436ZohVF7fb4Al1o-9Pc-mAnZmlC8w/preview',
      11: 'https://drive.google.com/file/d/12trdOkNoWSnm2G7RLxb-ieyGtDQB1-dd/preview',
      12: 'https://drive.google.com/file/d/1recPku5ZHF9AnAl7idWxmylA_la3mHw-/preview',
      13: 'https://drive.google.com/file/d/1NhKkT62JE6M8fq3q4Rt3TUxbk0O8qQo3/preview',
      14: 'https://drive.google.com/file/d/1CFMhg-5AWSEE7vSwwqQsfNANFKTssNyG/preview',
      15: 'https://drive.google.com/file/d/1vfCWxswBTwMM1PyYkGi2LTQAAVehTgjW/preview',
      16: 'https://drive.google.com/file/d/1F8gxy9xSXzkJdZvS0HDo4z2eMEEqF_vS/preview',
      17: 'https://drive.google.com/file/d/1p-oxvy24DXad6m8QSJjJQfa6rddMzxlm/preview',
      18: 'https://drive.google.com/file/d/1fxnhEZupTYoXD5kGMGNkdXRaqa4Y9h-v/preview',
      19: 'https://drive.google.com/file/d/1tmkTf_-FyVSN8HbPh8FBDxvgb4N-OkSj/preview',
      20: 'https://drive.google.com/file/d/1NX7IO5z2R8o_nKQMl59q0ZM17Q0PCWZS/preview',
      21: 'https://drive.google.com/file/d/12dbXgXNhZFYhvD8Zti8hJhavW4sICLyf/preview',
      22: 'https://drive.google.com/file/d/1diG7gvLYTpFw8VPRm2QqsSDFVX0ZN2dU/preview',
      23: 'https://drive.google.com/file/d/1u46FThMhICwBiVPJq3qTAKdJoEm86PbW/preview',
      24: 'https://drive.google.com/file/d/1cXPtZyM_fkMMEA5LM5L9ic28GRRqCVCx/preview',
      25: 'https://drive.google.com/file/d/1aopn6e6M3vBRQso2JmayLsyAGIDjtR7j/preview'
    };
    const titles = [
      "العقل والجهل وفضل العلم",
      "فضل العلم والتوحيد",
      "كتاب التوحيد",
      "كتاب التوحيد وكتاب الحجة",
      "كتاب الحجة",
      "كتاب الحجة",
      "كتاب الحجة",
      "كتاب الحجة",
      "كتاب الإيمان والكفر",
      "كتاب الإيمان والكفر",
      "كتاب الإيمان والكفر وكتاب الدعاء",
      "كتاب الدعاء وفضل القرآن والعشرة",
      "كتاب الطهارة والحيض",
      "كتاب الجنائز",
      "كتاب الصلاة - ج1",
      "كتاب الصلاة - ج2 وكتاب الزكاة",
      "الصيام والاعتكاف وكتاب الحج - ج1",
      "كتاب الحج - ج2",
      "كتاب الحج - ج3 وكتاب الجهاد",
      "كتاب المعيشة",
      "كتاب النكاح والعقيقة",
      "الطلاق والعتق والصيد والذبائح",
      "الأطعمة والأشربة وكتاب الوصايا",
      "كتاب المواريث والحدود",
      "الديات والأيمان والنذور والقضاء",
      "كتاب الروضة"
    ];
    return Array.from({ length: count }, (_, i) => ({
      id: `mirat_${i + 1}`,
      title: `مرآة العقول - الجزء ${i + 1}${titles[i] ? ` (${titles[i]})` : ''}`,
      url: urls[i] || '',
      category: 'مرآة العقول'
    }));
  };
  
  const miratVolumes = useMemo(() => generateMiratVolumes(26), []);

  // Helper to generate Man La Yahduruhu al-Faqih volumes dynamically
  const generateFaqihVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'man_la_yahduruhu_al_faqih');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1EWLyqr0lXVjGXRwx6cLFqzIaE1Ym7jIb/preview',
      1: 'https://drive.google.com/file/d/1ObYqL6P0FiVYdNBuFXdi8v7ghsZ8ZxHh/preview',
      2: 'https://drive.google.com/file/d/15KkeVWu6c4NztDNy2suwgo5cm1dODVLy/preview',
      3: 'https://drive.google.com/file/d/10jrwOJyt9PMLmj_T37PqoeTbmsfgaKvJ/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `faqih_${i + 1}`,
      title: `من لا يحضره الفقيه - الجزء ${i + 1}`,
      url: urls[i] || '',
      category: 'من لا يحضره الفقيه'
    }));
  };

  const faqihVolumes = useMemo(() => generateFaqihVolumes(4), []);

  const nawadirBook = {
    id: 'nawadir_muajizat',
    title: 'نوادر المعجزات',
    author: 'الطبري الشيعي',
    url: 'https://drive.google.com/file/d/1shk7OBZ2zia7pS37qOiZOC4PkRAey0mE/preview',
    category: 'كتب'
  };

  const awalemBook = {
    id: 'awalem_hussein',
    title: 'العوالم: الإمام الحسين (عليه السلام)',
    author: 'الشيخ عبد الله البحراني',
    url: 'https://drive.google.com/file/d/1v4-LTA3dIcCw9aKvjsoKFIPWOqPHROAR/preview',
    category: 'كتب'
  };

  const dalailBook = {
    id: 'dalail_imama',
    title: 'دلائل الإمامة',
    author: 'محمد بن جرير الطبري (الشيعي)',
    url: 'https://drive.google.com/file/d/10adrsJEQWPqdvRHZLozdxbdIlHC6I_Gj/preview',
    category: 'كتب'
  };

  const maqatilBook = {
    id: 'maqatil_talibiyyin',
    title: 'مقاتل الطالبيين',
    author: 'أبو الفرج الأصفهاني',
    url: 'https://drive.google.com/file/d/1bReFy1XUol1loS7-tgIpz8mKTMBkWYOT/preview',
    category: 'كتب'
  };

  const basairBook = {
    id: 'basair_darajat',
    title: 'بصائر الدرجات',
    author: 'الشيخ الصفار القمي',
    url: 'https://drive.google.com/file/d/1FqYVpuIY_HEXnxPf8A9tUb-_XFQpwHBh/preview',
    category: 'كتب'
  };

  const tuhafBook = {
    id: 'tuhaf_uqul',
    title: 'تحف العقول',
    author: 'ابن شعبة الحراني',
    url: 'https://drive.google.com/file/d/15hIX3J1bLIRYbxzxvFvE0NNl6BPxhThC/preview',
    category: 'كتب'
  };

  const amaliMufidBook = {
    id: 'amali_mufid',
    title: 'أمالي الشيخ المفيد',
    author: 'الشيخ المفيد (طاب ثراه)',
    url: 'https://drive.google.com/file/d/1WZZj_OoDZxUDMP_CPGFKFvV9WsOyZWxa/preview',
    category: 'كتب'
  };

  const amaliSaduqBook = {
    id: 'amali_saduq',
    title: 'أمالي الشيخ الصدوق',
    author: 'الشيخ الصدوق (قدس سره)',
    url: 'https://drive.google.com/file/d/1aa4BqPssMg5a-Ccn7F3DnjczivRTwzGO/preview',
    category: 'كتب'
  };

  const amaliTusiBook = {
    id: 'amali_tusi',
    title: 'أمالي الشيخ الطوسي',
    author: 'الشيخ الطوسي (قدس سره)',
    url: 'https://drive.google.com/file/d/1nqcKWXZ6nMYlIVM_0LiAMxQEmEHdoIgz/preview',
    category: 'كتب'
  };

  const ghaibaNumaniBook = {
    id: 'ghaiba_numani',
    title: 'كتاب الغيبة',
    author: 'الشيخ محمد بن إبراهيم النعماني',
    url: 'https://drive.google.com/file/d/1H-JwaM55P_gs6f87oUVc7JMG3-zrAhCA/preview',
    category: 'كتب'
  };

  const masailGhaybaBook = {
    id: 'masail_ghayba',
    title: 'المسائل العشر في الغيبة',
    author: 'الشيخ المفيد (طاب ثراه)',
    url: 'https://drive.google.com/file/d/1dA9rcFfqfsOfoiPvbIYytAbotLppIBdI/preview',
    category: 'كتب'
  };

  const ikhtisasBook = {
    id: 'ikhtisas_mufid',
    title: 'كتاب الاختصاص',
    author: 'الشيخ المفيد (طاب ثراه)',
    url: 'https://drive.google.com/file/d/1D9shXLv4kpzCdpW1qXl80EIMFqq8lERj/preview',
    category: 'كتب'
  };

  const awailMaqalatBook = {
    id: 'awail_maqalat',
    title: 'أوائل المقالات',
    author: 'الشيخ المفيد (طاب ثراه)',
    url: 'https://drive.google.com/file/d/1hXT3P1XnUFZR-n3SU2xucSB9o6XASbvD/preview',
    category: 'كتب'
  };

  const fusulMukhtaraBook = {
    id: 'fusul_mukhtara',
    title: 'الفصول المختارة',
    author: 'الشريف المرتضى (طاب ثراه)',
    url: 'https://drive.google.com/file/d/1tgHL-9MzceCwZSwL-Yw1h83pSFdRJJ2F/preview',
    category: 'كتب'
  };

  const saghaniyyaBook = {
    id: 'masail_saghaniyya',
    title: 'المسائل الصاغانية',
    author: 'الشيخ المفيد (طاب ثراه)',
    url: 'https://drive.google.com/file/d/18jTg4bo9I3F8o4bYZeqkzVC-sByW4l1X/preview',
    category: 'كتب'
  };

  const tafsirAskariBook = {
    id: 'tafsir_askari',
    title: 'تفسير الإمام الحسن العسكري (ع)',
    author: 'الإمام الحسن العسكري (ع)',
    url: 'https://drive.google.com/file/d/1sYrfo4y3cVQzaHlMYSOMH8bfwpMCrnd-/preview',
    category: 'كتب'
  };

  const tafsirAyyashiVolumes = [
    {
      id: 'ayyashi_1',
      title: 'تفسير العياشي - ج١',
      author: 'محمد بن مسعود العياشي',
      url: 'https://drive.google.com/file/d/1zklHvNE0glA4aLWqLcjhcukfkCdZgWT7/preview',
      category: 'تفسير وعلوم قرآن'
    },
    {
      id: 'ayyashi_2',
      title: 'تفسير العياشي - ج٢',
      author: 'محمد بن مسعود العياشي',
      url: 'https://drive.google.com/file/d/149h_xiXp9ALi7QWbe_bD-baS0y1F53nx/preview',
      category: 'تفسير وعلوم قرآن'
    }
  ];

  const wilayaBooks: LibraryItem[] = []; // Removed local definition, using library Books instead

  const generateImamAliEncyclopediaVolumes = (count: number) => {
    const dbBook = libraryBooks.find(b => b.id === 'imam_ali_encyclopedia');
    if (dbBook?.subItems && dbBook.subItems.length > 0) {
      return dbBook.subItems;
    }
    const urls: Record<number, string> = {
      0: 'https://drive.google.com/file/d/1_k9EHdmXDornl0MT1MhNB1gx3ahjXnnB/preview',
      1: 'https://drive.google.com/file/d/1NVdrP2ISvh18FhXE1H7vnK1m2ljppRNc/preview',
      2: 'https://drive.google.com/file/d/1QWnWIX3WKRlpgI4liAtfxY6D8EaR6A0b/preview',
      3: 'https://drive.google.com/file/d/1anZqTGSlTfBWdCxCIi78q34c9mcfaOlp/preview',
      4: 'https://drive.google.com/file/d/1Gr06vMkSqtQ0os7XjdV4gx46OllemRzY/preview',
      5: 'https://drive.google.com/file/d/1fgtgSnKvzpbWCPkrHd10zlTTxe5aEY3v/preview',
      6: 'https://drive.google.com/file/d/14M2ggZvOC3hDINTEjz6rIOUU4vHbZRUK/preview',
      7: 'https://drive.google.com/file/d/1f-UTU_vgPkFNWMEH6YZ3x4kchJTzr6c8/preview',
      8: 'https://drive.google.com/file/d/1kgv6CFMIZJ4G4qyrdySQIQtXnpICDfr0/preview',
      9: 'https://drive.google.com/file/d/1mYr3N2AzkqG-Xlm4lLkPeEtihKCDG5q_/preview',
      10: 'https://drive.google.com/file/d/1PREDIRMbNJZslWo4MDbEq_OIbQaVD_h8/preview',
      11: 'https://drive.google.com/file/d/1tgtxH1TWDpTfmBZc-1L08Jl2bWhTeFc4/preview'
    };
    return Array.from({ length: count }, (_, i) => ({
      id: `imam_ali_ency_${i + 1}`,
      title: `موسوعة الإمام علي (ع) في الكتاب والسنة والتاريخ - ج${i + 1}`,
      url: urls[i] || '',
      category: 'موسوعات'
    }));
  };

  const imamAliEncyclopediaVolumes = useMemo(() => generateImamAliEncyclopediaVolumes(12), []);

  const [readingFontSize, setReadingFontSize] = useState(24);
  
  // Dynamic Data State
  const [books, setBooks] = useState<LibraryItem[]>(() => {
    const uniqueMap = new Map<string, LibraryItem>();
    libraryBooks.forEach(b => uniqueMap.set(b.id, b));
    return Array.from(uniqueMap.values());
  });
  const [research, setResearch] = useState<Supplication[]>(shubuhatItems);
  const [isLoading, setIsLoading] = useState(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Fetch Firebase Data
    const loadDynamicData = async () => {
      try {
        setIsLoading(true);
        const fbBooks = await fetchBooksFromFirebase();
        
        const finalBooksMap = new Map<string, LibraryItem>();
        libraryBooks.forEach(b => finalBooksMap.set(b.id, b));
        if (fbBooks && fbBooks.length > 0) {
          fbBooks.forEach(b => finalBooksMap.set(b.id, b));
        }
        setBooks(Array.from(finalBooksMap.values()));

        // Fetch Shubuhat safely
        try {
          const fbShubuhat = await fetchShubuhatFromFirebase();
          if (fbShubuhat && fbShubuhat.length > 0) {
            const finalResearchMap = new Map<string | number, Supplication>();
            shubuhatItems.forEach(item => finalResearchMap.set(item.id, item));
            fbShubuhat.forEach(item => finalResearchMap.set(item.id, item));
            setResearch(Array.from(finalResearchMap.values()));
          }
        } catch (shubhatErr) {
          console.error('Failed to load dynamic shubuhat:', shubhatErr);
        }
      } catch (error) {
        console.error('Failed to load dynamic data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDynamicData();

    searchManager.setProgressListener((progress) => {
      if (progress.isResumed && progress.loaded > 0) {
        setResumeMessage({ bookTitle: String(progress.currentBook), page: Number(progress.loaded) });
        setTimeout(() => setResumeMessage(null), 5000); // Hide after 5 seconds
      }
      setIndexingHistory(prev => prev.map(item => 
        item.id === String(progress.bookId) 
          ? { ...item, loaded: Number(progress.loaded), total: Number(progress.total), status: 'indexing', phase: progress.phase }
          : item
      ));
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleDeveloperMode = () => {
    const newState = !isDeveloperMode;
    setIsDeveloperMode(newState);
    searchManager.setDeveloperMode(newState);
    setIsAdmin(newState || false); // Force isAdmin UI to show
    if (newState) {
      alert('تم تفعيل وضع المطور بنجاح ✅');
    }
  };

  const handleTitleClick = () => {
    const newCount = titleClickCount + 1;
    setTitleClickCount(newCount);
    if (newCount >= 7) {
      toggleDeveloperMode();
      setTitleClickCount(0);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      if (selectedSupplication?.audioUrl) {
        const downloaded = await offlineAudioService.isDownloaded(selectedSupplication.audioUrl);
        setIsDownloaded(downloaded);
        
        const src = await offlineAudioService.getAudioSource(selectedSupplication.audioUrl);
        setAudioSrc(src);
      }
    };
    checkStatus();
  }, [selectedSupplication]);

  const handleOfflineSave = async () => {
    if (!selectedSupplication?.audioUrl) return;
    
    if (isDownloaded) {
      const confirmed = window.confirm('هل تريد حذف الملف الصوتي من جهازك؟');
      if (confirmed) {
        await offlineAudioService.removeAudio(selectedSupplication.audioUrl);
        setIsDownloaded(false);
        setAudioSrc(selectedSupplication.audioUrl);
      }
    } else {
      setIsDownloading(true);
      const success = await offlineAudioService.downloadAudio(selectedSupplication.audioUrl);
      if (success) {
        setIsDownloaded(true);
        const src = await offlineAudioService.getAudioSource(selectedSupplication.audioUrl);
        setAudioSrc(src);
      }
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!selectedSupplication) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [selectedSupplication]);

  const togglePlay = useCallback(() => {
    if (!isOnline && !isDownloaded && selectedSupplication?.audioUrl && !selectedSupplication.audioUrl.startsWith('/')) {
      alert('يجب الاتصال بالإنترنت لتشغيل هذا الملف الصوتي، أو قم بتحميله مسبقاً.');
      return;
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, isOnline, isDownloaded, selectedSupplication]);

  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current && Number.isFinite(time)) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      const targetTime = audioRef.current.currentTime + seconds;
      if (Number.isFinite(targetTime)) {
        audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration, targetTime));
      }
    }
  }, []);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const filteredSupplications = dailySupplications.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesCategory;
  });

  const filteredBooks = books.filter(item => {
    const matchesCategory = 
      activeCategory === 'all' || 
      (activeCategory === 'كتب' && (item.category === 'كتب' || item.category === 'الكتب الولائية والعقائدية')) ||
      (item.category === activeCategory);
    return matchesCategory;
  });

  const filteredResearch = research.filter(item => {
    const matchesCategory = activeCategory === 'all' || activeCategory === 'شبهات وردود';
    return matchesCategory;
  });

  // Construct standard combined library dataset
  const allData = [
    ...books.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author || '',
      category: b.category,
      type: 'book' as const,
      url: b.url,
      subItems: b.subItems,
      description: b.description || '',
      content: b.content || '',
      contentAr: b.contentAr || '',
      originalItem: b
    })),
    ...dailySupplications.map(d => ({
      id: String(d.id),
      title: d.titleAr || d.title || '',
      author: d.titleEn || '',
      category: d.category || 'أدعية',
      type: 'dua' as const,
      audioUrl: d.audioUrl,
      description: d.description || '',
      content: d.content || d.contentAr || d.titleAr || d.title || '',
      contentAr: d.contentAr || '',
      originalItem: d
    })),
    ...research.map(r => ({
      id: String(r.id),
      title: r.title || r.titleAr || '',
      author: '',
      category: r.category || 'شبهات وردود',
      type: 'research' as const,
      description: r.description || '',
      content: r.content || r.contentAr || r.title || r.titleAr || '',
      contentAr: r.contentAr || '',
      originalItem: r
    }))
  ];

  // Single direct filtered dataset using normalizeText on both sides
  const filteredData = allData.filter(item => {
    if (!searchQuery.trim()) return false;
    
    const normalizedQuery = normalizeText(searchQuery);
    const subItemsText = item.subItems ? item.subItems.map(sub => `${sub.title} ${sub.content || ''}`).join(' ') : '';
    const combinedText = `${item.title || ''} ${item.author || ''} ${item.category || ''} ${item.description || ''} ${item.content || ''} ${item.contentAr || ''} ${subItemsText}`;
    
    const normalizedSource = normalizeText(combinedText);
    
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length === 0) return false;
    
    return queryWords.every(word => normalizedSource.includes(word));
  });

  const hasBook = (bookId: string) => {
    return true;
  };

  const handleContentSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsContentSearching(true);
    setLastSearchTerm(searchTerm);
    try {
      const results = await searchManager.search(searchTerm);
      setContentSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsContentSearching(false);
    }
  };

  const handleIndexBooks = async () => {
    if (!isAdmin) return;
    setIsIndexing(true);
    
    // Prepare all items to be indexed
    const allItems: { id: string; title: string; url?: string; type: 'book' | 'dua' | 'research'; content?: string }[] = [];
    
    const allBooks = [...books, ...biharVolumes, ...wasailVolumes, ...mustadrakVolumes, ...tahdhibVolumes, ...irshadVolumes, ...ghaibaVolumes, ...sharhNahjVolumes, ...istibsarVolumes, ...madinatVolumes, tawhidBook, ...logicBooks, wakeupBook, ...uyunVolumes, ...safiVolumes, ...burhanVolumes, ...qummiVolumes, ...ihtijajVolumes, ...miratVolumes, ...faqihVolumes, nawadirBook, awalemBook, dalailBook, maqatilBook, basairBook, tuhafBook, amaliMufidBook, amaliSaduqBook, amaliTusiBook, ghaibaNumaniBook, masailGhaybaBook, ikhtisasBook, awailMaqalatBook, fusulMukhtaraBook, saghaniyyaBook, tafsirAskariBook, ...tafsirAyyashiVolumes, ...imamAliEncyclopediaVolumes];

    for (const book of allBooks) {
      if (book.subItems) {
        for (const part of book.subItems) {
          allItems.push({ id: part.id, title: `${book.title} - ${part.title}`, url: part.url, type: 'book' });
        }
      } else if (book.url) {
        allItems.push({ id: book.id, title: book.title, url: book.url, type: 'book' });
      }
    }

    for (const item of dailySupplications) {
      const content = item.content || item.contentAr;
      if (content && content.length > 50) {
        allItems.push({ id: String(item.id), title: item.titleAr || item.title || 'دعاء', type: 'dua', content, url: item.audioUrl });
      }
    }

    for (const item of research) {
      const content = item.content || item.contentAr;
      if (content) {
        allItems.push({ id: String(item.id), title: item.title || item.titleAr || 'شبهة/رد', type: 'research', content });
      }
    }

    // Deduplicate allItems by id to prevent duplicate keys in history and processing
    const seenIds = new Set<string>();
    const uniqueAllItems: typeof allItems = [];
    for (const item of allItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueAllItems.push(item);
      }
    }

    // Filter out already indexed items
    const pendingItems = uniqueAllItems.filter(item => !indexedStatus[item.id]);

    // Initialize history with all items to show total progress
    setIndexingHistory(uniqueAllItems.map(item => ({
      id: item.id,
      title: item.title,
      loaded: indexedStatus[item.id] ? 1 : 0,
      total: 1,
      status: indexedStatus[item.id] ? 'completed' : 'pending'
    })));

    if (pendingItems.length === 0) {
      alert('جميع الكتب مؤرشفة بالفعل!');
      setIsIndexing(false);
      return;
    }

    try {
      // Connect progress listener to state
      searchManager.setProgressListener((progress) => {
        if (progress.isResumed && progress.loaded > 0) {
          setResumeMessage({ bookTitle: progress.currentBook, page: progress.loaded });
          setTimeout(() => setResumeMessage(null), 5000); // Hide after 5 seconds
        }
        setIndexingHistory(prev => prev.map(s => 
          s.id === progress.bookId ? { 
            ...s, 
            loaded: progress.loaded, 
            total: progress.total, 
            phase: progress.phase,
            status: 'indexing'
          } : s
        ));
      });

      // Process in batches of 3 sequential items to prevent memory exhaustion
      const batchSize = 1; // Reducing batch size to 1 for more precise error control as requested
      for (let i = 0; i < pendingItems.length; i += batchSize) {
        const currentBatch = pendingItems.slice(i, i + batchSize);
        let hasError = false;
        
        for (const item of currentBatch) {
          try {
            setIndexingHistory(prev => prev.map(s => 
              s.id === item.id ? { ...s, status: 'indexing', phase: 'تحضير...' } : s
            ));

            if (item.type === 'book' && item.url) {
              await searchManager.indexBook(item.id, item.title, item.url);
            } else if (item.content) {
              await searchManager.indexTextContent(item.id, item.title, item.content, item.url, item.type);
            }
            
            // Mark as completed in local state and persistence
            setIndexedStatus(prev => ({ ...prev, [item.id]: true }));
            setIndexingHistory(prev => prev.map(s => 
              s.id === item.id ? { ...s, status: 'completed', phase: 'اكتمل' } : s
            ));
          } catch (itemError: any) {
            console.error(`Failed to index ${item.title}:`, itemError);
            
            // Check for hard quota exhaustion
            if (itemError.code === 'resource-exhausted' || itemError.message?.includes('Quota exceeded') || itemError.message?.includes('QUOTA_EXCEEDED')) {
              alert('⚠️ نفذت حصة الاستخدام اليومية (Quota Exceeded): لقد وصلت إلى الحد الأقصى المسموح به من العمليات في قاعدة البيانات لهذا اليوم. سيتم حفظ تقدمك تلقائياً، ويمكنك "استئناف الأرشفة" غداً عند إعادة تعيين الحصة.');
              setIsIndexing(false);
              return;
            }

            setIndexingHistory(prev => prev.map(s => 
              s.id === item.id ? { ...s, status: 'error', phase: 'فشل (توقف)' } : s
            ));
            hasError = true;
            break; // Stop processing this batch
          }
        }

        if (hasError) {
          alert('❌ توقفت العملية: حدث خطأ أثناء تحميل الملف أو أرشفته. تم إيقاف الأرشفة لضمان دقة البيانات. يرجى التحقق من الشبكة والمحاولة مرة أخرى.');
          setIsIndexing(false);
          return; // Kill the entire indexing loop
        }
        
        // Small delay between batches to allow garbage collection and browser responsiveness
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Completed batch ${i / batchSize + 1}`);
      }

      const totalIndexed = Object.keys(indexedStatus).length;
      if (totalIndexed === allItems.length) {
        alert('تم اكتمال أرشفة السحابة للمكتبة بنجاح!');
      } else {
        alert(`تمت أرشفة ${totalIndexed} من أصل ${allItems.length}. يرجى المحاولة لاحقاً لإكمال المتبقي.`);
      }
    } catch (error) {
      console.error('Indexing failed:', error);
      alert('حدث خطأ أثناء الأرشفة. يرجى مراجعة سجل الأخطاء.');
    } finally {
      setIsIndexing(false);
      searchManager.setProgressListener(() => {}); // Remove listener
    }
  };

  const categories = [
    { id: 'all', label: 'الكل', icon: <LibraryIcon size={16} /> },
    { id: 'أدعية', label: 'الأدعية', icon: <FileText size={16} /> },
    { id: 'زيارات', label: 'الزيارات', icon: <BookOpen size={16} /> },
    { id: 'كتب', label: 'الكتب', icon: <Book size={16} /> },
    { id: 'شبهات وردود', label: 'شبهات وردود', icon: <Search size={16} /> },
  ];

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${filename}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      console.error('Download failed:', error?.message || error);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.mp3`);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="p-4 pb-24 min-h-screen bg-transparent text-white overflow-y-auto">
      {/* Resume Notification */}
      <AnimatePresence>
        {resumeMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-[calc(100%-2rem)]"
          >
            <div className="bg-emerald-500/90 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-2xl flex flex-row-reverse items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <RotateCcw size={20} className="animate-spin-slow" />
              </div>
              <div className="text-right flex-1">
                <p className="font-bold text-sm">تم استئناف الأرشفة بنجاح ✅</p>
                <div className="flex flex-row-reverse items-center justify-start gap-1">
                  <span className="text-[10px] opacity-100 font-bold bg-white/20 px-1.5 py-0.5 rounded truncate max-w-[150px]">
                    {resumeMessage.bookTitle}
                  </span>
                  <span className="text-[10px] opacity-80 shrink-0">
                    بدءاً من الصفحة {resumeMessage.page}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Search */}
      <div className="max-w-2xl mx-auto mb-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="w-10 h-10 shrink-0 opacity-0 pointer-events-none" />
          
          <h2 
            onClick={handleTitleClick}
            className="text-3xl font-serif font-bold text-center text-orange-400 cursor-pointer select-none active:scale-95 transition-transform flex-1"
          >
            {isAr ? 'المكتبة الشاملة' : 'Comprehensive Library'}
          </h2>

          <div className="w-10 h-10 shrink-0 opacity-0 pointer-events-none" />
        </div>
        
        <div className="relative group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-orange-400 transition-colors" size={20} />
          <input
            type="text"
            placeholder={isAr ? "ابحث عن كتاب، مؤلف، أو دعاء (أو محتوى الكتب)..." : "Search for books, authors, or supplications..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchTerm(e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleContentSearch()}
            className="w-full h-14 pr-12 pl-6 bg-slate-900/20 backdrop-blur-md border border-white/10 rounded-2xl outline-none focus:border-orange-500/50 transition-all font-bold text-right placeholder:text-white/40 text-white"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSearchTerm('');
                  setContentSearchResults([]);
                }}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              >
                <X size={14} />
              </button>
            )}
            <button 
              onClick={handleContentSearch}
              disabled={isContentSearching || !searchQuery.trim()}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2"
            >
              {isContentSearching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>بحث في المحتوى</span>
            </button>
          </div>
        </div>

        {/* Search Helper message */}
        {searchQuery.length > 2 && filteredSupplications.length === 0 && filteredBooks.length === 0 && filteredResearch.length === 0 && !contentSearchResults.length && !isContentSearching && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-center"
          >
            <p className="text-sm text-orange-400 font-bold mb-1">لم يتم العثور على نتائج في العناوين</p>
            <p className="text-[10px] text-white/50 mb-3">هل تريد البحث في داخل محتوى الكتب والشبهات والردود والموسوعات؟</p>
            <button 
              onClick={handleContentSearch}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-all active:scale-95"
            >
              اضغط هنا للبحث الشامل
            </button>
          </motion.div>
        )}

        {/* Indexing Banner (Admin Only) */}
        {isDeveloperMode && isAdmin && (
          <GlassCard className="p-6 border-orange-500/30 bg-orange-500/5">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-right flex-1">
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <span className="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Admin Tool</span>
                    <h4 className="text-orange-400 font-bold text-lg">أدوات المطور: البحث الشامل</h4>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    يمكنك أرشفة الكتب ورفعها للسحابة ليتمكن المستخدمون من البحث في محتوى الكتاب بالكامل.
                  </p>
                  <div className="mt-2 text-xs text-green-400 font-bold bg-green-500/5 border border-green-500/20 p-2.5 rounded-xl flex items-center gap-2">
                    <span>✅ تم تفعيل صلاحيات المسؤول (Bypass) تلقائياً لتسهيل العمل والأرشفة في بيئة المعاينة بأمان.</span>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  {isDeveloperMode && isAdmin && (Object.keys(indexedStatus).length > 0 || isIndexing) && (
                    <button
                      type="button"
                      style={{ position: 'relative', zIndex: 99999, pointerEvents: 'auto' }}
                      onClick={(e) => { 
                        e.preventDefault(); 
                        alert('✅ الزر يعمل ويستجيب للمس!'); 
                        clearIndexingStatus(); 
                      }}
                      className={`px-4 py-3 rounded-2xl text-[10px] font-black border transition-all flex items-center gap-2 ${
                        isDeepCleaned 
                          ? 'bg-green-500/20 text-green-400 border-green-500/40' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                      }`}
                    >
                      <Trash2 size={14} />
                      {isDeepCleaned ? '✅ تم تدمير السجل' : 'تنظيف شامل (Deep Clean)'}
                    </button>
                  )}
                  
                  <button
                    onClick={handleIndexBooks}
                    disabled={isIndexing}
                    className={`px-8 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2 shadow-xl ${
                      isIndexing 
                        ? 'bg-orange-500/20 text-orange-400 cursor-not-allowed border border-orange-500/30' 
                        : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/40'
                    }`}
                  >
                    {isIndexing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>جاري الأرشفة...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>{Object.keys(indexedStatus).length > 0 ? 'استئناف الأرشفة' : 'بدء أرشفة المكتبة'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Overall Progress Bar */}
              {isIndexing && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black text-orange-400/60 uppercase">
                    <span>{Math.round((indexingHistory.filter(h => h.status === 'completed').length / indexingHistory.length) * 100)}% اجمالي التقدم</span>
                    <span>{indexingHistory.filter(h => h.status === 'completed').length} / {indexingHistory.length} عنصر</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(indexingHistory.filter(h => h.status === 'completed').length / indexingHistory.length) * 100}%` }}
                      className="h-full bg-gradient-to-r from-orange-600 to-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                    />
                  </div>
                </div>
              )}

              {/* Progress Detail */}
              <AnimatePresence>
                {isIndexing && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 pt-4 border-t border-white/10 max-h-64 overflow-y-auto pr-2 custom-scrollbar"
                  >
                    <div className="text-[10px] text-orange-400 font-black uppercase tracking-widest mb-2 italic text-right">قائمة الأرشفة:</div>
                    
                    {indexingHistory.map((item) => (
                      <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                        <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                             {item.status === 'indexing' && <Loader2 size={12} className="animate-spin text-orange-400" />}
                             {item.status === 'completed' && <CheckCircle2 size={12} className="text-green-500" />}
                             {item.status === 'error' && <X size={12} className="text-red-500" />}
                             <span className={`text-[10px] font-bold ${
                               item.status === 'indexing' ? 'text-orange-400' : 
                               item.status === 'completed' ? 'text-green-500' :
                               item.status === 'error' ? 'text-red-500' : 'text-white/20'
                             }`}>
                               {item.status === 'indexing' ? (item.phase || 'جاري...') : 
                                item.status === 'completed' ? 'مكتمل' :
                                item.status === 'error' ? 'خطأ' : 'بانتظار'}
                             </span>
                           </div>
                           <p className="text-xs font-bold text-white truncate max-w-[200px] text-right">{item.title}</p>
                        </div>

                        {item.status === 'indexing' && item.total > 0 && (
                          <div className="space-y-1">
                            <div className="relative h-1 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.loaded / item.total) * 100}%` }}
                                className="absolute h-full bg-orange-500 shadow-[0_0_10px_rgba(251,146,60,0.5)]"
                              />
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-white/40">
                              <span>صفحة {item.loaded} من {item.total}</span>
                              <span>{Math.round((item.loaded / item.total) * 100)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        )}

        {/* Content Search Results */}
        <AnimatePresence>
          {(contentSearchResults.length > 0 || (lastSearchTerm && !isContentSearching)) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                <button 
                  onClick={() => {
                    setContentSearchResults([]);
                    setLastSearchTerm('');
                  }}
                  className="text-[10px] hover:text-white text-white/40 transition-colors"
                >
                  مسح النتائج
                </button>
                <h3 className="text-sm font-bold text-orange-400 border-r-2 border-orange-500 pr-3 uppercase tracking-widest text-right">
                  نتائج البحث في المحتوى ({contentSearchResults.length})
                </h3>
              </div>
              
              {contentSearchResults.length === 0 && (
                <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10">
                   <p className="text-orange-400 font-bold mb-2">عذراً، لم يتم العثور على نتائج في المحتوى لـ "{lastSearchTerm}"</p>
                   <p className="text-xs text-white/40 leading-relaxed">
                     إذا لم تظهر نتائج، قد يكون جاري تحديث فهارس المكتبة، يرجى المحاولة لاحقاً أو التأكد من كلمات البحث.
                   </p>
                </div>
              )}

              <div className="space-y-2">
                {contentSearchResults.map((result, idx) => (
                  <GlassCard 
                    key={`${result.bookId}-${idx}`} 
                    onClick={() => {
                      if (result.pageNumber > 0) {
                        setActivePdf({ url: result.url, title: result.bookTitle, page: result.pageNumber });
                      } else {
                        // Handle text content (supplications/research)
                        setSelectedSupplication({
                          id: result.bookId,
                          titleAr: result.bookTitle,
                          contentAr: result.content || '',
                          category: result.category === 'research' ? 'شبهات وردود' : 'أدعية',
                          audioUrl: result.url
                        });
                      }
                    }}
                    className="p-4 hover:bg-orange-500/5 group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                            {result.pageNumber > 0 ? `صفحة ${result.pageNumber}` : (result.category === 'research' ? 'شبهة/رد' : 'دعاء/زيارة')}
                          </span>
                          {(result as any).phase?.includes('OCR') && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-black flex items-center gap-1 uppercase">
                              <Sparkles size={8} /> OCR
                            </span>
                          )}
                        </div>
                      </div>
                      <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors text-right">{result.bookTitle}</h4>
                    </div>
                    <p className="text-sm text-white/60 mt-2 text-right leading-relaxed line-clamp-2 italic font-arabic" dir="rtl">
                      <HighlightMatchedText text={result.snippet} query={lastSearchTerm} />
                    </p>
                  </GlassCard>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none justify-end">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
                activeCategory === cat.id
                  ? 'bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-slate-950/20 backdrop-blur-sm border-white/10 text-white/60 hover:border-white/20'
              }`}
            >
              <span className="text-sm">{cat.label}</span>
              {cat.icon}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-10">
        {isLoading && (activeCategory === 'كتب' || activeCategory === 'شبهات وردود' || activeCategory === 'all') && (
          <div className="flex items-center justify-center gap-2 text-orange-400 font-bold p-4">
            <Loader2 className="animate-spin" size={20} />
            <span>جاري تحميل البيانات من السحابة...</span>
          </div>
        )}

        {searchQuery.trim() !== "" ? (
          filteredData.length === 0 ? (
            <div className="text-center py-20 opacity-40">
              <Search size={48} className="mx-auto mb-4 text-orange-500/50" />
              <p className="font-bold text-lg text-white">عذراً، لم يتم العثور على نتائج لـ "{searchQuery}"</p>
              <p className="text-xs mt-2 text-white/40">تأكد من كتابة الكلمات بشكل صحيح أو حاول البحث بكلمات أبسط</p>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-orange-400 border-r-2 border-orange-500 pr-3 uppercase tracking-widest text-right">
                نتائج البحث المكتشفة ({filteredData.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredData.map((item, idx) => {
                  if (item.type === 'book') {
                    const isExpanded = expandedBookId === item.id;
                    const hasParts = item.subItems && item.subItems.length > 0;

                    return (
                      <GlassCard key={`${item.id}-${idx}`} className="flex flex-col border-orange-500/20">
                        <div 
                          onClick={() => {
                            if (hasParts) {
                              setExpandedBookId(isExpanded ? null : item.id);
                            } else if (item.url) {
                              setActivePdf({ url: item.url, title: item.title });
                            }
                          }}
                          className="p-5 flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            {hasParts ? (
                              <ChevronDown 
                                size={20} 
                                className={`text-white/20 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-orange-400' : ''}`} 
                              />
                            ) : (
                              <ChevronLeft size={18} className="text-white/20 group-hover:text-orange-400" />
                            )}
                            {hasParts && (
                              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                                {item.subItems?.length} أجزاء
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <h4 className="font-bold text-lg text-white group-hover:text-orange-300 transition-colors mb-0.5">{item.title}</h4>
                              {item.author && (
                                <p className="text-sm opacity-40 flex items-center justify-end gap-1">
                                  {item.author}
                                  <User size={12} />
                                </p>
                              )}
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                              <Book size={24} />
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && hasParts && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="overflow-hidden bg-white/5 border-t border-white/10"
                            >
                              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.subItems?.map((part: any, pIndex: number) => (
                                  <button
                                    key={`${part.id}-${pIndex}`}
                                    onClick={() => setActivePdf({ url: part.url, title: `${item.title} - ${part.title}` })}
                                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 transition-all text-right group/part"
                                  >
                                    <ChevronLeft size={14} className="text-white/20 group-hover/part:text-orange-400 transition-colors" />
                                    <span className="font-bold text-sm text-white/80 group-hover/part:text-white transition-colors">
                                      {part.title}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </GlassCard>
                    );
                  } else {
                    return (
                      <SupplicationItem 
                        key={`${item.id}-${idx}`} 
                        item={item.originalItem} 
                        onClick={() => setSelectedSupplication(item.originalItem)} 
                        isOnline={isOnline}
                      />
                    );
                  }
                })}
              </div>
            </div>
          )
        ) : (
          <>
            {/* Books Section - Accordion Layout */}
            {(activeCategory === 'all' || activeCategory === 'كتب') && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-orange-400 border-r-2 border-orange-500 pr-3 uppercase tracking-widest text-right">الكتب والموسوعات</h3>
            <div className="grid grid-cols-1 gap-4">
              {/* Bihar al-Anwar Accordion */}
              {hasBook('bihar_al_anwar') && (
                <GlassCard className="flex flex-col border-orange-500/20">
                  <div 
                    onClick={() => setExpandedBookId(expandedBookId === 'bihar_root' ? null : 'bihar_root')}
                    className="p-5 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: expandedBookId === 'bihar_root' ? 180 : 0 }}
                        className="text-orange-400/40 group-hover:text-orange-400"
                      >
                        <ChevronDown size={20} />
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-black">110 أجزاء</span>
                          <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors">موسوعة بحار الأنوار</h4>
                        </div>
                        <p className="text-xs text-white/40">العلامة المجلسي (أعلى الله مقامه)</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:bg-orange-500/20 transition-all">
                        <LibraryIcon size={24} />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedBookId === 'bihar_root' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/20 border-t border-white/5"
                      >
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {biharVolumes.map((item, index) => (
                            <button
                              key={`${item.id}-${index}`}
                              onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                                item.url 
                                  ? 'bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-white/10 text-white' 
                                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.url ? <Download size={12} className="text-orange-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                                <span className="text-[10px] font-mono">Vol {item.id.split('_')[1]}</span>
                              </div>
                              <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              )}

              {/* Imam Ali Encyclopedia Accordion */}
              {hasBook('imam_ali_encyclopedia') && (
                <GlassCard className="flex flex-col border-blue-500/20">
                  <div 
                    onClick={() => setExpandedBookId(expandedBookId === 'imam_ali_ency_root' ? null : 'imam_ali_ency_root')}
                    className="p-5 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: expandedBookId === 'imam_ali_ency_root' ? 180 : 0 }}
                        className="text-blue-400/40 group-hover:text-blue-400"
                      >
                        <ChevronDown size={20} />
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black">12 جزءاً</span>
                          <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">موسوعة الإمام علي (ع) في الكتاب والسنة والتاريخ</h4>
                        </div>
                        <p className="text-xs text-white/40">محمد الريشهري</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                        <Sparkles size={24} />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedBookId === 'imam_ali_ency_root' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/20 border-t border-white/5"
                      >
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {imamAliEncyclopediaVolumes.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                                item.url 
                                  ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-white/10 text-white' 
                                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.url ? <Download size={12} className="text-blue-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                                <span className="text-[10px] font-mono">Vol {item.id.split('_').slice(-1)[0]}</span>
                              </div>
                              <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              )}

              {/* Wasa'il al-Shia Accordion */}
              {hasBook('wasail_al_shia') && (
                <GlassCard className="flex flex-col border-emerald-500/20">
                  <div 
                    onClick={() => setExpandedBookId(expandedBookId === 'wasail_root' ? null : 'wasail_root')}
                    className="p-5 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: expandedBookId === 'wasail_root' ? 180 : 0 }}
                        className="text-emerald-400/40 group-hover:text-emerald-400"
                      >
                        <ChevronDown size={20} />
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">30 جزءاً</span>
                          <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">موسوعة وسائل الشيعة</h4>
                        </div>
                        <p className="text-xs text-white/40">الشيخ الحر العاملي</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                        <LibraryIcon size={24} />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedBookId === 'wasail_root' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/20 border-t border-white/5"
                      >
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {wasailVolumes.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                                item.url 
                                  ? 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-white/10 text-white' 
                                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.url ? <Download size={12} className="text-emerald-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                                <span className="text-[10px] font-mono">Vol {item.id.split('_')[1]}</span>
                              </div>
                              <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              )}

              {/* Mustadrak al-Wasa'il Accordion */}
              {hasBook('mustadrak_al_wasail') && (
                <GlassCard className="flex flex-col border-cyan-500/20">
                  <div 
                    onClick={() => setExpandedBookId(expandedBookId === 'mustadrak_root' ? null : 'mustadrak_root')}
                    className="p-5 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: expandedBookId === 'mustadrak_root' ? 180 : 0 }}
                        className="text-cyan-400/40 group-hover:text-cyan-400"
                      >
                        <ChevronDown size={20} />
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="bg-cyan-500/10 text-cyan-400 text-[10px] px-2 py-0.5 rounded-full font-black">18 جزءاً</span>
                          <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">مستدرك الوسائل</h4>
                        </div>
                        <p className="text-xs text-white/40">المحدث النوري (طاب ثراه)</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                        <LibraryIcon size={24} />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedBookId === 'mustadrak_root' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/20 border-t border-white/5"
                      >
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {mustadrakVolumes.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                                item.url 
                                  ? 'bg-white/5 border-white/10 hover:border-cyan-500/50 hover:bg-white/10 text-white' 
                                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.url ? <Download size={12} className="text-cyan-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                                <span className="text-[10px] font-mono">Vol {item.id.split('_')[1]}</span>
                              </div>
                              <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              )}

              {/* Sharh Nahj al-Balagha Accordion */}
              {hasBook('sharh_nahj_balagha') && (
                <GlassCard className="flex flex-col border-orange-500/20">
                  <div 
                    onClick={() => setExpandedBookId(expandedBookId === 'sharh_nahj_root' ? null : 'sharh_nahj_root')}
                    className="p-5 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: expandedBookId === 'sharh_nahj_root' ? 180 : 0 }}
                        className="text-orange-400/40 group-hover:text-orange-400"
                      >
                        <ChevronDown size={20} />
                      </motion.div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-black">20 جزءاً</span>
                          <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors">شرح نهج البلاغة</h4>
                        </div>
                        <p className="text-xs text-white/40">ابن أبي الحديد المعتزلي</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:bg-orange-500/20 transition-all">
                        <Book size={24} />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedBookId === 'sharh_nahj_root' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/20 border-t border-white/5"
                      >
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {sharhNahjVolumes.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                                item.url 
                                  ? 'bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-white/10 text-white' 
                                  : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {item.url ? <Download size={12} className="text-orange-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                                <span className="text-[10px] font-mono">Part {item.id.split('_')[2]}</span>
                              </div>
                              <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              )}

              {/* Istibsar Accordion */}
              <GlassCard className="flex flex-col border-emerald-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'istibsar_root' ? null : 'istibsar_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'istibsar_root' ? 180 : 0 }}
                      className="text-emerald-400/40 group-hover:text-emerald-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">4 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">الاستبصار</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الطوسي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'istibsar_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {istibsarVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-emerald-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Tahdhib al-Ahkam Accordion */}
              <GlassCard className="flex flex-col border-sky-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'tahdhib_root' ? null : 'tahdhib_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'tahdhib_root' ? 180 : 0 }}
                      className="text-sky-400/40 group-hover:text-sky-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-sky-500/10 text-sky-400 text-[10px] px-2 py-0.5 rounded-full font-black">10 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-sky-400 transition-colors">تهذيب الأحكام</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الطوسي (قدس سره)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 transition-all">
                      <LibraryIcon size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'tahdhib_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {tahdhibVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-sky-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-sky-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Vol {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Al-Irshad Accordion */}
              <GlassCard className="flex flex-col border-indigo-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'irshad_root' ? null : 'irshad_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'irshad_root' ? 180 : 0 }}
                      className="text-indigo-400/40 group-hover:text-indigo-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-black">جزئان</span>
                        <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">كتاب الإرشاد</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'irshad_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {irshadVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-indigo-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-indigo-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Rasail fi al-Ghaiba Accordion */}
              <GlassCard className="flex flex-col border-blue-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'ghaiba_root' ? null : 'ghaiba_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'ghaiba_root' ? 180 : 0 }}
                      className="text-blue-400/40 group-hover:text-blue-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black">4 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">رسائل في الغيبة</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'ghaiba_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {ghaibaVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-blue-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
              
              {/* Madinat al-Ma'ajiz Accordion */}
              <GlassCard className="flex flex-col border-rose-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'madinat_root' ? null : 'madinat_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'madinat_root' ? 180 : 0 }}
                      className="text-rose-400/40 group-hover:text-rose-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-black">8 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-rose-400 transition-colors">مدينة المعاجز</h4>
                      </div>
                      <p className="text-xs text-white/40">السيد هاشم البحراني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'madinat_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {madinatVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-rose-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-rose-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
              
              {/* Kitab al-Tawhid (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: tawhidBook.url, title: tawhidBook.title })}
                className="flex flex-col border-indigo-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-black italic uppercase">Special</span>
                        <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">كتاب التوحيد</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الصدوق</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Logic Books */}
              {logicBooks.map((book) => (
                <GlassCard 
                  key={book.id}
                  onClick={() => setActivePdf({ url: book.url, title: book.title })}
                  className="flex flex-col border-cyan-500/20"
                >
                  <div className="p-5 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <ChevronLeft size={18} className="text-white/20 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="bg-cyan-500/10 text-cyan-400 text-[10px] px-2 py-0.5 rounded-full font-black">منطق</span>
                          <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">{book.title}</h4>
                        </div>
                        <p className="text-xs text-white/40">{book.author}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                        <BookOpen size={24} />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}

              {/* Al-Iqaz min al-Haj’a (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: wakeupBook.url, title: wakeupBook.title })}
                className="flex flex-col border-yellow-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-natural-dark/20 dark:text-white/20 group-hover:text-yellow-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-yellow-500/10 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-natural-text dark:text-white group-hover:text-yellow-400 transition-colors">الإيقاظ من الهجعة</h4>
                      </div>
                      <p className="text-xs text-natural-text/40 dark:text-white/40">الشيخ الحر العاملي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 group-hover:bg-yellow-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Uyun Akhbar al-Rida Accordion */}
              <GlassCard className="flex flex-col border-blue-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'uyun_root' ? null : 'uyun_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'uyun_root' ? 180 : 0 }}
                      className="text-blue-400/40 group-hover:text-blue-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black">2 جزءان</span>
                        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">عيون أخبار الرضا</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الصدوق</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'uyun_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {uyunVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-blue-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Al-Tafsir al-Safi Accordion */}
              <GlassCard className="flex flex-col border-amber-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'safi_root' ? null : 'safi_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'safi_root' ? 180 : 0 }}
                      className="text-amber-400/40 group-hover:text-amber-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black">7 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-amber-400 transition-colors">التفسير الصافي</h4>
                      </div>
                      <p className="text-xs text-white/40">الفيض الكاشاني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'safi_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {safiVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-amber-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-amber-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Al-Burhan fi Tafsir al-Qur'an Accordion */}
              <GlassCard className="flex flex-col border-violet-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'burhan_root' ? null : 'burhan_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'burhan_root' ? 180 : 0 }}
                      className="text-violet-400/40 group-hover:text-violet-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-violet-500/10 text-violet-400 text-[10px] px-2 py-0.5 rounded-full font-black">8 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-violet-400 transition-colors">تفسير البرهان</h4>
                      </div>
                      <p className="text-xs text-white/40">السيد هاشم البحراني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'burhan_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {burhanVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-violet-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-violet-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Tafsir al-Qummi Accordion */}
              <GlassCard className="flex flex-col border-emerald-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'qummi_root' ? null : 'qummi_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'qummi_root' ? 180 : 0 }}
                      className="text-emerald-400/40 group-hover:text-emerald-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">3 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">تفسير القمي</h4>
                      </div>
                      <p className="text-xs text-white/40">علي بن إبراهيم القمي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'qummi_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {qummiVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-emerald-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Al-Ihtijaj Accordion */}
              <GlassCard className="flex flex-col border-indigo-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'ihtijaj_root' ? null : 'ihtijaj_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'ihtijaj_root' ? 180 : 0 }}
                      className="text-indigo-400/40 group-hover:text-indigo-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-black">جزءان</span>
                        <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">كتاب الاحتجاج</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الطبرسي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'ihtijaj_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {ihtijajVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-indigo-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-indigo-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Mir'at al-Uqul Accordion */}
              <GlassCard className="flex flex-col border-emerald-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'mirat_root' ? null : 'mirat_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'mirat_root' ? 180 : 0 }}
                      className="text-emerald-400/40 group-hover:text-emerald-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">26 جزءاً</span>
                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">مرآة العقول</h4>
                      </div>
                      <p className="text-xs text-white/40">العلامة المجلسي (أعلى الله مقامه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <LibraryIcon size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'mirat_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {miratVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-emerald-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Vol {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Man La Yahduruhu al-Faqih Accordion */}
              <GlassCard className="flex flex-col border-blue-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'faqih_root' ? null : 'faqih_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'faqih_root' ? 180 : 0 }}
                      className="text-blue-400/40 group-hover:text-blue-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black">4 أجزاء</span>
                        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">من لا يحضره الفقيه</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الصدوق</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'faqih_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {faqihVolumes.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-blue-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <span className="text-[10px] font-mono">Part {item.id.split('_')[1]}</span>
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {/* Nawadir al-Mu'ajizat (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: nawadirBook.url, title: nawadirBook.title })}
                className="flex flex-col border-emerald-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">معاجز</span>
                        <h4 className="font-bold text-natural-text dark:text-white group-hover:text-emerald-400 transition-colors">نوادر المعجزات</h4>
                      </div>
                      <p className="text-xs text-natural-text/40 dark:text-white/40">الطبري الشيعي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Al-Awalem (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: awalemBook.url, title: awalemBook.title })}
                className="flex flex-col border-red-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-red-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-natural-text dark:text-white group-hover:text-red-400 transition-colors">العوالم: الإمام الحسين (ع)</h4>
                      </div>
                      <p className="text-xs text-natural-text/40 dark:text-white/40">الشيخ عبد الله البحراني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 group-hover:bg-red-500/20 transition-all">
                      <LibraryIcon size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Dalail al-Imama (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: dalailBook.url, title: dalailBook.title })}
                className="flex flex-col border-orange-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-orange-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors">دلائل الإمامة</h4>
                      </div>
                      <p className="text-xs text-white/40">محمد بن جرير الطبري (الشيعي)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:bg-orange-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Maqatil al-Talibiyyin (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: maqatilBook.url, title: maqatilBook.title })}
                className="flex flex-col border-red-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-red-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-black">سيرة وتاريخ</span>
                        <h4 className="font-bold text-white group-hover:text-red-400 transition-colors">مقاتل الطالبيين</h4>
                      </div>
                      <p className="text-xs text-white/40">أبو الفرج الأصفهاني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 group-hover:bg-red-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Basair al-Darajat (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: basairBook.url, title: basairBook.title })}
                className="flex flex-col border-cyan-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-cyan-500/10 text-cyan-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-white group-hover:text-cyan-400 transition-colors">بصائر الدرجات</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الصفار القمي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Tuhaf al-Uqul (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: tuhafBook.url, title: tuhafBook.title })}
                className="flex flex-col border-emerald-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">أخلاق وحِكم</span>
                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">تحف العقول</h4>
                      </div>
                      <p className="text-xs text-white/40">ابن شعبة الحراني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Amali al-Mufid (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: amaliMufidBook.url, title: amaliMufidBook.title })}
                className="flex flex-col border-indigo-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">أمالي الشيخ المفيد</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Amali al-Saduq (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: amaliSaduqBook.url, title: amaliSaduqBook.title })}
                className="flex flex-col border-blue-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">أمالي الشيخ الصدوق</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الصدوق (قدس سره)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Amali al-Tusi (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: amaliTusiBook.url, title: amaliTusiBook.title })}
                className="flex flex-col border-sky-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-sky-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-sky-500/10 text-sky-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث</span>
                        <h4 className="font-bold text-white group-hover:text-sky-400 transition-colors">أمالي الشيخ الطوسي</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ الطوسي (قدس سره)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Kitab al-Ghayba (al-Numani) (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: ghaibaNumaniBook.url, title: ghaibaNumaniBook.title })}
                className="flex flex-col border-orange-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-orange-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث وغيبة</span>
                        <h4 className="font-bold text-white group-hover:text-orange-400 transition-colors">كتاب الغيبة</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ محمد بن إبراهيم النعماني</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:bg-orange-500/20 transition-all">
                      <Book size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Al-Masail al-Ashr (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: masailGhaybaBook.url, title: masailGhaybaBook.title })}
                className="flex flex-col border-blue-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black">غيبة وعقيدة</span>
                        <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">المسائل العشر في الغيبة</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Al-Ikhtisas (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: ikhtisasBook.url, title: ikhtisasBook.title })}
                className="flex flex-col border-emerald-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">حديث وأخبار</span>
                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">كتاب الاختصاص</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Awail al-Maqalat (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: awailMaqalatBook.url, title: awailMaqalatBook.title })}
                className="flex flex-col border-indigo-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-black">عقائد</span>
                        <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors">أوائل المقالات</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Al-Fusul al-Mukhtara (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: fusulMukhtaraBook.url, title: fusulMukhtaraBook.title })}
                className="flex flex-col border-rose-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-rose-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-black">كلام وجدل</span>
                        <h4 className="font-bold text-white group-hover:text-rose-400 transition-colors">الفصول المختارة</h4>
                      </div>
                      <p className="text-xs text-white/40">الشريف المرتضى (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:bg-rose-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Al-Masail al-Saghaniyya (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: saghaniyyaBook.url, title: saghaniyyaBook.title })}
                className="flex flex-col border-purple-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-purple-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-purple-500/10 text-purple-400 text-[10px] px-2 py-0.5 rounded-full font-black">ردود عقائدية</span>
                        <h4 className="font-bold text-white group-hover:text-purple-400 transition-colors">المسائل الصاغانية</h4>
                      </div>
                      <p className="text-xs text-white/40">الشيخ المفيد (طاب ثراه)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/20 transition-all">
                      <Sparkles size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Tafsir al-Imam al-Askari (Standalone) */}
              <GlassCard 
                onClick={() => setActivePdf({ url: tafsirAskariBook.url, title: tafsirAskariBook.title })}
                className="flex flex-col border-amber-500/20"
              >
                <div className="p-5 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <ChevronLeft size={18} className="text-white/20 group-hover:text-amber-400 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-black">تفسير وعلوم قرآن</span>
                        <h4 className="font-bold text-white group-hover:text-amber-400 transition-colors">تفسير الإمام العسكري (ع)</h4>
                      </div>
                      <p className="text-xs text-white/40">الإمام الحسن العسكري (عليه السلام)</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Tafsir al-Ayyashi Accordion */}
              <GlassCard className="flex flex-col border-emerald-500/20">
                <div 
                  onClick={() => setExpandedBookId(expandedBookId === 'ayyashi_root' ? null : 'ayyashi_root')}
                  className="p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: expandedBookId === 'ayyashi_root' ? 180 : 0 }}
                      className="text-emerald-400/40 group-hover:text-emerald-400"
                    >
                      <ChevronDown size={20} />
                    </motion.div>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">جزئان</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="flex items-center justify-end gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-black">تفسير وعلوم قرآن</span>
                        <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">تفسير العياشي</h4>
                      </div>
                      <p className="text-xs text-white/40">محمد بن مسعود العياشي</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-all">
                      <BookOpen size={24} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBookId === 'ayyashi_root' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-black/20 border-t border-white/5"
                    >
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {tafsirAyyashiVolumes.map((item, index) => (
                          <button
                            key={`${item.id}-${index}`}
                            onClick={() => item.url && setActivePdf({ url: item.url, title: item.title })}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all text-right ${
                              item.url 
                                ? 'bg-white/5 border-white/10 hover:border-emerald-500/50 hover:bg-white/10 text-white' 
                                : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.url ? <Download size={12} className="text-emerald-400/40" /> : <Loader2 size={12} className="text-white/10" />}
                              <ChevronLeft size={10} className="text-white/20" />
                            </div>
                            <span className="text-xs font-bold truncate ml-2">{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>

              {Array.from(new Map<string, LibraryItem>(filteredBooks.map(b => [b.id, b])).values())
                .filter(book => {
                  const staticBookIds = [
                    'bihar_al_anwar', 'sharh_nahj_balagha', 'madinat_al_maajiz', 'tafsir_safi', 'tafsir_burhan', 'tafsir_qummi',
                    'imam_ali_encyclopedia', 'wasail_al_shia', 'mustadrak_al_wasail', 'al_istibsar_tusi', 'tahdhib_al_ahkam',
                    'al_irshad_mufid', 'rasail_fi_al_ghaiba', 'tawhid_saduq', 'logic_muzaffar', 'islah_logic', 'wakeup_haja',
                    'uyun_al_rida', 'ihtijaj_tabarsi', 'mirat_al_uqul', 'man_la_yahduruhu_al_faqih', 'nawadir_muajizat',
                    'awalem_hussein', 'dalail_imama', 'maqatil_talibiyyin', 'basair_darajat', 'tuhaf_uqul', 'amali_mufid',
                    'amali_saduq', 'amali_tusi', 'ghaiba_numani', 'masail_ghayba', 'ikhtisas_mufid', 'awail_maqalat',
                    'fusul_mukhtara', 'masail_saghaniyya', 'tafsir_askari', 'tafsir_ayyashi'
                  ];
                  
                  if (staticBookIds.includes(book.id)) return false;
                  
                  // Protect against duplicate rendering of individual volumes
                  const prefixes = [
                    'bihar_', 'wasail_', 'mustadrak_', 'tahdhib_', 'irshad_', 'ghaiba_', 'sharh_nahj_', 
                    'istibsar_', 'madinat_', 'uyun_', 'safi_', 'burhan_', 'qummi_', 'ihtijaj_', 'mirat_', 
                    'faqih_', 'ayyashi_', 'imam_ali_ency_'
                  ];
                  
                  for (const prefix of prefixes) {
                    if (book.id.startsWith(prefix)) {
                      const rest = book.id.substring(prefix.length);
                      if (/^\d+$/.test(rest)) return false;
                    }
                  }
                  
                  return true;
                })
                .map((book, bIndex) => {
                const isExpanded = expandedBookId === book.id;
                const hasParts = book.subItems && book.subItems.length > 0;

                return (
                  <GlassCard 
                    key={`${book.id}-${bIndex}`} 
                    className="flex flex-col"
                  >
                    {/* Header Action */}
                    <div 
                      onClick={() => {
                        if (hasParts) {
                          setExpandedBookId(isExpanded ? null : book.id);
                        } else if (book.url) {
                          setActivePdf({ url: book.url, title: book.title });
                        }
                      }}
                      className="p-5 flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {hasParts ? (
                          <ChevronDown 
                            size={20} 
                            className={`text-white/20 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-orange-400' : ''}`} 
                          />
                        ) : (
                          <ChevronLeft size={18} className="text-white/20 group-hover:text-orange-400" />
                        )}
                        {hasParts && (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">
                            {book.subItems?.length} أجزاء
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <h4 className="font-bold text-lg text-white group-hover:text-orange-300 transition-colors mb-0.5">{book.title}</h4>
                          <p className="text-sm opacity-40 flex items-center justify-end gap-1">
                            {book.author}
                            <User size={12} />
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                          <Book size={24} />
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Parts List */}
                    <AnimatePresence>
                      {isExpanded && hasParts && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                          className="overflow-hidden bg-white/5 border-t border-white/10"
                        >
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {book.subItems?.map((part, pIndex) => (
                              <button
                                key={`${part.id}-${pIndex}`}
                                onClick={() => setActivePdf({ url: part.url, title: `${book.title} - ${part.title}` })}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/5 hover:border-orange-500/30 transition-all text-right group/part"
                              >
                                <ChevronLeft size={14} className="text-white/20 group-hover/part:text-orange-400 transition-colors" />
                                <span className="font-bold text-sm text-white/80 group-hover/part:text-white transition-colors">
                                  {part.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        )}

        {/* Supplications & Ziyarat Section */}
        {(activeCategory === 'all' || activeCategory === 'أدعية' || activeCategory === 'زيارات') && filteredSupplications.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-blue-400 border-r-2 border-blue-500 pr-3 uppercase tracking-widest text-right">الأدعية والزيارات</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSupplications.map((item) => (
                <SupplicationItem 
                  key={item.id} 
                  item={item} 
                  onClick={() => setSelectedSupplication(item)} 
                  isOnline={isOnline}
                />
              ))}
            </div>
          </div>
        )}

        {/* Research Section */}
        {(activeCategory === 'all' || activeCategory === 'شبهات وردود') && filteredResearch.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 border-r-2 border-emerald-500 pr-3 uppercase tracking-widest text-right">شبهات وردود</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredResearch.map((item) => (
                <SupplicationItem 
                  key={item.id} 
                  item={item} 
                  onClick={() => setSelectedSupplication(item)} 
                  isOnline={isOnline}
                />
              ))}
            </div>
          </div>
        )}

        {/* Research Section - Empty State when nothing added yet */}
        {(activeCategory === 'شبهات وردود') && filteredResearch.length === 0 && searchTerm === '' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-emerald-400 border-r-2 border-emerald-500 pr-3 uppercase tracking-widest text-right">شبهات وردود</h3>
            <GlassCard className="p-12 text-center opacity-40">
              <Sparkles size={48} className="mx-auto mb-4 text-emerald-500" />
              <p className="font-bold text-lg">قسم شبهات وردود قيد التحديث</p>
              <p className="text-xs mt-2">سيتم إضافة الشبهات والردود عليها قريباً إن شاء الله</p>
            </GlassCard>
          </div>
        )}

        {filteredBooks.length === 0 && filteredSupplications.length === 0 && filteredResearch.length === 0 && (
          <div className="text-center py-20 opacity-40">
            <Search size={48} className="mx-auto mb-4" />
            <p className="font-bold">عذراً، لم نجد نتائج لـ "{searchTerm}"</p>
          </div>
        )}
          </>
        )}
      </div>

      {/* --- Modals --- */}

      <AnimatePresence>
        {selectedSupplication && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[110] bg-zinc-950 text-white backdrop-blur-3xl flex flex-col"
          >
            {/* Modal Header */}
            <header className="p-4 flex items-center justify-between border-b border-zinc-800/80 shadow-lg bg-zinc-900/80 backdrop-blur-md text-white">
              <button 
                onClick={() => setSelectedSupplication(null)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white transition-colors active:scale-90"
              >
                <X size={20} />
              </button>
              
              <div className="text-center">
                <h3 className="text-lg font-bold text-orange-400">{selectedSupplication.title || selectedSupplication.titleAr}</h3>
                <p className="text-[10px] text-white/60 uppercase tracking-widest">{selectedSupplication.titleEn}</p>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setReadingFontSize(s => Math.min(s + 4, 60))}
                  className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white transition-colors"
                >
                  <Type size={18} />
                </button>
              </div>
            </header>

            {/* Reading Content */}
            <main className="flex-1 overflow-y-auto p-6 md:p-12 relative scroll-smooth bg-zinc-950">
              <div 
                className={`max-w-2xl mx-auto leading-[2.5] font-arabic whitespace-pre-line transition-all duration-300 pb-80 text-gray-100 ${
                  selectedSupplication.category === 'شبهات وردود' ? 'text-right' : 'text-center'
                }`}
                style={{ 
                  fontSize: `${readingFontSize}px`,
                  direction: selectedSupplication.category === 'شبهات وردود' ? 'rtl' : 'ltr'
                }}
              >
                {selectedSupplication.content || selectedSupplication.contentAr}
              </div>
            </main>

            {/* Custom Modern Audio Player */}
            {selectedSupplication.audioUrl && (
              <div className="fixed bottom-24 left-4 right-4 z-[120]">
                <GlassCard className="max-w-xl mx-auto bg-zinc-900/95 backdrop-blur-2xl border border-zinc-800 dark:border-orange-500/30 p-4 rounded-3xl shadow-2xl text-white">
                  {/* Hidden Audio Element */}
                  {audioSrc && (
                      <audio
                        ref={audioRef}
                        key={audioSrc}
                        src={audioSrc}
                        onTimeUpdate={onTimeUpdate}
                        onLoadedMetadata={onLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        autoPlay
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={() => {
                          console.error("Audio playback error: Failed to load source");
                          setIsPlaying(false);
                        }}
                      />
                  )}

                  {/* Player Controls */}
                  <div className="flex flex-col gap-3">
                    {/* Top Row: Info & Download Controls */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        {/* System Download (Existing) */}
                        <button 
                          onClick={() => handleDownload(selectedSupplication.audioUrl!, selectedSupplication.title || selectedSupplication.titleAr)}
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-orange-400 hover:bg-orange-500/10 transition-all active:scale-95 group"
                          title="تحميل للجهاز"
                        >
                          <Download size={16} />
                        </button>

                        {/* Offline Caching (New) */}
                        <button 
                          onClick={handleOfflineSave}
                          disabled={isDownloading}
                          className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 border ${
                            isDownloaded 
                              ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400' 
                              : 'bg-white/5 border-white/10 text-white/60 hover:border-orange-500/30 hover:text-orange-400'
                          }`}
                          title={isDownloaded ? "حذف من المفضلة (بدون انترنت)" : "حفظ للتشغيل بدون انترنت"}
                        >
                          {isDownloading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : isDownloaded ? (
                            <CheckCircle2 size={18} className="group-hover:hidden" />
                          ) : (
                            <CloudDownload size={18} />
                          )}
                          {isDownloaded && <Trash2 size={18} className="hidden group-hover:block" />}
                        </button>
                      </div>
                      
                      <div className="flex-1 px-4 text-center">
                        <div className="flex flex-col">
                          <p className="text-orange-400 text-xs font-bold truncate">{selectedSupplication.title || selectedSupplication.titleAr}</p>
                          {isDownloaded ? (
                            <span className="text-[8px] text-green-500/60 font-bold">متاح بدون انترنت</span>
                          ) : (!isOnline && selectedSupplication.audioUrl && !selectedSupplication.audioUrl.startsWith('/')) ? (
                            <span className="text-[8px] text-red-500 font-bold animate-pulse">يحتاج للاتصال بالإنترنت</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="w-9" />
                    </div>

                    {/* Middle Row: Progress Slider */}
                    <div className="flex flex-col gap-1">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleProgressChange}
                        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 transition-all"
                      />
                      <div className="flex justify-between px-0.5">
                        <span className="text-[9px] font-mono text-white/40">{formatTime(currentTime)}</span>
                        <span className="text-[9px] font-mono text-white/40">{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Bottom Row: Main Buttons */}
                    <div className="flex items-center justify-center gap-4">
                      <button 
                        onClick={() => {
                          if (audioRef.current && Number.isFinite(0)) {
                            audioRef.current.currentTime = 0;
                            if (!isPlaying) togglePlay();
                          }
                        }}
                        className="text-white/40 hover:text-white transition-colors p-2"
                        title="إعادة التشغيل"
                      >
                        <RotateCcw size={18} />
                      </button>

                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => seek(-10)}
                          className="text-white/60 hover:text-orange-400 transition-colors p-2"
                          title="تأخير 10 ثوانٍ"
                        >
                          <Rewind size={22} fill="currentColor" fillOpacity={0.1} />
                        </button>

                        <button
                          onClick={togglePlay}
                          className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/40 hover:bg-orange-400 active:scale-95 transition-all"
                        >
                          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="translate-x-0.5" />}
                        </button>

                        <button 
                          onClick={() => seek(10)}
                          className="text-white/60 hover:text-orange-400 transition-colors p-2"
                          title="تقديم 10 ثوانٍ"
                        >
                          <FastForward size={22} fill="currentColor" fillOpacity={0.1} />
                        </button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart PDF Viewer */}
      <SmartPDFViewer 
        key={activePdf ? `${activePdf.url}_${activePdf.page || 'saved'}` : 'none'}
        isOpen={!!activePdf}
        url={activePdf?.url || ''}
        title={activePdf?.title || ''}
        initialPage={activePdf?.page}
        onClose={() => setActivePdf(null)}
      />
    </div>
  );
};

export default Library;
