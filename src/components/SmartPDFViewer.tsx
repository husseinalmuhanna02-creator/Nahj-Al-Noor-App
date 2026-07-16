import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Bookmark, Info, ChevronRight, ChevronLeft, BookOpen, ExternalLink } from 'lucide-react';

interface Props {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  initialPage?: number;
}

const SmartPDFViewer: React.FC<Props> = ({ url, title, isOpen, onClose, initialPage }) => {
  const [pageNumber, setPageNumber] = useState<number>(initialPage || 1);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [savedPage, setSavedPage] = useState<number | null>(null);
  const [showTargetBanner, setShowTargetBanner] = useState(false);

  const isWebPub = url?.includes('/pub') || url?.includes('docs.google.com') || url?.toLowerCase().includes('.doc') || url?.toLowerCase().includes('.docx');

  // Helper to format embed url
  const getEmbedUrl = (baseUrl: string, page: number): string => {
    if (!baseUrl) return '';

    const isWordFile = baseUrl.toLowerCase().includes('.doc') || baseUrl.toLowerCase().includes('.docx');
    const isDriveLink = baseUrl.includes('drive.google.com');
    const isOriginalPreview = baseUrl.endsWith('/preview');

    if (isWordFile || (isDriveLink && !isOriginalPreview)) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(baseUrl)}&embedded=true`;
    }

    if (baseUrl.includes('/pub') || baseUrl.includes('docs.google.com')) {
      return baseUrl;
    }

    let cleanUrl = baseUrl.replace('/view', '/preview');
    if (page > 1) {
      return `${cleanUrl}#page=${page}`;
    }
    return cleanUrl;
  };

  // Restore or load positions
  useEffect(() => {
    if (isOpen && url) {
      if (typeof initialPage === 'number' && initialPage > 0) {
        setPageNumber(initialPage);
        setShowContinuePrompt(false);
        setSavedPage(null);
        setShowTargetBanner(true);
      } else {
        if (url.includes('/pub') || url.includes('docs.google.com')) {
          setPageNumber(1);
          setShowContinuePrompt(false);
          setSavedPage(null);
          setShowTargetBanner(false);
          return;
        }
        const saved = localStorage.getItem('pdf_page_' + url);
        if (saved) {
          const page = parseInt(saved);
          if (page > 1) {
            setSavedPage(page);
            setPageNumber(page);
            setShowContinuePrompt(true);
            setShowTargetBanner(false);
            const timer = setTimeout(() => {
              setShowContinuePrompt(false);
            }, 6050);
            return () => clearTimeout(timer);
          } else {
            setPageNumber(1);
            setShowContinuePrompt(false);
            setShowTargetBanner(false);
          }
        } else {
          setPageNumber(1);
          setShowContinuePrompt(false);
          setShowTargetBanner(false);
        }
      }
    } else {
      setShowContinuePrompt(false);
      setSavedPage(null);
      setShowTargetBanner(false);
    }
  }, [isOpen, url, initialPage]);

  // Sync state if initialPage changes on runtime
  useEffect(() => {
    if (typeof initialPage === 'number' && initialPage > 0) {
      setPageNumber(initialPage);
      setShowContinuePrompt(false);
      setSavedPage(null);
      setShowTargetBanner(true);
    }
  }, [initialPage]);

  // Save progress
  useEffect(() => {
    if (isOpen && url && pageNumber > 1) {
      localStorage.setItem('pdf_page_' + url, pageNumber.toString());
    }
  }, [pageNumber, url, isOpen]);

  const handleDownload = () => {
    if (url?.includes('/pub') || url?.includes('docs.google.com')) {
      window.open(url, '_blank');
    } else {
      window.open(url.replace('/preview', '/view'), '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-zinc-950 flex flex-col font-arabic select-none"
          dir="rtl"
        >
          {/* Top Header */}
          <div className="h-16 relative flex items-center justify-between px-4 bg-white dark:bg-black border-b border-black/5 dark:border-white/5 z-10 shadow-sm transition-colors duration-500 gap-2">
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-zinc-700 dark:text-zinc-300"
                title="إغلاق"
              >
                <X size={20} />
              </button>
              <div className="hidden md:block h-8 w-px bg-black/10 dark:bg-white/10" />
              <h3 className="text-sm font-bold text-orange-400 truncate max-w-[200px] md:max-w-md">
                {title}
              </h3>
            </div>

            {/* Middle navigation manual fallback */}
            {isWebPub ? (
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold text-orange-400">
                <span>⚡ صفحة ويب سريعة التحميل</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-black/5 dark:bg-zinc-900 rounded-xl p-1 border border-black/5 dark:border-white/5">
                  <button 
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                    className="w-8 h-8 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-20 rounded-lg transition-all text-zinc-800 dark:text-white cursor-pointer"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <div className="px-2 flex items-center gap-1 min-w-[70px] justify-center text-xs">
                    <span className="font-bold text-zinc-400">صفحة</span>
                    <input 
                      type="number" 
                      value={pageNumber}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > 0) setPageNumber(val);
                      }}
                      className="w-8 bg-transparent text-center font-bold outline-none text-zinc-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button 
                    onClick={() => setPageNumber(p => p + 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all text-zinc-800 dark:text-white cursor-pointer"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button 
                onClick={handleDownload}
                className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center hover:bg-orange-500/20 transition-all shadow-lg shadow-orange-500/5 cursor-pointer"
                title={isWebPub ? "فتح في نافذة خارجية" : "تحميل الكتاب"}
              >
                {isWebPub ? <ExternalLink size={18} /> : <Download size={18} />}
              </button>
            </div>
          </div>

          {/* Target Page Prompt/Banner for User */}
          {showTargetBanner && initialPage && (
            <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-3 flex items-center justify-between gap-3 text-amber-800 dark:text-amber-300 transition-colors duration-500">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-amber-500 shrink-0" />
                <span className="text-xs md:text-sm font-semibold">
                  💡 نتيجة البحث التي تبحث عنها موجودة في الصفحة رقم: <span className="font-bold underline text-amber-600 dark:text-amber-400 text-sm md:text-base mx-0.5">{initialPage}</span>. يرجى التمرير إليها.
                </span>
              </div>
              <button
                onClick={() => setShowTargetBanner(false)}
                className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors cursor-pointer"
                title="إغلاق التنبيه"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Main Viewer Area */}
          <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-900 overflow-hidden flex items-center justify-center select-none font-arabic" dir="rtl">
            {url ? (
              <iframe
                id="doc-viewer-iframe"
                src={getEmbedUrl(url, pageNumber)}
                className="w-full h-full border-none bg-white dark:bg-zinc-900"
                title={title}
                allow="autoplay"
              />
            ) : (
              <div className="text-zinc-400 text-sm">
                ملف الكتاب غير متاح
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SmartPDFViewer;
