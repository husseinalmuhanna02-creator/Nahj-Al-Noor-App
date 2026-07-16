import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, BookOpen } from 'lucide-react';

interface PDFViewerProps {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  initialPage?: number;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ url, title, isOpen, onClose, initialPage }) => {
  const getEmbedUrl = (baseUrl: string, page?: number) => {
    if (!baseUrl) return '';

    const isWordFile = baseUrl.toLowerCase().includes('.doc') || baseUrl.toLowerCase().includes('.docx');
    const isDriveLink = baseUrl.includes('drive.google.com');
    const isOriginalPreview = baseUrl.endsWith('/preview');

    if (isWordFile || (isDriveLink && !isOriginalPreview)) {
      return `https://docs.google.com/gview?url=${encodeURIComponent(baseUrl)}&embedded=true`;
    }

    let finalUrl = baseUrl;
    // If it's a google drive link, make sure it's in preview mode
    if (baseUrl.includes('drive.google.com') && !baseUrl.includes('/preview')) {
      finalUrl = baseUrl.replace('/view', '/preview');
    }
    
    if (page && page > 1) {
      // Many viewers use #page=N or &page=N
      // Google Drive viewer is picky. Sometimes it respects #page=N
      return `${finalUrl}#page=${page}`;
    }
    return finalUrl;
  };

  const handleOpenExternal = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-3xl flex flex-col"
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between bg-black/50 border-b border-white/10">
            <button 
              onClick={onClose} 
              className="px-4 py-2 hover:bg-white/5 rounded-xl transition-colors font-bold text-sm text-white/70 cursor-pointer"
            >
              إغلاق
            </button>
            
            <div className="text-center">
              <h3 className="font-bold text-orange-400 text-sm md:text-base truncate max-w-[200px] md:max-w-md">
                {title}
              </h3>
            </div>

            <button 
              onClick={handleOpenExternal}
              className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center hover:bg-orange-500/20 transition-all cursor-pointer"
              title="فتح في نافذة خارجية"
            >
              <ExternalLink size={18} />
            </button>
          </div>

          {/* Main Viewer Area */}
          <div className="flex-1 bg-zinc-900 overflow-hidden relative flex items-center justify-center select-none font-arabic" dir="rtl">
            {url ? (
              <iframe
                id="pdf-viewer-iframe"
                src={getEmbedUrl(url, initialPage)}
                className="w-full h-full border-none bg-white"
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

export default PDFViewer;
