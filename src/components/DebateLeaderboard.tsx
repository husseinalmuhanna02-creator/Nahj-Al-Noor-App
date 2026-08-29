import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Award, 
  Crown, 
  Calendar, 
  Sparkles, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Radio, 
  BookOpen, 
  ShieldCheck, 
  Flame, 
  Layers, 
  CheckCircle2, 
  TrendingUp,
  User,
  ThumbsUp,
  History,
  Scale,
  Lightbulb,
  MessageSquare,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  getDebaterLeaderboard, 
  INITIAL_LEADERBOARD_ENTRIES 
} from '../services/debateService';
import type { 
  DebaterLeaderboardEntry, 
  LeaderboardTimeframe, 
  DebateCategory 
} from '../types';
import { DEBATE_CATEGORIES, getCategoryConfig } from './DebateRoom';

interface DebateLeaderboardProps {
  onSelectDebater?: (debater: DebaterLeaderboardEntry) => void;
  onNavigateToRooms?: () => void;
}

export default function DebateLeaderboard({ onSelectDebater, onNavigateToRooms }: DebateLeaderboardProps) {
  const { settings } = useApp();
  const isAr = settings.language === 'ar';

  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('weekly');
  const [selectedCategory, setSelectedCategory] = useState<DebateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [entries, setEntries] = useState<DebaterLeaderboardEntry[]>(INITIAL_LEADERBOARD_ENTRIES);
  const [loading, setLoading] = useState(false);
  const [selectedDebaterModal, setSelectedDebaterModal] = useState<DebaterLeaderboardEntry | null>(null);

  // Load Leaderboard entries
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getDebaterLeaderboard(timeframe, selectedCategory);
      setEntries(data);
    } catch (err) {
      console.warn('Leaderboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe, selectedCategory]);

  // Listen for live updates when reactions occur in active sessions
  useEffect(() => {
    const handleLeaderboardUpdate = () => {
      fetchLeaderboard();
    };

    window.addEventListener('debater_leaderboard_updated', handleLeaderboardUpdate);
    return () => {
      window.removeEventListener('debater_leaderboard_updated', handleLeaderboardUpdate);
    };
  }, [timeframe, selectedCategory]);

  // Search Filter
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase().trim();
    return entries.filter(e => {
      const nameMatch = e.name.toLowerCase().includes(q);
      const titleMatch = e.recentDebateTitles?.some(t => t.toLowerCase().includes(q));
      const badgeMatch = e.badges?.some(b => b.toLowerCase().includes(q));
      return nameMatch || titleMatch || badgeMatch;
    });
  }, [entries, searchQuery]);

  // Top 3 Podium
  const topThree = useMemo(() => {
    return filteredEntries.slice(0, 3);
  }, [filteredEntries]);

  // Rest of the list (Rank #4+)
  const restEntries = useMemo(() => {
    return filteredEntries.slice(3);
  }, [filteredEntries]);

  // KPI Aggregates for header summary
  const summaryStats = useMemo(() => {
    let totalPos = 0;
    let totalDebates = 0;
    let highestPos = 0;

    filteredEntries.forEach(e => {
      const count = timeframe === 'daily' 
        ? e.dailyPositiveReactions 
        : timeframe === 'weekly' 
          ? e.weeklyPositiveReactions 
          : e.totalPositiveReactions;
      
      const debCount = timeframe === 'daily'
        ? e.dailyDebatesCount
        : timeframe === 'weekly'
          ? e.weeklyDebatesCount
          : e.debatesCount;

      totalPos += count || 0;
      totalDebates += debCount || 0;
      if ((count || 0) > highestPos) highestPos = count || 0;
    });

    return {
      totalPositive: totalPos,
      totalDebates: totalDebates,
      topScore: highestPos,
      activeDebatersCount: filteredEntries.length
    };
  }, [filteredEntries, timeframe]);

  // Get score for debater based on selected timeframe
  const getScore = (entry: DebaterLeaderboardEntry) => {
    if (timeframe === 'daily') return entry.dailyPositiveReactions || 0;
    if (timeframe === 'weekly') return entry.weeklyPositiveReactions || 0;
    return entry.totalPositiveReactions || 0;
  };

  const getDebatesCount = (entry: DebaterLeaderboardEntry) => {
    if (timeframe === 'daily') return entry.dailyDebatesCount || 1;
    if (timeframe === 'weekly') return entry.weeklyDebatesCount || 1;
    return entry.debatesCount || 1;
  };

  return (
    <div className="w-full flex flex-col gap-6 text-white pb-24">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-600/30 via-slate-900/95 to-slate-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 flex items-center gap-1.5 shadow-md">
                <Trophy size={14} />
                {isAr ? 'لوحة الصدارة والترتيب' : 'Debater Leaderboard'}
              </span>
              <span className="text-xs font-mono text-amber-400/90 flex items-center gap-1">
                <Flame size={13} className="text-amber-400" />
                {isAr ? 'مجموع التفاعلات الإيجابية المكتسبة' : 'Total Positive Live Reactions'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {isAr ? 'صدارة الفرسان والمناظرين الأكاديميين' : 'Distinguished Scholars & Debaters Leaderboard'}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              {isAr
                ? 'تصنيف لحظي ومستمر للمناظرين بناءً على مجموع تفاعلات التأييد والحجج القوية والأدلة الموثقة المكتسبة خلال المناظرات الحية، مع إمكانية التصفح بين الصدارة اليومية، الأسبوعية، والتصنيف الشامل.'
                : 'Real-time debaters ranking based on cumulative positive reactions, valid citations, and audience acceptance earned in live sessions.'}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-black/40 border border-white/10 p-3 rounded-2xl w-full lg:w-auto shrink-0 shadow-lg">
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-base sm:text-xl font-black font-mono text-amber-400">
                {summaryStats.totalPositive}
              </span>
              <span className="text-[10px] text-white/60 mt-0.5">
                {isAr ? 'تفاعلات إيجابية' : 'Positive Reactions'}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 text-center border-x border-white/10">
              <span className="text-base sm:text-xl font-black font-mono text-emerald-400">
                {summaryStats.totalDebates}
              </span>
              <span className="text-[10px] text-white/60 mt-0.5">
                {isAr ? 'جلسات مناظرة' : 'Debate Sessions'}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 text-center">
              <span className="text-base sm:text-xl font-black font-mono text-sky-400">
                {summaryStats.activeDebatersCount}
              </span>
              <span className="text-[10px] text-white/60 mt-0.5">
                {isAr ? 'مناظر نشط' : 'Active Debaters'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Timeframe Navigation (Daily vs Weekly vs All-Time) + Search */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
        {/* Timeframe Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/10 text-xs self-start md:self-auto w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setTimeframe('daily')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              timeframe === 'daily'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles size={14} className={timeframe === 'daily' ? 'text-slate-950' : 'text-amber-400'} />
            <span>{isAr ? 'اليومية (اليوم)' : 'Daily Leaderboard'}</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeframe('weekly')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              timeframe === 'weekly'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar size={14} className={timeframe === 'weekly' ? 'text-slate-950' : 'text-emerald-400'} />
            <span>{isAr ? 'الأسبوعية (هذا الأسبوع)' : 'Weekly Leaderboard'}</span>
          </button>

          <button
            type="button"
            onClick={() => setTimeframe('all')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              timeframe === 'all'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Crown size={14} className={timeframe === 'all' ? 'text-slate-950' : 'text-amber-400'} />
            <span>{isAr ? 'التصنيف الشامل' : 'All-Time'}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'ابحث عن مناظر، لقب، أو موضوع...' : 'Search debater, badge, or topic...'}
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/15 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 transition-all"
          />
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
        </div>
      </div>

      {/* Category Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {DEBATE_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all duration-200 cursor-pointer border shrink-0 ${
                isSelected
                  ? `${cat.activeBg} border-transparent scale-102 shadow-md`
                  : `${cat.badgeBg} ${cat.badgeBorder} ${cat.badgeText} hover:bg-white/15`
              }`}
            >
              <Icon size={14} />
              <span>{isAr ? cat.nameAr : cat.nameEn}</span>
            </button>
          );
        })}
      </div>

      {/* Top 3 Podium (منصة التتويج) */}
      {topThree.length > 0 && !searchQuery.trim() && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Rank #2 (Silver) */}
          {topThree[1] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              onClick={() => setSelectedDebaterModal(topThree[1])}
              className="order-2 md:order-1 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-400/40 rounded-3xl p-5 flex flex-col items-center text-center relative overflow-hidden shadow-xl hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-300/20 border border-slate-300/50 flex items-center justify-center font-black font-mono text-slate-200 text-xs">
                #2
              </div>

              <div className="relative mb-3 mt-2">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-300 shadow-lg group-hover:scale-105 transition-all">
                  <img src={topThree[1].avatar} alt={topThree[1].name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-1 bg-slate-300 text-slate-950 p-1 rounded-full shadow">
                  <Award size={14} />
                </div>
              </div>

              <h3 className="text-sm font-black text-white group-hover:text-slate-200 transition-colors truncate max-w-[200px]">
                {topThree[1].name}
              </h3>
              <span className="text-[11px] text-slate-300/80 font-semibold mt-0.5">
                {getCategoryConfig(topThree[1].topCategory)[isAr ? 'nameAr' : 'nameEn']}
              </span>

              {/* Score Tag */}
              <div className="mt-3 bg-slate-950/60 border border-slate-400/30 rounded-2xl px-4 py-2 w-full flex items-center justify-between">
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <ThumbsUp size={13} className="text-emerald-400" />
                  <span>{isAr ? 'تفاعلات إيجابية' : 'Positive'}</span>
                </span>
                <span className="font-mono font-black text-emerald-400 text-base">
                  {getScore(topThree[1])}
                </span>
              </div>

              {/* Acceptance Bar */}
              <div className="mt-2 w-full flex items-center justify-between text-[10px] text-white/60">
                <span>{isAr ? `القبول: ${topThree[1].acceptanceRate}%` : `Approval: ${topThree[1].acceptanceRate}%`}</span>
                <span>{isAr ? `${getDebatesCount(topThree[1])} مناظرات` : `${getDebatesCount(topThree[1])} debates`}</span>
              </div>
            </motion.div>
          )}

          {/* Rank #1 (Golden Champion / First Place) */}
          {topThree[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSelectedDebaterModal(topThree[0])}
              className="order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-amber-950/20 border-2 border-amber-400 rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden shadow-2xl hover:border-amber-300 transition-all cursor-pointer group scale-100 md:-translate-y-2 ring-4 ring-amber-400/20"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
              
              <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black font-mono text-xs flex items-center gap-1 shadow-md">
                <Crown size={13} />
                <span>#1 {isAr ? 'المتصدر' : 'Leader'}</span>
              </div>

              <div className="relative mb-3 mt-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-amber-400 shadow-2xl group-hover:scale-105 transition-all ring-4 ring-amber-400/30">
                  <img src={topThree[0].avatar} alt={topThree[0].name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-lg">
                  <Crown size={16} />
                </div>
              </div>

              <h3 className="text-base font-black text-amber-300 group-hover:text-amber-200 transition-colors truncate max-w-[220px]">
                {topThree[0].name}
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                {topThree[0].badges?.slice(0, 2).map((b, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg font-bold">
                    {b}
                  </span>
                ))}
              </div>

              {/* Score Tag */}
              <div className="mt-4 bg-slate-950/80 border border-amber-400/40 rounded-2xl px-5 py-2.5 w-full flex items-center justify-between shadow-inner">
                <span className="text-xs text-amber-200 font-bold flex items-center gap-1.5">
                  <Flame size={14} className="text-amber-400" />
                  <span>{isAr ? (timeframe === 'daily' ? 'نقاط اليوم' : timeframe === 'weekly' ? 'نقاط الأسبوع' : 'إجمالي النقاط') : 'Score'}</span>
                </span>
                <span className="font-mono font-black text-amber-300 text-lg sm:text-xl">
                  {getScore(topThree[0])}
                </span>
              </div>

              {/* Progress & Acceptance */}
              <div className="mt-2.5 w-full flex items-center justify-between text-[11px] text-white/70">
                <span className="text-emerald-400 font-bold">{isAr ? `معدل القبول: ${topThree[0].acceptanceRate}%` : `Approval: ${topThree[0].acceptanceRate}%`}</span>
                <span className="font-mono font-bold text-white/60">{isAr ? `${getDebatesCount(topThree[0])} مناظرات` : `${getDebatesCount(topThree[0])} debates`}</span>
              </div>
            </motion.div>
          )}

          {/* Rank #3 (Bronze) */}
          {topThree[2] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              onClick={() => setSelectedDebaterModal(topThree[2])}
              className="order-3 md:order-3 bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-amber-700/40 rounded-3xl p-5 flex flex-col items-center text-center relative overflow-hidden shadow-xl hover:border-amber-600 transition-all cursor-pointer group"
            >
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-700/20 border border-amber-700/50 flex items-center justify-center font-black font-mono text-amber-400 text-xs">
                #3
              </div>

              <div className="relative mb-3 mt-2">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-600 shadow-lg group-hover:scale-105 transition-all">
                  <img src={topThree[2].avatar} alt={topThree[2].name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-1 bg-amber-700 text-white p-1 rounded-full shadow">
                  <Award size={14} />
                </div>
              </div>

              <h3 className="text-sm font-black text-white group-hover:text-amber-200 transition-colors truncate max-w-[200px]">
                {topThree[2].name}
              </h3>
              <span className="text-[11px] text-amber-400/80 font-semibold mt-0.5">
                {getCategoryConfig(topThree[2].topCategory)[isAr ? 'nameAr' : 'nameEn']}
              </span>

              {/* Score Tag */}
              <div className="mt-3 bg-slate-950/60 border border-amber-700/30 rounded-2xl px-4 py-2 w-full flex items-center justify-between">
                <span className="text-xs text-amber-200/80 flex items-center gap-1">
                  <ThumbsUp size={13} className="text-emerald-400" />
                  <span>{isAr ? 'تفاعلات إيجابية' : 'Positive'}</span>
                </span>
                <span className="font-mono font-black text-emerald-400 text-base">
                  {getScore(topThree[2])}
                </span>
              </div>

              {/* Acceptance Bar */}
              <div className="mt-2 w-full flex items-center justify-between text-[10px] text-white/60">
                <span>{isAr ? `القبول: ${topThree[2].acceptanceRate}%` : `Approval: ${topThree[2].acceptanceRate}%`}</span>
                <span>{isAr ? `${getDebatesCount(topThree[2])} مناظرات` : `${getDebatesCount(topThree[2])} debates`}</span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Main Leaderboard Table / Card List */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-400" />
            <h2 className="text-sm sm:text-base font-black text-white">
              {isAr 
                ? (timeframe === 'daily' 
                    ? 'جدول ترتيب المناظرين في الجلسات اليومية' 
                    : timeframe === 'weekly' 
                      ? 'جدول ترتيب المناظرين في الجلسات الأسبوعية' 
                      : 'جدول الترتيب الشامل لجميع المناظرين')
                : 'Debater Standings'}
            </h2>
          </div>
          <span className="text-xs text-white/50 font-mono">
            {filteredEntries.length} {isAr ? 'مناظر مسجل' : 'debaters listed'}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/40">
              <Search size={24} />
            </div>
            <p className="text-xs text-white/50">
              {isAr ? 'لم يتم العثور على مناظرين يطابقون شروط البحث الحالية' : 'No debaters matched the criteria.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filteredEntries.map((entry, index) => {
              const rank = index + 1;
              const score = getScore(entry);
              const debates = getDebatesCount(entry);
              const catConfig = getCategoryConfig(entry.topCategory);

              return (
                <motion.div
                  key={entry.uid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  onClick={() => setSelectedDebaterModal(entry)}
                  className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer ${
                    rank === 1
                      ? 'bg-amber-950/20 border-amber-500/40 hover:bg-amber-950/30'
                      : rank === 2
                        ? 'bg-slate-800/40 border-slate-400/30 hover:bg-slate-800/60'
                        : rank === 3
                          ? 'bg-amber-900/10 border-amber-700/30 hover:bg-amber-900/20'
                          : 'bg-black/30 border-white/10 hover:bg-white/5'
                  }`}
                >
                  {/* Left: Rank & Debater Info */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Rank Badge */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black font-mono text-xs shrink-0 ${
                      rank === 1
                        ? 'bg-amber-400 text-slate-950 shadow-md'
                        : rank === 2
                          ? 'bg-slate-300 text-slate-950'
                          : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-white/10 text-white/70'
                    }`}>
                      #{rank}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 shrink-0 shadow">
                      <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                    </div>

                    {/* Names & Badges */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white truncate max-w-[180px] sm:max-w-[240px]">
                          {entry.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.2 rounded-md font-bold hidden sm:inline-block ${catConfig.badgeBg} ${catConfig.badgeText}`}>
                          {catConfig[isAr ? 'nameAr' : 'nameEn']}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/50">
                        <span>{isAr ? `${debates} مناظرة` : `${debates} sessions`}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">
                          {entry.acceptanceRate}% {isAr ? 'قبول' : 'approval'}
                        </span>
                        {entry.badges?.[0] && (
                          <>
                            <span>•</span>
                            <span className="text-amber-300/80 truncate max-w-[130px]">{entry.badges[0]}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Positive Reactions Aggregate & Breakdown */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                    {/* Arguments Type Micro-Icons */}
                    <div className="hidden lg:flex items-center gap-3 text-xs text-white/60">
                      <span className="flex items-center gap-1" title={isAr ? 'حجة قوية' : 'Strong arguments'}>
                        <span>👏</span>
                        <span className="font-mono font-bold text-white/80">{entry.breakdown?.strongArgument || 0}</span>
                      </span>
                      <span className="flex items-center gap-1" title={isAr ? 'دليل موثق' : 'Evidence'}>
                        <span>📜</span>
                        <span className="font-mono font-bold text-white/80">{entry.breakdown?.evidence || 0}</span>
                      </span>
                      <span className="flex items-center gap-1" title={isAr ? 'دفاع متين' : 'Defense'}>
                        <span>🛡️</span>
                        <span className="font-mono font-bold text-white/80">{entry.breakdown?.solidDefense || 0}</span>
                      </span>
                    </div>

                    {/* Total Positive Reaction Score Highlight */}
                    <div className="bg-slate-950/80 px-4 py-2 rounded-xl border border-emerald-500/30 flex items-center gap-2">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-white/50 font-bold leading-none">
                          {isAr ? (timeframe === 'daily' ? 'نقاط اليوم' : timeframe === 'weekly' ? 'نقاط الأسبوع' : 'التفاعلات الإيجابية') : 'Positive Score'}
                        </span>
                        <span className="text-base font-black font-mono text-emerald-400 leading-tight">
                          +{score}
                        </span>
                      </div>
                      <ThumbsUp size={16} className="text-emerald-400" />
                    </div>

                    <ArrowUpRight size={16} className="text-white/40 group-hover:text-amber-400 transition-colors shrink-0" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Debater Profile & Recent Debates Detail Modal */}
      <AnimatePresence>
        {selectedDebaterModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 shrink-0">
                    <img src={selectedDebaterModal.avatar} alt={selectedDebaterModal.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{selectedDebaterModal.name}</h3>
                    <p className="text-xs text-amber-400 font-bold mt-0.5">
                      {getCategoryConfig(selectedDebaterModal.topCategory)[isAr ? 'nameAr' : 'nameEn']}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDebaterModal(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Key Reaction Score Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block">{isAr ? 'اليومية' : 'Daily'}</span>
                  <span className="font-mono font-black text-amber-400 text-sm">+{selectedDebaterModal.dailyPositiveReactions || 0}</span>
                </div>
                <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block">{isAr ? 'الأسبوعية' : 'Weekly'}</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">+{selectedDebaterModal.weeklyPositiveReactions || 0}</span>
                </div>
                <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block">{isAr ? 'الإجمالي' : 'All-Time'}</span>
                  <span className="font-mono font-black text-amber-300 text-sm">+{selectedDebaterModal.totalPositiveReactions || 0}</span>
                </div>
                <div className="bg-black/40 border border-white/10 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-white/50 block">{isAr ? 'نسبة القبول' : 'Approval'}</span>
                  <span className="font-mono font-black text-sky-400 text-sm">{selectedDebaterModal.acceptanceRate}%</span>
                </div>
              </div>

              {/* Badges List */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-white/70">{isAr ? 'الأوسمة والشهادات المكتسبة:' : 'Earned Badges:'}</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDebaterModal.badges?.map((b, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1">
                      <Award size={12} />
                      <span>{b}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Argument Quality Breakdown */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-white/80">{isAr ? 'توزيع التفاعلات الإيجابية حسب نوع الحجة:' : 'Positive Reactions Distribution:'}</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/5 p-2 rounded-xl text-center">
                    <span className="block text-base mb-0.5">👏</span>
                    <span className="text-[10px] text-white/60 block">{isAr ? 'حجة قوية' : 'Strong Arg'}</span>
                    <span className="font-mono font-bold text-amber-300">{selectedDebaterModal.breakdown?.strongArgument || 0}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl text-center">
                    <span className="block text-base mb-0.5">📜</span>
                    <span className="text-[10px] text-white/60 block">{isAr ? 'دليل موثق' : 'Evidence'}</span>
                    <span className="font-mono font-bold text-emerald-300">{selectedDebaterModal.breakdown?.evidence || 0}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-xl text-center">
                    <span className="block text-base mb-0.5">🛡️</span>
                    <span className="text-[10px] text-white/60 block">{isAr ? 'دفاع متين' : 'Defense'}</span>
                    <span className="font-mono font-bold text-sky-300">{selectedDebaterModal.breakdown?.solidDefense || 0}</span>
                  </div>
                </div>
              </div>

              {/* Recent Debates History */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-white/80">{isAr ? 'أبرز المناظرات المسجلة للمناظر:' : 'Recent Debates:'}</span>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedDebaterModal.recentDebateTitles?.map((title, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 p-2 rounded-xl text-xs text-white/80">
                      <Radio size={13} className="text-amber-400 shrink-0" />
                      <span className="truncate">{title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setSelectedDebaterModal(null)}
                  className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
                {onNavigateToRooms && (
                  <button
                    onClick={() => {
                      setSelectedDebaterModal(null);
                      onNavigateToRooms();
                    }}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Radio size={14} />
                    <span>{isAr ? 'الانتقال لغرف البث الحية' : 'Go to Live Rooms'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
