import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MessageSquare, X, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { fatwaService, FatwaQuestion } from '../services/fatwaService';
import { auth, isFirebaseEnabled } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useApp } from '../context/AppContext';

interface NotificationToast {
  id: string;
  questionId: string;
  questionText: string;
}

const FatwaNotificationTracker: React.FC = () => {
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const { setActiveTab, settings } = useApp();
  const isAr = settings.language === 'ar';

  useEffect(() => {
    let unsubscribeQuestions: (() => void) | undefined;

    const setupTracking = async () => {
      if (!isFirebaseEnabled()) return;

      if (!auth) return;

      return onAuthStateChanged(auth, async (u) => {
        if (u) {
          try {
            const unsub = await fatwaService.subscribeToUserQuestions(
              (questions) => {
                const prevStatusesStr = localStorage.getItem('fatwa_question_statuses');
                const prevStatuses = prevStatusesStr ? JSON.parse(prevStatusesStr) : {};
                const newStatuses: Record<string, string> = { ...prevStatuses };
                const newToasts: NotificationToast[] = [];

                questions.forEach((q) => {
                  if (q.id) {
                    const prevStatus = prevStatuses[q.id];
                    
                    // Trigger notification ONLY if previous state was explicitly 'pending' and is now 'answered'
                    if (prevStatus === 'pending' && q.status === 'answered') {
                      const questionText = q.question || (q as any).text || '';
                      newToasts.push({
                        id: `${q.id}-${Date.now()}`,
                        questionId: q.id,
                        questionText: questionText.length > 60 ? `${questionText.substring(0, 60)}...` : questionText,
                      });
                    }

                    newStatuses[q.id] = q.status;
                  }
                });

                // Save updated statuses in Local Storage
                localStorage.setItem('fatwa_question_statuses', JSON.stringify(newStatuses));

                if (newToasts.length > 0) {
                  setToasts((prev) => [...prev, ...newToasts]);
                }
              },
              (err) => {
                console.error('Notification tracker subscription error:', err);
              }
            );
            unsubscribeQuestions = unsub;
          } catch (err) {
            console.error('Failed to setup question tracking:', err);
          }
        }
      });
    };

    const trackingPromise = setupTracking();

    return () => {
      trackingPromise.then((unsubAuth) => unsubAuth && unsubAuth());
      if (unsubscribeQuestions) unsubscribeQuestions();
    };
  }, []);

  const handleToastClick = (toast: NotificationToast) => {
    setActiveTab('fatwa');
    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
  };

  const handleDismiss = (e: React.MouseEvent, toastId: string) => {
    e.stopPropagation();
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  return (
    <div className="fixed top-6 right-6 left-6 md:left-auto md:w-[400px] z-[9999] pointer-events-none flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            className="pointer-events-auto w-full bg-slate-950/90 dark:bg-slate-900/95 backdrop-blur-xl border border-dark-accent/30 dark:border-emerald-500/20 text-white p-4 rounded-3xl shadow-2xl flex items-start gap-3 cursor-pointer hover:border-dark-accent hover:shadow-dark-accent/10 transition-colors"
            onClick={() => handleToastClick(toast)}
          >
            {/* Icon */}
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
              <CheckCircle2 size={20} className="animate-bounce" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <Bell size={14} className="text-dark-accent" />
                {isAr ? 'تمت الإجابة على سؤالك!' : 'Your question has been answered!'}
              </h4>
              <p className="text-xs text-white/80 mt-1 font-medium leading-relaxed truncate">
                {toast.questionText}
              </p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-dark-accent font-semibold">
                <span>{isAr ? 'اضغط هنا لقراءة الإجابة' : 'Click here to read the answer'}</span>
                <ChevronLeft size={10} className={isAr ? '' : 'rotate-180'} />
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={(e) => handleDismiss(e, toast.id)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default FatwaNotificationTracker;
