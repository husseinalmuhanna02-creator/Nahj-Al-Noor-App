/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'ar' | 'en';

export interface AppSettings {
  language: Language;
  theme: 'light' | 'dark';
  hijriOffset: number;
  country: string;
  city: string;
  autoLocation: boolean;
  adhanEnabled: {
    fajr: boolean;
    dhuhr: boolean;
    asr: boolean;
    maghrib: boolean;
    isha: boolean;
  };
  backgroundImage?: string;
  selectedAdhanUrl?: string;
  tasbihSoundEnabled: boolean;
  prayerOffsets: {
    fajr: number;
    dhuhr: number;
    asr: number;
    maghrib: number;
    isha: number;
  };
  prayerAngles: {
    fajr: number;
    maghrib: number;
    isha: number;
  };
  prayerAlertsEnabled: boolean;
  prayerAlertMinutesBefore: number;
}

export interface PrayerTime {
  id: string;
  nameAr: string;
  nameEn: string;
  time: Date;
}

export interface LibrarySubItem {
  id: string;
  title: string;
  url: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  author: string;
  category: string;
  url?: string;
  subItems?: LibrarySubItem[];
}

export interface LibraryBook {
  id: string;
  titleAr: string;
  titleEn: string;
  authorAr: string;
  authorEn: string;
  pdfUrl?: string;
  coverImage: string;
  parts?: {
    id: string;
    titleAr: string;
    titleEn: string;
    pdfUrl: string;
  }[];
}

export interface Supplication {
  id: string | number;
  titleAr?: string;
  titleEn?: string;
  contentAr?: string;
  contentEn?: string;
  category: 'أدعية' | 'زيارات' | 'months' | 'daily' | 'ziyarat' | 'شبهات وردود';
  audioUrl?: string;
  title?: string;
  content?: string;
  description?: string;
}

export interface Video {
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
}

export type DebateRole = 'debaterA' | 'debaterB' | 'listener';

export type DebateCategory = 
  | 'all'
  | 'aqeedah'
  | 'fiqh'
  | 'history'
  | 'quran_hadith'
  | 'thought'
  | 'general';

export interface DebateCategoryInfo {
  id: DebateCategory;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  iconName: string;
}

export interface DebaterProfile {
  uid: string;
  name: string;
  avatar: string;
  role: 'debaterA' | 'debaterB';
  joinedAt: number;
}

export interface ListenerProfile {
  uid: string;
  name: string;
  avatar: string;
  joinedAt: number;
}

export interface SharedDebateImage {
  id: string;
  url: string;
  caption?: string;
  sharedBy: string;
  sharedByRole: 'debaterA' | 'debaterB';
  timestamp: number;
}

export interface DebateRoomData {
  id: string;
  title: string;
  topic?: string;
  category?: DebateCategory;
  status: 'waiting' | 'active' | 'paused' | 'ended';
  createdAt: number;
  startedAt?: number;
  totalDurationSeconds: number; // 3600 (60 mins)
  turnDurationSeconds: number; // 180 (3 mins)
  currentTurn: 'debaterA' | 'debaterB';
  turnStartTime: number; // timestamp ms
  roundNumber: number;
  debaterA: DebaterProfile | null;
  debaterB: DebaterProfile | null;
  currentSharedImage: SharedDebateImage | null;
  listenersCount: number;
  listeners?: ListenerProfile[];
  streamCallId: string;
}

export interface DebateMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: DebateRole;
  text: string;
  timestamp: number;
}

export interface LiveReactionPayload {
  id: string;
  roomId: string;
  senderName: string;
  senderUid: string;
  targetRole: 'debaterA' | 'debaterB' | 'general';
  targetDebaterName: string;
  emoji: string;
  label: string;
  isNegative: boolean;
  timestamp: number;
}

export type LeaderboardTimeframe = 'daily' | 'weekly' | 'all';

export interface DebaterReactionBreakdown {
  strongArgument: number; // 👏 👍
  evidence: number;       // 📜 💡
  solidDefense: number;   // 🌟 🛡️
  negativeCritique: number; // 👎 ⚠️ ❌ 🛑
}

export interface DebaterLeaderboardEntry {
  uid: string;
  name: string;
  avatar: string;
  totalPositiveReactions: number;
  totalNegativeReactions: number;
  totalReactions: number;
  acceptanceRate: number; // 0 - 100 percentage
  debatesCount: number;
  speakingTimeSeconds: number;
  topCategory: DebateCategory;
  badges: string[];
  recentDebateTitles: string[];
  lastActiveTimestamp: number;
  // Time-windowed metrics for daily and weekly browsing
  dailyPositiveReactions: number;
  weeklyPositiveReactions: number;
  dailyNegativeReactions: number;
  weeklyNegativeReactions: number;
  dailyDebatesCount: number;
  weeklyDebatesCount: number;
  breakdown: DebaterReactionBreakdown;
  recentDebates?: {
    id: string;
    title: string;
    category: DebateCategory;
    timestamp: number;
    positiveEarned: number;
    acceptanceRate: number;
  }[];
}

