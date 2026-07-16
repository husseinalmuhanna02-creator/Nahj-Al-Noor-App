/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Cache-busting trigger for clean database reload - 2026-06-05T03:31:00Z
import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Book, Compass, Home as HomeIcon, MessageCircleQuestion, Settings as SettingsIcon, Sparkles, Image as ImageIcon, Tv, Moon, Sun, HeartHandshake } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import Home from './components/Home';
import Tasbih from './components/Tasbih';
import Settings from './components/Settings';
import FatwaNotificationTracker from './components/FatwaNotificationTracker';
import PrayerNotificationTracker from './components/PrayerNotificationTracker';
import { auth, isFirebaseEnabled } from './services/firebase';
import { signInAnonymously } from 'firebase/auth';

// Lazy load large/heavy components for fast startup and instant navigation responsiveness
const Library = lazy(() => import('./components/Library'));
import Zowar from './components/Zowar';
const PhotoGallery = lazy(() => import('./components/PhotoGallery'));
const Television = lazy(() => import('./components/Television'));
const Qibla = lazy(() => import('./components/Qibla'));
const FatwaQuestions = lazy(() => import('./components/FatwaQuestions'));

function MainLayout() {
  const { activeTab, setActiveTab, settings, updateSettings } = useApp();
  const isAr = settings.language === 'ar';

  useEffect(() => {
    const autoSignIn = async () => {
      if (isFirebaseEnabled()) {
        if (auth && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
            console.log('Signed in anonymously for cloud features');
          } catch (e) {
            console.warn('Auto anonymous sign-in failed', e);
          }
        }
      }
    };
    autoSignIn();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Home />;
      case 'tasbih': return <Tasbih />;
      case 'gallery': return <PhotoGallery />;
      case 'tv': return <Television />;
      case 'zowar': return <Zowar />;
      case 'library': return <Library />;
      case 'fatwa': return <FatwaQuestions />;
      case 'qibla': return <Qibla />;
      case 'settings': return <Settings />;
      default: return <Home />;
    }
  };

  const navItems = [
    { id: 'home', icon: HomeIcon, label: isAr ? 'الرئيسية' : 'Home' },
    { id: 'tasbih', icon: Sparkles, label: isAr ? 'المسبحة' : 'Tasbih' },
    { id: 'gallery', icon: ImageIcon, label: isAr ? 'المعرض' : 'Gallery' },
    { id: 'tv', icon: Tv, label: isAr ? 'التلفزيون' : 'TV' },
    { id: 'zowar', icon: HeartHandshake, label: isAr ? 'زوار' : 'Zowar' },
    { id: 'qibla', icon: Compass, label: isAr ? 'البوصلة' : 'Compass' },
    { id: 'fatwa', icon: MessageCircleQuestion, label: isAr ? 'الأسئلة' : 'Questions' },
    { id: 'library', icon: Book, label: isAr ? 'المكتبة' : 'Library' },
    { id: 'settings', icon: SettingsIcon, label: isAr ? 'الإعدادات' : 'Settings' },
  ];

  const glassCardClasses = "bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-[28px] shadow-xl";

  return (
    <div 
      className="flex flex-col h-screen text-dark-text font-sans transition-colors duration-500 bg-cover bg-center bg-fixed bg-no-repeat relative overflow-hidden"
      style={{ 
        backgroundImage: settings.backgroundImage ? `url("${settings.backgroundImage}")` : 'none'
      }}
    >
      {/* Background Overlay for better readability */}
      {settings.backgroundImage && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-0" />
      )}

      {/* Inside-app floating notifications tracker */}
      <FatwaNotificationTracker />
      <PrayerNotificationTracker />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-40 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="min-h-full"
          >
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-orange-400 gap-3">
                <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-sm font-arabic opacity-70">جاري التحميل...</span>
              </div>
            }>
              {renderContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Glassmorphic */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-card/60 backdrop-blur-xl px-4 py-3 flex justify-around items-center z-50 shadow-2xl rounded-t-[32px] border-t border-white/5">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 relative ${
                isActive 
                  ? 'text-dark-accent scale-110' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[10px] font-bold mt-0.5 sm:mt-1">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute -bottom-1 w-1 h-1 bg-dark-accent rounded-full"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

