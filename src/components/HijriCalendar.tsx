/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Calendar, Sparkles, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useApp } from '../context/AppContext';

export const toArabicNumerals = (num: number | string): string => {
  const str = String(num);
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[0-9]/g, (w) => arabicDigits[+w]);
};

export interface HijriDayInfo {
  gregorianDate: Date;
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  dayOfWeek: number;
}

interface IslamicEvent {
  day: number;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  isHoliday?: boolean;
}

export const HIJRI_MONTHS = [
  { ar: "محرم الحرام", en: "Muharram" },
  { ar: "صفر الخير", en: "Safar" },
  { ar: "ربيع الأول", en: "Rabi' al-Awwal" },
  { ar: "ربيع الآخر", en: "Rabi' al-Thani" },
  { ar: "جمادى الأولى", en: "Jumada al-Awwal" },
  { ar: "جمادى الآخرة", en: "Jumada al-Thani" },
  { ar: "رجب الأصب", en: "Rajab" },
  { ar: "شعبان المعظم", en: "Sha'ban" },
  { ar: "رمضان المبارك", en: "Ramadan" },
  { ar: "شوال المكرم", en: "Shawwal" },
  { ar: "ذو القعدة الحرام", en: "Dhu al-Qi'dah" },
  { ar: "ذو الحجة الحرام", en: "Dhu al-Hijjah" }
];

