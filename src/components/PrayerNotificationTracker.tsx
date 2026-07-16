/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, X, Music, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getPrayerTimes } from '../services/prayerService';
import { countries } from '../data/locations';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const MUEZZINS = [
  { nameAr: 'أباذر الحلواجي', nameEn: 'Abather Al-Halwachi', url: 'abathar.mp3' },
  { nameAr: 'نزار القطري', nameEn: 'Nazar Al-Qatari', url: 'nizar.mp3' },
  { nameAr: 'ميثم التمار', nameEn: 'Maitham Al-Tamar', url: 'maytham.mp3' },
  { nameAr: 'علي الكعبي', nameEn: 'Ali Al-Kaabi', url: 'alikaabi.mp3' },
  { nameAr: 'أسامة الكربلائي', nameEn: 'Osama Al-Karbalai', url: 'osama.mp3' },
  { nameAr: 'عامر الكاظمي', nameEn: 'Amer Al-Kazemi', url: 'amer.mp3' },
  { nameAr: 'هاني الموسوي', nameEn: 'Hani Al-Mousawi', url: 'hani.mp3' },
  { nameAr: 'شبر معله', nameEn: 'Shubbar Maala', url: 'shubbar.mp3' },
  { nameAr: 'روح الله كاظم زاده', nameEn: 'Rohullah Kazimzadeh', url: 'rohullah.mp3' },
  { nameAr: 'حسين علي شريف', nameEn: 'Hussein Ali Sharif', url: 'hussein.mp3' },
];

interface ActiveAdhan {
  prayerId: string;
  prayerNameAr: string;
  prayerNameEn: string;
  url: string;
  muezzinAr: string;
  muezzinEn: string;
}

