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
