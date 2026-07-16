/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { Globe, Bell, Calendar as CalendarIcon, MapPin, Moon, Sun, Palette, Image as ImageIcon, Music, Play, Pause, Sliders, MessageCircle, ChevronDown, Facebook, Instagram, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';

import { countries } from '../data/locations';

const BACKGROUNDS = [
  { id: 'default', labelAr: 'الافترضي', labelEn: 'Default', url: '' },
  { id: 'ali', labelAr: 'الإمام علي (ع)', labelEn: 'Imam Ali (as)', url: 'https://i.postimg.cc/mDnj96Mt/c8ec608b86c94b0d962dcf99f5f09048.jpg' },
  { id: 'hussain', labelAr: 'الإمام الحسين (ع)', labelEn: 'Imam Hussain (as)', url: 'https://i.postimg.cc/dVnx16WT/1559205391-2765.jpg' },
  { id: 'abbas', labelAr: 'أبي الفضل العباس (ع)', labelEn: 'Al-Abbas (as)', url: 'https://i.postimg.cc/Dwfxts2X/1602496196-6251.jpg' },
  { id: 'kadhim', labelAr: 'الإمام الكاظم (ع)', labelEn: 'Imam Kadhim (as)', url: 'https://i.postimg.cc/V6tgjWFq/aee5efb133c2eb3dd5321f09b9927743.jpg' },
  { id: 'askari', labelAr: 'الإمام العسكري (ع)', labelEn: 'Imam Askari (as)', url: 'https://i.postimg.cc/ZK4Hd3v7/FB-IMG-1777609747766.jpg' },
  { id: 'hussain_new', labelAr: 'الإمام الحسين عليه السلام', labelEn: 'Imam Hussain (as)', url: 'https://i.postimg.cc/D0M3XBGK/images-(6).jpg' },
];

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

const SOCIAL_LINKS = [
  {
    id: 'facebook',
    labelAr: 'فيسبوك',
    labelEn: 'Facebook',
    username: 'hu_ex',
    url: 'https://www.facebook.com/share/1LmShRijxG/',
    iconName: 'facebook',
    bgColor: 'bg-blue-600/10 dark:bg-blue-500/10',
    borderColor: 'border-blue-500/20 hover:border-blue-500/40',
    textColor: 'text-blue-400',
  },
  {
    id: 'instagram',
    labelAr: 'انستغرام',
    labelEn: 'Instagram',
    username: '@hu_ex',
    url: 'https://www.instagram.com/hu_ex?igsh=MW1mZGJhMThhMHNodQ==',
    iconName: 'instagram',
    bgColor: 'bg-pink-600/10 dark:bg-pink-500/10',
    borderColor: 'border-pink-500/20 hover:border-pink-500/40',
    textColor: 'text-pink-400',
  },
  {
    id: 'tiktok',
    labelAr: 'تيك توك',
    labelEn: 'TikTok',
    username: '@hu_mc',
    url: 'https://www.tiktok.com/@hu_mc?_r=1&_t=ZS-976jkei149Q',
    iconName: 'music',
    bgColor: 'bg-purple-600/10 dark:bg-purple-500/10',
    borderColor: 'border-purple-500/20 hover:border-purple-500/40',
    textColor: 'text-purple-400',
  },
  {
    id: 'telegram',
    labelAr: 'تلغرام',
    labelEn: 'Telegram',
    username: '@hu_gw',
    url: 'https://t.me/hu_gw',
    iconName: 'send',
    bgColor: 'bg-sky-500/10 dark:bg-sky-500/10',
    borderColor: 'border-sky-500/20 hover:border-sky-500/40',
    textColor: 'text-sky-400',
  }
];

const Settings: React.FC = () => {
  const { settings, updateSettings, gpsCoords, gpsError, isFetchingGps, gpsCityName, refreshGps } = useApp();
  const isAr = settings.language === 'ar';

  const [isContactOpen, setIsContactOpen] = React.useState(false);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [permission, setPermission] = React.useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window 
      ? Notification.permission 
      : 'default';
  });

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setPermission(result);
      } catch (e) {
        console.error('Failed to request notification permission', e);
      }
    }
  };

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = React.useRef<Promise<void> | null>(null);
  const isProcessingRef = React.useRef(false);

  const togglePreview = async (url: string) => {
    if (Capacitor.getPlatform() === 'web') return;
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    // Resolve local filenames to fully-qualified URLs for correct comparison against audioRef.current.src
    const resolvedUrl = url.startsWith('http') 
      ? url 
      : window.location.origin + (url.startsWith('/') ? url : '/' + url);

    try {
      // Handle switching to a different audio source or toggling existing
      if (audioRef.current && audioRef.current.src !== resolvedUrl) {
        if (playPromiseRef.current) {
          try {
            await playPromiseRef.current;
          } catch (e) {}
        }
        audioRef.current.pause();
        audioRef.current.src = '';
        setIsPreviewing(false);
        audioRef.current = null;
      }

      if (audioRef.current && audioRef.current.src === resolvedUrl) {
        if (isPreviewing) {
          if (playPromiseRef.current) {
            try {
              await playPromiseRef.current;
            } catch (e) {}
          }
          audioRef.current.pause();
          setIsPreviewing(false);
        } else {
          try {
            const promise = audioRef.current.play();
            playPromiseRef.current = promise;
            await promise;
            setIsPreviewing(true);
          } catch (error) {
            setIsPreviewing(false);
          } finally {
            playPromiseRef.current = null;
          }
        }
        return;
      }

      // New audio source
      const newAudio = new Audio(resolvedUrl);
      newAudio.onended = () => setIsPreviewing(false);
      newAudio.onerror = () => {
        setIsPreviewing(false);
      };
      audioRef.current = newAudio;
      
      try {
        const promise = newAudio.play();
        playPromiseRef.current = promise;
        await promise;
        setIsPreviewing(true);
      } catch (error) {
        setIsPreviewing(false);
      } finally {
        playPromiseRef.current = null;
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const selectedCountry = countries.find(c => c.nameEn === settings.country) || countries[0];
  const selectedCity = selectedCountry.cities.find(c => c.nameEn === settings.city) || selectedCountry.cities[0];

  const glassCardClasses = "bg-slate-900/40 backdrop-blur-md rounded-[40px] p-8 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] transition-all hover:bg-dark-card/50";

  const openExternalUrl = (url: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        window.open(url, '_system');
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error('Error opening external URL', e);
      window.open(url, '_blank');
    }
  };

  const getSocialIcon = (name: string, className: string) => {
    switch (name) {
      case 'facebook':
        return <Facebook size={18} className={className} />;
      case 'instagram':
        return <Instagram size={18} className={className} />;
      case 'music':
        return <Music size={18} className={className} />;
      case 'send':
        return <Send size={18} className={className} />;
      default:
        return <MessageCircle size={18} className={className} />;
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto flex flex-col gap-10 bg-transparent min-h-full transition-all duration-300 pb-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-black text-white font-serif-header tracking-tight">
          {isAr ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em]">
          {isAr ? 'تخصيص تجربة نهج النور' : 'Customize Nahj Al-Nur Experience'}
        </p>
        <div className="w-12 h-1 bg-dark-accent rounded-full" />
      </header>

      <div className="grid gap-8">
        {/* Contact Us Section */}
        <section 
          className={`${glassCardClasses} overflow-hidden cursor-pointer active:scale-[0.99] transition-transform`} 
          onClick={() => setIsContactOpen(!isContactOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="font-black text-base text-white">{isAr ? 'تواصل معنا' : 'Contact Us'}</h3>
                <p className="text-white/40 text-[10px] font-bold mt-0.5">
                  {isAr ? 'تابع حساباتنا الرسمية' : 'Follow our official channels'}
                </p>
              </div>
            </div>
            <div className="text-white/40">
              <motion.div animate={{ rotate: isContactOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={20} />
              </motion.div>
            </div>
          </div>

          <motion.div
            initial={false}
            animate={{ height: isContactOpen ? "auto" : 0, opacity: isContactOpen ? 1 : 0 }}
            className="overflow-hidden"
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
              {SOCIAL_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => openExternalUrl(link.url)}
                  className={`flex items-center gap-3 bg-white/5 hover:bg-white/10 p-4 rounded-3xl border border-white/10 ${link.borderColor} transition-all group hover:scale-[1.03] text-right duration-200`}
                >
                  <div className={`p-2.5 rounded-2xl ${link.bgColor} ${link.textColor} group-hover:scale-110 transition-transform flex items-center justify-center`}>
                    {getSocialIcon(link.iconName, link.textColor)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-black text-white leading-tight">{isAr ? link.labelAr : link.labelEn}</span>
                    <span className="text-[9px] text-white/40 truncate font-semibold mt-1">{link.username}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Background Selection Section */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Palette size={20} />
            </div>
            <h2 className="font-black text-base text-white">{isAr ? 'الخلفية الروحانية' : 'Spiritual Themes'}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => updateSettings({ backgroundImage: bg.url })}
                className={`relative h-28 rounded-[28px] overflow-hidden border-2 transition-all group ${
                  (settings.backgroundImage === bg.url || (!settings.backgroundImage && !bg.url)) 
                    ? 'border-natural-accent dark:border-dark-accent scale-[1.05] shadow-[0_20px_40px_-10px_rgba(180,83,9,0.3)] z-10' 
                    : 'border-white/20 dark:border-white/5 hover:border-white/40'
                }`}
              >
                {bg.url ? (
                  <img src={bg.url} alt={bg.labelEn} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-125" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-white/20 dark:bg-black/20 flex items-center justify-center">
                    <ImageIcon className="text-natural-dark/20 dark:text-white/10" size={28} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex items-end p-4">
                   <div className="flex flex-col items-start translate-y-1 group-hover:translate-y-0 transition-transform">
                     <span className="text-[10px] font-black text-white/90 drop-shadow-md">{isAr ? bg.labelAr : bg.labelEn}</span>
                     {(settings.backgroundImage === bg.url || (!settings.backgroundImage && !bg.url)) && <span className="text-[8px] font-black text-natural-accent/90 uppercase tracking-tighter">{isAr ? 'مُفعّل' : 'Active'}</span>}
                   </div>
                </div>
                {(settings.backgroundImage === bg.url || (!settings.backgroundImage && !bg.url)) && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-natural-accent dark:bg-dark-accent rounded-full flex items-center justify-center shadow-lg ring-4 ring-white/10 animate-scale-in">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Language Selection */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
              <Globe size={20} />
            </div>
            <h2 className="font-black text-base text-natural-dark dark:text-white">{isAr ? 'اللغة والتطبيق' : 'Language'}</h2>
          </div>
          <div className="flex bg-black/5 dark:bg-black/20 p-1.5 rounded-[20px] border border-white/10">
            <button
              onClick={() => updateSettings({ language: 'ar' })}
              className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                settings.language === 'ar' ? 'bg-white shadow-xl text-natural-accent' : 'text-natural-dark/40 dark:text-white/40'
              }`}
            >
              العربية
            </button>
            <button
              onClick={() => updateSettings({ language: 'en' })}
              className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                settings.language === 'en' ? 'bg-white shadow-xl text-natural-accent' : 'text-natural-dark/40 dark:text-white/40'
              }`}
            >
              English
            </button>
          </div>
        </section>

        {/* Location Section */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
              <MapPin size={20} />
            </div>
            <h2 className="font-black text-base text-natural-dark dark:text-white">{isAr ? 'الموقع الجغرافي' : 'Location Settings'}</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex justify-between items-center py-1">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-natural-dark/70 dark:text-white/50 uppercase tracking-[0.1em]">
                  {isAr ? 'تحديث تلقائي للموقع' : 'Auto-Detect Location'}
                </span>
                <p className="text-[9px] font-bold text-natural-dark/40 dark:text-white/30">{isAr ? 'استخدام مستشعر الـ GPS' : 'Use device GPS sensor'}</p>
              </div>
              <button 
                onClick={() => updateSettings({ autoLocation: !settings.autoLocation })}
                className={`w-14 h-8 rounded-full transition-all relative border border-white/20 ${settings.autoLocation ? 'bg-natural-dark dark:bg-dark-accent' : 'bg-black/5 dark:bg-white/5'}`}
              >
                <motion.div 
                  animate={{ x: settings.autoLocation ? 28 : 4 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-2xl"
                />
              </button>
            </div>

            {settings.autoLocation ? (
              <div className="space-y-4 pt-4">
                <div className="p-5 bg-white/60 dark:bg-black/20 rounded-[28px] border border-black/5 dark:border-white/10 flex flex-col gap-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-base font-black text-natural-dark dark:text-white">
                        {isFetchingGps 
                          ? (isAr ? 'جاري تحديد إحداثيات GPS...' : 'Detecting GPS coordinates...') 
                          : gpsCoords 
                            ? (isAr ? 'تم قفل إشارات الـ GPS بنجاح' : 'GPS Coordinates Fixed')
                            : (isAr ? 'في انتظار الإشارة...' : 'Awaiting GPS signal...')}
                      </span>
                      <span className="text-[9px] font-black text-natural-accent dark:text-dark-accent uppercase tracking-[0.2em] mt-1">
                        {isAr ? 'البحث عن الإحداثيات والتحويل العكسي' : 'Reverse Geocode Sync'}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-natural-accent/20 flex items-center justify-center shadow-lg">
                      <MapPin size={18} className="text-natural-accent animate-bounce" />
                    </div>
                  </div>

                  {gpsCityName && (
                    <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>{isAr ? `الموقع المكتشف: ${gpsCityName.ar}` : `Detected Location: ${gpsCityName.en}`}</span>
                    </div>
                  )}

                  {gpsCoords && (
                    <div className="p-4 bg-black/10 dark:bg-white/5 rounded-2xl flex justify-between items-center text-xs font-mono font-black text-natural-dark/80 dark:text-white/80 border border-white/5">
                      <span>{isAr ? 'خط العرض:' : 'Lat:'} <span className="text-natural-accent dark:text-dark-accent">{gpsCoords.lat.toFixed(6)}</span></span>
                      <span>{isAr ? 'خط الطول:' : 'Lng:'} <span className="text-natural-accent dark:text-dark-accent">{gpsCoords.lng.toFixed(6)}</span></span>
                    </div>
                  )}

                  {gpsError ? (
                    <p className="text-[10px] font-bold text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/10">
                      ⚠️ {isAr ? `خطأ GPS: ${gpsError}. تم تفعيل المدينة الاحتياطية (${selectedCity.nameAr}) تلقائياً.` : `GPS Error: ${gpsError}. Fallback to Backup City (${selectedCity.nameEn}).`}
                    </p>
                  ) : !gpsCoords && !isFetchingGps ? (
                    <p className="text-[10px] font-bold text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/10">
                      ⚠️ {isAr ? 'تعذر جلب إحداثيات الـ GPS حالياً. يرجى تفعيل تحديد الموقع بالهاتف والنقر على التحديث بالأسفل.' : 'Could not fetch GPS coordinates. Please enable mobile location services and refresh.'}
                    </p>
                  ) : null}

                  <button
                    onClick={() => refreshGps().catch((err) => console.log('GPS load error ignored', err))}
                    disabled={isFetchingGps}
                    className="w-full mt-1 py-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-xs rounded-2xl border border-emerald-500/20 dark:border-emerald-500/10 transition-all uppercase tracking-wider active:scale-[0.98] disabled:opacity-50"
                  >
                    {isFetchingGps 
                      ? (isAr ? 'جاري جلب إحداثيات GPS جديدة...' : 'Retrieving GPS coordinates...') 
                      : (isAr ? 'إعادة تحديد وتحديث موقع الـ GPS' : 'Update & Sync GPS Coordinates')}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Drodown Selectors - Always accessible for full personalization & backup setup */}
            <div className="space-y-5 pt-6 border-t border-white/10">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-black text-natural-dark dark:text-white uppercase tracking-tight">
                  {settings.autoLocation 
                    ? (isAr ? 'تخصيص المدينة والبلد الاحتياطي' : 'Customize Backup Location') 
                    : (isAr ? 'اختيار الموقع والمدينة يدوياً' : 'Manual Location Setup')
                  }
                </span>
                <p className="text-[9px] font-bold text-natural-dark/40 dark:text-white/30">
                  {isAr 
                    ? 'هذه الخيارات المنسدلة تُخفظ تلقائياً في ذاكرة المتصفح كمرجع دائم لجهازك.' 
                    : 'These dropdown choices are automatically cached on your device as permanent fallbacks.'}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-natural-dark/40 dark:text-white/30 uppercase tracking-[0.2em] ml-2">
                  {isAr ? 'الدولة' : 'Country'}
                </label>
                <select 
                  value={settings.country}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    const countryData = countries.find(c => c.nameEn === newCountry);
                    updateSettings({ 
                      country: newCountry, 
                      city: countryData ? countryData.cities[0].nameEn : settings.city 
                    });
                  }}
                  className="w-full bg-white/60 dark:bg-black/20 p-4 rounded-[20px] border border-black/5 dark:border-white/10 text-natural-dark dark:text-white text-sm font-black focus:outline-none backdrop-blur-md"
                >
                  {countries.map(c => (
                    <option key={c.nameEn} value={c.nameEn} className="bg-slate-900 text-white font-bold">{isAr ? c.nameAr : c.nameEn}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-natural-dark/40 dark:text-white/30 uppercase tracking-[0.2em] ml-2">
                  {isAr ? 'المدينة' : 'City'}
                </label>
                <select 
                  value={settings.city}
                  onChange={(e) => updateSettings({ city: e.target.value })}
                  className="w-full bg-white/60 dark:bg-black/20 p-4 rounded-[20px] border border-black/5 dark:border-white/10 text-natural-dark dark:text-white text-sm font-black focus:outline-none backdrop-blur-md"
                >
                  {selectedCountry.cities.map(city => (
                    <option key={city.nameEn} value={city.nameEn} className="bg-slate-900 text-white font-bold">{isAr ? city.nameAr : city.nameEn}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Hijri Adjustment */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <CalendarIcon size={20} />
            </div>
            <h2 className="font-black text-base text-natural-dark dark:text-white">{isAr ? 'التاريخ الهجري' : 'Hijri Offset'}</h2>
          </div>
          <div className="flex items-center justify-between bg-black/5 dark:bg-black/20 p-5 rounded-[28px] border border-white/10">
            <button 
              onClick={() => updateSettings({ hijriOffset: settings.hijriOffset - 1 })}
              className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-natural-accent dark:text-dark-accent font-black text-2xl active:scale-90 transition-all hover:bg-natural-accent hover:text-white border border-black/5 dark:border-transparent"
            >
              -
            </button>
            <div className="text-center">
              <span className="text-4xl font-mono font-black text-natural-dark dark:text-white tabular-nums tracking-tighter">
                {settings.hijriOffset > 0 ? `+${settings.hijriOffset}` : settings.hijriOffset}
              </span>
              <p className="text-[9px] text-natural-dark/40 dark:text-white/30 font-black uppercase tracking-[0.2em] mt-1">{isAr ? 'أيام' : 'Days'}</p>
            </div>
            <button 
              onClick={() => updateSettings({ hijriOffset: settings.hijriOffset + 1 })}
              className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-natural-accent dark:text-dark-accent font-black text-2xl active:scale-90 transition-all hover:bg-natural-accent hover:text-white border border-black/5 dark:border-transparent"
            >
              +
            </button>
          </div>
        </section>

        {/* Prayer Time Adjustments (Manual Offsets) */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
              <Bell size={20} />
            </div>
            <div className="flex flex-col">
              <h2 className="font-black text-base text-natural-dark dark:text-white">{isAr ? 'الاحتياط الشرعي' : 'Sharia Offsets'}</h2>
              <p className="text-[9px] font-bold text-natural-dark/40 dark:text-white/30 uppercase tracking-widest">{isAr ? 'تعديل يدوي لمواقيت الصلاة' : 'Manual Prayer Adjustments'}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {(Object.entries(settings.prayerOffsets || { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }) as [keyof typeof settings.prayerOffsets, number][]).map(([key, value]) => {
              const labels: Record<string, { ar: string, en: string }> = {
                fajr: { ar: 'الفجر', en: 'Fajr' },
                dhuhr: { ar: 'الظهر', en: 'Dhuhr' },
                asr: { ar: 'العصر', en: 'Asr' },
                maghrib: { ar: 'المغرب', en: 'Maghrib' },
                isha: { ar: 'العشاء', en: 'Isha' }
              };
              const label = labels[key as string] || { ar: key as string, en: key as string };
              
              return (
                <div key={key} className="flex items-center justify-between bg-black/5 dark:bg-black/10 p-3 px-5 rounded-[24px] border border-white/5">
                  <span className="text-[11px] font-black uppercase tracking-tight text-white/60">
                    {isAr ? label.ar : label.en}
                  </span>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => updateSettings({ 
                        prayerOffsets: { ...(settings.prayerOffsets || { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }), [key]: (value as number) - 1 } 
                      })}
                      className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 font-black hover:bg-white hover:text-natural-accent transition-all active:scale-95"
                    >
                      -
                    </button>
                    <span className="text-xl font-mono font-black text-white w-8 text-center tabular-nums">
                      {(value as number) > 0 ? `+${value}` : value}
                    </span>
                    <button 
                      onClick={() => updateSettings({ 
                        prayerOffsets: { ...(settings.prayerOffsets || { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }), [key]: (value as number) + 1 } 
                      })}
                      className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 font-black hover:bg-white hover:text-natural-accent transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-[10px] text-center font-bold text-natural-dark/30 dark:text-white/20 px-4 leading-relaxed italic">
            {isAr 
              ? '* يتم حساب المواقيت بناءً على طريقة معهد ليفا (قم المقدسة) افتراضياً. يمكنك إضافة دقائق احتياطية يدوياً لضمان دخول الوقت.' 
              : '* Times are calculated using the Leva Institute (Qom) method. Use offsets for manual Sharia precaution.'}
          </p>
        </section>

        {/* Angle Calibration Section */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/20">
              <Sliders size={20} />
            </div>
            <div className="flex flex-col">
              <h2 className="font-black text-base text-natural-dark dark:text-white leading-none">
                {isAr ? 'معايرة الزوايا الفلكية' : 'Angle Calibration'}
              </h2>
              <p className="text-[9px] font-bold text-natural-dark/40 dark:text-white/30 uppercase tracking-widest mt-1">
                {isAr ? 'ضبط زوايا انحطاط الشمس بدقة عشرية' : 'Calibrate solar depression angles'}
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            {(Object.entries(settings.prayerAngles || { fajr: 16.0, maghrib: 4.0, isha: 14.0 }) as [keyof typeof settings.prayerAngles, number][]).map(([key, value]) => {
              const labels: Record<string, { ar: string, en: string, descAr: string, descEn: string }> = {
                fajr: { 
                  ar: 'زاوية صلاة الفجر', 
                  en: 'Fajr Angle',
                  descAr: 'الزاوية الشرعية لظهور الفجر الصادق الفعلي (الافتراضي 16.0)',
                  descEn: 'Solar depression angle for true dawn astronomical twilight (Default 16.0)'
                },
                maghrib: { 
                  ar: 'زاوية صلاة المغرب', 
                  en: 'Maghrib Angle',
                  descAr: 'زاوية مغيب الشمس لذهاب الحمرة المشرقية (الافتراضي 4.0)',
                  descEn: 'Angular depression for vanishing eastern glow (Default 4.0)'
                },
                isha: { 
                  ar: 'زاوية صلاة العشاء', 
                  en: 'Isha Angle',
                  descAr: 'زاوية مغيب الشفق الأحمر بالكامل (الافتراضي 14.0)',
                  descEn: 'Solar depression angle for red twilight end (Default 14.0)'
                }
              };
              const label = labels[key as string] || { ar: key as string, en: key as string, descAr: '', descEn: '' };
              
              return (
                <div key={key} className="bg-black/5 dark:bg-black/10 p-5 rounded-[24px] border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-natural-dark dark:text-white">
                        {isAr ? label.ar : label.en}
                      </span>
                      <span className="text-[10px] text-natural-dark/60 dark:text-white/50">
                        {isAr ? label.descAr : label.descEn}
                      </span>
                    </div>
                    <span className="text-xl font-mono font-black text-natural-accent dark:text-dark-accent bg-black/20 px-3 py-1 rounded-xl">
                      {Number(value).toFixed(1)}°
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        const nextValue = Math.max(0, Number((value - 0.1).toFixed(1)));
                        updateSettings({
                          prayerAngles: { ...(settings.prayerAngles || { fajr: 16.0, maghrib: 4.0, isha: 14.0 }), [key]: nextValue }
                        });
                      }}
                      className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 font-black hover:bg-white hover:text-natural-accent transition-all active:scale-95"
                    >
                      -
                    </button>
                    
                    <input 
                      type="range"
                      min={key === 'maghrib' ? '0.0' : '10.0'}
                      max={key === 'maghrib' ? '10.0' : '20.0'}
                      step="0.1"
                      value={value}
                      onChange={(e) => {
                        const nextValue = parseFloat(e.target.value);
                        updateSettings({
                          prayerAngles: { ...(settings.prayerAngles || { fajr: 16.0, maghrib: 4.0, isha: 14.0 }), [key]: nextValue }
                        });
                      }}
                      className="flex-1 h-2 rounded-lg appearance-none bg-black/20 accent-natural-accent dark:accent-dark-accent cursor-pointer"
                    />

                    <button 
                      onClick={() => {
                        const nextValue = Math.min(25, Number((value + 0.1).toFixed(1)));
                        updateSettings({
                          prayerAngles: { ...(settings.prayerAngles || { fajr: 16.0, maghrib: 4.0, isha: 14.0 }), [key]: nextValue }
                        });
                      }}
                      className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/80 font-black hover:bg-white hover:text-natural-accent transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-[10px] text-center font-bold text-natural-dark/30 dark:text-white/20 px-4 leading-relaxed italic">
            {isAr 
              ? '* معايرة الزوايا الفلكية تتم مباشرة دون أي تعديل يدوي في دقائق الأوقات، لتعكس الحسابات الفيزيائية الشرعية الحقيقية.' 
              : '* Angular calibration operates directly in astronomical equations, enabling authentic, custom sharia-physical times.'}
          </p>
        </section>

        {/* Prayer Time Notifications */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 shadow-sm border border-rose-500/20">
              <Bell size={20} />
            </div>
            <div className="flex flex-col">
              <h2 className="font-black text-lg text-natural-dark dark:text-white leading-none">
                {isAr ? 'تنبيهات الصلاة' : 'Prayer Notifications'}
              </h2>
              <p className="text-[10px] font-bold text-natural-dark/40 dark:text-white/30 uppercase tracking-[0.1em] mt-1">
                {isAr ? 'تخصيص إشعارات الأذان' : 'Manage Azan Alerts'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Notification Permission Info */}
            {(() => {
              const alertMinutes = settings.prayerAlertMinutesBefore !== undefined ? settings.prayerAlertMinutesBefore : 15;
              const alertMinutesStrAr = alertMinutes === 5 ? '٥ دقائق' 
                : alertMinutes === 10 ? '١٠ دقائق' 
                : alertMinutes === 15 ? '١٥ دقيقة' 
                : alertMinutes === 30 ? '٣٠ دقيقة' 
                : `${alertMinutes} دقيقة`;
                
              return (
                <div className="flex flex-col gap-3 p-4 rounded-[24px] bg-amber-500/5 border border-amber-500/10 mb-2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Bell size={18} className="text-amber-600" />
                    </div>
                    <p className="text-[11px] font-bold text-amber-900/60 dark:text-amber-200/40 leading-relaxed">
                      {permission === 'granted' 
                        ? (isAr ? `إشعارات المتصفح مفعلة بنجاح وسيتم تنبيهك قبل الأذان بـ ${alertMinutesStrAr}.` : `Browser notifications are active; you will be alerted ${alertMinutes} minutes before Azan.`)
                        : (isAr ? `تأكد من السماح للمتصفح بإرسال الإشعارات لتلقي تنبيهات قبل الصلاة بـ ${alertMinutesStrAr}.` : `Please ensure browser notification permissions are granted to receive alerts ${alertMinutes} minutes before prayer.`)}
                    </p>
                  </div>
                  {permission !== 'granted' && (
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className="w-full mt-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-black font-black text-[11px] uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/10"
                    >
                      {isAr ? 'طلب إذن إشعارات المتصفح' : 'Request Notification Permission'}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Pre-prayer Reminder Alert Tuning Section */}
            <div className="p-5 bg-white/5 dark:bg-black/20 rounded-[28px] border border-white/10 flex flex-col gap-4 shadow-sm mb-2">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black text-natural-dark dark:text-white">
                    {isAr ? 'تنبيه مسبق قبل الصلاة' : 'Pre-Prayer Alerts'}
                  </span>
                  <span className="text-[10px] text-natural-dark/40 dark:text-white/40">
                    {isAr ? 'احصل على تذكير كافي للاستعداد والوضوء والتهيؤ للصلاة' : 'Get enough warm ups buffer for physical preparation & wudu'}
                  </span>
                </div>
                <button 
                  onClick={() => updateSettings({ prayerAlertsEnabled: !settings.prayerAlertsEnabled })}
                  className={`w-14 h-8 rounded-full transition-all relative border-2 ${
                    settings.prayerAlertsEnabled 
                      ? 'bg-natural-dark dark:bg-dark-accent border-transparent' 
                      : 'bg-transparent border-natural-dark/20 dark:border-white/20'
                  }`}
                >
                  <motion.div 
                    animate={{ x: settings.prayerAlertsEnabled ? 26 : 4 }}
                    className={`absolute top-1 w-5 h-5 rounded-full shadow-2xl transition-colors ${
                      settings.prayerAlertsEnabled ? 'bg-white' : 'bg-natural-dark/20 dark:bg-white/20'
                    }`}
                  />
                </button>
              </div>

              {settings.prayerAlertsEnabled && (
                <div className="flex flex-col gap-3 pt-3 border-t border-white/5 animate-scale-in">
                  <span className="text-[10px] font-black text-natural-dark/40 dark:text-white/30 uppercase tracking-[0.2em]">
                    {isAr ? 'أعلمني قبل دخول الوقت بـ:' : 'Notify me before time entry by:'}
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 30].map((mins) => {
                      const isActive = settings.prayerAlertMinutesBefore === mins;
                      return (
                        <button
                          key={mins}
                          onClick={() => updateSettings({ prayerAlertMinutesBefore: mins })}
                          className={`py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            isActive
                              ? 'bg-dark-accent text-white shadow-lg scale-105'
                              : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
                          }`}
                        >
                          {mins} {isAr ? 'د' : 'm'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {Object.entries(settings.adhanEnabled).map(([key, val]) => {
              const prayerLabels: Record<string, { ar: string, en: string, icon: React.ReactNode }> = {
                fajr: { ar: 'الفجر', en: 'Fajr', icon: <div className="w-2 h-2 rounded-full bg-blue-400" /> },
                dhuhr: { ar: 'الظهر', en: 'Dhuhr', icon: <div className="w-2 h-2 rounded-full bg-amber-400" /> },
                asr: { ar: 'العصر', en: 'Asr', icon: <div className="w-2 h-2 rounded-full bg-orange-400" /> },
                maghrib: { ar: 'المغرب', en: 'Maghrib', icon: <div className="w-2 h-2 rounded-full bg-indigo-500" /> },
                isha: { ar: 'العشاء', en: 'Isha', icon: <div className="w-2 h-2 rounded-full bg-slate-800" /> }
              };
              
              const info = prayerLabels[key as keyof typeof prayerLabels] || { ar: key, en: key, icon: null };
              const label = isAr ? info.ar : info.en;

              return (
                <div 
                  key={key} 
                  className={`flex justify-between items-center p-4 rounded-[28px] border transition-all duration-300 group ${
                    val 
                    ? 'bg-white/80 dark:bg-black/20 border-black/5 dark:border-white/10 shadow-sm' 
                    : 'bg-black/5 dark:bg-white/5 border-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl transition-all ${val ? 'bg-white shadow-md scale-110' : 'bg-transparent'}`}>
                      {info.icon}
                    </div>
                    <span className={`text-sm font-black uppercase tracking-tight ${val ? 'text-natural-dark dark:text-white' : 'text-natural-dark/40 dark:text-white/20'}`}>
                      {label}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => updateSettings({ 
                      adhanEnabled: { ...settings.adhanEnabled, [key]: !val } 
                    })}
                    className={`w-14 h-8 rounded-full transition-all relative border-2 ${
                      val 
                      ? 'bg-natural-dark dark:bg-dark-accent border-transparent' 
                      : 'bg-transparent border-natural-dark/20 dark:border-white/20'
                    }`}
                  >
                    <motion.div 
                      animate={{ x: val ? 26 : 4 }}
                      className={`absolute top-1 w-5 h-5 rounded-full shadow-2xl transition-colors ${
                        val ? 'bg-white' : 'bg-natural-dark/20 dark:bg-white/20'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Adhan Voice Selection */}
        <section className={glassCardClasses}>
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-500">
              <Bell size={20} />
            </div>
            <h2 className="font-black text-base text-natural-dark dark:text-white">{isAr ? 'صوت الأذان' : 'Adhan Voice'}</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <select
                value={settings.selectedAdhanUrl}
                onChange={(e) => updateSettings({ selectedAdhanUrl: e.target.value })}
                className="w-full bg-white/80 dark:bg-black/20 p-4 pl-12 pr-12 rounded-[24px] border border-black/5 dark:border-white/10 text-natural-dark dark:text-white text-sm font-black focus:outline-none backdrop-blur-md appearance-none rtl:text-right"
              >
                {MUEZZINS.map((m) => (
                  <option key={m.url} value={m.url} className="bg-white dark:bg-dark-card">
                    {isAr ? m.nameAr : m.nameEn}
                  </option>
                ))}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-natural-dark/40 dark:text-white/40">
                <Music size={18} />
              </div>
              <button
                onClick={() => togglePreview(settings.selectedAdhanUrl || MUEZZINS[0].url)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-natural-accent dark:bg-dark-accent text-white flex items-center justify-center shadow-lg active:scale-95 transition-all"
                title={isAr ? 'معاينة الصوت' : 'Preview Voice'}
              >
                {isPreviewing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
            </div>
          </div>
        </section>

      </div>
      
      <div className="text-center flex flex-col items-center gap-3 mt-12 mb-10">
        <p className="text-[10px] font-black text-natural-dark/40 dark:text-white/30 uppercase tracking-[0.4em]">Nahj al-Nur v1.1.2</p>
        <div className="w-16 h-1 bg-natural-accent/40 rounded-full" />
      </div>
    </div>
  );
};

export default Settings;
