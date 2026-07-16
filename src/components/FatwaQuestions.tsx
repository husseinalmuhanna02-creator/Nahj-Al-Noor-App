import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, Clock, CheckCircle2, AlertCircle, LogIn } from 'lucide-react';
import { fatwaService, FatwaQuestion } from '../services/fatwaService';
import { auth, db, isFirebaseEnabled } from '../services/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';

const FatwaQuestions: React.FC = () => {
  const [questions, setQuestions] = useState<FatwaQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth) {
      if (isFirebaseEnabled()) setError('فشل في تحميل إعدادات Firebase.');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setError(null);
      // Clean direct fetching of questions
      try {
        setIsLoading(true);
        const data = await fatwaService.getUserQuestions();
        setQuestions(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Fetch questions error on auth changed:', err);
        setError(err?.message || 'فشل في جلب قائمة الأسئلة.');
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const lastUpdateIdRef = useRef<number>(0);

  useEffect(() => {
    const savedOffset = localStorage.getItem('telegram_update_offset');
    if (savedOffset) {
      lastUpdateIdRef.current = parseInt(savedOffset, 10);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseEnabled() || !db) return;
    
    let active = true;
    let timerId: any = null;

    const pollTelegramUpdates = async () => {
      try {
        const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '8673039648:AAFd0npkMDfggj9voisJQxWdDlhdbKiGIww';
        const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID || '-1001716344540';
        
        const telegramToken = botToken ? String(botToken).trim() : null;
        let telegramChatId = chatId ? String(chatId).trim().replace(/['"]/g, '') : null;
        
        if (!telegramToken || !telegramChatId) return;

        if (!telegramChatId.startsWith('-')) {
          telegramChatId = telegramChatId.startsWith('100') ? `-${telegramChatId}` : `-100${telegramChatId}`;
        }

        const offset = lastUpdateIdRef.current ? lastUpdateIdRef.current + 1 : 0;
        const url = `https://api.telegram.org/bot${telegramToken}/getUpdates?offset=${offset}&timeout=5`;
        
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) return;

        const data = await res.json();
        if (!data.ok || !data.result || !Array.isArray(data.result)) return;

        for (const update of data.result) {
          if (!active) break;
          const updateId = update.update_id;
          if (updateId > lastUpdateIdRef.current) {
            lastUpdateIdRef.current = updateId;
            localStorage.setItem('telegram_update_offset', String(updateId));
          }

          const msg = update.message;
          if (msg && msg.reply_to_message && msg.text) {
            const repliedMsgId = String(msg.reply_to_message.message_id);
            const answerText = msg.text;
            const senderUserId = msg.from?.id;

            if (senderUserId) {
              const memberUrl = `https://api.telegram.org/bot${telegramToken}/getChatMember?chat_id=${telegramChatId}&user_id=${senderUserId}`;
              const memberProxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(memberUrl)}`;
              
              try {
                const memberRes = await fetch(memberProxyUrl);
                if (memberRes.ok) {
                  const memberData = await memberRes.json();
                  if (memberData.ok && memberData.result) {
                    const status = memberData.result.status;
                    if (status === 'creator' || status === 'administrator') {
                      console.log(`Verified Admin/Creator reply. Processing answer in Firestore...`);
                      
                      const qSnap = await getDocs(query(
                        collection(db, 'fatwa_questions'),
                        where('telegramMessageId', '==', repliedMsgId)
                      ));
                      
                      let updatedAny = false;
                      for (const docSnap of qSnap.docs) {
                        await updateDoc(docSnap.ref, {
                          answer: answerText,
                          status: 'answered',
                          answeredAt: new Date().toISOString()
                        });
                        updatedAny = true;
                      }

                      if (updatedAny) {
                        try {
                          const refreshed = await fatwaService.getUserQuestions();
                          setQuestions(Array.isArray(refreshed) ? refreshed : []);
                        } catch (refErr) {
                          console.error('Error refreshing UI list:', refErr);
                        }
                      }
                    } else {
                      console.warn(`Ignoring non-admin reply (status: ${status}) from user ID: ${senderUserId}`);
                    }
                  }
                }
              } catch (permError) {
                console.error('Error checking chat member status:', permError);
              }
            }
          }
        }
      } catch (pollError) {
        console.error('Telegram updates poll error:', pollError);
      } finally {
        if (active) {
          timerId = setTimeout(pollTelegramUpdates, 10000);
        }
      }
    };

    pollTelegramUpdates();

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      if (!auth) throw new Error('Auth not initialized');
      await signInAnonymously(auth);
    } catch (err: any) {
      if (err.code === 'auth/configuration-not-found') {
        setError('عذراً، يجب تفعيل "تسجيل الدخول المجهول" (Anonymous Auth) في لوحة تحكم Firebase للمشروع.');
      } else {
        setError('فشل في تسجيل الدخول مجهول الهوية.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const questionText = newQuestion.trim();
    if (!questionText || isLoading) return;

    try {
      setIsLoading(true);
      
      // Direct, standard Firestore query insertion
      const docRef = await addDoc(collection(db, 'fatwa_questions'), {
        userId: user?.uid || 'anonymous',
        text: questionText,
        question: questionText,
        status: 'pending',
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp()
      });

      // Send order-compliant Telegram notification silently in a separate block
      try {
        const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
        const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
        
        const telegramToken = botToken ? String(botToken).trim() : null;
        let telegramChatId = chatId ? String(chatId).trim().replace(/['"]/g, '') : null;
        
        const telegramMessage = `سؤال فقهي جديد من التطبيق:\n${questionText}`;
        let success = false;

        if (telegramToken && telegramChatId) {
          try {
            const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: telegramChatId,
                text: telegramMessage,
              }),
            });

            if (response.ok) {
              console.log('Telegram Success (Attempt 1)!');
              success = true;
              try {
                const data = await response.json();
                if (data.ok && data.result && data.result.message_id) {
                  const msgId = String(data.result.message_id);
                  await updateDoc(doc(db, 'fatwa_questions', docRef.id), {
                    telegramMessageId: msgId
                  });
                  console.log(`Saved telegramMessageId ${msgId} to Firestore.`);
                }
              } catch (jsonErr) {
                console.warn('Error parsing tg json or updating doc (Attempt 1):', jsonErr);
              }
            } else {
              const errText = await response.text();
              console.warn('Telegram Attempt 1 Note:', errText);
              
              // Auto-correction: if chatId does not start with a minus, but looks like a group/channel ID, try prepending '-' or '-100'
              if (errText.includes('chat not found') && !telegramChatId.startsWith('-')) {
                const correctedChatId = telegramChatId.startsWith('100') ? `-${telegramChatId}` : `-100${telegramChatId}`;
                console.log(`Retrying with auto-corrected Chat ID: ${correctedChatId}`);
                
                const retryResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    chat_id: correctedChatId,
                    text: telegramMessage,
                  }),
                });

                if (retryResponse.ok) {
                  console.log('Telegram Success after auto-correcting Chat ID!');
                  success = true;
                  try {
                    const data = await retryResponse.json();
                    if (data.ok && data.result && data.result.message_id) {
                      const msgId = String(data.result.message_id);
                      await updateDoc(doc(db, 'fatwa_questions', docRef.id), {
                        telegramMessageId: msgId
                      });
                    }
                  } catch (jsonErr) {
                    console.warn('Error parsing tg json or updating doc (Retry):', jsonErr);
                  }
                } else {
                  console.warn('Telegram Retry with auto-corrected ID Note:', await retryResponse.text());
                }
              }
            }
          } catch (directError) {
            console.warn('Telegram Attempt 1 failed with info:', directError);
          }
        }

        // Fallback: If configured custom telegram credentials failed or are missing, use working default bot
        if (!success) {
          console.log('Using robust default fallback Telegram configuration...');
          const DEFAULT_BOT_TOKEN = '8673039648:AAFd0npkMDfggj9voisJQxWdDlhdbKiGIww';
          const DEFAULT_CHAT_ID = '-1001716344540';
          
          try {
            const tgUrl = `https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/sendMessage?chat_id=${DEFAULT_CHAT_ID}&text=${encodeURIComponent(telegramMessage)}`;
            const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(tgUrl)}`;
            const fallbackRes = await fetch(proxyUrl);
            const fallbackData = await fallbackRes.json();
            if (fallbackData.ok) {
              console.log('Telegram Successfully sent via robust default fallback!');
              if (fallbackData.result && fallbackData.result.message_id) {
                const msgId = String(fallbackData.result.message_id);
                await updateDoc(doc(db, 'fatwa_questions', docRef.id), {
                  telegramMessageId: msgId
                });
              }
            } else {
              console.warn('Default fallback Telegram info:', fallbackData);
            }
          } catch (fError) {
            console.warn('Telegram Default fallback failed with info:', fError);
          }
        }
      } catch (tgError) {
        console.warn("⚠️ Failed to send Telegram notification (optional logic):", tgError);
      }
      
      setNewQuestion('');
      setError(null);
      // Refresh list with simple getDocs query immediately
      const refreshed = await fatwaService.getUserQuestions();
      setQuestions(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: any) {
      console.error("Submit error in UI:", err);
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isFirebaseEnabled()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <AlertCircle size={48} className="text-amber-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">قاعدة البيانات غير مهيأة</h2>
        <p className="text-natural-text/60 dark:text-dark-text/60">
          هذه الميزة تتطلب تهيئة Firebase. يرجى مراجعة المهندس.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <header className="p-6 pb-2">
        <h1 className="text-2xl font-bold text-natural-accent dark:text-white drop-shadow-sm">الأسئلة العقائدية والفقهية</h1>
        <p className="text-sm text-natural-text/60 dark:text-dark-text/60 mt-1">تواصل مع المختصين للحصول على إجابات لأسئلتك</p>
      </header>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm"
          >
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Questions List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-natural-text/40 dark:text-dark-text/40 italic">
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p>لا توجد أسئلة سابقة. ابدأ بطرح سؤالك الأول!</p>
          </div>
        ) : (
          questions.map((q) => (
            <motion.div
              key={q.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/30 dark:bg-slate-950/40 backdrop-blur-sm p-5 rounded-3xl shadow-sm border border-white/20 dark:border-white/5"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-natural-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-natural-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-natural-text dark:text-white font-medium leading-relaxed">{q.question || (q as any).text}</p>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-natural-text/40 dark:text-dark-text/40">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {q.timestamp?.toDate 
                        ? q.timestamp.toDate().toLocaleDateString('ar-IQ') 
                        : ((q.timestamp || (q as any).createdAt) 
                            ? new Date(q.timestamp || (q as any).createdAt).toLocaleDateString('ar-IQ') 
                            : 'جاري الإرسال...')}
                    </span>
                    <span className={`flex items-center gap-1 ${q.status === 'answered' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {q.status === 'answered' ? <CheckCircle2 size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      {q.status === 'answered' ? 'تمت الإجابة' : 'قيد الانتظار...'}
                    </span>
                  </div>
                </div>
              </div>

              {q.status === 'answered' && q.answer && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-natural-accent/5 dark:border-white/5"
                >
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <p className="text-natural-text/80 dark:text-dark-text/80 text-sm leading-relaxed whitespace-pre-wrap">
                      {q.answer}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 pt-2 bg-gradient-to-t from-natural-bg dark:from-dark-bg via-natural-bg/95 dark:via-dark-bg/95 to-transparent">
        <form 
          onSubmit={handleSubmit}
          className="relative block"
        >
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="اكتب سؤالك الفقهي هنا..."
            className="w-full bg-white/30 dark:bg-slate-950/40 backdrop-blur-sm rounded-[28px] py-4 pr-5 pl-14 shadow-xl border border-white/40 dark:border-white/10 focus:ring-2 focus:ring-natural-accent/50 outline-none resize-none transition-all dark:text-white"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!newQuestion.trim() || isLoading}
            className={`absolute left-2 bottom-2 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              newQuestion.trim() && !isLoading
                ? 'bg-natural-accent text-white shadow-lg shadow-natural-accent/30'
                : 'bg-natural-text/10 text-natural-text/40 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-center text-natural-text/30 dark:text-dark-text/30 mt-3">
          سيتم حفظ سؤالك بشكل خاص ولن يراه أحد غيرك والمختصين.
        </p>
      </div>
    </div>
  );
};

export default FatwaQuestions;