const PrayerNotificationTracker: React.FC = () => {
  const { settings, resolvedCoords } = useApp();
  const isAr = settings.language === 'ar';

  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const playedAdhanKeysRef = useRef<Set<string>>(new Set());

  // Player state
  const [activeAdhan, setActiveAdhan] = useState<ActiveAdhan | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Ask for Notification Permission on mount for Android/iOS
  useEffect(() => {
    const requestPerms = async () => {
      try {
        const checkStatus = await LocalNotifications.checkPermissions();
        if (checkStatus.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch (err) {
        console.warn('POST_NOTIFICATIONS LocalNotifications permission request failed:', err);
      }
    };
    requestPerms();
  }, []);

  // 2. Schedule Local Notifications for next 7 days in background
  useEffect(() => {
    const syncBackgroundAlarms = async () => {
      try {
        // Enforce permissions check first
        const checkPerms = await LocalNotifications.checkPermissions();
        if (checkPerms.display !== 'granted') {
          console.log('Skipping background notification scheduling because permission not granted.');
          return;
        }

        // Read directly from localStorage as a fail-safe to guarantee immediate response with no state lag
        let storedAdhan = settings.selectedAdhanUrl || 'abathar.mp3';
        try {
          const rawSettings = localStorage.getItem('nahj_al_nur_settings');
          if (rawSettings) {
            const parsed = JSON.parse(rawSettings);
            if (parsed && parsed.selectedAdhanUrl) {
              storedAdhan = parsed.selectedAdhanUrl;
            }
          }
        } catch (e) {
          console.error('Error reading stored adhan url', e);
        }

        const rawBase = storedAdhan.toLowerCase().replace('.mp3', '').trim();
        const soundFile = rawBase + '.mp3';

        // Use a dynamic channel ID unique to the selected muezzin to overcome the write-once channel limitation on Android
        const channelId = `adhan_voice_channel_${rawBase}`;

        // Create Channel with ultimate max priority, lock-screen visibility & custom adhan sound file
        await LocalNotifications.createChannel({
          id: channelId,
          name: `قناة الأذان (${rawBase})`,
          description: 'تنبيهات أوقات الصلاة الدقيقة مع الأذان الكامل في الخلفية وبأعلى درجة أهمية لتجاوز السكون والصامت',
          importance: 5, // Ultimate Android high priority (IMPORTANCE_HIGH/MAX) to trigger sound on locked/doze states
          sound: soundFile, // Reference custom sound file mapped perfectly per platform
          vibration: true,
          visibility: 1 // VISIBILITY_PUBLIC: Show full notification content on lock screen
        });

        // Cancel existing pending notifications to prevent collision or duplicates
        const pending = await LocalNotifications.getPending();
        if (pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map(n => ({ id: n.id }))
          });
        }

        const coords = resolvedCoords;
        const now = new Date();
        const notificationBatch: any[] = [];
        const prayerKeys: ('fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha')[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

        // Loop next 7 days
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const checkDate = new Date();
          checkDate.setDate(now.getDate() + dayOffset);
          
          const times = getPrayerTimes(coords, settings.prayerOffsets, checkDate, settings.prayerAngles);
          
          prayerKeys.forEach((key, keyIndex) => {
            const isEnabled = settings.adhanEnabled[key];
            if (!isEnabled) return;

            const prayerTime = times[key];
            
            // Only alarm upcoming times we haven't crossed
            if (prayerTime.getTime() > now.getTime()) {
              const prayerArName = key === 'fajr' ? 'الفجر' : key === 'dhuhr' ? 'الظهر' : key === 'asr' ? 'العصر' : key === 'maghrib' ? 'المغرب' : 'العشاء';
              const prayerEnName = key.charAt(0).toUpperCase() + key.slice(1);
              
              // Unique numeric ID for each day's slot (e.g. 10 * offset + index)
              const id = (dayOffset * 10) + keyIndex + 1;

              notificationBatch.push({
                id,
                title: isAr ? `حان الآن موعد أذان ${prayerArName}` : `Time for ${prayerEnName} Prayer`,
                body: isAr 
                  ? `قم إلى الصلاة يرحمك الله، موعد صلاة ${prayerArName}.` 
                  : `Please prepare for the ${prayerEnName} prayer.`,
                schedule: { 
                  at: prayerTime,
                  allowWhileIdle: true // This guarantees Capacitor invokes the AlarmManager setExactAndAllowWhileIdle on Android
                },
                sound: soundFile, // Link the sound file name with correct built extension or base name
                channelId: channelId,
                smallIcon: 'notification_icon',
                localNotificationSchedule: { 
                  at: prayerTime,
                  allowWhileIdle: true
                }
              });
            }
          });
        }

        if (notificationBatch.length > 0) {
          await LocalNotifications.schedule({
            notifications: notificationBatch
          });
          console.log(`[Capacitor Notifications] Scheduled ${notificationBatch.length} background Adhan alarms successfully.`);
        }
      } catch (err) {
        console.warn('Failed to schedule local background adhan notifications:', err);
      }
    };

    syncBackgroundAlarms();
  }, [settings, resolvedCoords, isAr]);



  // Load previously notified and played keys from localStorage
  useEffect(() => {
    try {
      const savedAlerts = localStorage.getItem('notified_prayer_alerts');
      if (savedAlerts) {
        const parsed = JSON.parse(savedAlerts);
        if (Array.isArray(parsed)) {
          notifiedKeysRef.current = new Set(parsed);
        }
      }

      const savedPlayed = localStorage.getItem('played_adhan_alerts');
      if (savedPlayed) {
        const parsed = JSON.parse(savedPlayed);
        if (Array.isArray(parsed)) {
          playedAdhanKeysRef.current = new Set(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse logs from local storage', e);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(err => {
          console.warn('Notification permission request failed:', err);
        });
      }
    }

    const checkPrayers = () => {
      if (typeof window === 'undefined') return;

      // Get current location coords
      const coords = resolvedCoords;

      const now = new Date();
      
      // Calculate today's and tomorrow's prayer times
      const todayPrayers = getPrayerTimes(coords, settings.prayerOffsets, now, settings.prayerAngles);
      
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowPrayers = getPrayerTimes(coords, settings.prayerOffsets, tomorrow, settings.prayerAngles);

      const prayerKeys: ('fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha')[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
      const checkList: { id: string; nameAr: string; nameEn: string; time: Date }[] = [];

      // Add today's prayers
      prayerKeys.forEach(key => {
        checkList.push({
          id: key,
          nameAr: key === 'fajr' ? 'الفجر' : key === 'dhuhr' ? 'الظهر' : key === 'asr' ? 'العصر' : key === 'maghrib' ? 'المغرب' : 'العشاء',
          nameEn: key.charAt(0).toUpperCase() + key.slice(1),
          time: todayPrayers[key]
        });
      });

      // Add tomorrow's prayers (for safety if run near midnight)
      prayerKeys.forEach(key => {
        checkList.push({
          id: key,
          nameAr: key === 'fajr' ? 'الفجر' : key === 'dhuhr' ? 'الظهر' : key === 'asr' ? 'العصر' : key === 'maghrib' ? 'المغرب' : 'العشاء',
          nameEn: key.charAt(0).toUpperCase() + key.slice(1),
          time: tomorrowPrayers[key]
        });
      });

      checkList.forEach(prayer => {
        const isEnabled = settings.adhanEnabled[prayer.id as keyof typeof settings.adhanEnabled];
        if (!isEnabled) return;

        const diffMs = prayer.time.getTime() - now.getTime();
        const diffMins = diffMs / (60 * 1000);

        // 1. Dynamic Prayer Reminder Alert (Browser Notification) Based on User Settings
        if (settings.prayerAlertsEnabled) {
          const targetMin = settings.prayerAlertMinutesBefore !== undefined ? settings.prayerAlertMinutesBefore : 15;
          const lowerBound = targetMin - 0.5;
          const upperBound = targetMin + 0.5;

          if (diffMins >= lowerBound && diffMins <= upperBound) {
            if (Notification.permission === 'granted') {
              const uniqueKey = `alert_${targetMin}_${prayer.id}_${prayer.time.getFullYear()}_${prayer.time.getMonth()}_${prayer.time.getDate()}_${prayer.time.getHours()}`;

              if (!notifiedKeysRef.current.has(uniqueKey)) {
                notifiedKeysRef.current.add(uniqueKey);
                try {
                  localStorage.setItem('notified_prayer_alerts', JSON.stringify(Array.from(notifiedKeysRef.current)));
                } catch (e) {
                  console.error(e);
                }

                // Arabic-native elegant numeral and plural format
                const timeStrAr = targetMin === 5 ? '٥ دقائق' 
                  : targetMin === 10 ? '١٠ دقائق' 
                  : targetMin === 15 ? '١٥ دقيقة' 
                  : targetMin === 30 ? '٣٠ دقيقة' 
                  : `${targetMin} دقيقة`;

                const title = isAr 
                  ? `بقي ${timeStrAr} على صلاة ${prayer.nameAr}!`
                  : `${targetMin} minutes left until ${prayer.nameEn} prayer!`;
                
                const body = isAr
                  ? `اقترب موعد صلاة ${prayer.nameAr}، يرجى الاستعداد لأداء الصلاة في وقتها.`
                  : `The time for ${prayer.nameEn} prayer is approaching. Please prepare to pray.`;

                const notification = new Notification(title, {
                  body,
                  icon: '/logo.png',
                  badge: '/logo.png',
                  tag: uniqueKey,
                  requireInteraction: true,
                });

                notification.onclick = () => {
                  window.focus();
                  notification.close();
                };
              }
            }
          }
        }

        // 2. Play Adhan on exactly arrival of prayer time [Time Window: 0 to 2 minutes elapsed]
        // This ensures a 2-minute broad window to launch autoplay when page is open
        if (diffMs <= 0 && diffMs >= -120000) {
          const uniquePlayKey = `play_${prayer.id}_${prayer.time.getFullYear()}_${prayer.time.getMonth()}_${prayer.time.getDate()}_${prayer.time.getHours()}`;

          if (!playedAdhanKeysRef.current.has(uniquePlayKey)) {
            // Mark as triggered so we don't start multiple instances
            playedAdhanKeysRef.current.add(uniquePlayKey);
            try {
              localStorage.setItem('played_adhan_alerts', JSON.stringify(Array.from(playedAdhanKeysRef.current)));
            } catch (e) {
              console.error(e);
            }

            // Trigger actual audio play state
            const muezzin = MUEZZINS.find(m => m.url === settings.selectedAdhanUrl) || MUEZZINS[0];
            
            triggerAdhan(prayer, muezzin);
          }
        }
      });
    };

    const triggerAdhan = (
      prayer: { id: string; nameAr: string; nameEn: string; time: Date },
      muezzin: { nameAr: string; nameEn: string; url: string }
    ) => {
      if (Capacitor.getPlatform() === 'web') return;

      // Clear previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const activeObj: ActiveAdhan = {
        prayerId: prayer.id,
        prayerNameAr: prayer.nameAr,
        prayerNameEn: prayer.nameEn,
        url: muezzin.url,
        muezzinAr: muezzin.nameAr,
        muezzinEn: muezzin.nameEn
      };

      setActiveAdhan(activeObj);
      setIsPlaying(true);
      setIsMuted(false);
      setAutoplayBlocked(false);

      const audio = new Audio('/' + muezzin.url);
      audio.loop = false;
      audioRef.current = audio;

      audio.play()
        .then(() => {
          setAutoplayBlocked(false);
          setIsPlaying(true);
        })
        .catch(err => {
          console.warn('Autoplay blocked by browser. Showing manual click banner.', err);
          setAutoplayBlocked(true);
        });

      audio.onended = () => {
        handleStop();
      };

      audio.onerror = () => {
        console.warn(`Local adhan playback skipped/failed in browser preview: ${muezzin.url}`);
        handleStop();
      };
    };

    // Run first verification
    checkPrayers();

    // Check with precision every 5 seconds
    const interval = setInterval(checkPrayers, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [settings]);

  // Handle controls
  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(err => {
          console.error('Failed to resume playback', err);
        });
    }
  };

  const handleToggleMute = () => {
    if (!audioRef.current) return;
    const newMute = !isMuted;
    audioRef.current.muted = newMute;
    setIsMuted(newMute);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setActiveAdhan(null);
    setIsPlaying(false);
    setAutoplayBlocked(false);
  };

  const handleForcePlay = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setAutoplayBlocked(false);
          setIsPlaying(true);
        })
        .catch(err => {
          console.error('Failed to force play Adhan', err);
        });
    }
  };

  return (
    <div id="adhan-global-player-portal" className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[420px] z-[9999] pointer-events-none flex flex-col gap-4">
      <AnimatePresence>
        {activeAdhan && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className={`pointer-events-auto w-full rounded-[36px] overflow-hidden p-[2px] bg-gradient-to-tr ${
              isPlaying ? 'from-amber-500 via-orange-500 to-indigo-500 animate-gradient-xy' : 'from-slate-800 to-slate-900'
            } shadow-[0_32px_60px_-15px_rgba(0,0,0,0.6)]`}
          >
            <div className="w-full bg-slate-950/95 dark:bg-slate-900/98 backdrop-blur-2xl rounded-[34px] p-5 flex flex-col gap-4 text-white">
              
              {/* Top Details & Waveform */}
              <div className="flex items-center gap-4">
                {/* Simulated Pulse wave indicator */}
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex flex-col items-center justify-center relative overflow-hidden flex-shrink-0">
                  <Bell size={22} className={`text-amber-400 ${isPlaying ? 'animate-bounce' : ''}`} />
                  {isPlaying && (
                    <div className="absolute inset-0 flex items-end justify-center gap-[2px] pb-[6px] px-2 opacity-60">
                      <span className="w-[3px] h-3 bg-amber-400 rounded-full animate-pulse" />
                      <span className="w-[3px] h-5 bg-amber-400 rounded-full animate-pulse delay-75" />
                      <span className="w-[3px] h-2 bg-amber-400 rounded-full animate-pulse delay-150" />
                      <span className="w-[3px] h-4 bg-amber-400 rounded-full animate-pulse delay-300" />
                    </div>
                  )}
                </div>

                {/* Text Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-amber-400 text-black rounded-lg">LIVE ADHAN</span>
                    <span className="text-[10px] font-semibold text-white/40">
                      {isAr ? 'حان الآن موعد الصلاة' : 'Now is Prayer Time'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black mt-1 text-white flex items-center gap-1.5 leading-none">
                    {isAr ? `أذان صلاة ${activeAdhan.prayerNameAr}` : `${activeAdhan.prayerNameEn} Azan`}
                  </h3>
                  <p className="text-xs text-white/60 mt-1 truncate">
                    {isAr ? `بصوت المؤذن: ${activeAdhan.muezzinAr}` : `Recited by: ${activeAdhan.muezzinEn}`}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={handleStop}
                  className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all flex-shrink-0"
                  title={isAr ? 'إغلاق الأذان' : 'Stop Adhan'}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Interaction Required Warning / Tap to Start */}
              {autoplayBlocked && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex flex-col gap-2.5"
                >
                  <p className="text-[11px] text-amber-300 font-bold leading-relaxed">
                    {isAr 
                      ? 'قام المتصفح بحظر التشغيل التلقائي للصوت. يرجى الضغط على الزر أدناه للاستماع للأذان.'
                      : 'Your browser restricted automatic audio playback. Click the button below to listen.'}
                  </p>
                  <button
                    onClick={handleForcePlay}
                    className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl transition-all uppercase tracking-wide active:scale-[0.98]"
                  >
                    {isAr ? 'اضغط لتشغيل صوت الأذان' : 'Click to Play Adhan'}
                  </button>
                </motion.div>
              )}



              {/* Control Bar (shown only when not blocked) */}
              {!autoplayBlocked && (
                <div className="flex justify-between items-center bg-white/5 rounded-2xl p-2.5">
                  <div className="flex items-center gap-2">
                    {/* Play/Pause */}
                    <button
                      onClick={handleTogglePlay}
                      className="w-12 h-12 rounded-xl bg-amber-400 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all outline-none"
                    >
                      {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="translate-x-[1px]" fill="currentColor" />}
                    </button>

                    {/* Mute toggle */}
                    <button
                      onClick={handleToggleMute}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>

                  {/* Status Indicator text */}
                  <div className="px-3 text-[10px] font-black tracking-widest text-white/30 uppercase">
                    {isPlaying ? (isAr ? 'جاري التشغيل الآن' : 'Playing Now') : (isAr ? 'مؤقت' : 'Paused')}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PrayerNotificationTracker;
