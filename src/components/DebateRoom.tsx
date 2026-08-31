import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  Mic, 
  MicOff, 
  Users, 
  Clock, 
  Image as ImageIcon, 
  X, 
  Plus, 
  ArrowRight, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  Check, 
  Radio, 
  Flame, 
  MessageSquare, 
  UserCheck, 
  Headphones, 
  AlertTriangle,
  Upload,
  RefreshCw,
  LogOut,
  Send,
  HelpCircle,
  Scale,
  History,
  BookOpen,
  Lightbulb,
  Search,
  Filter,
  Layers,
  CheckCircle2,
  Tag,
  User,
  Camera,
  Smile,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  BarChart2,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity,
  Award,
  Zap,
  ChevronDown,
  ChevronUp,
  Bell,
  HeartHandshake,
  Trophy,
  Crown,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { useApp } from '../context/AppContext';
import DebateLeaderboard from './DebateLeaderboard';
import { 
  createDebateRoom, 
  joinDebateRoom, 
  subscribeToDebateRoom, 
  switchDebateTurn, 
  shareDebateImage, 
  removeSharedDebateImage, 
  endDebateRoom, 
  deleteDebateRoom,
  removeLocalRoom,
  leaveDebateRoom,
  getActiveDebateRooms,
  subscribeToActiveRooms,
  startDebateSession,
  getLocalRooms,
  saveLocalRoom,
  isDemoOrMockRoom,
  withTimeout,
  sendDebateLiveReaction,
  subscribeToDebateLiveReactions
} from '../services/debateService';
import type { DebateRoomData, DebateRole, DebaterProfile, SharedDebateImage, DebateCategory, LiveReactionPayload } from '../types';
class DebateErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Debate Room Render Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-950 text-white min-h-screen flex flex-col items-center justify-center font-mono">
          <div className="p-5 bg-red-950/80 border border-red-500/60 rounded-2xl max-w-lg w-full text-right shadow-2xl">
            <h2 className="text-red-400 font-bold text-base mb-2">⚠️ حدث خطأ أثناء فتح الغرفة</h2>
            <p className="text-xs text-red-200 bg-black/60 p-3 rounded-xl border border-red-900/50 break-words font-mono dir-ltr text-left">
              {this.state.error?.stack || this.state.error?.toString() || 'React Execution Error'}
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-sans font-bold text-xs rounded-xl transition-all">
              إعادة تحميل الغرفة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// Category Definitions & Visual Metadata
// ==========================================
export interface CategoryConfig {
  id: DebateCategory;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  activeBg: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const DEBATE_CATEGORIES: CategoryConfig[] = [
  {
    id: 'all',
    nameAr: 'جميع المناظرات',
    nameEn: 'All Categories',
    descAr: 'استعراض كل الغرف المتاحة حالياً عبر جميع التخصصات',
    descEn: 'Browse all active and open debate rooms',
    badgeBg: 'bg-white/10',
    badgeBorder: 'border-white/20',
    badgeText: 'text-white',
    activeBg: 'bg-white text-slate-950 font-black',
    icon: Layers
  },
  {
    id: 'aqeedah',
    nameAr: 'عقائد وكلام',
    nameEn: 'Creed & Theology',
    descAr: 'مسائل التوحيد، الإمامة، العدل الإلهي، والرد على الشبهات الكلامية',
    descEn: 'Monotheism, Imamah, Theological argumentation and apologetics',
    badgeBg: 'bg-purple-500/20',
    badgeBorder: 'border-purple-500/40',
    badgeText: 'text-purple-300',
    activeBg: 'bg-purple-500 text-white font-black shadow-lg shadow-purple-500/25',
    icon: Sparkles
  },
  {
    id: 'fiqh',
    nameAr: 'فقه وأحكام',
    nameEn: 'Jurisprudence & Fiqh',
    descAr: 'الأحكام الشرعية، المسائل المستحدثة، والقواعد والأصول الفقهية',
    descEn: 'Legal rulings, modern contemporary issues, and jurisprudential principles',
    badgeBg: 'bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-300',
    activeBg: 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/25',
    icon: Scale
  },
  {
    id: 'history',
    nameAr: 'تاريخ وسيرة',
    nameEn: 'History & Biography',
    descAr: 'تحقيق الوقائع التاريخية، سيرة أهل البيت (ع)، وتوثيق المخطوطات',
    descEn: 'Historical investigation, biographical inquiry, and manuscript verification',
    badgeBg: 'bg-amber-500/20',
    badgeBorder: 'border-amber-500/40',
    badgeText: 'text-amber-300',
    activeBg: 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25',
    icon: History
  },
  {
    id: 'quran_hadith',
    nameAr: 'قرآن وحديث',
    nameEn: 'Quran & Hadith',
    descAr: 'مناهج التفسير الموضوعي، علوم القرآن، وعلم دراية الحديث والرجال',
    descEn: 'Quranic hermeneutics, exegesis, Hadith sciences and chain analysis',
    badgeBg: 'bg-sky-500/20',
    badgeBorder: 'border-sky-500/40',
    badgeText: 'text-sky-300',
    activeBg: 'bg-sky-500 text-slate-950 font-black shadow-lg shadow-sky-500/25',
    icon: BookOpen
  },
  {
    id: 'thought',
    nameAr: 'فكر وفلسفة',
    nameEn: 'Thought & Philosophy',
    descAr: 'الفلسفة الإسلامية، المعرفة، الحوار الحضاري، ونقد التيارات الفكرية',
    descEn: 'Islamic philosophy, epistemology, intercultural dialogue and critique',
    badgeBg: 'bg-indigo-500/20',
    badgeBorder: 'border-indigo-500/40',
    badgeText: 'text-indigo-300',
    activeBg: 'bg-indigo-500 text-white font-black shadow-lg shadow-indigo-500/25',
    icon: Lightbulb
  },
  {
    id: 'general',
    nameAr: 'حوارات عامة',
    nameEn: 'General Topics',
    descAr: 'موضوعات حوارية وثقافية متنوعة ونقاشات منهجية مفتوحة',
    descEn: 'General cultural debates, open discussions, and academic exchange',
    badgeBg: 'bg-slate-500/20',
    badgeBorder: 'border-slate-500/40',
    badgeText: 'text-slate-300',
    activeBg: 'bg-slate-300 text-slate-950 font-black shadow-lg shadow-slate-300/25',
    icon: MessageSquare
  }
];

export function getCategoryConfig(catId?: DebateCategory): CategoryConfig {
  const targetId = catId || 'general';
  return DEBATE_CATEGORIES.find(c => c.id === targetId) || DEBATE_CATEGORIES[DEBATE_CATEGORIES.length - 1];
}

// ==========================================
// Preset Avatars for Profile Customization
// ==========================================
export interface AvatarPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  url: string;
}

export const PRESET_AVATARS: AvatarPreset[] = [
  {
    id: 'av_scholar_1',
    nameAr: 'باحث أكاديمي',
    nameEn: 'Academic Scholar',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_2',
    nameAr: 'طالب حوزوي',
    nameEn: 'Seminary Researcher',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_3',
    nameAr: 'محقق تاريخي',
    nameEn: 'Historical Analyst',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_4',
    nameAr: 'مستبصر باحث',
    nameEn: 'Inquiring Scholar',
    url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_5',
    nameAr: 'أستاذ دراسات',
    nameEn: 'Studies Professor',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_6',
    nameAr: 'محاور فلسفي',
    nameEn: 'Philosophical Debater',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_7',
    nameAr: 'باحثة مستبصرة',
    nameEn: 'Woman Researcher',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80'
  },
  {
    id: 'av_scholar_8',
    nameAr: 'رمز نهج النور',
    nameEn: 'Nahj al-Nur Emblem',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=160&auto=format&fit=crop&q=80'
  }
];