export const ISLAMIC_EVENTS: Record<number, IslamicEvent[]> = {
  1: [
    { day: 1, titleAr: "رأس السنة الهجرية", titleEn: "Islamic New Year", descAr: "بداية العام الهجري الجديد وهجرة الرسول محمد صلى الله عليه وآله من مكة إلى المدينة.", descEn: "The beginning of the Islamic New Year and migration of Prophet Muhammad (PBUH) from Makkah to Madinah." },
    { day: 10, titleAr: "يوم عاشوراء الحزين", titleEn: "Day of Ashura", descAr: "ذكرى استشهاد الإمام الحسين بن علي عليهما السلام وأهل بيته وأصحابه في معركة كربلاء الخالدة.", descEn: "The martyrdom of Imam Husayn (AS) and his family/companions in the Battle of Karbala." }
  ],
  2: [
    { day: 20, titleAr: "أربعينية الإمام الحسين (ع)", titleEn: "Arba'een of Imam Husayn", descAr: "مرور ٤٠ يوماً على فاجعة استشهاد الإمام الحسين عليه السلام في كربلاء ووفود الملايين من الزائرين.", descEn: "The 40th day after the martyrdom of Imam Husayn (AS) in Karbala." },
    { day: 28, titleAr: "وفاة الرسول الأكرم (ص)", titleEn: "Martyrdom of Prophet Muhammad (PBUH)", descAr: "ذكرى استشهاد الرسول الأعظم محمد بن عبد الله صلى الله عليه وآله المبعوث رحمة للعالمين.", descEn: "Commemoration of the passing of the Holy Prophet Muhammad (PBUH)." }
  ],
  3: [
    { day: 17, titleAr: "المولد النبوي ومولد الإمام الصادق (ع)", titleEn: "Prophet's Birth & Imam Sadiq's Birth", descAr: "ذكرى ولادة سيد الكائنات الرسول الأعظم محمد صلى الله عليه وآله وولادة حفيده ناشر المذهب الإمام جعفر الصادق عليه السلام.", descEn: "Commemoration of the birth of Prophet Muhammad (PBUH) and Imam Jafar al-Sadiq (AS)." }
  ],
  4: [
    { day: 8, titleAr: "ولادة الإمام الحسن العسكري (ع)", titleEn: "Birth of Imam Hasan al-Askari", descAr: "ذكرى ولادة الإمام الحادي عشر من أئمة الهدى المعصومين عليهم السلام.", descEn: "The birth anniversary of the 11th Shia Imam, Imam Hasan al-Askari (AS)." }
  ],
  5: [
    { day: 5, titleAr: "ولادة السيدة زينب الحوراء (ع)", titleEn: "Birth of Sayyida Zainab", descAr: "ولادة بطلة كربلاء وعقيلة الطالبيين السيدة زينب بنت أمير المؤمنين عليهما السلام.", descEn: "Birth anniversary of Sayyida Zainab (AS), daughter of Imam Ali (AS)." }
  ],
  6: [
    { day: 20, titleAr: "ولادة السيدة فاطمة الزهراء (ع)", titleEn: "Birth of Sayyida Fatima al-Zahra", descAr: "ولادة بضعة المصطفى وسيدة نساء العالمين السيدة فاطمة الزهراء عليها السلام.", descEn: "Birth anniversary of Sayyida Fatima al-Zahra (AS), daughter of the Holy Prophet." }
  ],
  7: [
    { day: 1, titleAr: "ولادة الإمام محمد الباقر (ع)", titleEn: "Birth of Imam Muhammad al-Baqir", descAr: "ولادة باقر علوم الأولين والآخرين سليل النبوة الإمام الخامس محمد الباقر عليه السلام.", descEn: "Birth anniversary of the 5th Imam, Imam Muhammad al-Baqir (AS)." },
    { day: 13, titleAr: "ولادة أمير المؤمنين الإمام علي (ع)", titleEn: "Birth of Imam Ali (AS)", descAr: "ذكرى ولادة أسد الله الغالب الإمام علي بن أبي طالب عليه السلام داخل جوف الكعبة المشرفة.", descEn: "The birth of Imam Ali ibn Abi Talib (AS) inside the Holy Kaaba." },
    { day: 27, titleAr: "المبعث النبوي الشريف والمعراج", titleEn: "Al-Mab'as / Prophet's Commissioning", descAr: "يوم بعث الرسول محمد صلى الله عليه وآله رسولاً وهبوط الوحي وجبريل بأولى آيات التنزيل الشريف.", descEn: "The commissioning of Prophet Muhammad (PBUH) and start of the Holy Revelation." }
  ],
  8: [
    { day: 3, titleAr: "ولادة الإمام الحسين (ع)", titleEn: "Birth of Imam Husayn (AS)", descAr: "ولادة سبط الرسول وسيد شباب أهل الجنة وريحانة المصطفى الإمام الحسين الشهيد عليه السلام.", descEn: "Birth anniversary of the master of martyrs, Imam Husayn (AS)." },
    { day: 4, titleAr: "ولادة أبي الفضل العباس (ع)", titleEn: "Birth of Hazrat Abbas (AS)", descAr: "ولادة قمر بني هاشم بطل الطف والخل الوفي أبي الفضل العباس بن أمير المؤمنين عليه السلام.", descEn: "Birth anniversary of Hazrat Abbas ibn Ali (AS), standard-bearer of Karbala." },
    { day: 15, titleAr: "مولد الإمام المهدي (عج) ونصف شعبان", titleEn: "Birth of Imam Mahdi (AJFS)", descAr: "ليلة النصف من شعبان المعظم وذكرى ولادة منقذ البشرية وناشر العدل الإمام الحجة المنتظر عجل الله فرجه.", descEn: "The blessed night of Mid-Sha'ban and birth anniversary of the Savior, Imam al-Mahdi (AJFS)." }
  ],
  9: [
    { day: 15, titleAr: "ولادة الإمام الحسن المجتبى (ع)", titleEn: "Birth of Imam Hasan al-Mujtaba", descAr: "ذكرى ولادة السبط الأكبر وريحانة المصطفى الإمام الحسن المجتبى عليه السلام الكريم.", descEn: "Birth anniversary of the eldest grandson of the Prophet, Imam Hasan (AS)." },
    { day: 17, titleAr: "غزوة بدر الكبرى المباركة", titleEn: "Battle of Badr", descAr: "ذكرى أول معركة حاسمة وتاريخية في الإسلام وانتصار المؤمنين المؤزر برعاية الله والملائكة.", descEn: "The historical victory of Muslims in the Battle of Badr." },
    { day: 19, titleAr: "ضربة محراب أمير المؤمنين (ع)", titleEn: "Striking of Imam Ali (AS)", descAr: "الاعتداء الآثم على أمير المؤمنين وسيف الله الغالب علي بن أبي طالب في محراب مسجد الكوفة المعظم.", descEn: "The tragic striking of Imam Ali (AS) in the prayer niche of Kufa Mosque." },
    { day: 21, titleAr: "استشهاد أمير المؤمنين الإمام علي (ع)", titleEn: "Martyrdom of Imam Ali (AS)", descAr: "فاجعة استشهاد الإمام الأول وسيف الله الغالب علي بن أبي طالب عليه السلام وصي رسول الله.", descEn: "Martyrdom anniversary of Imam Ali ibn Abi Talib (AS)." },
    { day: 23, titleAr: "ليلة القدر المباركة الثالثة", titleEn: "Laylat al-Qadr (Blessed Night)", descAr: "ليلة القدر الشريفة الكبرى، ليلة التقدير والمغفرة ونزول القرآن الكريم بأتم تجلياته الإيمانية.", descEn: "One of the key candidates of the Night of Power and Quranic Revelation." }
  ],
  10: [
    { day: 1, titleAr: "عيد الفطر السعيد", titleEn: "Eid al-Fitr", descAr: "بهجة إفطار المسلمين وتكبير الإفطار بعد صيام شهر كامل من الرحمة والمغفرة والعتق من النيران.", descEn: "The festive celebration of fast-breaking after Ramadan." },
    { day: 25, titleAr: "استشهاد الإمام جعفر الصادق (ع)", titleEn: "Martyrdom of Imam Jafar al-Sadiq", descAr: "ذكرى استشهاد مؤسس المذهب الجعفري الشريف سادس أئمة أهل البيت الصابرين مسموماً.", descEn: "The martyrdom anniversary of Imam Jafar al-Sadiq (AS)." }
  ],
  11: [
    { day: 1, titleAr: "ولادة السيدة فاطمة المعصومة (ع)", titleEn: "Birth of Sayyida Fatima Ma'sumah", descAr: "ولادة كريمة أهل البيت فاطمة المعصومة عليها السلام أخت الإمام علي الرضا عليه السلام في المدينة المنورة.", descEn: "The birth anniversary of Sayyida Fatima al-Ma'sumah (AS)." },
    { day: 11, titleAr: "ولادة الإمام علي بن موسى الرضا (ع)", titleEn: "Birth of Imam Ali al-Rida", descAr: "ولادة غريب طوس وضامن الجنان الإمام الثامن علي بن موسى الرضا عليه السلام المرتضى الشاهد.", descEn: "The birth anniversary of Imam Ali ibn Musa al-Rida (AS)." }
  ],
  12: [
    { day: 1, titleAr: "زواج النورين الإمام علي والسيدة فاطمة", titleEn: "Marriage of Imam Ali & Lady Fatima", descAr: "أطهر زواج وإقران النور بالنور الإمام علي بن أبي طالب والبتول فاطمة الزهراء عليهما السلام في المدينة المنورة.", descEn: "The marriage anniversary of the ultimate lights: Imam Ali (AS) and Lady Fatima (AS)." },
    { day: 9, titleAr: "يوم عرفة المبارك العظيم", titleEn: "Day of Arafah", descAr: "أحد أفضل الأيام المباركة، يوم الوقوف والضراعة على صعيد عرفات وقراءة دعاء الإمام الحسين ع.", descEn: "The spectacular spiritual assembly on Mount Arafat." },
    { day: 10, titleAr: "عيد الأضحى المبارك السعيد", titleEn: "Eid al-Adha", descAr: "عيد الفداء والتقرب الشريف بتقديم التقربات والأضاحي وتحقيق المودة والتزاور الإيماني النبيل.", descEn: "The Great Feast of Sacrifices commemorating Prophet Ibrahim's obedience." },
    { day: 18, titleAr: "عيد الغدير الأغر الأكبر", titleEn: "Eid al-Ghadir", descAr: "يوم تنصيب الإمام علي بن أبي طالب عليه السلام وصياً وأميراً وأولاً على المسلمين بعهد الغدير الأغر الشهير.", descEn: "The declaration of Imam Ali's mastership at Ghadir Khumm." },
    { day: 24, titleAr: "يوم المباهلة والتصدق بالخاتم", titleEn: "Day of Mubahalah & Ring Donation", descAr: "ذكرى مباهلة الرسول لنصارى نجران بنور أهل بيته الخمسة الأطهار، وتصدق أمير المؤمنين بالخاتم في الصلاة.", descEn: "The interaction with Christians of Najran and donating the ring in Ruku." }
  ]
};

