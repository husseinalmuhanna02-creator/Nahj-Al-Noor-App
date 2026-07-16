/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getHijriDate, getPrayerTimes } from '../services/prayerService';
import { Clock, MapPin, Youtube, Play, ArrowLeftRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

import { countries } from '../data/locations';
import { suggestedVideos } from '../data/videos';
import HijriCalendar from './HijriCalendar';

const Home: React.FC = () => {
  const { settings, resolvedCoords, gpsCityName } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSilverGlow, setIsSilverGlow] = useState(false);
  const [showSolar, setShowSolar] = useState(false);
  const pressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const wasLongPressed = React.useRef(false);
  const isAr = settings.language === 'ar';

  // Helper to convert Gregorian to Solar Hijri (Persian/Jalali) Date
  const getSolarHijriDate = (date: Date, locale: 'ar' | 'en'): string => {
    const g_y = date.getFullYear();
    const g_m = date.getMonth() + 1;
    const g_d = date.getDate();

    const g_days_in_month = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const isLeapG = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (isLeapG(g_y)) {
      g_days_in_month[2] = 29;
    }

    let gy = g_y - 1600;
    let gm = g_m - 1;
    let gd = g_d - 1;

    let g_day_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);

    for (let i = 0; i < gm; ++i) {
      g_day_no += g_days_in_month[i + 1];
    }
    g_day_no += gd;

    let j_day_no = g_day_no - 79;

    const j_np = Math.floor(j_day_no / 12053);
    j_day_no %= 12053;

    let jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
    j_day_no %= 1461;

    if (j_day_no >= 366) {
      jy += Math.floor((j_day_no - 1) / 365);
      j_day_no = (j_day_no - 1) % 365;
    }

    let jm = 0;
    let jd = 0;
    if (j_day_no < 186) {
      jm = 1 + Math.floor(j_day_no / 31);
      jd = 1 + (j_day_no % 31);
    } else {
      jm = 7 + Math.floor((j_day_no - 186) / 30);
      jd = 1 + ((j_day_no - 186) % 30);
    }

    const jalaliMonthsAr = [
      "فروردين", "أرديبهشت", "خرداد", "تير", "مرداد", "شهريور",
      "مهر", "آبان", "آذر", "دي", "بهمن", "اسفند"
    ];

    const jalaliMonthsEn = [
      "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
      "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"
    ];

    const monthName = locale === 'ar' ? jalaliMonthsAr[jm - 1] : jalaliMonthsEn[jm - 1];

    if (locale === 'ar') {
      const toArNum = (n: number) => n.toString().split('').map(c => '٠١٢٣٤٥٦٧٨٩'[parseInt(c)] || c).join('');
      return `${toArNum(jd)} ${monthName} ${toArNum(jy)} هـ.ش`;
    } else {
      return `${jd} ${monthName} ${jy} SH`;
    }
  };

  const solarHijri = getSolarHijriDate(currentTime, isAr ? 'ar' : 'en');

  const handleStart = () => {
    wasLongPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);

    pressTimer.current = setTimeout(() => {
      wasLongPressed.current = true;
      setShowSolar(prev => !prev);
      setIsSilverGlow(true);
      setTimeout(() => setIsSilverGlow(false), 1000);
    }, 600);
  };

  const handleEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerClick = () => {
    if (!wasLongPressed.current) {
      setIsSilverGlow(true);
      setTimeout(() => setIsSilverGlow(false), 1000);
    }
  };

  // Find coordinates based on selected city/country for label fallbacks
  const selectedCountry = countries.find(c => c.nameEn === settings.country) || countries[0];
  const selectedCity = selectedCountry.cities.find(c => c.nameEn === settings.city) || selectedCountry.cities[0];
  
  const coords = resolvedCoords;
  const prayers = getPrayerTimes(coords, settings.prayerOffsets, new Date(), settings.prayerAngles);
  const hijri = getHijriDate(settings.hijriOffset, isAr ? 'ar' : 'en');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const prayerList = [
    { name: isAr ? 'الفجر' : 'Fajr', time: prayers.fajr },
    { name: isAr ? 'الشروق' : 'Sunrise', time: prayers.sunrise },
    { name: isAr ? 'الظهر' : 'Dhuhr', time: prayers.dhuhr },
    { name: isAr ? 'العصر' : 'Asr', time: prayers.asr },
    { name: isAr ? 'المغرب' : 'Maghrib', time: prayers.maghrib },
    { name: isAr ? 'العشاء' : 'Isha', time: prayers.isha },
    { name: isAr ? 'منتصف الليل' : 'Midnight', time: (prayers as any).midnight },
  ];

  // Find next prayer
  const nextPrayer = prayerList.find(p => p.time > currentTime) || prayerList[0];
  const diff = nextPrayer.time.getTime() - currentTime.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  const glassCardClasses = "bg-slate-900/40 backdrop-blur-md rounded-[40px] p-8 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] transition-all hover:bg-dark-card/50";

  return (
    <div className="p-6 flex flex-col gap-10 max-w-lg mx-auto w-full">
      {/* Header Section */}
      <header className="flex justify-between items-center border-b border-dark-accent/20 pb-4">
        <div className="flex flex-col gap-1">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/25 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-2 shadow-sm shrink-0">
            <BookOpen size={24} className="stroke-[2.5]" />
          </div>
          <h1 className="text-4xl font-black text-white">
            <span className="text-[9px] text-dark-accent block mb-1">
              Nahj Al-Nur &bull; Path of Light
            </span>
          </h1>
        </div>

        <div className="text-left flex items-center gap-4">
          <div className="text-right flex flex-col items-end">
            <div className="flex items-center gap-2 select-none justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSolar(prev => !prev);
                  setIsSilverGlow(true);
                  setTimeout(() => setIsSilverGlow(false), 1000);
                }}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 hover:text-dark-accent active:scale-95 transition-all border border-white/5 text-white/60 cursor-pointer flex items-center justify-center shadow-lg"
                title={isAr ? "تبديل سريع بين التاريخ الهجري القمري والشمسي" : "Quick Toggle: Lunar / Solar Hijri"}
              >
                <ArrowLeftRight size={13} className="transition-transform duration-300 hover:rotate-180" />
              </button>

              <motion.p 
                id="hijri-date" 
                layout
                className="text-lg font-black text-dark-accent leading-tight cursor-pointer select-none transition-all duration-300 active:scale-95 text-right flex items-center" 
                onMouseDown={handleStart}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchEnd={handleEnd}
                onClick={handlePointerClick}
                style={{ 
                  textShadow: isSilverGlow ? '0 0 14px rgba(226, 232, 240, 0.95)' : '0 0 8px rgba(245, 158, 11, 0.6)' 
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={showSolar ? "solar" : "lunar"}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="inline-block"
                  >
                    {showSolar ? solarHijri : hijri}
                  </motion.span>
                </AnimatePresence>
              </motion.p>
            </div>
            <p id="gregorian-date" className="text-[10px] text-white/40 font-black uppercase tracking-tight mt-1">
              {format(currentTime, isAr ? 'EEEE، d MMMM yyyy' : 'EEEE, d MMMM yyyy', { locale: isAr ? ar : enUS })}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white shadow-lg border border-white/20">
            <Clock size={20} />
          </div>
        </div>
      </header>

      {/* Hero Section / Next Prayer */}
      <motion.div 
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-slate-900/40 backdrop-blur-md rounded-[48px] p-12 border border-white/10 flex flex-col items-center justify-center relative shadow-[0_48px_96px_-24px_rgba(0,0,0,0.15)] text-center overflow-hidden"
      >
        {/* Animated Glows */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-0 right-0 w-48 h-48 bg-dark-accent/20 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" 
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], rotate: [0, -90, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute bottom-0 left-0 w-48 h-48 bg-dark-accent/10 blur-[80px] rounded-full -ml-20 -mb-20 pointer-events-none" 
        />

        <div className="absolute top-8 text-dark-accent text-[11px] font-black tracking-[0.4em] uppercase opacity-80">
          {isAr ? 'الصلاة القادمة' : 'Next Prayer'}
        </div>
        
        <div className="flex flex-col items-center gap-2 mb-8 mt-6 relative z-10">
          <h3 className="text-5xl md:text-7xl font-black text-white font-serif-header tracking-tighter drop-shadow-md">
            {nextPrayer.name}
          </h3>
          <div className="bg-white/5 px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
            <div className="w-2 h-2 bg-dark-accent rounded-full animate-pulse" />
            <p className="text-[11px] font-black text-white/50 uppercase tracking-widest font-mono">
              -{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
          </div>
        </div>

        <div className="text-4xl font-mono font-black text-dark-accent bg-black/20 backdrop-blur-2xl px-12 py-5 rounded-[32px] border border-white/10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] relative z-10 transition-all hover:scale-110 active:scale-95 group">
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px]" />
          {format(nextPrayer.time, 'HH:mm')}
        </div>
      </motion.div>
      
      {/* Hijri Calendar Section below Prayer Clock */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
      >
        <HijriCalendar />
      </motion.div>
      
      {/* Suggested Videos Section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="space-y-4"
      >
        <div className="flex justify-between items-end px-2">
          <h3 className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-2">
            <Youtube size={14} className="text-red-500" />
            {isAr ? 'فيديوهات مقترحة' : 'Suggested Videos'}
          </h3>
          <span className="text-[10px] font-bold text-dark-accent opacity-60">
            {isAr ? 'عرض الكل' : 'View All'}
          </span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar snap-x snap-mandatory">
          {suggestedVideos.map((video, index) => (
            <motion.a
              key={index}
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 w-44 snap-start group"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/10 mb-2">
                <img 
                  src={video.thumbnailUrl} 
                  alt={video.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform duration-300">
                    <Play size={20} fill="currentColor" />
                  </div>
                </div>
              </div>
              <h4 className="text-[12px] font-black text-white/80 line-clamp-2 leading-snug group-hover:text-dark-accent transition-colors">
                {video.title}
              </h4>
            </motion.a>
          ))}
        </div>
      </motion.div>

      {/* Grid of Prayers (Quick View) */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={glassCardClasses}
      >
        <div className="flex flex-col gap-1 mb-8">
          <h2 className="text-lg font-black text-white uppercase tracking-tight">
            {isAr ? 'جدول الصلوات' : "Prayer Schedule"}
          </h2>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30">
             <MapPin size={10} />
             <span>
               {settings.autoLocation
                 ? (gpsCityName 
                     ? (isAr ? `تحديد تلقائي: ${gpsCityName.ar}` : `Auto GPS: ${gpsCityName.en}`)
                     : (isAr 
                         ? `الموقع الفعلي (${coords.lat.toFixed(4)}، ${coords.lng.toFixed(4)})` 
                         : `GPS Position (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
                       )
                   )
                 : `${isAr ? selectedCity.nameAr : selectedCity.nameEn}، ${isAr ? selectedCountry.nameAr : selectedCountry.nameEn}`}
             </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {prayerList.filter(p => !['Sunrise', 'الشروق'].includes(p.name)).map((p) => {
            const isNext = p === nextPrayer;
            return (
              <div 
                key={p.name}
                className={`flex flex-col items-center gap-2 p-3 rounded-[24px] border transition-all duration-300 ${
                  isNext 
                  ? 'bg-dark-accent text-white border-transparent shadow-xl scale-110 z-10' 
                  : 'bg-black/20 text-white border-white/5'
                }`}
              >
                <span className={`text-[8px] font-black uppercase ${isNext ? 'opacity-70' : 'opacity-40'}`}>{p.name}</span>
                <span className={`text-xs font-mono font-black tabular-nums tracking-tighter ${isNext ? 'text-white' : ''}`}>
                  {format(p.time, 'HH:mm')}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Detailed Schedule List */}
      <div className="space-y-4">
        <h3 className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] ml-4 flex items-center gap-4">
          {isAr ? 'تفاصيل المواعيد' : 'Full Daily Schedule'}
          <div className="flex-1 h-[1px] bg-white/10" />
        </h3>
        <div className="grid gap-3">
          {prayerList.map((p, i) => {
            const isNext = p === nextPrayer;
            return (
              <motion.div
                key={p.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`flex justify-between items-center p-6 rounded-[32px] border backdrop-blur-md transition-all duration-500 overflow-hidden relative group ${
                  isNext 
                  ? 'bg-dark-accent text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)] scale-[1.05] border-transparent z-10' 
                  : 'bg-slate-900/40 text-white border-white/5 hover:bg-dark-card/50'
                }`}
              >
                {isNext && (
                  <motion.div 
                    animate={{ x: [-200, 400] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" 
                  />
                )}
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-2 h-2 rounded-full ${isNext ? 'bg-white animate-pulse' : 'bg-dark-accent opacity-40'}`} />
                  <span className={`font-black text-base tracking-tight ${isNext ? 'text-white' : 'text-white/70 uppercase tracking-widest'}`}>
                    {p.name}
                  </span>
                </div>
                <div className="flex flex-col items-end relative z-10">
                  <span className={`font-mono font-black tabular-nums transition-all ${isNext ? 'text-3xl' : 'text-xl'}`}>
                    {format(p.time, 'HH:mm')}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