// Specialized Reaction Templates for Encouragement / Support
export const POSITIVE_DEBATER_REACTIONS = [
  { emoji: '👍', labelAr: 'أحسنت', labelEn: 'Good Point', shortAr: 'أحسنت', bg: 'hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { emoji: '👏', labelAr: 'حجة قوية', labelEn: 'Strong Argument', shortAr: 'حجة قوية', bg: 'hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { emoji: '💡', labelAr: 'فكرة سديدة', labelEn: 'Insightful', shortAr: 'فكرة', bg: 'hover:bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { emoji: '🌟', labelAr: 'تأييد ونصرة', labelEn: 'Affirmation', shortAr: 'تأييد', bg: 'hover:bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { emoji: '📜', labelAr: 'دليل موثق', labelEn: 'Documented', shortAr: 'دليل', bg: 'hover:bg-sky-500/20 text-sky-300 border-sky-500/30' },
  { emoji: '🛡️', labelAr: 'دفاع متين', labelEn: 'Solid Defense', shortAr: 'دفاع', bg: 'hover:bg-teal-500/20 text-teal-300 border-teal-500/30' },
];

// Specialized Reaction Templates for Dispute / Critique (Counter Faith / Opposition)
export const NEGATIVE_DEBATER_REACTIONS = [
  { emoji: '👎', labelAr: 'غير مقنع', labelEn: 'Unconvincing', shortAr: 'غير مقنع', bg: 'hover:bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { emoji: '❓', labelAr: 'شبهة مردودة', labelEn: 'Questionable', shortAr: 'شبهة', bg: 'hover:bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { emoji: '⚠️', labelAr: 'مغالطة منطقية', labelEn: 'Fallacy', shortAr: 'مغالطة', bg: 'hover:bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { emoji: '❌', labelAr: 'باطل وحجة ضعيفة', labelEn: 'Refuted', shortAr: 'باطل', bg: 'hover:bg-red-500/20 text-red-300 border-red-500/30' },
  { emoji: '🚫', labelAr: 'خروج عن النص', labelEn: 'Off-Topic', shortAr: 'تشتيت', bg: 'hover:bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { emoji: '🛑', labelAr: 'اعتراض صريح', labelEn: 'Strong Objection', shortAr: 'اعتراض', bg: 'hover:bg-rose-600/20 text-rose-300 border-rose-600/30' },
];

// ==========================================
// Inner Live Debate Stage (Inside StreamCall)
// ==========================================
interface DebateStageProps {
  room: DebateRoomData;
  currentUserRole: DebateRole;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  onLeaveRoom: () => void;
  onEndRoom?: (roomId: string) => void;
  isAr: boolean;
}

function DebateStage({
  room: initialRoom,
  currentUserRole: initialUserRole,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onLeaveRoom,
  onEndRoom,
  isAr
}: DebateStageProps) {
  // Resilient Local Room & Role State for 0-latency instant actions
  const [room, setRoom] = useState<DebateRoomData>(initialRoom);
  const [currentUserRole, setCurrentUserRole] = useState<DebateRole>(initialUserRole);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    setRoom(initialRoom);
  }, [initialRoom]);

  useEffect(() => {
    setCurrentUserRole(initialUserRole);
  }, [initialUserRole]);

  // Local Timers State calculated from room timestamps
  const [totalRemainingSeconds, setTotalRemainingSeconds] = useState<number>(() => {
    if (initialRoom.status === 'active' && initialRoom.startedAt) {
      const elapsed = Math.floor((Date.now() - initialRoom.startedAt) / 1000);
      return Math.max(0, initialRoom.totalDurationSeconds - elapsed);
    }
    return 3600;
  });

  const [turnRemainingSeconds, setTurnRemainingSeconds] = useState<number>(() => {
    if (initialRoom.status === 'active' && initialRoom.turnStartTime) {
      const elapsed = Math.floor((Date.now() - initialRoom.turnStartTime) / 1000);
      return Math.max(0, initialRoom.turnDurationSeconds - elapsed);
    }
    return 180;
  });
  
  // Gallery Image Upload Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Floating Reactions State
  const [reactions, setReactions] = useState<{ 
    id: string; 
    emoji: string; 
    label?: string;
    target?: 'debaterA' | 'debaterB' | 'general';
    isNegative?: boolean;
    x: number;
  }[]>([]);

  // Per-Debater Reaction Counters (Positive / Encouragement & Negative / Critical Dispute)
  const [debaterAReactions, setDebaterAReactions] = useState<Record<string, number>>({
    '👍': 14,
    '👏': 9,
    '💡': 16,
    '🌟': 8,
    '📜': 12,
    '🛡️': 8,
    '👎': 3,
    '❓': 4,
    '⚠️': 2,
    '❌': 1,
    '🚫': 1,
    '🛑': 2
  });

  const [debaterBReactions, setDebaterBReactions] = useState<Record<string, number>>({
    '👍': 12,
    '👏': 8,
    '💡': 11,
    '🌟': 7,
    '📜': 9,
    '🛡️': 6,
    '👎': 4,
    '❓': 5,
    '⚠️': 3,
    '❌': 2,
    '🚫': 1,
    '🛑': 2
  });

  // Category filter tabs for reactions under each debater
  const [debaterATab, setDebaterATab] = useState<'all' | 'positive' | 'negative'>('all');
  const [debaterBTab, setDebaterBTab] = useState<'all' | 'positive' | 'negative'>('all');

  // Computed positive and negative support sums for Debater A
  const totalDebaterAPositive = useMemo(() => {
    return POSITIVE_DEBATER_REACTIONS.reduce((sum, r) => sum + (debaterAReactions[r.emoji] || 0), 0);
  }, [debaterAReactions]);

  const totalDebaterANegative = useMemo(() => {
    return NEGATIVE_DEBATER_REACTIONS.reduce((sum, r) => sum + (debaterAReactions[r.emoji] || 0), 0);
  }, [debaterAReactions]);

  const totalAllA = totalDebaterAPositive + totalDebaterANegative;
  const posPercentA = totalAllA > 0 ? Math.round((totalDebaterAPositive / totalAllA) * 100) : 50;
  const negPercentA = 100 - posPercentA;

  // Computed positive and negative support sums for Debater B
  const totalDebaterBPositive = useMemo(() => {
    return POSITIVE_DEBATER_REACTIONS.reduce((sum, r) => sum + (debaterBReactions[r.emoji] || 0), 0);
  }, [debaterBReactions]);

  const totalDebaterBNegative = useMemo(() => {
    return NEGATIVE_DEBATER_REACTIONS.reduce((sum, r) => sum + (debaterBReactions[r.emoji] || 0), 0);
  }, [debaterBReactions]);

  const totalAllB = totalDebaterBPositive + totalDebaterBNegative;
  const posPercentB = totalAllB > 0 ? Math.round((totalDebaterBPositive / totalAllB) * 100) : 50;
  const negPercentB = 100 - posPercentB;

  // Real-Time Live Reaction Alerts & Notification System
  const [reactionAlerts, setReactionAlerts] = useState<{
    id: string;
    senderName: string;
    targetRole: 'debaterA' | 'debaterB' | 'general';
    targetDebaterName: string;
    emoji: string;
    label: string;
    isNegative: boolean;
    timestamp: number;
  }[]>([]);

  const [isReactionSoundEnabled, setIsReactionSoundEnabled] = useState<boolean>(true);
  const [isReactionAlertsVisible, setIsReactionAlertsVisible] = useState<boolean>(true);

  // Brief glowing pulse alert state over Debater A and Debater B cards
  const [lastDebaterAAlert, setLastDebaterAAlert] = useState<{ emoji: string; label: string; isNegative: boolean; id: string } | null>(null);
  const [lastDebaterBAlert, setLastDebaterBAlert] = useState<{ emoji: string; label: string; isNegative: boolean; id: string } | null>(null);

  // Play lightweight synthesized audio cue (Affirmative chime for support, subtle low tone for dispute)
  const playReactionAudioCue = useCallback((isNegative: boolean) => {
    if (!isReactionSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (isNegative) {
        // Subtle dispute acoustic tick
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(340, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Pleasant affirmative chime (E5 -> B5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Gracefully ignore audio autoplay policies if restricted
    }
  }, [isReactionSoundEnabled]);

  // Trigger local instant alert notification banner and visual pulse on debater cards
  const triggerReactionNotification = useCallback((payload: {
    id: string;
    senderName?: string;
    targetRole: 'debaterA' | 'debaterB' | 'general';
    targetDebaterName?: string;
    emoji: string;
    label: string;
    isNegative?: boolean;
  }) => {
    const targetName = payload.targetDebaterName || 
      (payload.targetRole === 'debaterA' ? (room.debaterA?.name || (isAr ? 'المناظر أ' : 'Debater A')) :
       payload.targetRole === 'debaterB' ? (room.debaterB?.name || (isAr ? 'المناظر ب' : 'Debater B')) : 
       (isAr ? 'الغرفة العامة' : 'General Room'));

    const alertItem = {
      id: payload.id,
      senderName: payload.senderName || (isAr ? 'أحد الحضور' : 'Listener'),
      targetRole: payload.targetRole,
      targetDebaterName: targetName,
      emoji: payload.emoji,
      label: payload.label,
      isNegative: !!payload.isNegative,
      timestamp: Date.now()
    };

    setReactionAlerts(prev => [alertItem, ...prev.filter(a => a.id !== alertItem.id)].slice(0, 3));
    playReactionAudioCue(!!payload.isNegative);

    if (payload.targetRole === 'debaterA') {
      setLastDebaterAAlert({ emoji: payload.emoji, label: payload.label, isNegative: !!payload.isNegative, id: payload.id });
      setTimeout(() => {
        setLastDebaterAAlert(prev => (prev?.id === payload.id ? null : prev));
      }, 2600);
    } else if (payload.targetRole === 'debaterB') {
      setLastDebaterBAlert({ emoji: payload.emoji, label: payload.label, isNegative: !!payload.isNegative, id: payload.id });
      setTimeout(() => {
        setLastDebaterBAlert(prev => (prev?.id === payload.id ? null : prev));
      }, 2600);
    }

    setTimeout(() => {
      setReactionAlerts(prev => prev.filter(a => a.id !== alertItem.id));
    }, 4500);
  }, [playReactionAudioCue, room.debaterA?.name, room.debaterB?.name, isAr]);

  // Voice visualizer simulation (audio waves)
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time Analytics & Speaking Time Stats State (Tracked with Recharts)
  const [speakingSecondsA, setSpeakingSecondsA] = useState<number>(() => {
    if (initialRoom.roundNumber && initialRoom.roundNumber > 1) {
      return (initialRoom.roundNumber - 1) * 165 + (initialRoom.currentTurn === 'debaterA' ? 45 : 180);
    }
    return initialRoom.currentTurn === 'debaterA' ? 45 : 20;
  });

  const [speakingSecondsB, setSpeakingSecondsB] = useState<number>(() => {
    if (initialRoom.roundNumber && initialRoom.roundNumber > 1) {
      return (initialRoom.roundNumber - 1) * 155 + (initialRoom.currentTurn === 'debaterB' ? 45 : 0);
    }
    return initialRoom.currentTurn === 'debaterB' ? 45 : 15;
  });

  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({
    '👍': 14,
    '👏': 9,
    '💡': 18,
    '📜': 12,
    '⚖️': 7,
    '🌟': 11
  });

  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState<boolean>(true);
  const [analyticsTab, setAnalyticsTab] = useState<'popular_acceptance' | 'time_distribution' | 'rounds_compare' | 'activity_timeline' | 'reactions_stats'>('popular_acceptance');
  const [sentimentChartMode, setSentimentChartMode] = useState<'overview' | 'comparison' | 'breakdown'>('overview');

  // Determine who has the floor
  const isDebaterAActive = room.currentTurn === 'debaterA';
  const isDebaterBActive = room.currentTurn === 'debaterB';

  const isCurrentDebaterTurn = 
    (currentUserRole === 'debaterA' && isDebaterAActive) ||
    (currentUserRole === 'debaterB' && isDebaterBActive);

  const canShareImage = currentUserRole === 'debaterA' || currentUserRole === 'debaterB';

  // ----------------------------------------------------
  // 1. High-Precision Local Timers Engine (60 min & 3 min turns)
  // ----------------------------------------------------
  useEffect(() => {
    if (room.status !== 'active') {
      if (room.status === 'ended') {
        setTotalRemainingSeconds(0);
        setTurnRemainingSeconds(0);
      }
      return;
    }

    const timerInterval = setInterval(() => {
      const now = Date.now();
      
      // Calculate overall 60-min (3600s) session timer
      const startedAt = room.startedAt || now;
      const elapsedTotalSec = Math.floor((now - startedAt) / 1000);
      const totalLeft = Math.max(0, (room.totalDurationSeconds || 3600) - elapsedTotalSec);
      setTotalRemainingSeconds(totalLeft);

      // Check if 60-minute duration expired -> auto close and purge room!
      if (totalLeft <= 0) {
        clearInterval(timerInterval);
        const endedRoom: DebateRoomData = { ...room, status: 'ended' };
        setRoom(endedRoom);
        removeLocalRoom(room.id);
        endDebateRoom(room.id).catch(() => {});
        deleteDebateRoom(room.id).catch(() => {});
        return;
      }

      // Calculate 3-min (180s) turn timer
      const turnStart = room.turnStartTime || now;
      const turnElapsedSec = Math.floor((now - turnStart) / 1000);
      const turnLeft = Math.max(0, (room.turnDurationSeconds || 180) - turnElapsedSec);
      setTurnRemainingSeconds(turnLeft);

      // Accumulate live speaking time for analytics charts
      if (room.currentTurn === 'debaterA') {
        setSpeakingSecondsA(prev => Math.round(prev + 0.5));
      } else if (room.currentTurn === 'debaterB') {
        setSpeakingSecondsB(prev => Math.round(prev + 0.5));
      }

      // Check if 3-minute turn ended -> switch turn automatically!
      if (turnLeft <= 0) {
        const nextTurn = room.currentTurn === 'debaterA' ? 'debaterB' : 'debaterA';
        const nextRound = nextTurn === 'debaterA' ? (room.roundNumber || 1) + 1 : (room.roundNumber || 1);
        const updatedRoom: DebateRoomData = {
          ...room,
          currentTurn: nextTurn,
          turnStartTime: Date.now(),
          roundNumber: nextRound
        };
        setRoom(updatedRoom);
        saveLocalRoom(updatedRoom);
        setTurnRemainingSeconds(180);
        switchDebateTurn(room.id, room.currentTurn, room.roundNumber).catch(() => {});
      }
    }, 500);

    return () => clearInterval(timerInterval);
  }, [room.status, room.startedAt, room.turnStartTime, room.currentTurn, room.roundNumber, room.id, room.totalDurationSeconds, room.turnDurationSeconds]);

  // ----------------------------------------------------
  // 2. Audio Visualizer Pulse Simulator (Active Speaker)
  // ----------------------------------------------------
  useEffect(() => {
    if (room.status !== 'active') {
      setAudioLevel(0);
      return;
    }
    const interval = setInterval(() => {
      // Simulate speech audio waves for whoever is speaking
      setAudioLevel(Math.floor(Math.random() * 80) + 20);
    }, 150);
    return () => clearInterval(interval);
  }, [room.status, room.currentTurn]);

  // Format MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Turn time percentage for progress bar
  const turnProgressPercent = Math.max(0, Math.min(100, (turnRemainingSeconds / (room.turnDurationSeconds || 180)) * 100));
  const totalProgressPercent = Math.max(0, Math.min(100, (totalRemainingSeconds / (room.totalDurationSeconds || 3600)) * 100));

  // Handle Image Selection from Phone Gallery
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert(isAr ? 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 10 ميجابايت' : 'Image too large, max 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setSelectedImageFile(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Broadcast image to room instantly
  const handlePublishImage = () => {
    if (!selectedImageFile) return;
    setIsUploadingImage(true);
    const sharedImg: SharedDebateImage = {
      id: `img_${Date.now()}`,
      url: selectedImageFile,
      caption: imageCaption.trim() || undefined,
      sharedBy: currentUserName || (isAr ? 'المناظر' : 'Debater'),
      sharedByRole: (currentUserRole === 'debaterB' ? 'debaterB' : 'debaterA'),
      timestamp: Date.now()
    };

    const updatedRoom: DebateRoomData = {
      ...room,
      currentSharedImage: sharedImg
    };

    setRoom(updatedRoom);
    saveLocalRoom(updatedRoom);
    setShowImageModal(false);
    setSelectedImageFile(null);
    setImageCaption('');
    setIsUploadingImage(false);

    shareDebateImage(room.id, {
      url: selectedImageFile,
      caption: imageCaption.trim() || undefined,
      sharedBy: currentUserName,
      sharedByRole: (currentUserRole === 'debaterB' ? 'debaterB' : 'debaterA')
    }).catch(() => {});
  };

  // Remove shared image instantly
  const handleRemoveImage = () => {
    const updatedRoom: DebateRoomData = {
      ...room,
      currentSharedImage: null
    };
    setRoom(updatedRoom);
    saveLocalRoom(updatedRoom);
    removeSharedDebateImage(room.id).catch(() => {});
  };

  // Add Live Reaction (Targeted to a specific debater or general)
  const handleSendTargetedReaction = (
    target: 'debaterA' | 'debaterB',
    emoji: string,
    label: string,
    isNegative: boolean = false
  ) => {
    // Determine x offset: Debater A is on left (10-32%), Debater B is on right (68-90%)
    const x = target === 'debaterA'
      ? Math.random() * 22 + 8
      : Math.random() * 22 + 70;

    const reactionId = `rx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newReaction = {
      id: reactionId,
      emoji,
      label,
      target,
      isNegative,
      x
    };

    setReactions(prev => [...prev.slice(-20), newReaction]);

    if (target === 'debaterA') {
      setDebaterAReactions(prev => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1
      }));
    } else {
      setDebaterBReactions(prev => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1
      }));
    }

    setReactionCounts(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));

    const targetDebaterName = target === 'debaterA' 
      ? (room.debaterA?.name || (isAr ? 'المناظر أ' : 'Debater A'))
      : (room.debaterB?.name || (isAr ? 'المناظر ب' : 'Debater B'));

    // Trigger instant local notification and sound cue
    triggerReactionNotification({
      id: reactionId,
      senderName: currentUserName,
      targetRole: target,
      targetDebaterName,
      emoji,
      label,
      isNegative
    });

    // Broadcast in real-time to all other listeners and debaters in the room
    sendDebateLiveReaction({
      id: reactionId,
      roomId: room.id,
      senderName: currentUserName,
      senderUid: currentUserId,
      targetRole: target,
      targetDebaterName,
      emoji,
      label,
      isNegative,
      timestamp: Date.now()
    }).catch(() => {});

    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 2600);
  };

  // Add General Live Reaction
  const handleSendReaction = (emoji: string) => {
    const reactionId = `rx_gen_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newReaction = {
      id: reactionId,
      emoji,
      target: 'general' as const,
      x: Math.random() * 60 + 20
    };
    setReactions(prev => [...prev.slice(-15), newReaction]);
    setReactionCounts(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));

    // Trigger general notification
    triggerReactionNotification({
      id: reactionId,
      senderName: currentUserName,
      targetRole: 'general',
      emoji,
      label: isAr ? 'تفاعل عام مع الغرفة' : 'General Reaction',
      isNegative: false
    });

    sendDebateLiveReaction({
      id: reactionId,
      roomId: room.id,
      senderName: currentUserName,
      senderUid: currentUserId,
      targetRole: 'general',
      targetDebaterName: isAr ? 'الغرفة الصوتية' : 'Debate Arena',
      emoji,
      label: isAr ? 'تفاعل عام' : 'General Reaction',
      isNegative: false,
      timestamp: Date.now()
    }).catch(() => {});

    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 2500);
  };

  // Subscribe to Live Reactions broadcast from Firebase RTDB in real time
  useEffect(() => {
    const unsubReactions = subscribeToDebateLiveReactions(room.id, (remoteRx: LiveReactionPayload) => {
      if (!remoteRx || remoteRx.senderUid === currentUserId) return;

      const x = remoteRx.targetRole === 'debaterA'
        ? Math.random() * 22 + 8
        : remoteRx.targetRole === 'debaterB'
          ? Math.random() * 22 + 70
          : Math.random() * 60 + 20;

      const floatingRx = {
        id: remoteRx.id,
        emoji: remoteRx.emoji,
        label: remoteRx.label,
        target: remoteRx.targetRole,
        isNegative: remoteRx.isNegative,
        x
      };

      setReactions(prev => [...prev.slice(-20), floatingRx]);

      if (remoteRx.targetRole === 'debaterA') {
        setDebaterAReactions(prev => ({
          ...prev,
          [remoteRx.emoji]: (prev[remoteRx.emoji] || 0) + 1
        }));
      } else if (remoteRx.targetRole === 'debaterB') {
        setDebaterBReactions(prev => ({
          ...prev,
          [remoteRx.emoji]: (prev[remoteRx.emoji] || 0) + 1
        }));
      }

      setReactionCounts(prev => ({
        ...prev,
        [remoteRx.emoji]: (prev[remoteRx.emoji] || 0) + 1
      }));

      // Trigger instant audio & toast notification
      triggerReactionNotification({
        id: remoteRx.id,
        senderName: remoteRx.senderName,
        targetRole: remoteRx.targetRole,
        targetDebaterName: remoteRx.targetDebaterName,
        emoji: remoteRx.emoji,
        label: remoteRx.label,
        isNegative: remoteRx.isNegative
      });

      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== floatingRx.id));
      }, 2600);
    });

    return () => {
      unsubReactions();
    };
  }, [room.id, currentUserId, triggerReactionNotification]);

  // Handle Manual Pass Turn (Finish early and pass floor)
  const handlePassTurnManually = () => {
    if (!isCurrentDebaterTurn) return;
    const nextTurn = room.currentTurn === 'debaterA' ? 'debaterB' : 'debaterA';
    const nextRound = nextTurn === 'debaterA' ? (room.roundNumber || 1) + 1 : (room.roundNumber || 1);
    const updatedRoom: DebateRoomData = {
      ...room,
      currentTurn: nextTurn,
      turnStartTime: Date.now(),
      roundNumber: nextRound
    };
    setRoom(updatedRoom);
    saveLocalRoom(updatedRoom);
    setTurnRemainingSeconds(180);
    switchDebateTurn(room.id, room.currentTurn, room.roundNumber).catch(() => {});
  };

  // Start Session manually
  const handleStartSession = () => {
    const updatedRoom: DebateRoomData = {
      ...room,
      status: 'active',
      startedAt: Date.now(),
      turnStartTime: Date.now()
    };
    setRoom(updatedRoom);
    saveLocalRoom(updatedRoom);
    setTotalRemainingSeconds(3600);
    setTurnRemainingSeconds(180);
    startDebateSession(room.id).catch(() => {});
  };

  // Take an open debater slot
  const handleTakeDebaterSlot = (slotRole: 'debaterA' | 'debaterB') => {
    const debaterProfile: DebaterProfile = {
      uid: currentUserId,
      name: currentUserName || (isAr ? 'مشارك في الحوار' : 'Debate Participant'),
      avatar: currentUserAvatar || (slotRole === 'debaterA' 
        ? PRESET_AVATARS[0].url 
        : PRESET_AVATARS[1].url),
      role: slotRole,
      joinedAt: Date.now()
    };

    const hasBoth = (slotRole === 'debaterA' && room.debaterB) || (slotRole === 'debaterB' && room.debaterA);
    const filteredListeners = (room.listeners || []).filter(l => l.uid !== currentUserId);
    const updatedRoom: DebateRoomData = {
      ...room,
      [slotRole]: debaterProfile,
      listeners: filteredListeners,
      listenersCount: filteredListeners.length,
      status: hasBoth ? 'active' : room.status,
      startedAt: hasBoth ? (room.startedAt || Date.now()) : room.startedAt,
      turnStartTime: hasBoth ? Date.now() : room.turnStartTime
    };

    setRoom(updatedRoom);
    setCurrentUserRole(slotRole);
    saveLocalRoom(updatedRoom);
    joinDebateRoom(room.id, { uid: currentUserId, name: currentUserName }, slotRole).catch(() => {});
  };

  // Debaters display names for Recharts labels
  const debaterAName = room.debaterA?.name || (isAr ? 'المحاور (أ)' : 'Debater A');
  const debaterBName = room.debaterB?.name || (isAr ? 'المحاور (ب)' : 'Debater B');

  // Speaking time balance calculation
  const totalSpeakingSec = Math.max(1, speakingSecondsA + speakingSecondsB);
  const percentA = Math.round((speakingSecondsA / totalSpeakingSec) * 100);
  const percentB = 100 - percentA;

  // 1. Data for Recharts Pie / Donut Chart (Speaking Time Share)
  const speakingPieData = useMemo(() => [
    {
      name: debaterAName,
      value: speakingSecondsA,
      color: '#f59e0b',
      percent: percentA
    },
    {
      name: debaterBName,
      value: speakingSecondsB,
      color: '#10b981',
      percent: percentB
    }
  ], [debaterAName, debaterBName, speakingSecondsA, speakingSecondsB, percentA, percentB]);

  // 2. Data for Recharts Grouped Bar Chart (Rounds Progression)
  const roundAnalyticsData = useMemo(() => {
    const currentRound = room.roundNumber || 1;
    const maxR = Math.max(currentRound, 3);
    const data = [];
    for (let r = 1; r <= maxR; r++) {
      let aSec = 0;
      let bSec = 0;
      if (r < currentRound) {
        aSec = 175;
        bSec = 168;
      } else if (r === currentRound) {
        if (room.currentTurn === 'debaterA') {
          aSec = Math.min(180, Math.max(15, 180 - turnRemainingSeconds));
          bSec = 0;
        } else {
          aSec = 175;
          bSec = Math.min(180, Math.max(15, 180 - turnRemainingSeconds));
        }
      }
      data.push({
        round: isAr ? `الجولة ${r}` : `Round ${r}`,
        debaterA: aSec,
        debaterB: bSec,
        totalSec: aSec + bSec
      });
    }
    return data;
  }, [room.roundNumber, room.currentTurn, turnRemainingSeconds, isAr]);

  // 3. Data for Recharts Area Chart (Speaking Activity Flow Timeline)
  const timelineData = useMemo(() => {
    const currentRound = room.roundNumber || 1;
    const data = [];
    const points = 6;
    for (let i = 1; i <= points; i++) {
      const isPast = i <= currentRound * 2;
      data.push({
        time: isAr ? `${i * 3} د` : `${i * 3}m`,
        debaterA: isPast ? (i % 2 === 1 ? 160 + (i * 2) : 25) : (room.currentTurn === 'debaterA' ? Math.min(180, 180 - turnRemainingSeconds) : 0),
        debaterB: isPast ? (i % 2 === 0 ? 155 + (i * 3) : 30) : (room.currentTurn === 'debaterB' ? Math.min(180, 180 - turnRemainingSeconds) : 0)
      });
    }
    return data;
  }, [room.roundNumber, room.currentTurn, turnRemainingSeconds, isAr]);

  // 4. Data for Recharts Reactions Distribution
  const reactionChartData = useMemo(() => [
    { label: isAr ? '👍 أحسنت' : '👍 Agree', count: reactionCounts['👍'] || 0, color: '#38bdf8' },
    { label: isAr ? '👏 إتقان' : '👏 Applause', count: reactionCounts['👏'] || 0, color: '#10b981' },
    { label: isAr ? '💡 فكرة' : '💡 Insight', count: reactionCounts['💡'] || 0, color: '#f59e0b' },
    { label: isAr ? '📜 وثيقة' : '📜 Evidence', count: reactionCounts['📜'] || 0, color: '#a855f7' },
    { label: isAr ? '⚖️ إنصاف' : '⚖️ Balance', count: reactionCounts['⚖️'] || 0, color: '#ec4899' },
    { label: isAr ? '🌟 تميز' : '🌟 Star', count: reactionCounts['🌟'] || 0, color: '#eab308' }
  ], [reactionCounts, isAr]);

  const totalReactionsCount = useMemo(() => {
    return Object.values(reactionCounts).reduce((acc: number, curr: number) => acc + curr, 0);
  }, [reactionCounts]);

  // 5. Data for Recharts Debater Sentiment / Popular Acceptance Comparison
  const debaterSentimentComparisonData = useMemo(() => [
    {
      name: debaterAName,
      shortName: room.debaterA?.name ? (room.debaterA.name.length > 12 ? `${room.debaterA.name.substring(0, 12)}...` : room.debaterA.name) : (isAr ? 'المناظر (أ)' : 'Debater A'),
      positive: totalDebaterAPositive,
      negative: totalDebaterANegative,
      posPercent: posPercentA,
      negPercent: negPercentA,
      total: totalAllA,
      acceptanceScore: posPercentA
    },
    {
      name: debaterBName,
      shortName: room.debaterB?.name ? (room.debaterB.name.length > 12 ? `${room.debaterB.name.substring(0, 12)}...` : room.debaterB.name) : (isAr ? 'المناظر (ب)' : 'Debater B'),
      positive: totalDebaterBPositive,
      negative: totalDebaterBNegative,
      posPercent: posPercentB,
      negPercent: negPercentB,
      total: totalAllB,
      acceptanceScore: posPercentB
    }
  ], [debaterAName, debaterBName, room.debaterA?.name, room.debaterB?.name, totalDebaterAPositive, totalDebaterANegative, posPercentA, negPercentA, totalAllA, totalDebaterBPositive, totalDebaterBNegative, posPercentB, negPercentB, totalAllB, isAr]);

  // 6. Donut Data for Debater A Acceptance Breakdown
  const debaterASentimentPieData = useMemo(() => [
    { 
      name: isAr ? 'تأييد وإشادة بالحجة' : 'Positive Support', 
      value: totalDebaterAPositive || (totalAllA === 0 ? 1 : 0), 
      count: totalDebaterAPositive,
      percent: posPercentA, 
      color: '#10b981' 
    },
    { 
      name: isAr ? 'نقد واعتراض منهجي' : 'Negative Dispute', 
      value: totalDebaterANegative || 0, 
      count: totalDebaterANegative,
      percent: negPercentA, 
      color: '#f43f5e' 
    }
  ], [totalDebaterAPositive, totalDebaterANegative, posPercentA, negPercentA, totalAllA, isAr]);

  // 7. Donut Data for Debater B Acceptance Breakdown
  const debaterBSentimentPieData = useMemo(() => [
    { 
      name: isAr ? 'تأييد وإشادة بالحجة' : 'Positive Support', 
      value: totalDebaterBPositive || (totalAllB === 0 ? 1 : 0), 
      count: totalDebaterBPositive,
      percent: posPercentB, 
      color: '#10b981' 
    },
    { 
      name: isAr ? 'نقد واعتراض منهجي' : 'Negative Dispute', 
      value: totalDebaterBNegative || 0, 
      count: totalDebaterBNegative,
      percent: negPercentB, 
      color: '#f43f5e' 
    }
  ], [totalDebaterBPositive, totalDebaterBNegative, posPercentB, negPercentB, totalAllB, isAr]);

  // 8. Categorical Reactions Breakdown comparing both Debaters (Criteria Comparison)
  const categoricalSentimentComparison = useMemo(() => [
    {
      category: isAr ? 'حجة قوية / إتقان' : 'Strong Argument',
      tag: '👏 👍',
      debaterA: (debaterAReactions['👍'] || 0) + (debaterAReactions['👏'] || 0),
      debaterB: (debaterBReactions['👍'] || 0) + (debaterBReactions['👏'] || 0),
      type: 'positive'
    },
    {
      category: isAr ? 'دليل موثق وفكرة' : 'Documented Evidence',
      tag: '📜 💡',
      debaterA: (debaterAReactions['📜'] || 0) + (debaterAReactions['💡'] || 0),
      debaterB: (debaterBReactions['📜'] || 0) + (debaterBReactions['💡'] || 0),
      type: 'positive'
    },
    {
      category: isAr ? 'تأييد ودفاع متين' : 'Solid Defense',
      tag: '🌟 🛡️',
      debaterA: (debaterAReactions['🌟'] || 0) + (debaterAReactions['🛡️'] || 0),
      debaterB: (debaterBReactions['🌟'] || 0) + (debaterBReactions['🛡️'] || 0),
      type: 'positive'
    },
    {
      category: isAr ? 'شبهة / غير مقنع' : 'Unconvincing / Doubt',
      tag: '👎 ❓',
      debaterA: (debaterAReactions['👎'] || 0) + (debaterAReactions['❓'] || 0),
      debaterB: (debaterBReactions['👎'] || 0) + (debaterBReactions['❓'] || 0),
      type: 'negative'
    },
    {
      category: isAr ? 'مغالطة / باطل' : 'Fallacy / Refuted',
      tag: '⚠️ ❌',
      debaterA: (debaterAReactions['⚠️'] || 0) + (debaterAReactions['❌'] || 0),
      debaterB: (debaterBReactions['⚠️'] || 0) + (debaterBReactions['❌'] || 0),
      type: 'negative'
    },
    {
      category: isAr ? 'اعتراض / تشتيت' : 'Objection / Off-Topic',
      tag: '🛑 🚫',
      debaterA: (debaterAReactions['🛑'] || 0) + (debaterAReactions['🚫'] || 0),
      debaterB: (debaterBReactions['🛑'] || 0) + (debaterBReactions['🚫'] || 0),
      type: 'negative'
    }
  ], [debaterAReactions, debaterBReactions, isAr]);

  // 9. Detailed Emojis for Debater A
  const debaterADetailedReactionsList = useMemo(() => {
    const list = [
      ...POSITIVE_DEBATER_REACTIONS.map(r => ({
        emoji: r.emoji,
        label: isAr ? r.labelAr : r.labelEn,
        count: debaterAReactions[r.emoji] || 0,
        type: 'positive' as const,
        color: '#10b981'
      })),
      ...NEGATIVE_DEBATER_REACTIONS.map(r => ({
        emoji: r.emoji,
        label: isAr ? r.labelAr : r.labelEn,
        count: debaterAReactions[r.emoji] || 0,
        type: 'negative' as const,
        color: '#f43f5e'
      }))
    ];
    return list.filter(i => i.count > 0).sort((a, b) => b.count - a.count);
  }, [debaterAReactions, isAr]);

  // 10. Detailed Emojis for Debater B
  const debaterBDetailedReactionsList = useMemo(() => {
    const list = [
      ...POSITIVE_DEBATER_REACTIONS.map(r => ({
        emoji: r.emoji,
        label: isAr ? r.labelAr : r.labelEn,
        count: debaterBReactions[r.emoji] || 0,
        type: 'positive' as const,
        color: '#10b981'
      })),
      ...NEGATIVE_DEBATER_REACTIONS.map(r => ({
        emoji: r.emoji,
        label: isAr ? r.labelAr : r.labelEn,
        count: debaterBReactions[r.emoji] || 0,
        type: 'negative' as const,
        color: '#f43f5e'
      }))
    ];
    return list.filter(i => i.count > 0).sort((a, b) => b.count - a.count);
  }, [debaterBReactions, isAr]);

  return (
    <div className="relative w-full max-w-6xl mx-auto flex flex-col gap-4 text-white p-2 sm:p-4 select-none pb-24">
      {/* Floating Audience Reactions Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 1, y: '80%', x: `${reaction.x}%`, scale: 0.7 }}
              animate={{ 
                opacity: [0.95, 1, 0], 
                y: ['75%', '40%', '8%'], 
                scale: [0.8, 1.4, 1.1] 
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="absolute flex flex-col items-center pointer-events-none drop-shadow-2xl z-50"
            >
              <span className="text-3xl sm:text-4xl filter drop-shadow">{reaction.emoji}</span>
              {reaction.label && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border shadow-lg mt-0.5 whitespace-nowrap ${
                  reaction.isNegative 
                    ? 'bg-rose-950/95 text-rose-300 border-rose-500/50' 
                    : 'bg-emerald-950/95 text-emerald-300 border-emerald-500/50'
                }`}>
                  {reaction.label}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top Header: Room Title & 60-Minute Master Timer */}
      <header className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Radio className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {room.status === 'active' ? (isAr ? 'مناظرة جارية' : 'Live Debate') : (isAr ? 'في انتظار المناظرين' : 'Waiting Room')}
              </span>
              
              {/* Room Category Pill */}
              {(() => {
                const cat = getCategoryConfig(room.category);
                const CatIcon = cat.icon;
                return (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black border flex items-center gap-1 ${cat.badgeBg} ${cat.badgeBorder} ${cat.badgeText}`}>
                    <CatIcon size={12} />
                    <span>{isAr ? cat.nameAr : cat.nameEn}</span>
                  </span>
                );
              })()}

              <span className="text-xs text-white/50 flex items-center gap-1">
                <Users size={13} /> {room.listenersCount || 1} {isAr ? 'مستمع' : 'Listeners'}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white truncate max-w-[280px] sm:max-w-md mt-0.5">
              {room.title}
            </h1>
          </div>
        </div>

        {/* 60-Minute Master Countdown Gauge */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex flex-col items-center sm:items-end bg-black/40 px-4 py-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-bold">
              <Clock size={13} />
              <span>{isAr ? 'الوقت الإجمالي للمناظرة (60 دقيقة)' : 'Master 60-Min Timer'}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl sm:text-2xl font-mono font-black text-amber-400 tracking-wider">
                {formatTime(totalRemainingSeconds)}
              </span>
              <span className="text-[10px] text-white/40 font-mono">/ 60:00</span>
            </div>
            {/* Total progress bar */}
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalProgressPercent}%` }}
              />
            </div>
          </div>

          {/* End Debate Button (for debaters / host) */}
          {(currentUserRole === 'debaterA' || currentUserRole === 'debaterB') && (
            <button
              onClick={() => setShowEndConfirmModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 active:scale-95 text-red-300 border border-red-500/40 flex items-center gap-1.5 text-xs font-black shadow-lg transition-all cursor-pointer shrink-0"
              title={isAr ? 'إنهاء المناظرة وإغلاق الغرفة وحذفها نهائياً' : 'End Debate & Delete Room Permanently'}
            >
              <AlertTriangle size={15} className="text-red-400" />
              <span>{isAr ? 'إنهاء المناظرة' : 'End Debate'}</span>
            </button>
          )}
</div>
</header>
{/* 1. الشريط العلوي المبسط Header */}
<header className="flex items-center justify-between p-4 bg-slate-900/90 border-b border-slate-800">
  <div>
    <h2 className="text-base font-bold text-white">{room?.title || (isAr ? 'غرفة المناظرة' : 'Live')}</h2>
    <span className="text-xs text-emerald-400 font-medium">● {isAr ? 'بث مباشر' : 'Live'}</span>
  </div>
  <button 
    onClick={onLeaveRoom}
    className="px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl border border-red-500/30 transition-all flex items-center gap-1">
    <LogOut size={14} />
    <span>{isAr ? 'مغادرة الغرفة' : 'Leave Room'}</span>
  </button>
</header>

{/* 2. منطقة المناظرين (جنباً إلى جنب) */}
<div className="grid grid-cols-2 gap-3 p-4">
  
  {/* المناظر الأول (الطرف أ) */}
  <div className={`flex flex-col items-center p-4 rounded-2xl bg-slate-800/60 border ${room?.currentTurn === 'debaterA' ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50' : 'border-slate-700/60'}`}>
    <div className="relative">
      <img 
        src={room?.debaterA?.avatar || PRESET_AVATARS[0].url} 
        className={`w-20 h-20 rounded-full object-cover border-2 ${room?.currentTurn === 'debaterA' ? 'border-emerald-400' : 'border-slate-600'}`} 
      />
      <span className={`absolute bottom-0 right-0 p-1.5 rounded-full border-2 border-slate-900 ${room?.currentTurn === 'debaterA' ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-red-500 text-white'}`}>
        {room?.currentTurn === 'debaterA' ? <Mic size={12} /> : <MicOff size={12} />}
      </span>
    </div>

    <h3 className="mt-2 text-sm font-bold text-white truncate max-w-full">{room?.debaterA?.name || (isAr ? 'الطرف أ' : 'Debater A')}</h3>
    
    <div className="mt-1.5">
      {room?.currentTurn === 'debaterA' ? (
        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          ⏱️ {Math.floor((room?.turnSecondsLeft || 0) / 60)}:{('0' + ((room?.turnSecondsLeft || 0) % 60)).slice(-2)}
        </span>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-700/40">
          {isAr ? 'مكتوم' : 'Muted'}
        </span>
      )}
    </div>

    <button 
      onClick={() => handleSendReaction && handleSendReaction('debaterA')}
      className="mt-3 w-full py-2 bg-slate-700/50 hover:bg-emerald-600/20 text-emerald-400 text-xs font-bold rounded-xl border border-slate-600/50 flex items-center justify-center gap-1.5 transition-all">
      👏 {isAr ? 'تأييد وتفاعل' : 'React'}
    </button>
  </div>

  {/* المناظر الثاني (الطرف ب) */}
  <div className={`flex flex-col items-center p-4 rounded-2xl bg-slate-800/60 border ${room?.currentTurn === 'debaterB' ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50' : 'border-slate-700/60'}`}>
    {room?.debaterB ? (
      <>
        <div className="relative">
          <img 
            src={room?.debaterB?.avatar || PRESET_AVATARS[0].url}
            className={`w-20 h-20 rounded-full object-cover border-2 ${room?.currentTurn === 'debaterB' ? 'border-emerald-400' : 'border-slate-600'}`} 
          />
          <span className={`absolute bottom-0 right-0 p-1.5 rounded-full border-2 border-slate-900 ${room?.currentTurn === 'debaterB' ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-red-500 text-white'}`}>
            {room?.currentTurn === 'debaterB' ? <Mic size={12} /> : <MicOff size={12} />}
          </span>
        </div>

        <h3 className="mt-2 text-sm font-bold text-white truncate max-w-full">{room?.debaterB?.name || (isAr ? 'الطرف ب' : 'Debater B')}</h3>

        <div className="mt-1.5">
          {room?.currentTurn === 'debaterB' ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ⏱️ {Math.floor((room?.turnSecondsLeft || 0) / 60)}:{('0' + ((room?.turnSecondsLeft || 0) % 60)).slice(-2)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs text-slate-400 bg-slate-700/40">
              {isAr ? 'مكتوم' : 'Muted'}
            </span>
          )}
        </div>

        <button 
          onClick={() => handleSendReaction && handleSendReaction('debaterB')}
          className="mt-3 w-full py-2 bg-slate-700/50 hover:bg-emerald-600/20 text-emerald-400 text-xs font-bold rounded-xl border border-slate-600/50 flex items-center justify-center gap-1.5 transition-all">
          👏 {isAr ? 'تأييد وتفاعل' : 'React'}
        </button>
      </>
    ) : (
      /* المقعد فارغ */
      <div className="flex flex-col items-center justify-center h-full py-4 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700/30 border border-dashed border-slate-500 flex items-center justify-center text-slate-400 mb-2">
          <Users size={24} />
        </div>
        <p className="text-xs text-slate-400 mb-3">{isAr ? 'المقعد فارغ' : 'Seat Empty'}</p>
        <button 
          onClick={() => handleTakeDebaterSlot && handleTakeDebaterSlot('debaterB')}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all">
          {isAr ? 'احجز المقعد' : 'Take Seat'}
        </button>
      </div>
    )}
  </div>

</div>
          

      {/* ==================================================== */}
      {/* Listeners & Audience Section (المستمعون والحضور)     */}
      {/* ==================================================== */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-3.5">
        {/* Section Header with Cumulative Count */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Headphones size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>{isAr ? 'المستمعون والحضور' : 'Listeners & Audience'}</span>
              </h3>
              <p className="text-[11px] text-white/50">
                {isAr ? 'حضور الصالة الصوتية (استماع وتفاعل)' : 'Live audio room audience'}
              </p>
            </div>
          </div>

          {/* Statistical Cumulative Listeners Badge */}
          <div className="px-3.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2 text-sky-300">
            <Headphones size={14} className="animate-pulse" />
            <span className="text-xs font-black font-mono">
              {isAr ? `المستمعون: ${Math.max(room.listeners?.length || 0, room.listenersCount || 0)}` : `Listeners: ${Math.max(room.listeners?.length || 0, room.listenersCount || 0)}`}
            </span>
          </div>
        </div>

        {/* Listeners Avatars Grid / Row */}
        {room.listeners && room.listeners.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {room.listeners.map((listener, idx) => (
              <div 
                key={listener.uid || `listener_${idx}`}
                className="group relative flex items-center gap-2.5 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-sky-500/40 rounded-xl p-1.5 pr-3 transition-all duration-200"
              >
                {/* Avatar with Headphone Overlay Badge */}
                <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/20 group-hover:border-sky-400 shadow-md">
                  <img 
                    src={listener.avatar || PRESET_AVATARS[0].url} 
                    alt={listener.name} 
                    className="w-full h-full object-cover"
                  />
                  {/* Small Headphone badge confirming listener-only state */}
                  <div 
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-sky-600 rounded-full border border-slate-900 flex items-center justify-center text-white"
                    title={isAr ? 'مستمع فقط (بدون مايكروفون)' : 'Listener only (Mic muted)'}
                  >
                    <Headphones size={8} />
                  </div>
                </div>

                {/* Name & Role Tag */}
                <div className="flex flex-col min-w-0 max-w-[110px]">
                  <span className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                    {listener.name || (isAr ? 'مستمع' : 'Listener')}
                  </span>
                  <span className="text-[9px] text-white/40 font-mono">
                    {listener.uid === currentUserId ? (isAr ? '(أنت)' : '(You)') : (isAr ? 'مستمع' : 'Audience')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 px-3 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-white/40 text-xs">
            <Headphones size={15} />
            <span>
              {isAr ? 'لا يوجد مستمعون آخرون في الصالة حالياً.' : 'No other listeners in the arena yet.'}
            </span>
          </div>
        )}
      </div>

      {/* Audience Reactions & Quick Leave Toolbar */}
      <footer className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Sparkles size={16} className="text-amber-400" />
          <span className="font-bold">{isAr ? 'تفاعل الجمهور المباشر:' : 'Live Reactions:'}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {['👍', '👏', '💡', '📜', '⚖️', '🌟'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-125 transition-transform flex items-center justify-center text-lg sm:text-xl cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Quick Leave in Bottom Bar */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLeaveRoom();
          }}
          className="px-3.5 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ml-auto"
        >
          <LogOut size={14} />
          <span>{isAr ? 'خروج من الغرفة' : 'Exit Arena'}</span>
        </button>
      </footer>

      {/* Modal: Gallery Image Picker */}
      <AnimatePresence>
        {showImageModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ImageIcon size={18} className="text-amber-400" />
                  <span>{isAr ? 'مشاركة صورة أو وثيقة من المعرض' : 'Share Image from Gallery'}</span>
                </h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="text-white/60 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* File Input Trigger */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />

              {selectedImageFile ? (
                <div className="relative rounded-2xl overflow-hidden border border-amber-500/40 bg-black/40 max-h-60 flex items-center justify-center">
                  <img src={selectedImageFile} alt="Preview" className="w-full max-h-56 object-contain" />
                  <button
                    onClick={() => setSelectedImageFile(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 hover:border-amber-400 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 text-center text-white/70 hover:text-white transition-all cursor-pointer bg-white/5 hover:bg-white/10"
                >
                  <Upload size={28} className="text-amber-400" />
                  <span className="text-xs font-bold">
                    {isAr ? 'انقر لاختيار صورة من ألبوم الصور بالهاتف' : 'Click to select image from phone gallery'}
                  </span>
                  <span className="text-[10px] text-white/40">PNG, JPG, WebP (Max 10MB)</span>
                </button>
              )}

              {/* Caption Input */}
              <div>
                <label className="text-xs text-white/60 font-bold block mb-1">
                  {isAr ? 'عنوان توضيحي للصورة (اختياري):' : 'Caption / Document description (optional):'}
                </label>
                <input
                  type="text"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder={isAr ? 'مثال: نص الصفحة 42 من الكتاب' : 'e.g., Document manuscript evidence'}
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={() => setShowImageModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  disabled={!selectedImageFile || isUploadingImage}
                  onClick={handlePublishImage}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  {isUploadingImage ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{isAr ? 'نشر في الغرفة الصوتية فوراً' : 'Broadcast to Arena'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox Fullscreen Image View */}
      <AnimatePresence>
        {lightboxImage && (
          <div 
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={lightboxImage}
              alt="Fullscreen Document"
              className="max-w-full max-h-full object-contain rounded-xl"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X size={24} />
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal to End & Delete Room */}
      <AnimatePresence>
        {showEndConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full flex flex-col items-center text-center gap-4 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertTriangle size={28} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-white">
                  {isAr ? 'إنهاء المناظرة وإغلاق الغرفة نهائياً؟' : 'End Debate & Delete Room Permanently?'}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed mt-1">
                  {isAr 
                    ? 'عند تأكيد إنهاء المناظرة، سيتم إغلاق البث لجميع المشاركين وحذف الغرفة نهائياً من قائمة الغرف النشطة.' 
                    : 'This will terminate the session for all participants and permanently delete the room from the active rooms list.'}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEndConfirmModal(false);
                    if (onEndRoom) {
                      onEndRoom(room.id);
                    } else {
                      endDebateRoom(room.id).catch(() => {});
                      deleteDebateRoom(room.id).catch(() => {});
                      onLeaveRoom();
                    }
                  }}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-950/40"
                >
                  {isAr ? 'نعم، إنهاء وحذف الغرفة' : 'Yes, End & Delete Room'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEndConfirmModal(false)}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-white/10"
                >
                  {isAr ? 'إلغاء وتراجع' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 60-Minute Session Completed & Permanently Purged Summary Modal */}
      <AnimatePresence>
        {room.status === 'ended' && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-md w-full text-center flex flex-col items-center gap-4 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Clock size={32} />
              </div>
              <h2 className="text-xl font-black text-white">
                {isAr ? 'تم انتهاء المناظرة وإغلاق الغرفة' : 'Debate Concluded & Closed'}
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                {isAr 
                  ? 'تم استيفاء المناظرة وحذف الغرفة نهائياً من قائمة الغرف المتاحة وفقاً للضوابط. تم حفظ نتائج التفاعلات في لوحة الصدارة.' 
                  : 'The debate has concluded and the room has been permanently removed from active listings. Reaction stats have been saved.'}
              </p>
              <button
                onClick={() => {
                  if (onEndRoom) {
                    onEndRoom(room.id);
                  } else {
                    onLeaveRoom();
                  }
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs transition-all shadow-lg cursor-pointer"
              >
                {isAr ? 'العودة إلى صالة المناظرات' : 'Return to Debate Lobby'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// Outer Root Debate Manager (Lobby + StreamVideo Client)
// ==========================================
  function DebateRoomContent() {
  const { settings } = useApp();
  const isAr = settings.language === 'ar';

  const [activeRooms, setActiveRooms] = useState<DebateRoomData[]>([]);
  const [currentRoom, setCurrentRoom] = useState<DebateRoomData | null>(null);
  const [userRole, setUserRole] = useState<DebateRole>('listener');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [joiningRoom, setJoiningRoom] = useState(false);
  const [mainViewTab, setMainViewTab] = useState<'rooms' | 'leaderboard'>('rooms');
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(180);

useEffect(() => {
  if (currentRoom?.currentTurn) {
    setTurnSecondsLeft(180);
    const timer = setInterval(() => {
      setTurnSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }
}, [currentRoom?.currentTurn]);
    
  // Filtering & Classification States
  const [selectedCategory, setSelectedCategory] = useState<DebateCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'waiting'>('all');

  // Create Room Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newCategory, setNewCategory] = useState<DebateCategory>('aqeedah');
  const [joinAsHostDebater, setJoinAsHostDebater] = useState(true);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // User Profile
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('nahj_user_display_name') || '';
  });
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    return localStorage.getItem('nahj_user_avatar') || PRESET_AVATARS[0].url;
  });
  const [userId] = useState<string>(() => {
    let id = localStorage.getItem('nahj_user_uid');
    if (!id) {
      id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      localStorage.setItem('nahj_user_uid', id);
    }
    return id;
  });

    const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("يرجى اختيار صورة بحجم أقل من 2 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      setUserAvatar(base64Image);
      localStorage.setItem('nahj_user_avatar', base64Image);

      if (userId) {
        try {
          await updateDoc(doc(db, 'users', userId), { photoURL: base64Image });
        } catch (err) {
          console.error("خطأ في حفظ الصورة:", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Temporary Profile Setup Modal Before Joining
  const [showJoinProfileModal, setShowJoinProfileModal] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<{ room: DebateRoomData; role: DebateRole } | null>(null);
  const [profileModalName, setProfileModalName] = useState<string>('');
  const [profileModalAvatar, setProfileModalAvatar] = useState<string>('');
  const profileAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Load Rooms on mount with 1-second emergency timeout
  const refreshRooms = useCallback(async () => {
    setLoadingRooms(true);
    let resolved = false;

    // Safety timer: force loadingRooms to false after 1000ms in all circumstances
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        setLoadingRooms(false);
        // If state is still empty, populate from local cache immediately
        setActiveRooms((prev) => {
          if (prev.length === 0) {
            const local = getLocalRooms();
            const list = (Object.values(local) as DebateRoomData[]).filter(r => r && r.status !== 'ended' && !isDemoOrMockRoom(r));
            return list;
          }
          return prev.filter(r => !isDemoOrMockRoom(r));
        });
      }
    }, 1000);

    try {
      const rooms = await getActiveDebateRooms();
      resolved = true;
      clearTimeout(timeoutId);
      setActiveRooms((rooms || []).filter(r => !isDemoOrMockRoom(r)));
    } catch (e) {
      console.warn('Failed to load active debate rooms, using fallback:', e);
      const local = getLocalRooms();
      const list = (Object.values(local) as DebateRoomData[]).filter(r => r && r.status !== 'ended' && !isDemoOrMockRoom(r));
      setActiveRooms(list);
    } finally {
      resolved = true;
      clearTimeout(timeoutId);
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    refreshRooms();
  }, [refreshRooms]);

// Subscribe to real-time active rooms list from Firestore
useEffect(() => {
  if (!db) {
    setLoadingRooms(false);
    return;
  }

  try {
    const q = query(
      collection(db, 'debate_rooms'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DebateRoomData[];

      setActiveRooms(roomsData.filter(r => r.status !== 'ended'));
      setLoadingRooms(false);
    }, (error) => {
      console.error("خطأ في جلب الغرف المباشرة:", error);
      setLoadingRooms(false);
    });

    return () => unsubscribe();
  } catch (err) {
    console.error("خطأ في الاتصال بـ Firestore:", err);
    setLoadingRooms(false);
  }
}, []);


  // Subscribe to active room real-time changes
  useEffect(() => {
    if (!currentRoom) return;

    const unsubscribe = subscribeToDebateRoom(currentRoom.id, (updatedRoom) => {
      if (!updatedRoom || updatedRoom.status === 'ended') {
        // Room ended or deleted: remove from active list and local storage
        setActiveRooms(prev => prev.filter(r => r.id !== currentRoom.id));
        removeLocalRoom(currentRoom.id);
        setCurrentRoom(prev => (prev ? { ...prev, status: 'ended' } : null));
      } else {
        setCurrentRoom(updatedRoom);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentRoom?.id]);

  // Category counts computation
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activeRooms.length };
    activeRooms.forEach(room => {
      const cat = room.category || 'general';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activeRooms]);

  // Reactive filtering of rooms based on Category, Status, and Search Query
  const filteredRooms = useMemo(() => {
    return activeRooms.filter(room => {
      // 1. Category Filter
      if (selectedCategory !== 'all') {
        const roomCat = room.category || 'general';
        if (roomCat !== selectedCategory) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (room.status !== statusFilter) return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = room.title.toLowerCase().includes(q);
        const topicMatch = room.topic ? room.topic.toLowerCase().includes(q) : false;
        const debaterAMatch = room.debaterA?.name ? room.debaterA.name.toLowerCase().includes(q) : false;
        const debaterBMatch = room.debaterB?.name ? room.debaterB.name.toLowerCase().includes(q) : false;
        const catConfig = getCategoryConfig(room.category);
        const catMatch = catConfig.nameAr.toLowerCase().includes(q) || catConfig.nameEn.toLowerCase().includes(q);
        
        if (!titleMatch && !topicMatch && !debaterAMatch && !debaterBMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [activeRooms, selectedCategory, statusFilter, searchQuery]);

  // Initiate Join: opens profile modal first
  const handleInitiateJoin = (room: DebateRoomData, desiredRole: DebateRole) => {
    setPendingJoin({ room, role: desiredRole });
    setProfileModalName(userName || '');
    setProfileModalAvatar(userAvatar || PRESET_AVATARS[0].url);
    setShowJoinProfileModal(true);
  };

  // Custom photo upload from gallery
  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(isAr ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(isAr ? 'حجم الصورة كبير جداً (الحد الأقصى 5 ميغابايت)' : 'Image too large (max 5MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setProfileModalAvatar(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Confirm Profile and Enter Room Now
  const handleConfirmJoinProfile = () => {
    if (!pendingJoin) return;
    const finalName = profileModalName.trim() || (isAr ? 'مشارك' : 'Participant');
    const finalAvatar = profileModalAvatar || userAvatar || PRESET_AVATARS[0].url;

    // Save chosen profile locally and into state
    setUserName(finalName);
    setUserAvatar(finalAvatar);
    try {
      localStorage.setItem('nahj_user_display_name', finalName);
      localStorage.setItem('nahj_user_avatar', finalAvatar);
    } catch (err) {
      console.warn('LocalStorage save warning:', err);
    }

    setShowJoinProfileModal(false);
    executeJoin(pendingJoin.room, pendingJoin.role, finalName, finalAvatar);
  };

  // Execute Join Room - Synchronous & Instant
  const executeJoin = (
    room: DebateRoomData, 
    desiredRole: DebateRole, 
    chosenName: string, 
    chosenAvatar: string
  ) => {
    setJoiningRoom(true);

    let activeRoomState = { ...room };
    let assignedRole = desiredRole;

    // If joining as debaterB into a waiting room, activate the session immediately
    if (desiredRole === 'debaterB' && !activeRoomState.debaterB) {
      activeRoomState = {
        ...activeRoomState,
        debaterB: {
          uid: userId,
          name: chosenName,
          avatar: chosenAvatar,
          role: 'debaterB',
          joinedAt: Date.now()
        },
        status: activeRoomState.debaterA ? 'active' : 'waiting',
        startedAt: activeRoomState.debaterA ? (activeRoomState.startedAt || Date.now()) : undefined,
        turnStartTime: activeRoomState.debaterA ? Date.now() : activeRoomState.turnStartTime
      };
      saveLocalRoom(activeRoomState);
    } else if (desiredRole === 'debaterA' && !activeRoomState.debaterA) {
      activeRoomState = {
        ...activeRoomState,
        debaterA: {
          uid: userId,
          name: chosenName,
          avatar: chosenAvatar,
          role: 'debaterA',
          joinedAt: Date.now()
        },
        status: activeRoomState.debaterB ? 'active' : 'waiting',
        startedAt: activeRoomState.debaterB ? (activeRoomState.startedAt || Date.now()) : undefined,
        turnStartTime: activeRoomState.debaterB ? Date.now() : activeRoomState.turnStartTime
      };
      saveLocalRoom(activeRoomState);
    } else if (desiredRole === 'listener') {
      const currentListeners = activeRoomState.listeners || [];
      const exists = currentListeners.some(l => l.uid === userId);
      const updatedListeners = exists
        ? currentListeners
        : [
            ...currentListeners,
            {
              uid: userId,
              name: chosenName,
              avatar: chosenAvatar,
              joinedAt: Date.now()
            }
          ];
      activeRoomState = {
        ...activeRoomState,
        listeners: updatedListeners,
        listenersCount: updatedListeners.length
      };
      saveLocalRoom(activeRoomState);
    }

    // Instant UI state transition without any blocking network await
    setActiveRooms(prev => prev.map(r => r.id === activeRoomState.id ? activeRoomState : r));
    setCurrentRoom(activeRoomState);
    setUserRole(assignedRole);
    setJoiningRoom(false);

    // Optional background non-blocking join sync
    setTimeout(() => {
      try {
        joinDebateRoom(activeRoomState.id, { uid: userId, name: chosenName, avatar: chosenAvatar }, assignedRole).catch(() => {});
      } catch {
        // Safe ignore
      }
    }, 50);
  };

  // Create Room Handler - Fully Synchronous & Instant (Zero Network Await)
  const handleCreate = async () => {
    if (!newTitle.trim()) {
      alert(isAr ? 'يرجى كتابة عنوان للمناظرة' : 'Please provide a debate title');
      return;
    }

    setIsCreatingRoom(true);

    const roomId = `room_${Date.now()}`;
    const newRoom: DebateRoomData = {
      id: roomId,
      title: newTitle.trim(),
      topic: newTopic.trim() || null,
      category: newCategory,
      status: 'waiting',
      createdAt: Date.now(),
      totalDurationSeconds: 3600,
      turnDurationSeconds: 180,
      currentTurn: 'debaterA',
      turnStartTime: Date.now(),
      roundNumber: 1,
      debaterA: joinAsHostDebater ? {
        uid: userId,
        name: userName || (isAr ? 'مشارك' : 'Participant'),
        avatar: userAvatar || PRESET_AVATARS[0].url,
        role: 'debaterA',
        joinedAt: Date.now()
      } : null,
      debaterB: null,
      currentSharedImage: null,
      listenersCount: joinAsHostDebater ? 0 : 1,
      listeners: joinAsHostDebater ? [] : [{
        uid: userId,
        name: userName || (isAr ? 'مشارك' : 'Participant'),
        avatar: userAvatar || PRESET_AVATARS[0].url,
        joinedAt: Date.now()
      }],
      streamCallId: roomId
    };

    // 1. حفظ الغرفة محلياً
    saveLocalRoom(newRoom);

    // 2. إرسال الغرفة إلى Firestore فوراً لتظهر عند الجميع
    try {
      await setDoc(doc(db, 'debate_rooms', roomId), newRoom);
      setCurrentRoom(newRoom);
      setUserRole(joinAsHostDebater ? 'debaterA' : 'listener');
    } catch (err) {
      console.error("خطأ في حفظ الغرفة في Firestore:", err);
    } finally {
      setIsCreatingRoom(false);
      setShowCreateModal(false);
      setNewTitle('');
      setNewTopic('');
      setNewCategory('aqeedah');
    }
};
  

  // Leave Room Handler - 100% Synchronous & Instant
  const handleLeave = () => {
    const leavingRoomId = currentRoom?.id;
    const leavingRole = userRole;
    const leavingUid = userId;

    // 1. Immediately reset current room state to return to lobby
    setCurrentRoom(null);
    setUserRole('listener');

    // 2. Update local state & storage immediately
    if (leavingRoomId) {
      try {
        const localRooms = getLocalRooms();
        const room = localRooms[leavingRoomId];
        if (room) {
          let updated = { ...room };
          if (leavingRole === 'debaterA' && updated.debaterA?.uid === leavingUid) {
            updated.debaterA = null;
          } else if (leavingRole === 'debaterB' && updated.debaterB?.uid === leavingUid) {
            updated.debaterB = null;
          } else if (leavingRole === 'listener') {
            updated.listenersCount = Math.max(0, (updated.listenersCount || 1) - 1);
          }
          saveLocalRoom(updated);
          setActiveRooms(prev => prev.map(r => r.id === updated.id ? updated : r));
        }
      } catch (err) {
        console.warn('Local room leave error:', err);
      }
    }

    // 3. Fire-and-forget background service notification
    if (leavingRoomId) {
      setTimeout(() => {
        try {
          leaveDebateRoom(leavingRoomId, leavingRole, leavingUid).catch(() => {});
        } catch {
          // Safe ignore
        }
      }, 50);
    }
  };

  // Save display name
  const handleUpdateName = (name: string) => {
    setUserName(name);
    try {
      localStorage.setItem('nahj_user_display_name', name);
    } catch (e) {
      console.warn('Storage save warning:', e);
    }
  };

  // Permanently end & purge room
  const handleEndRoom = useCallback((roomId: string) => {
    // 1. Immediately leave stage view
    setCurrentRoom(null);
    setUserRole('listener');

    // 2. Remove room immediately from active rooms list in local state
    setActiveRooms(prev => prev.filter(r => r.id !== roomId));

    // 3. Purge room from local storage and backend RTDB/Firestore
    removeLocalRoom(roomId);
    deleteDebateRoom(roomId).catch(() => {});
    endDebateRoom(roomId).catch(() => {});
  }, []);

  // ----------------------------------------------------
  // Render In-Debate Stage View
  // ----------------------------------------------------
  if (currentRoom) {
    return (
      <DebateStage
        room={currentRoom}
        currentUserRole={userRole}
        currentUserId={userId}
        currentUserName={userName}
        currentUserAvatar={userAvatar}
        onLeaveRoom={handleLeave}
        onEndRoom={handleEndRoom}
        isAr={isAr}
      />
    );
  }

  const activeCategoryMeta = getCategoryConfig(selectedCategory);

  // ----------------------------------------------------
  // Render Debate Rooms Lobby
  // ----------------------------------------------------
  return (
    <div className="w-full max-w-5xl mx-auto p-4 flex flex-col gap-6 text-white pb-32">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-600/20 via-slate-900/90 to-slate-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 flex items-center gap-1.5 shadow-md">
                <Radio size={14} className="animate-pulse" />
                {isAr ? 'البث الصوتي المباشر' : 'Live Audio Debate'}
              </span>
              <span className="text-xs font-mono text-amber-400/90">
                {isAr ? 'نظام الأدوار الصارم • 3 دقائق لكل طرف' : 'Strict Turn-Based 3-Min Gating'}
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {isAr ? 'غرفة المناظرة والحوار الصوتي المباشر' : 'Audio Debate Arena'}
            </h1>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              {isAr 
                ? 'منصة حوارية قائمة على تصنيف الموضوعات التخصصية، تبادل الأدوار التلقائي (3 دقائق مع كتم صوت الطرف الآخر تلقائياً)، مشاركة الوثائق والصور من المعرض، وجلسات محددة بـ 60 دقيقة.' 
                : 'Turn-based audio debate rooms featuring categorized subjects, automated 3-minute mic shifts, gallery document sharing, and strict 60-minute session boundaries.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={18} />
              <span>{isAr ? 'إنشاء غرفة مناظرة جديدة' : 'Create New Debate Room'}</span>
            </button>

            <button
              onClick={refreshRooms}
              className="px-4 py-3.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/10"
              title={isAr ? 'تحديث الغرف' : 'Refresh Rooms'}
            >
              <RefreshCw size={16} className={loadingRooms ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* User Display Profile Bar with Avatar */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="relative group cursor-pointer w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/50" onClick={handleAvatarClick}>
            <img 
              src={userAvatar || '/default-avatar.png'} 
              alt="My Avatar" 
              className="w-full h-full object-cover hover:opacity-80 transition"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <span className="text-white text-[9px] font-bold">تغيير</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
              <UserCheck size={14} />
              <span>{isAr ? 'ملفك الشخصي في المناظرات:' : 'Your Debate Profile:'}</span>
            </div>
            <span className="text-sm font-black text-white truncate max-w-[200px]">
              {userName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={userName}
            onChange={(e) => handleUpdateName(e.target.value)}
            className="w-full sm:w-56 px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 placeholder-white/30"
            placeholder={isAr ? 'تعديل الاسم الظاهر...' : 'Edit display name...'}
          />
        </div>
      </div>

      {/* Main Mode Navigation Bar: Live Rooms vs Debater Leaderboard */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex items-center gap-2 shadow-xl">
        <button
          type="button"
          onClick={() => setMainViewTab('rooms')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mainViewTab === 'rooms'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-white/70 hover:text-white hover:bg-white/5'
          }`}
        >
          <Radio size={16} className={mainViewTab === 'rooms' ? 'text-slate-950 animate-pulse' : 'text-amber-400'} />
          <span>{isAr ? 'غرف المناظرات المباشرة' : 'Live Debate Rooms'}</span>
          {activeRooms.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              mainViewTab === 'rooms' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {activeRooms.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainViewTab('leaderboard')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mainViewTab === 'leaderboard'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-white/70 hover:text-white hover:bg-white/5'
          }`}
        >
          <Trophy size={16} className={mainViewTab === 'leaderboard' ? 'text-slate-950' : 'text-amber-400'} />
          <span>{isAr ? 'لوحة الصدارة والترتيب (اليومي والأسبوعي)' : 'Debater Leaderboard (Daily & Weekly)'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
            mainViewTab === 'leaderboard' ? 'bg-slate-950 text-amber-400' : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            <Flame size={11} className="text-amber-400" />
            <span>{isAr ? 'مباشر' : 'Live'}</span>
          </span>
        </button>
      </div>

      {mainViewTab === 'leaderboard' ? (
        <DebateLeaderboard onNavigateToRooms={() => setMainViewTab('rooms')} />
      ) : (
        <>
          {/* ========================================== */}
          {/* Category Filter & Navigation Bar           */}
          {/* ========================================== */}
          <div className="flex flex-col gap-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-amber-400" />
            <h2 className="text-sm font-black text-white">
              {isAr ? 'تصنيف ومجال المناظرة:' : 'Filter by Subject Classification:'}
            </h2>
          </div>
          
          {/* Status Quick Filter Chips */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 text-xs self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-amber-500 text-slate-950 font-black' : 'text-white/60 hover:text-white'
              }`}
            >
              {isAr ? 'الكل' : 'All'}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                statusFilter === 'active' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isAr ? 'جارية الآن' : 'Live'}
            </button>
            <button
              onClick={() => setStatusFilter('waiting')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                statusFilter === 'waiting' ? 'bg-amber-500/30 text-amber-300 font-black border border-amber-500/40' : 'text-white/60 hover:text-white'
              }`}
            >
              {isAr ? 'بانتظار مناظر' : 'Open'}
            </button>
          </div>
        </div>

        {/* Horizontal Category Selector Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {DEBATE_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            const count = categoryCounts[category.id] || 0;
            const CatIcon = category.icon;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs whitespace-nowrap transition-all duration-200 cursor-pointer border shrink-0 ${
                  isSelected
                    ? `${category.activeBg} border-transparent scale-[1.02]`
                    : `${category.badgeBg} ${category.badgeBorder} ${category.badgeText} hover:bg-white/15 opacity-80 hover:opacity-100`
                }`}
              >
                <CatIcon size={14} />
                <span>{isAr ? category.nameAr : category.nameEn}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isSelected 
                    ? 'bg-black/20 text-current' 
                    : 'bg-white/10 text-white/70'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar & Category Description Ribbon */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-white/5">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث في العناوين والمحاورين...' : 'Search debates & topics...'}
              className="w-full pl-3 pr-9 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Active Category Description Note */}
          <div className="flex-1 text-xs text-white/60 flex items-center gap-2">
            <Tag size={13} className="text-amber-400 shrink-0" />
            <span className="truncate">
              {isAr ? activeCategoryMeta.descAr : activeCategoryMeta.descEn}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* Active Debate Rooms Grid                   */}
      {/* ========================================== */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-amber-400 animate-pulse" />
            <h3 className="text-base font-black text-white">
              {isAr ? 'غرف المناظرة المتوفرة' : 'Available Debate Rooms'}
            </h3>
            {selectedCategory !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${activeCategoryMeta.badgeBg} ${activeCategoryMeta.badgeBorder} ${activeCategoryMeta.badgeText}`}>
                {isAr ? activeCategoryMeta.nameAr : activeCategoryMeta.nameEn}
              </span>
            )}
          </div>
          
          <span className="text-xs text-white/50">
            {filteredRooms.length} {isAr ? 'من أصل' : 'of'} {activeRooms.length} {isAr ? 'غرفة' : 'Rooms'}
          </span>
        </div>

        {loadingRooms ? (
          <div className="flex flex-col items-center justify-center p-12 text-amber-400 gap-3">
            <RefreshCw size={28} className="animate-spin" />
            <span className="text-xs">{isAr ? 'جاري تحميل الغرف...' : 'Loading debate arenas...'}</span>
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-10 sm:p-14 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-inner">
              <Radio size={32} className="animate-pulse" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
              <h4 className="text-base font-black text-white">
                {isAr ? 'لا توجد مناظرات متاحة حالياً' : 'No debates currently available'}
              </h4>
              <p className="text-xs text-white/50 leading-relaxed">
                {isAr 
                  ? 'كن أول من ينشئ غرفة ويبدأ حواراً علمياً هادئاً وبنّاءً في العقيدة أو الفقه أو التاريخ أو القرآن.' 
                  : 'Be the first to create a room and start a constructive, scholarly debate.'}
              </p>
            </div>
            <button
              onClick={() => {
                setNewCategory(selectedCategory !== 'all' ? selectedCategory : 'aqeedah');
                setShowCreateModal(true);
              }}
              className="mt-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-black rounded-2xl cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Plus size={16} />
              <span>{isAr ? 'إنشاء غرفة مناظرة جديدة' : 'Create New Debate Room'}</span>
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
              <activeCategoryMeta.icon size={28} />
            </div>
            <p className="text-sm font-bold text-white/80">
              {isAr 
                ? `لا توجد غرف مناظرة مطابقة في تصنيف "${activeCategoryMeta.nameAr}" حالياً.` 
                : `No debate rooms found under "${activeCategoryMeta.nameEn}".`}
            </p>
            <p className="text-xs text-white/50 max-w-md">
              {isAr 
                ? 'يمكنك تغيير معايير التصفية أو أن تكون أول من ينشئ مناظرة في هذا التخصص العلمي!' 
                : 'You can adjust your search filter or be the first to start a debate in this subject!'}
            </p>
            <div className="flex gap-2 mt-2">
              {(selectedCategory !== 'all' || searchQuery || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  {isAr ? 'إلغاء التصفية' : 'Reset Filters'}
                </button>
              )}
              <button
                onClick={() => {
                  setNewCategory(selectedCategory !== 'all' ? selectedCategory : 'aqeedah');
                  setShowCreateModal(true);
                }}
                className="px-5 py-2 bg-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>{isAr ? 'إنشاء غرفة في هذا التصنيف' : 'Create in this Category'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRooms.map((room) => {
              const hasSlotA = !room.debaterA;
              const hasSlotB = !room.debaterB;
              const roomCatConfig = getCategoryConfig(room.category);
              const CatIcon = roomCatConfig.icon;

              return (
                <div
                  key={room.id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-white/10 hover:border-amber-500/50 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 transition-all hover:scale-[1.01]"
                >
                  <div className="flex flex-col gap-2">
                    {/* Header Badges: Status + Category Pill */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Category Badge */}
                        <button
                          onClick={() => setSelectedCategory(room.category || 'general')}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 transition-all hover:scale-105 cursor-pointer ${roomCatConfig.badgeBg} ${roomCatConfig.badgeBorder} ${roomCatConfig.badgeText}`}
                          title={isAr ? `تصفية حسب ${roomCatConfig.nameAr}` : `Filter by ${roomCatConfig.nameEn}`}
                        >
                          <CatIcon size={11} />
                          <span>{isAr ? roomCatConfig.nameAr : roomCatConfig.nameEn}</span>
                        </button>

                        {/* Status Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {room.status === 'active' ? (isAr ? 'مناظرة جارية' : 'In Progress') : (isAr ? 'بانتظار المناظرين' : 'Open Seat')}
                        </span>
                      </div>

                      <span className="text-xs text-white/50 flex items-center gap-1">
                        <Users size={13} /> {room.listenersCount || 1}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white leading-snug">
                      {room.title}
                    </h3>
                    {room.topic && (
                      <p className="text-xs text-white/60 line-clamp-2">
                        {room.topic}
                      </p>
                    )}
                  </div>

                  {/* Debaters Matchup Preview */}
                  <div className="bg-black/30 rounded-2xl p-3 flex items-center justify-between border border-white/5">
                    {/* Debater A */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-400/60 shrink-0">
                        <img 
                          src={room.debaterA?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'} 
                          alt="Debater A" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-white/40">{isAr ? 'الطرف أ' : 'Debater A'}</span>
                        <span className="text-xs font-bold text-white truncate max-w-[90px]">
                          {room.debaterA?.name || (isAr ? 'مقعد شاغر' : 'Open')}
                        </span>
                      </div>
                    </div>

                    <div className="text-amber-400 font-mono font-black text-xs">VS</div>

                    {/* Debater B */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-white/40">{isAr ? 'الطرف ب' : 'Debater B'}</span>
                        <span className="text-xs font-bold text-white truncate max-w-[90px]">
                          {room.debaterB?.name || (isAr ? 'مقعد شاغر' : 'Open')}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-emerald-400/60 shrink-0">
                        <img 
                          src={room.debaterB?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'} 
                          alt="Debater B" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Join Actions */}
                  <div className="flex gap-2">
                    {/* Join as Debater if slot available */}
                    {(hasSlotA || hasSlotB) && (
                      <button
                        onClick={() => handleInitiateJoin(room, hasSlotA ? 'debaterA' : 'debaterB')}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                      >
                        <Mic size={14} />
                        <span>{isAr ? 'انضم كمحاور (مناظر)' : 'Join as Debater'}</span>
                      </button>
                    )}

                    {/* Join as Listener */}
                    <button
                      onClick={() => handleInitiateJoin(room, 'listener')}
                      className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10 active:scale-95"
                    >
                      <Headphones size={14} />
                      <span>{isAr ? 'استماع فقط (مستمع)' : 'Listen as Audience'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}

      {/* ========================================== */}
      {/* Modal: Create Debate Room with Category    */}
      {/* ========================================== */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 my-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Radio size={18} className="text-amber-400" />
                  <span>{isAr ? 'إنشاء غرفة مناظرة صوتية جديدة' : 'Create Turn-Based Debate Room'}</span>
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white/60 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-white/70 font-bold block mb-1">
                  {isAr ? 'عنوان المناظرة:' : 'Debate Title:'}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isAr ? 'مثال: منهجية توثيق الروايات في كتب الحديث' : 'e.g., Epistemological debate on historical texts'}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Category Selector */}
              <div>
                <label className="text-xs text-white/70 font-bold block mb-1.5">
                  {isAr ? 'تصنيف ومجال المناظرة:' : 'Subject Category:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DEBATE_CATEGORIES.filter(c => c.id !== 'all').map((cat) => {
                    const isSelected = newCategory === cat.id;
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setNewCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-right flex flex-col gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? `${cat.activeBg} border-transparent ring-2 ring-amber-400/50 shadow-md`
                            : 'bg-black/30 border-white/10 text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <CatIcon size={14} className={isSelected ? 'text-current' : 'text-amber-400'} />
                          {isSelected && <CheckCircle2 size={13} className="text-current" />}
                        </div>
                        <span className="text-[11px] font-black leading-tight mt-0.5">
                          {isAr ? cat.nameAr : cat.nameEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Topic Description */}
              <div>
                <label className="text-xs text-white/70 font-bold block mb-1">
                  {isAr ? 'تفاصيل ومحاور الحوار:' : 'Discussion Outline / Context:'}
                </label>
                <textarea
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  rows={2}
                  placeholder={isAr ? 'اكتب نبذة عن المسائل المطروحة للنقاش العلمي...' : 'Brief overview of arguments...'}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              {/* Role Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white/80 select-none bg-black/30 p-2.5 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  checked={joinAsHostDebater}
                  onChange={(e) => setJoinAsHostDebater(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>{isAr ? 'الانضمام كـ "مناظر أول" مباشرة بعد إنشاء الغرفة' : 'Join as Debater A upon creation'}</span>
              </label>

              {/* Rules summary banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-300 leading-relaxed">
                ⏱️ <strong>{isAr ? 'الضوابط التلقائية:' : 'Rules:'}</strong> {isAr ? 'مدة الجلسة 60 دقيقة • 3 دقائق لكل محاور بنظام الكتم التلقائي للطرف الآخر • إمكانية مشاركة الوثائق والصور من المعرض.' : '60 min max duration • 3-min automatic mic turns with auto-mute • Live gallery document sharing.'}
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatingRoom}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreatingRoom || !newTitle.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-slate-950 flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  {isCreatingRoom ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>{isAr ? 'جاري تجهيز الغرفة...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{isAr ? 'تأكيد وإنشاء الغرفة' : 'Create & Enter'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* Modal: Join Profile Setup (Before Entering)*/}
      {/* ========================================== */}
      <AnimatePresence>
        {showJoinProfileModal && pendingJoin && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 my-8 relative overflow-hidden"
            >
              {/* Subtle background glow */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <User size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white leading-tight">
                      {isAr ? 'إعداد الملف الشخصي قبل الدخول' : 'Profile Setup Before Joining'}
                    </h3>
                    <p className="text-[11px] text-white/50">
                      {isAr ? 'حدد اسمك وصورتك الرمزية للظهور داخل الغرفة' : 'Choose your display name and avatar'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowJoinProfileModal(false)}
                  className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Target Room & Role Banner */}
              <div className="bg-black/40 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3 relative z-10">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                    {isAr ? 'الغرفة المستهدفة' : 'Target Room'}
                  </span>
                  <span className="text-xs font-black text-white truncate">
                    {pendingJoin.room.title}
                  </span>
                </div>

                <div className="shrink-0">
                  {pendingJoin.role === 'debaterA' && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <Mic size={12} />
                      {isAr ? 'مقعد: محاور أ' : 'Debater A'}
                    </span>
                  )}
                  {pendingJoin.role === 'debaterB' && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <Mic size={12} />
                      {isAr ? 'مقعد: محاور ب' : 'Debater B'}
                    </span>
                  )}
                  {pendingJoin.role === 'listener' && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                      <Headphones size={12} />
                      {isAr ? 'حضور: مستمع' : 'Listener'}
                    </span>
                  )}
                </div>
              </div>

              {/* Active Profile Live Preview Card */}
              <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl gap-3 relative z-10">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400 p-0.5 shadow-xl bg-slate-950">
                    <img
                      src={profileModalAvatar || PRESET_AVATARS[0].url}
                      alt="Selected Avatar"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <button
                    onClick={() => profileAvatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg hover:bg-amber-400 cursor-pointer transition-transform hover:scale-110"
                    title={isAr ? 'رفع صورة من المعرض' : 'Upload from gallery'}
                  >
                    <Camera size={14} />
                  </button>
                </div>

                <div className="text-center">
                  <div className="text-sm font-black text-white">
                    {profileModalName.trim() || (isAr ? 'مشارك' : 'Participant')}
                  </div>
                  <span className="text-[11px] text-amber-400 font-mono">
                    {pendingJoin.role === 'listener' 
                      ? (isAr ? 'مستمع في الصالة' : 'Audience Member') 
                      : (isAr ? 'محاور في المنصة الصوتية' : 'Live Debater on Stage')}
                  </span>
                </div>
              </div>

              {/* Display Name Input */}
              <div className="flex flex-col gap-1.5 relative z-10">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                  <User size={13} className="text-amber-400" />
                  <span>{isAr ? 'الاسم الظاهر / اللقب العلمي:' : 'Display Name / Alias:'}</span>
                </label>
                <input
                  type="text"
                  value={profileModalName}
                  onChange={(e) => setProfileModalName(e.target.value)}
                  placeholder={isAr ? 'اكتب اسمك أو لقبك هنا...' : 'Enter your name...'}
                  maxLength={30}
                  className="w-full px-3.5 py-2.5 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              {/* Avatar Selection: Presets Grid + Custom Gallery Upload */}
              <div className="flex flex-col gap-2 relative z-10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                    <Smile size={13} className="text-amber-400" />
                    <span>{isAr ? 'اختر صورة شخصية (أفاتار):' : 'Select Avatar:'}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => profileAvatarInputRef.current?.click()}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Upload size={12} />
                    <span>{isAr ? 'رفع صورة من المعرض' : 'Upload from gallery'}</span>
                  </button>
                </div>

                {/* Hidden File Input for Custom Image from Device / Gallery */}
                <input
                  ref={profileAvatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomAvatarUpload}
                  className="hidden"
                />

                {/* Presets Grid */}
                <div className="grid grid-cols-4 gap-2.5 bg-black/40 p-2.5 rounded-2xl border border-white/10 max-h-44 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                  {PRESET_AVATARS.map((av) => {
                    const isSelected = profileModalAvatar === av.url;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setProfileModalAvatar(av.url)}
                        className={`relative rounded-xl p-1.5 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 ring-2 ring-amber-400 shadow-md scale-105'
                            : 'bg-white/5 hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20">
                          <img src={av.url} alt={av.nameAr} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] font-bold text-white/80 text-center truncate w-full">
                          {isAr ? av.nameAr : av.nameEn}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-slate-950">
                            <Check size={9} className="stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Role Rules Summary Note */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-300 leading-relaxed relative z-10">
                {pendingJoin.role === 'listener' ? (
                  <>
                    🎧 <strong>{isAr ? 'صلاحيات المستمع:' : 'Listener Role:'}</strong>{' '}
                    {isAr 
                      ? 'يمكنك الاستماع المباشر عالي النقاء، مطالعة الوثائق المعروضة، وإرسال التفاعلات في أي وقت.' 
                      : 'Listen in real-time, view shared debate documents, and send live emojis.'}
                  </>
                ) : (
                  <>
                    🎙️ <strong>{isAr ? 'صلاحيات المحاور:' : 'Debater Role:'}</strong>{' '}
                    {isAr 
                      ? 'ستحصل على ميكروفون لمدة 3 دقائق لكل جولة مع كتم تلقائي للطرف الآخر وميزة عرض الوثائق.' 
                      : 'You will take the floor with a 3-minute mic timer per round and gallery sharing.'}
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end mt-1 relative z-10">
                <button
                  type="button"
                  onClick={() => setShowJoinProfileModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmJoinProfile}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
                >
                  <Sparkles size={15} />
                  <span>{isAr ? 'دخول الغرفة الان' : 'Enter Room Now'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default function DebateRoom(props: any) {
  return (
    <DebateErrorBoundary>
      <DebateRoomContent {...props} />
    </DebateErrorBoundary>
  );
}