const getHijriComponents = (date: Date, offset: number): { day: number; month: number; year: number } => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + offset);
  
  const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  });
  
  const parts = formatter.formatToParts(d);
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '1', 10);
  
  return { day, month, year };
};

const findFirstDayOfHijriMonth = (targetYear: number, targetMonth: number, offset: number): Date => {
  const now = new Date();
  const currentHijri = getHijriComponents(now, offset);
  
  const diffMonths = (targetYear - currentHijri.year) * 12 + (targetMonth - currentHijri.month);
  
  const estimatedTime = now.getTime() + (diffMonths * 29.53059 + 15) * 24 * 60 * 60 * 1000;
  let d = new Date(estimatedTime);
  
  let hj = getHijriComponents(d, offset);
  let iterations = 0;
  
  while ((hj.year > targetYear || (hj.year === targetYear && hj.month > targetMonth)) && iterations < 60) {
    d.setDate(d.getDate() - 15);
    hj = getHijriComponents(d, offset);
    iterations++;
  }
  
  iterations = 0;
  while ((hj.year < targetYear || (hj.year === targetYear && hj.month < targetMonth)) && iterations < 60) {
    d.setDate(d.getDate() + 15);
    hj = getHijriComponents(d, offset);
    iterations++;
  }
  
  iterations = 0;
  while ((hj.year > targetYear || (hj.year === targetYear && hj.month > targetMonth)) && iterations < 45) {
    d.setDate(d.getDate() - 1);
    hj = getHijriComponents(d, offset);
    iterations++;
  }
  
  iterations = 0;
  while ((hj.year < targetYear || (hj.year === targetYear && hj.month < targetMonth)) && iterations < 45) {
    d.setDate(d.getDate() + 1);
    hj = getHijriComponents(d, offset);
    iterations++;
  }
  
  iterations = 0;
  while (hj.day > 1 && iterations < 35) {
    d.setDate(d.getDate() - 1);
    hj = getHijriComponents(d, offset);
    iterations++;
  }
  
  if (hj.month !== targetMonth || hj.year !== targetYear || hj.day !== 1) {
    iterations = 0;
    while ((hj.month !== targetMonth || hj.year !== targetYear || hj.day !== 1) && iterations < 35) {
      d.setDate(d.getDate() + 1);
      hj = getHijriComponents(d, offset);
      iterations++;
    }
  }
  
  d.setHours(12, 0, 0, 0);
  return d;
};

const generateHijriMonthDays = (firstDayGregorian: Date, targetYear: number, targetMonth: number, offset: number): HijriDayInfo[] => {
  const days: HijriDayInfo[] = [];
  const curr = new Date(firstDayGregorian.getTime());
  
  for (let i = 0; i < 31; i++) {
    const hj = getHijriComponents(curr, offset);
    if (hj.month !== targetMonth || hj.year !== targetYear) {
      break;
    }
    days.push({
      gregorianDate: new Date(curr.getTime()),
      hijriDay: hj.day,
      hijriMonth: hj.month,
      hijriYear: hj.year,
      dayOfWeek: curr.getDay(),
    });
    curr.setDate(curr.getDate() + 1);
  }
  
  return days;
};

const HijriCalendar: React.FC = () => {
  const { settings } = useApp();
  const isAr = settings.language === 'ar';

  const todayDate = new Date();
  const todayComponents = getHijriComponents(todayDate, settings.hijriOffset);

  const [hijriYear, setHijriYear] = useState(todayComponents.year);
  const [hijriMonth, setHijriMonth] = useState(todayComponents.month);
  const [days, setDays] = useState<HijriDayInfo[]>([]);
  const [selectedDay, setSelectedDay] = useState<HijriDayInfo | null>(null);

  // Date conversion tool states and real-time computation
  const [showConverter, setShowConverter] = useState(true);
  const [gregorianInput, setGregorianInput] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const getConvertedHijri = () => {
    if (!gregorianInput) return null;
    const parts = gregorianInput.split('-');
    if (parts.length !== 3) return null;
    const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(dateObj.getTime())) return null;
    
    const hj = getHijriComponents(dateObj, settings.hijriOffset);
    const monthLabel = HIJRI_MONTHS[hj.month - 1] || HIJRI_MONTHS[0];
    return {
      day: hj.day,
      monthName: isAr ? monthLabel.ar : monthLabel.en,
      year: hj.year,
      dayOfWeek: dateObj.getDay()
    };
  };

  const convertedResult = getConvertedHijri();

  useEffect(() => {
    const firstDay = findFirstDayOfHijriMonth(hijriYear, hijriMonth, settings.hijriOffset);
    const monthDays = generateHijriMonthDays(firstDay, hijriYear, hijriMonth, settings.hijriOffset);
    setDays(monthDays);
    
    // Auto select today if present, otherwise select first day
    const tm = getHijriComponents(new Date(), settings.hijriOffset);
    const matchedToday = monthDays.find(d => d.hijriDay === tm.day && d.hijriMonth === tm.month && d.hijriYear === tm.year);
    if (matchedToday) {
      setSelectedDay(matchedToday);
    } else if (monthDays.length > 0) {
      setSelectedDay(monthDays[0]);
    }
  }, [hijriYear, hijriMonth, settings.hijriOffset]);

  const handlePrevMonth = () => {
    if (hijriMonth === 1) {
      setHijriMonth(12);
      setHijriYear(prev => prev - 1);
    } else {
      setHijriMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (hijriMonth === 12) {
      setHijriMonth(1);
      setHijriYear(prev => prev + 1);
    } else {
      setHijriMonth(prev => prev + 1);
    }
  };

  const handleResetToToday = () => {
    setHijriYear(todayComponents.year);
    setHijriMonth(todayComponents.month);
  };

  const monthLabel = HIJRI_MONTHS[hijriMonth - 1] || HIJRI_MONTHS[0];
  const monthEvents = ISLAMIC_EVENTS[hijriMonth] || [];

  const WEEKDAYS = isAr
    ? ["أحد", "إثن", "ثلاث", "أربع", "خميس", "جمع", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Compute Gregorian range (First day to Last day) of the currently rendered Hijri Month
  let gregorianRangeLabel = '';
  if (days.length > 0) {
    const startD = days[0].gregorianDate;
    const endD = days[days.length - 1].gregorianDate;
    
    const startM = format(startD, 'MMMM', { locale: isAr ? ar : enUS });
    const endM = format(endD, 'MMMM', { locale: isAr ? ar : enUS });
    const yearS = format(startD, 'yyyy');
    const yearE = format(endD, 'yyyy');
    
    if (startM === endM) {
      gregorianRangeLabel = `${startM} ${yearS}`;
    } else {
      gregorianRangeLabel = yearS === yearE 
        ? `${startM} - ${endM} ${yearS}` 
        : `${startM} ${yearS} - ${endM} ${yearE}`;
    }
  }

  // Padding counts for the beginning of our calendar layout
  const startPadding = days[0] ? days[0].dayOfWeek : 0;
  const gridDays: (HijriDayInfo | null)[] = Array(startPadding).fill(null);
  days.forEach(d => gridDays.push(d));

  // Find dynamic event for any given day
  const getEventForDay = (dayNum: number): IslamicEvent | undefined => {
    return monthEvents.find(e => e.day === dayNum);
  };

  // Check if a day is actual today
  const isActualToday = (dayInfo: HijriDayInfo): boolean => {
    const today = getHijriComponents(new Date(), settings.hijriOffset);
    return dayInfo.hijriDay === today.day && dayInfo.hijriMonth === today.month && dayInfo.hijriYear === today.year;
  };

  const glassCardClasses = "bg-slate-900/40 backdrop-blur-md rounded-[40px] p-6 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]";

  return (
    <div className={glassCardClasses}>
      
      {/* Calendar Header Control Block */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-1">
          <button
            onClick={isAr ? handleNextMonth : handlePrevMonth}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all text-white flex items-center justify-center cursor-pointer border border-white/5"
            title={isAr ? "الشهر القادم" : "Next Month"}
          >
            <ChevronRight size={18} />
          </button>
          
          <button
            onClick={handleResetToToday}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-[10px] text-white/60 hover:text-white font-black uppercase tracking-wider cursor-pointer border border-white/5"
          >
            {isAr ? "اليوم" : "Today"}
          </button>

          <button
            onClick={isAr ? handlePrevMonth : handleNextMonth}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 transition-all text-white flex items-center justify-center cursor-pointer border border-white/5"
            title={isAr ? "الشهر السابق" : "Previous Month"}
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="text-right">
          <h3 className="text-xl font-black text-white flex items-center gap-2 justify-end font-serif-header">
            <span className="text-dark-accent">
              {isAr ? toArabicNumerals(hijriYear) : hijriYear} هـ
            </span>
            <span>{isAr ? monthLabel.ar : monthLabel.en}</span>
          </h3>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-0.5 font-mono">
            {gregorianRangeLabel}
          </p>
        </div>
      </div>

      {/* WeekDays Label Row */}
      <div className="grid grid-cols-7 gap-1 mb-3 text-center border-b border-white/5 pb-2">
        {WEEKDAYS.map((w, idx) => (
          <span key={idx} className="text-[10px] font-black uppercase tracking-wider text-white/30 font-sans">
            {w}
          </span>
        ))}
      </div>

      {/* Calendar Grid Numbers Block */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${hijriYear}-${hijriMonth}`}
            initial={{ opacity: 0, x: isAr ? -15 : 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 15 : -15 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="grid grid-cols-7 gap-1.5 mb-6 text-center"
          >
            {gridDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="aspect-square opacity-0 select-none pointer-events-none" />;
              }

              const hasEvent = getEventForDay(day.hijriDay);
              const isSelected = selectedDay && selectedDay.hijriDay === day.hijriDay;
              const isToday = isActualToday(day);

              return (
                <button
                  onClick={() => setSelectedDay(day)}
                  key={`day-${day.hijriDay}`}
                  className={`aspect-square w-full rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative cursor-pointer border group select-none ${
                    isSelected
                      ? "bg-dark-accent text-white border-transparent shadow-[0_8px_24px_-4px_rgba(var(--dark-accent-rgb,0,0,0),0.3)] scale-[1.08] z-10"
                      : isToday
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-inner scale-[1.04]"
                      : "bg-black/15 text-white/80 border-white/5 hover:bg-white/5 hover:border-white/10 hover:scale-105"
                  }`}
                >
                  <span className="text-xs font-black font-mono">
                    {isAr ? toArabicNumerals(day.hijriDay) : day.hijriDay}
                  </span>
                  
                  {/* Event indicator dot */}
                  {hasEvent && (
                    <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${
                      isSelected ? "bg-white" : isToday ? "bg-amber-400" : "bg-dark-accent animate-pulse"
                    }`} />
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Selected Day details board */}
      <AnimatePresence mode="wait">
        {selectedDay && (
          <motion.div
            key={`detail-${selectedDay.hijriDay}-${selectedDay.hijriMonth}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-3xl bg-black/30 border border-white/5 flex flex-col gap-3"
          >
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-[10px] text-white/40 font-mono font-bold uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                {format(selectedDay.gregorianDate, isAr ? 'EEEE، d MMMM' : 'EEEE, d MMMM', { locale: isAr ? ar : enUS })}
              </span>
              <h4 className="text-xs font-black text-dark-accent tracking-tight flex items-center gap-1.5">
                <Moon size={12} className="text-dark-accent" />
                <span>
                  {isAr ? toArabicNumerals(selectedDay.hijriDay) : selectedDay.hijriDay} {isAr ? monthLabel.ar : monthLabel.en} {isAr ? toArabicNumerals(selectedDay.hijriYear) : selectedDay.hijriYear} هـ
                </span>
                {isActualToday(selectedDay) && (
                  <span className="text-[8px] uppercase tracking-wider bg-emerald-500/10 text-emerald-500 font-black px-1.5 py-0.5 rounded-md border border-emerald-500/20 flex-shrink-0">
                    {isAr ? "اليوم" : "Today"}
                  </span>
                )}
              </h4>
            </div>

            {(() => {
              const currentEvent = getEventForDay(selectedDay.hijriDay);
              if (currentEvent) {
                return (
                  <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15 flex flex-col gap-1.5 text-right"
                    dir="rtl"
                  >
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <Sparkles size={14} className="text-amber-400 animate-spin animate-once fill-amber-400/20" />
                      <span>{isAr ? currentEvent.titleAr : currentEvent.titleEn}</span>
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed font-sans">
                      {isAr ? currentEvent.descAr : currentEvent.descEn}
                    </p>
                  </motion.div>
                );
              }
              return (
                <p className="text-[10px] text-white/30 italic text-center py-1">
                  {isAr ? "لا توجد أحداث دينية بارزة في هذا اليوم" : "No prominent religious events recorded for this day."}
                </p>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chronological events slider or list for the month */}
      {monthEvents.length > 0 && (
        <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-3">
          <div className="flex justify-between items-center text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
            <span>{isAr ? `${monthEvents.length} أحداث` : `${monthEvents.length} Events`}</span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {isAr ? "أبرز أحداث الشهر الثاني" : "Prominent Month Events"}
            </span>
          </div>

          <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
            {monthEvents.map((evt) => {
              const matchingDayInfo = days.find(d => d.hijriDay === evt.day);
              const isSelectedEvt = selectedDay && selectedDay.hijriDay === evt.day;
              return (
                <button
                  key={`evt-${evt.day}`}
                  onClick={() => {
                    if (matchingDayInfo) {
                      setSelectedDay(matchingDayInfo);
                    }
                  }}
                  className={`w-full p-3 rounded-2xl border text-right transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer relative ${
                    isSelectedEvt
                      ? "bg-amber-500/[0.04] border-amber-500/25 scale-[1.01]"
                      : "bg-white/[0.02] border-white/5 hover:border-white/10"
                  }`}
                  dir="rtl"
                >
                  <div className="flex flex-col text-right gap-0.5 max-w-[80%]">
                    <span className="text-[11px] font-black text-white/90 truncate">{isAr ? evt.titleAr : evt.titleEn}</span>
                    <span className="text-[9px] text-white/40 truncate leading-snug font-sans">{isAr ? evt.descAr : evt.descEn}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-center flex flex-col items-center justify-center border border-amber-500/20 flex-shrink-0">
                    <span className="text-[8px] text-amber-500 font-black uppercase leading-none">{isAr ? "اليوم" : "Day"}</span>
                    <span className="text-xs font-mono font-black text-white leading-none mt-0.5">
                      {isAr ? toArabicNumerals(evt.day) : evt.day}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date Converter Tool */}
      <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-3">
        <button
          onClick={() => setShowConverter(!showConverter)}
          className="w-full py-2.5 px-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.98] transition-all text-xs text-white/80 flex items-center justify-between gap-2 cursor-pointer border border-white/5 font-bold"
        >
          <span className="flex items-center gap-2">
            <Calendar size={13} className="text-amber-500" />
            <span>{isAr ? "محول التاريخ (ميلادي ⇆ هجري)" : "Date Converter (Gregorian ⇆ Hijri)"}</span>
          </span>
          <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
            {showConverter ? (isAr ? "إخفاء" : "Hide") : (isAr ? "عرض" : "Show")}
          </span>
        </button>

        <AnimatePresence>
          {showConverter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden flex flex-col gap-4 text-right"
              dir="rtl"
            >
              <div className="bg-black/30 p-4 rounded-3xl border border-white/5 flex flex-col gap-3 mt-1">
                <div className="flex flex-col gap-1.5 justify-end">
                  <label className="text-[10px] uppercase tracking-widest font-black text-white/40 block text-right">
                    {isAr ? "التاريخ الميلادي المراد تحويله" : "Gregorian Date to Convert"}
                  </label>
                  <input
                    type="date"
                    value={gregorianInput}
                    onChange={(e) => setGregorianInput(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 hover:border-white/20 focus:border-amber-500/50 text-white font-sans text-sm rounded-2xl px-4 py-2.5 outline-none transition-all cursor-pointer text-right text-scheme-dependent"
                  />
                </div>

                {convertedResult ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15 flex flex-col gap-1 text-right">
                    <span className="text-[9px] uppercase tracking-widest font-black text-amber-500">
                      {isAr ? "التاريخ الهجري المقابل" : "Equivalent Hijri Date"}
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-white">
                        {isAr ? WEEKDAYS[convertedResult.dayOfWeek] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][convertedResult.dayOfWeek]}
                      </span>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-amber-400">
                        <Moon size={13} className="text-amber-400" />
                        <span className="font-mono">
                          {isAr ? toArabicNumerals(convertedResult.day) : convertedResult.day} {convertedResult.monthName} {isAr ? toArabicNumerals(convertedResult.year) : convertedResult.year} هـ
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-white/30 italic text-center py-1">
                    {isAr ? "يرجى تحديد تاريخ صحيح" : "Please select a valid date."}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default HijriCalendar;
