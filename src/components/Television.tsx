/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Tv, X, AlertOctagon, Loader2, Play, Star, Maximize2, Minimize2, Pause, Volume2, VolumeX, Rewind, FastForward, RefreshCw, Settings, Search, Calendar, Heart, RotateCw, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface TvChannel {
  id: string;
  name: string;
  logoUrl: string;
  streamUrl: string;
}

interface TvProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  day?: string;
}

enum OperationType {
  GET = 'get',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

const getYouTubeEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  if (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('youtube-nocookie.com') && !url.includes('embed/videoseries')) {
    return null;
  }

  try {
    // Extract playlist ID (list=PLAYLIST_ID)
    let listId = '';
    if (url.includes('list=')) {
      const match = url.match(/[?&]list=([^&#]+)/);
      if (match) {
        listId = match[1];
      }
    }

    // Extract potential video ID
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/|live\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[1] && match[1].trim().length === 11) ? match[1].trim() : null;

    let baseUrl = '';
    if (videoId) {
      baseUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (listId) {
      baseUrl = `https://www.youtube.com/embed/videoseries`;
    } else {
      return null;
    }

    const params: string[] = [
      'autoplay=1',
      'mute=0',
      'controls=0',
      'rel=0',
      'modestbranding=1',
      'showinfo=0',
      'iv_load_policy=3',
      'playsinline=1',
      'enablejsapi=1'
    ];

    if (listId) {
      params.push(`list=${listId}`);
    }

    try {
      params.push(`origin=${encodeURIComponent(window.location.origin)}`);
    } catch (err) {
      // safe ignore
    }

    return `${baseUrl}?${params.join('&')}`;
  } catch (e) {
    return null;
  }
};

const getSecureStreamUrl = (url: string): string => {
  if (!url) return '';
  // Force HTTPS for non-localhost/non-local addresses to prevent secure context (Mixed Content) blocks
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

// M3U8 helper removed

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
    },
  },
};

const Television: React.FC = () => {
  const { settings, registerBackHandler } = useApp();
  const isAr = settings.language === 'ar';
  
  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeChannel, setActiveChannel] = useState<TvChannel | null>(null);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerStatusText, setPlayerStatusText] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [slowConnection, setSlowConnection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [programs, setPrograms] = useState<TvProgram[]>([]);
  const [showEpgDrawer, setShowEpgDrawer] = useState(false);

  // Native back button registration to close stream player on Android
  useEffect(() => {
    if (activeChannel) {
      const cleanup = registerBackHandler(() => {
        handleClosePlayer();
        return true; 
      });
      return () => cleanup();
    }
  }, [activeChannel, registerBackHandler]);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tv_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (channelId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      localStorage.setItem('tv_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Native HLS/HTML5 custom Controls States
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [hlsLevels, setHlsLevels] = useState<{ index: number; label: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [usingHlsFallback, setUsingHlsFallback] = useState(false);
  const [playUrl, setPlayUrl] = useState<string>('');
  const [hasTriedProxy, setHasTriedProxy] = useState<boolean>(false);
  const controlsTimeoutRef = useRef<any>(null);
  const lastTouchTime = useRef<number>(0);
  const [rotation, setRotation] = useState<number>(0);

  const getRotationStyle = () => {
    const isLandscape = rotation === 90 || rotation === 270;
    return {
      width: isLandscape ? '100vh' : '100%',
      height: isLandscape ? '100vw' : '100%',
      top: isLandscape ? '50%' : '0',
      left: isLandscape ? '50%' : '0',
      right: isLandscape ? 'auto' : '0',
      bottom: isLandscape ? 'auto' : '0',
      transform: isLandscape 
        ? `translate(-50%, -50%) rotate(${rotation}deg)` 
        : rotation === 180 
        ? 'rotate(180deg)' 
        : 'none',
      transformOrigin: 'center center',
    };
  };

  const handleNextChannel = () => {
    if (!activeChannel) return;
    const list = filteredChannels.length > 0 ? filteredChannels : channels;
    if (list.length <= 1) return;
    const currentIndex = list.findIndex(c => c.id === activeChannel.id);
    const nextIndex = (currentIndex + 1) % list.length;
    setRotation(0);
    setActiveChannel(list[nextIndex]);
  };

  const handlePrevChannel = () => {
    if (!activeChannel) return;
    const list = filteredChannels.length > 0 ? filteredChannels : channels;
    if (list.length <= 1) return;
    const currentIndex = list.findIndex(c => c.id === activeChannel.id);
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    setRotation(0);
    setActiveChannel(list[prevIndex]);
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3500);
  };

  const handleTouchStart = () => {
    lastTouchTime.current = Date.now();
  };

  const handleMouseMove = () => {
    // Ignore emulated mouse moves from touch events to prevent double firing
    if (Date.now() - lastTouchTime.current < 1000) return;
    resetControlsTimeout();
  };

  const togglePlay = () => {
    if (playerRef.current) {
      if (playerRef.current.paused()) {
        const p = playerRef.current.play();
        if (p && typeof p.catch === 'function') {
          p.catch((e: any) => console.warn('[VideoJS] play() interrupted:', e));
        }
      } else {
        playerRef.current.pause();
      }
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(e => console.warn(e));
      } else {
        videoRef.current.pause();
      }
    }
  };

  const togglePlayPause = () => {
    const isYouTube = activeChannel ? getYouTubeEmbedUrl(activeChannel.streamUrl) !== null : false;
    if (isYouTube) {
      setIsPlaying(p => !p);
    } else {
      togglePlay();
    }
  };

  const toggleMute = () => {
    if (playerRef.current) {
      const isMutedNow = !playerRef.current.muted();
      playerRef.current.muted(isMutedNow);
      setIsMuted(isMutedNow);
    } else if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleVolumeChange = (newVal: number) => {
    if (playerRef.current) {
      playerRef.current.volume(newVal);
      playerRef.current.muted(newVal === 0);
      setVolume(newVal);
      setIsMuted(newVal === 0);
    } else if (videoRef.current) {
      videoRef.current.volume = newVal;
      videoRef.current.muted = newVal === 0;
      setVolume(newVal);
      setIsMuted(newVal === 0);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showControls) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) {
          setShowControls(false);
        }
      }, 3500);
    } else {
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  };

  const handleQualityLevelChange = (index: number) => {
    if (playerRef.current) {
      try {
        const vhs = (playerRef.current.tech() as any).vhs;
        if (vhs && vhs.representations) {
          const reps = vhs.representations();
          if (reps && reps.length > 0) {
            if (index === -1) {
              reps.forEach((rep: any) => rep.enabled(true));
            } else {
              reps.forEach((rep: any, idx: number) => rep.enabled(idx === index));
            }
          }
        }
      } catch (e) {
        console.warn('Could not set custom quality levels in video.js:', e);
      }
    }
    setCurrentLevel(index);
    setShowQualityMenu(false);
  };

  // Manage auto-hide controls timer lifecycle
  useEffect(() => {
    if (activeChannel) {
      setUsingHlsFallback(false);
      setIsPlaying(true);
      setIsMuted(false);
      setVolume(1.0);
      setCurrentTime(0);
      setDuration(0);
      setHlsLevels([]);
      setCurrentLevel(-1);
      setShowQualityMenu(false);
      setShowControls(true);
      setRotation(0);
      resetControlsTimeout();
      
      // Setup initial secure play URL and clear retry states
      setPlayUrl(getSecureStreamUrl(activeChannel.streamUrl));
      setHasTriedProxy(false);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [activeChannel]);

  // Synchronize isFullscreen state with browser's Fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Auto-trigger full screen when activeChannel is set
  useEffect(() => {
    if (activeChannel) {
      const triggerAutoFullscreen = async () => {
        // Wait a small physical frame (tick) for the ref to bind to the rendered element
        await new Promise((resolve) => setTimeout(resolve, 350));
        
        if (playerContainerRef.current && !document.fullscreenElement) {
          try {
            const elem = playerContainerRef.current;
            if (elem.requestFullscreen) {
              await elem.requestFullscreen();
            } else if ((elem as any).webkitRequestFullscreen) {
              await (elem as any).webkitRequestFullscreen();
            } else if ((elem as any).msRequestFullscreen) {
              await (elem as any).msRequestFullscreen();
            }
          } catch (err) {
            console.warn("Auto-fullscreen on channel mount was blocked or requires explicit gesture interactions:", err);
          }
        }
      };
      triggerAutoFullscreen();
    }
  }, [activeChannel]);

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        if (playerContainerRef.current.requestFullscreen) {
          await playerContainerRef.current.requestFullscreen();
        } else if ((playerContainerRef.current as any).webkitRequestFullscreen) {
          await (playerContainerRef.current as any).webkitRequestFullscreen();
        } else if ((playerContainerRef.current as any).msRequestFullscreen) {
          await (playerContainerRef.current as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  };

  const handleClosePlayer = async () => {
    if (document.fullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        console.warn("Error exiting fullscreen on close:", err);
      }
    }
    setActiveChannel(null);
  };

  const isCurrentProgram = (startTime: string, endTime: string): boolean => {
    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const parseTimeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.trim().split(':').map(Number);
        return h * 60 + m;
      };
      
      const startMin = parseTimeToMinutes(startTime);
      let endMin = parseTimeToMinutes(endTime);
      if (endMin === 0) endMin = 24 * 60; // Midnight standard
      
      if (startMin <= endMin) {
        return currentMinutes >= startMin && currentMinutes < endMin;
      } else {
        // Over midnight
        return currentMinutes >= startMin || currentMinutes < endMin;
      }
    } catch {
      return false;
    }
  };

  const sortProgramsByTime = (progA: TvProgram, progB: TvProgram) => {
    try {
      const parseTimeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.trim().split(':').map(Number);
        return h * 60 + m;
      };
      return parseTimeToMinutes(progA.startTime) - parseTimeToMinutes(progB.startTime);
    } catch {
      return 0;
    }
  };

  const getFallbackPrograms = (channelId: string, channelName: string, isArabic: boolean): TvProgram[] => {
    const isTaha = channelId === 'taha_trial' || channelName.toLowerCase().includes('طه') || channelName.toLowerCase().includes('taha');
    
    const schedulesAr = isTaha ? [
      { start: "00:00", end: "05:00", title: "تلاوات قرآنية عطرة ومناجاة", desc: "أدعية الليل وبث مباشر لتلاوة القرآن الكريم بصوت نخبة من القراء الكبار." },
      { start: "05:00", end: "07:00", title: "أذان الفجر وأدعية الصباح", desc: "تكبيرات الفجر وأدعية الصباح لبدء يوم مبارك." },
      { start: "07:00", end: "09:00", title: "برنامج يسعد صباحكم المباشر", desc: "أناشيد الصباح واستعراض فقرات مسلية للأطفال والناشئة ترفع المستوى الثقافي والديني." },
      { start: "09:00", end: "11:00", title: "كارتون حواري هادف", desc: "أفلام رسوم متحركة تتناول القيم والأخلاق الإسلامية بطرق تفاعلية رائعة وعجيبة." },
      { start: "11:00", end: "13:00", title: "قصص الأنبياء للأطفال والناشئة", desc: "سلسلة قصصية تسرد سيرة الأنبياء عليهم السلام بأسلوب مبسط وشيق للغاية." },
      { start: "13:00", end: "15:00", title: "أناشيد الأطفال والبراعم العذبة", desc: "باقة ملونة من الأناشيد التعليمية والتربوية المخصصة للمشاهدين الصغار." },
      { start: "15:00", end: "17:00", title: "مسابقة طه الكبرى التفاعلية", desc: "مسابقات تفاعلية مباشرة مع الأطفال لاختبار معلوماتهم العامة والدينية." },
      { start: "17:00", end: "19:00", title: "رسوم متحركة إسلامية ثرية وعجيبة", desc: "مغامرات وقصص من التاريخ الإسلامي تهدف لغرس الفضائل المجتمعية النبيلة." },
      { start: "19:00", end: "21:00", title: "حديث البراعم والعلماء الصغار", desc: "برنامج تعليمي وإثرائي يتحدث فيه الصغار عن مواضيع دينية وتثقيفية مبسطة." },
      { start: "21:00", end: "23:00", title: "من وحي الأخلاق والآداب الرفيعة", desc: "ندوات وحكايات تربوية مفيدة لكافة أفراد العائلة المسلمة." },
      { start: "23:00", end: "24:00", title: "أدعية وإبتهالات المساء الكبرى والزيارات", desc: "زيارات ودعاء كميل ونخبة من باقات الأناشيد الهادئة قبل النوم." }
    ] : [
      { start: "00:00", end: "05:00", title: "تلاوات من الحرمين الشريفين والذكر الحكيم", desc: "بث مباشر لتلاوة آيات الذكر الحكيم من المسجد الحرام والمسجد النبوي." },
      { start: "05:00", end: "07:00", title: "نفحات الفجر والذكر الحكيم والتسبيح", desc: "حلقة ذكر واستماع وروحانيات الصلاة الصباحية." },
      { start: "07:00", end: "09:30", title: "شرح كتاب رياض الصالحين الميسر", desc: "شرح مفصل وممتع لأحاديث النبي الكريم صلى الله عليه وآله وسلم لعموم المسلمين." },
      { start: "09:30", end: "12:00", title: "مجالس الفقه والعقيدة الحية", desc: "برنامج فقهي للإجابة على تساؤلات المسلمين حول عباداتهم اليومية فقهياً." },
      { start: "12:00", end: "14:30", title: "نور المشكاة وتنوير عقول الأمة", desc: "سلسلة محاضرات لتبسيط الأحكام الفقهية والتفسير العقائدي لجيل الشباب." },
      { start: "14:30", end: "17:00", title: "حديث الروح وتفسير القرآن الكريم الجلي", desc: "تفسير ميسّر وعقد مقارنات لآيات القرآن الحكيم والتدبر الإيماني العميق." },
      { start: "17:00", end: "19:00", title: "وثائقي الحضارة الإسلامية ورواد الفكر", desc: "جولة تاريخية مصورة تسلط الضوء على إسهامات المسلمين الكبرى في العلوم والفنون." },
      { start: "19:00", end: "21:30", title: "حوار مباشر وبرنامج الفتاوى والمسائل الشرعية", desc: "تغطية فقهية حية ومباشرة لاستقبل استفسارات المشاهدين والإجابة عليها فتاوئياً." },
      { start: "21:30", end: "23:00", title: "قصص السلف الصالح والصحابة الأجلاء", desc: "استعراض لروائع القصص التاريخية للصحابة الأجلاء وسيرتهم العطرة الخالدة." },
      { start: "23:00", end: "24:00", title: "الدعاء والمناجاة الخاشعة في جوف الليل", desc: "باقة من الأدعية المأثورة والتراتيل الروحية الهادئة لأوقات الليل والسحر العطرة." }
    ];

    const schedulesEn = isTaha ? [
      { start: "00:00", end: "05:00", title: "Quranic Whispers and Nocturnal Prayers", desc: "Calm spiritual recitation of Quran and prayers for the night." },
      { start: "05:00", end: "07:00", title: "Fajr Transmission and Morning Hymns", desc: "Start the day blessed with the call to prayer and morning supplications." },
      { start: "07:00", end: "09:00", title: "Happy Morning Show", desc: "Interacting chants and delightful segments for children." },
      { start: "09:00", end: "11:00", title: "Value-Driven Cartoon Series", desc: "Animated series that explore ethical teachings and Islamic manners." },
      { start: "11:00", end: "13:00", title: "Stories of the Prophets for Kids", desc: "An easy-to-understand biography of the noble Prophets." },
      { start: "13:00", end: "15:00", title: "Melodious Chants for Budding Hearts", desc: "Beautiful chants teaching values and behavior to toddlers." },
      { start: "15:00", end: "17:00", title: "The Great Taha Quiz Show", desc: "Live interaction testing children's general and Islamic index of knowledge." },
      { start: "17:00", end: "19:00", title: "Islamic Cartoon Adventures", desc: "Epic stories from history aimed at cultivating noble social morals." },
      { start: "19:00", end: "21:00", title: "Budding Scholars Dialogue", desc: "A creative panel discussing science, faith, and ethics." },
      { start: "21:00", end: "23:00", title: "Echoes of Ethics and Character", desc: "Helpful seminars addressing parent-child dialogue and ethics." },
      { start: "23:00", end: "24:00", title: "Evening Liturgies & Supplications", desc: "Peaceful concluding supplications and chants before sleeping." }
    ] : [
      { start: "00:00", end: "05:00", title: "Live Quran from The Holy Harams", desc: "Continuous live streaming recitations from Makkah and Madinah." },
      { start: "05:00", end: "07:00", title: "Dawn Remembrance & Prayer Circle", desc: "Early morning supplications and Quranic reflections." },
      { start: "07:00", end: "09:30", title: "Riyadh us-Saleheen Explanation", desc: "Contextual and linguistic breakdown of noble Prophetic traditions." },
      { start: "09:30", end: "12:00", title: "Jurisprudence and Creed Forums", desc: "Interactive classes answering vital questions on routine worships." },
      { start: "12:00", end: "14:30", title: "Light of Prophethood Scholars Show", desc: "Special lecture explaining the depth of the text of Quran." },
      { start: "14:30", end: "17:00", title: "Deep Tafsir and Spiritual Meditations", desc: "Word-by-word Tafsir and deep ideological insights." },
      { start: "17:00", end: "19:00", title: "Islamic Golden Age Documentary", desc: "Cinematic exploration of Muslim contributions to global sciences." },
      { start: "19:00", end: "21:30", title: "Live Fatwa and Dialogue Forum", desc: "Interactive streaming answering jurisprudential questions in real-time." },
      { start: "21:30", end: "23:00", title: "Schooled by the Companions", desc: "Lessons on the golden generations and the noble followers of Islam." },
      { start: "23:00", end: "24:00", title: "Humility and Evening Soliloquies", desc: "Dua Kumayl and emotional evening invocations." }
    ];

    const source = isArabic ? schedulesAr : schedulesEn;
    return source.map((item, idx) => ({
      id: `fallback_${channelId}_${idx}`,
      channelId,
      title: item.title,
      description: item.desc,
      startTime: item.start,
      endTime: item.end
    }));
  };

  const getChannelPrograms = (channelId: string, channelName: string): TvProgram[] => {
    const dbPrograms = programs.filter(p => p.channelId === channelId);
    if (dbPrograms.length > 0) {
      return [...dbPrograms].sort(sortProgramsByTime);
    }
    return getFallbackPrograms(channelId, channelName, isAr);
  };

  const getCurrentProgramForChannel = (channelId: string, channelName: string): TvProgram | null => {
    const channelProgs = getChannelPrograms(channelId, channelName);
    return channelProgs.find(p => isCurrentProgram(p.startTime, p.endTime)) || null;
  };

  // 1.5 Setup clean, direct fetch with the Firestore 'tv_programs' collection
  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        if (!db) return;
        const programsCol = collection(db, 'tv_programs');
        const snapshot = await getDocs(programsCol);
        const fetched: TvProgram[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.channelId && data.title && data.startTime && data.endTime) {
            fetched.push({
              id: doc.id,
              channelId: data.channelId,
              title: data.title,
              description: data.description || '',
              startTime: data.startTime,
              endTime: data.endTime,
              day: data.day || 'all',
            });
          }
        });
        setPrograms(fetched);
      } catch (err) {
        console.warn("Could not fetch tv_programs:", err);
      }
    };
    fetchPrograms();
  }, []);

  // Helper to handle and format Firestore errors according to security rules auditing specifications
  const handleTvFirestoreError = (err: any) => {
    const auth = (window as any).firebaseAuth || null;
    const errInfo: FirestoreErrorInfo = {
      error: err instanceof Error ? err.message : String(err),
      authInfo: {
        userId: auth?.currentUser?.uid || null,
        email: auth?.currentUser?.email || null,
        emailVerified: auth?.currentUser?.emailVerified || null,
        isAnonymous: auth?.currentUser?.isAnonymous || null,
      },
      operationType: OperationType.GET,
      path: 'tv_channels'
    };
    console.error('Firestore Error in TV module: ', JSON.stringify(errInfo));
    return isAr 
      ? 'فشل جلب القنوات الفضائية المباشرة من قاعدة البيانات. يرجى التحقق من أذونات الأمان والاتصال.'
      : 'Failed to retrieve live channels from the database. Please check authorization and network rules.';
  };

  // 1. Setup clean, direct fetch with the Firestore 'tv_channels' collection
  useEffect(() => {
    setSlowConnection(false);
    setLoading(true);

    const timer = setTimeout(() => {
      setSlowConnection(true);
    }, 5500); // Trigger connection fallback alert if Firestore takes more than 5.5s to reply

    const fetchChannels = async () => {
      try {
        if (!db) {
          clearTimeout(timer);
          setError(isAr ? 'قاعدة بيانات Firestore معطلة حالياً.' : 'Firestore database is currently disabled.');
          setLoading(false);
          return;
        }

        const tvCollectionRef = collection(db, 'tv_channels');
        const snapshot = await getDocs(tvCollectionRef);
        
        clearTimeout(timer);
        setSlowConnection(false);
        const fetchedChannels: TvChannel[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Validate structures are correct
          if (data.name && data.logoUrl && data.streamUrl) {
            fetchedChannels.push({
              id: doc.id,
              name: data.name,
              logoUrl: data.logoUrl,
              streamUrl: getSecureStreamUrl(data.streamUrl),
            });
          }
        });
        
        // Sort channels by name alphabetically
        fetchedChannels.sort((a, b) => a.name.localeCompare(b.name, isAr ? 'ar' : 'en'));
        
        // Add the trial channel requested by the user at the top to test stream.starmenajo.com
        const testChannelId = 'taha_trial';
        if (!fetchedChannels.some(c => c.id === testChannelId || c.streamUrl.includes('stream.starmenajo.com'))) {
          fetchedChannels.unshift({
            id: testChannelId,
            name: isAr ? 'طه (تجريبية)' : 'Taha TV (Trial)',
            logoUrl: '/logo.png',
            streamUrl: 'https://stream.starmenajo.com/live/tahatv/playlist.m3u8',
          });
        }
        
        setChannels(fetchedChannels);
        setError(null);
      } catch (err: any) {
        clearTimeout(timer);
        setSlowConnection(false);
        const errorMsg = err?.message || String(err);
        setError(isAr ? `فشل جلب القنوات: ${errorMsg}` : `Failed to fetch channels: ${errorMsg}`);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();

    return () => {
      clearTimeout(timer);
    };
  }, [isAr]);

  // 2. Manage Video Player Instance Life-Cycle
  useEffect(() => {
    if (!activeChannel || !playUrl) return;

    setPlayerLoading(true);
    setPlayerError(null);
    setPlayerStatusText(isAr ? 'جاري الاتصال بقناة البث المباشر...' : 'Connecting to live broadcast...');

    const isYouTube = getYouTubeEmbedUrl(playUrl) !== null;

    if (isYouTube) {
      // YouTube uses standard safe iframe loading, we don't need HLS.js or video element hooks.
      // The onload event on iframe will set loading back to false.
      return () => {
        console.log('YouTube iframe unmounted and RAM cleaned.');
      };
    }

    let hasStartedPlaying = false;

    // Show more descriptive delay message if stream takes more than 4 seconds to start playing
    const statusTextTimer = setTimeout(() => {
      setPlayerStatusText(isAr 
        ? 'جاري محاولة الاتصال بالسيرفر المضيف... يرجى الانتظار' 
        : 'Attempting to contact streaming server... please hold on'
      );
    }, 4500);

    let connectionTimeoutTimer: any;

    // Give state/DOM a tiny tick to register ref
    const timeoutId = setTimeout(() => {
      const video = videoRef.current;
      if (!video) {
        setPlayerError(isAr ? 'عطل في تحميل مشغل الفيديو.' : 'Could not find video player element.');
        setPlayerLoading(false);
        return;
      }

      console.log("[VideoJS] Initializing robust streaming player with @videojs/http-streaming:", playUrl);

      const isM3U8 = playUrl.toLowerCase().includes('.m3u8') || playUrl.toLowerCase().includes('m3u8');

      // Setup video.js options to ensure optimal Live playback and CORS headers
      const videoJsOptions = {
        autoplay: true,
        controls: false,
        preload: 'auto',
        responsive: true,
        fluid: false,
        muted: isMuted,
        volume: volume,
        techOrder: ['html5'],
        html5: {
          vhs: {
            overrideNative: true,
            withCredentials: false
          }
        },
        sources: [{
          src: playUrl,
          type: isM3U8 ? 'application/x-mpegURL' : 'video/mp4'
        }]
      };

      // Set anonymous crossOrigin directly on the video element for CORS bypass
      video.crossOrigin = 'anonymous';
      video.setAttribute('crossorigin', 'anonymous');

      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing old player:', e);
        }
        playerRef.current = null;
      }

      const player = videojs(video, videoJsOptions, () => {
        console.log('Video.js player is successfully initialized.');
      });

      playerRef.current = player;

      // Register standard videojs player event handlers
      player.on('loadstart', () => {
        setPlayerLoading(true);
        setPlayerError(null);
      });

      player.on('playing', () => {
        hasStartedPlaying = true;
        setPlayerLoading(false);
        setPlayerStatusText('');
      });

      player.on('play', () => {
        setIsPlaying(true);
        setPlayerLoading(false);
      });

      player.on('pause', () => {
        setIsPlaying(false);
      });

      player.on('waiting', () => {
        setPlayerLoading(true);
      });

      player.on('timeupdate', () => {
        setCurrentTime(player.currentTime() || 0);
      });

      player.on('durationchange', () => {
        setDuration(player.duration() || 0);
      });

      player.on('volumechange', () => {
        setIsMuted(player.muted() || false);
        setVolume(player.volume() || 0);
      });

      player.on('error', () => {
        const errorObj = player.error();
        console.error('Video.js player error occured:', errorObj);
        
        // Automatic proxy fallback retry
        if (!hasTriedProxy && !playUrl.includes('/api/proxy') && isM3U8) {
          console.log('[Proxy Fallback] VideoJS playback failed. Attempting connection using CORS Bypass Proxy...');
          setHasTriedProxy(true);
          setPlayerStatusText(isAr ? 'فشل الاتصال المباشر. جاري المحاولة عبر خادم وسيط آمن...' : 'Direct link blocked. Retrying via secure proxy...');
          setPlayUrl('/api/proxy?url=' + encodeURIComponent(getSecureStreamUrl(activeChannel.streamUrl)));
          return;
        }

        setPlayerError(isAr 
          ? 'عذراً، فشل فك ترميز البث أو حدث تمزق في خط الاتصال بالسيرفر.' 
          : 'Sorry, failed to decode the live stream or host communication failed.'
        );
        setPlayerLoading(false);
      });

      // Populate custom stream quality options using Video.js VHS representation APIs if available
      try {
        player.ready(() => {
          const vhs = (player.tech() as any).vhs;
          if (vhs && vhs.representations) {
            const updateLevels = () => {
              const reps = vhs.representations();
              if (reps && reps.length > 0) {
                const formattedLevels = reps.map((rep: any, idx: number) => {
                  const label = rep.height ? `${rep.height}p` : rep.bandwidth ? `${Math.round(rep.bandwidth / 1000)}kbps` : `${isAr ? 'دقة' : 'Level'} ${idx + 1}`;
                  return { index: idx, label };
                });
                setHlsLevels([{ index: -1, label: isAr ? 'تلقائي' : 'Auto' }, ...formattedLevels]);
              } else {
                setHlsLevels([]);
              }
            };
            vhs.addEventListener('loadedplaylist', updateLevels);
            // also trigger once
            setTimeout(updateLevels, 1500);
          }
        });
      } catch (err) {
        console.warn('Crashed setting up custom VHS representations quality levels:', err);
      }

      // Strong error handling constraint: If connection fails or stream doesn't play within 10 seconds, trigger the exact error message
      connectionTimeoutTimer = setTimeout(() => {
        if (!hasStartedPlaying) {
          player.pause();
          
          if (!hasTriedProxy && !playUrl.includes('/api/proxy') && isM3U8) {
            console.log('[Proxy Fallback] VideoJS timeout. Attempting connection using CORS Bypass Proxy...');
            setHasTriedProxy(true);
            setPlayerStatusText(isAr ? 'انتهت مهلة الاتصال المباشر. جاري المحاولة عبر خادم وسيط آمن...' : 'Direct connection timed out. Retrying via secure proxy...');
            setPlayUrl('/api/proxy?url=' + encodeURIComponent(getSecureStreamUrl(activeChannel.streamUrl)));
            return;
          }

          setPlayerError(isAr 
            ? 'عذراً، تعذر الاتصال بالسيرفر، حاول مرة أخرى' 
            : 'Sorry, failed to connect to the server, please try again.'
          );
          setPlayerLoading(false);
          console.warn('[VideoJS] Stream failed to start playing within 10 seconds. Triggered fail HUD.');
        }
      }, 10000);

    }, 50);

    // Clean up connections and destroy player instances safely
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(statusTextTimer);
      clearTimeout(connectionTimeoutTimer);

      setHlsLevels([]);
      setCurrentLevel(-1);

      if (playerRef.current) {
        try {
          playerRef.current.dispose();
          console.log('[VideoJS] Player successfully disposed, DOM elements cleaned and memory freed.');
        } catch (e) {
          console.warn('Error during player disposal:', e);
        }
        playerRef.current = null;
      }
    };
  }, [playUrl, isAr]);

  const renderCustomHUD = () => {
    if (!activeChannel) return null;
    return (
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-30 flex flex-col gap-4 p-6 pb-12 pt-16 pointer-events-auto cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Timeline scrubber if video has duration (VOD stream) */}
            {duration > 0 && isFinite(duration) && duration < 86400 && (
              <div className="flex items-center gap-3 w-full">
                <span className="text-[10px] font-mono font-bold text-white/75">
                  {formatTime(currentTime)}
                </span>
                <div 
                  className="flex-1 h-1.5 bg-white/20 hover:bg-white/30 rounded-full relative cursor-pointer group transition-all"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percentage = clickX / rect.width;
                    const targetTime = percentage * duration;
                    if (videoRef.current) {
                      videoRef.current.currentTime = targetTime;
                    }
                  }}
                >
                  <div 
                    className="h-full bg-amber-500 rounded-full relative"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  >
                    {/* Scrub knob */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-400 scale-0 group-hover:scale-100 transition-transform shadow-md" />
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-white/75">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Control actions row */}
            <div className="flex justify-between items-center w-full">
              
              {/* Play, Volume controls */}
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-amber-400 active:scale-95 transition-all cursor-pointer p-1"
                  title={isPlaying ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
                >
                  {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
                </button>

                {/* Rewind (if VOD) */}
                {duration > 0 && isFinite(duration) && duration < 86400 && (
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                      }
                    }}
                    className="text-white/80 hover:text-amber-400 active:scale-95 transition-all cursor-pointer p-1"
                    title={isAr ? "تأخير ١٠ ثوانٍ" : "Rewind 10s"}
                  >
                    <Rewind size={18} fill="currentColor" />
                  </button>
                )}

                {/* FastForward (if VOD) */}
                {duration > 0 && isFinite(duration) && duration < 86400 && (
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                      }
                    }}
                    className="text-white/80 hover:text-amber-400 active:scale-95 transition-all cursor-pointer p-1"
                    title={isAr ? "تقديم ١٠ ثوانٍ" : "Skip 10s"}
                  >
                    <FastForward size={18} fill="currentColor" />
                  </button>
                )}

                {/* Volume & Mute control with slider */}
                <div className="flex items-center gap-2 group/volume relative">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-amber-400 active:scale-95 transition-all cursor-pointer p-1"
                    title={isMuted ? (isAr ? "إلغاء الكتم" : "Unmute") : (isAr ? "كتم الصوت" : "Mute")}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX size={20} className="text-red-400" />
                    ) : (
                      <Volume2 size={20} />
                    )}
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 md:w-20 h-1 bg-white/20 accent-amber-500 rounded-lg appearance-none cursor-pointer group-hover/volume:bg-white/35 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Middle badge: Live Badge or VOD badge */}
              <div className="flex items-center gap-3">
                {(!duration || !isFinite(duration)) && (
                  <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 px-3 py-1 rounded-full select-none">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    <span className="text-[10px] uppercase font-black tracking-wider text-red-500">
                      {isAr ? "مباشر" : "Live"}
                    </span>
                  </div>
                )}

                {/* HLS Resolution / Quality Level Selector Popup */}
                {hlsLevels && hlsLevels.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/10 py-1.5 px-3 rounded-full text-[11px] font-bold font-mono select-none cursor-pointer transition-all"
                      title={isAr ? "تغيير دقة الفيديو" : "Change quality resolution"}
                    >
                      <Settings size={12} className="animate-pulse" />
                      <span>
                        {currentLevel === -1 
                          ? (isAr ? "تلقائي" : "Auto") 
                          : (hlsLevels.find(l => l.index === currentLevel)?.label || (isAr ? "تلقائي" : "Auto"))
                        }
                      </span>
                    </button>

                    {/* Quality Selector Options Menu */}
                    <AnimatePresence>
                      {showQualityMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full mb-2 right-0 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl py-2 px-1 w-32 shadow-2xl z-50 max-h-48 overflow-y-auto"
                        >
                          {hlsLevels.map((lvl) => (
                            <button
                              key={lvl.index}
                              onClick={() => handleQualityLevelChange(lvl.index)}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-[11px] font-mono hover:bg-white/10 transition-colors flex items-center justify-between cursor-pointer ${
                                currentLevel === lvl.index 
                                  ? "text-amber-400 font-bold bg-white/5" 
                                  : "text-white/80"
                              }`}
                            >
                              <span>{lvl.label}</span>
                              {currentLevel === lvl.index && (
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* EPG Programs Schedule Button */}
                <button
                  onClick={() => setShowEpgDrawer(true)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-amber-400 text-white flex items-center justify-center transition-all cursor-pointer"
                  title={isAr ? "جدول البرامج" : "Program Schedule"}
                >
                  <Calendar size={14} />
                </button>

                {/* Stream Reload Button */}
                <button
                  onClick={() => {
                    setPlayerLoading(true);
                    setPlayerError(null);
                    setHasTriedProxy(false);
                    const origUrl = getSecureStreamUrl(activeChannel.streamUrl);
                    setPlayUrl('');
                    setTimeout(() => setPlayUrl(origUrl), 50);
                  }}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-amber-400 text-white flex items-center justify-center active:rotate-180 transition-all duration-500 cursor-pointer"
                  title={isAr ? "إعادة تحميل البث" : "Reload Transmission"}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const ytEmbedUrl = activeChannel ? getYouTubeEmbedUrl(activeChannel.streamUrl) : null;

  const sortedChannels = [...channels].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.name.localeCompare(b.name, isAr ? 'ar' : 'en');
  });

  const displayedChannels = activeTab === 'all'
    ? sortedChannels
    : sortedChannels.filter(channel => favorites.includes(channel.id));

  const filteredChannels = displayedChannels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const glassCardClasses = "bg-slate-900/40 backdrop-blur-md rounded-[40px] p-8 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)]";

  return (
    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto w-full min-h-screen">
      
      {/* Dynamic Main Header Section */}
      <header className="flex justify-between items-center border-b border-dark-accent/20 pb-4">
        <div className="flex flex-col gap-1">
          <div className="w-12 h-12 rounded-2xl bg-dark-accent/10 border border-dark-accent/20 flex items-center justify-center text-dark-accent mb-2 shadow-sm">
            <Tv size={24} />
          </div>
          <h1 className="text-3xl font-black text-white">
            {isAr ? 'البث المباشر' : 'Live Broadcast'}
            <span className="text-[9px] text-dark-accent block mt-1 uppercase tracking-widest font-mono">
              {isAr ? 'القنوات الفضائية الإسلامية' : 'Islamic Satellite Channels'}
            </span>
          </h1>
        </div>
      </header>

      {/* Main Container Area */}
      <div className={glassCardClasses}>
        
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <Loader2 className="animate-spin text-dark-accent" size={40} />
            <p className="text-sm font-medium text-white/50 animate-pulse">
              {isAr ? 'جاري جلب قائمة البث من الخادم...' : 'Fetching directory indexes from cloud...'}
            </p>
            {slowConnection && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-3xl max-w-xs text-center relative overflow-hidden"
              >
                <p className="text-[11px] leading-relaxed">
                  {isAr
                    ? 'الاتصال بخادم السحابة يستغرق وقتاً أطول بسبب قيود الشبكة. جاري تأسيس اتصال بديل لملء الشاشة والبث...'
                    : 'Cloud connection takes longer than expected due to proxy constraints. Establishing robust alternative channels...'}
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* Firebase Error Message Container */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-center py-10 px-4 bg-red-950/20 border border-red-500/20 rounded-[32px]">
            <AlertOctagon className="text-red-500" size={40} />
            <h3 className="text-base font-bold text-white">
              {isAr ? 'حدث خطأ في جلب البيانات' : 'Error Syncing TV Channels'}
            </h3>
            <p className="text-xs text-white/60 leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* Directory is Empty fallback */}
        {!loading && !error && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-white/5 rounded-[32px] border border-white/5">
            <Tv className="text-white/20 mb-4" size={56} />
            <h4 className="text-base font-black text-white/90 mb-2">
              {isAr ? 'بانتظار إضافة القنوات' : 'Awaiting Content Setup'}
            </h4>
            <p className="text-xs text-white/50 leading-relaxed max-w-sm">
              {isAr 
                ? 'لا توجد قنوات فضائية مضافة حالياً في قاعدة البيانات. بمجرد إضافة القنوات من لوحة المطورين، ستظهر هنا فورياً ومباشرة.'
                : 'No channels configured inside the Firestore databases. As soon as lists are created on firebase under tv_channels, they will sync automatically.'}
            </p>
            <div className="mt-6 text-[10px] font-mono p-3 bg-black/30 text-dark-accent rounded-xl border border-white/5 select-all">
              Collection: tv_channels
            </div>
          </div>
        )}

        {/* Search Bar */}
        {!loading && !error && channels.length > 0 && (
          <div className="relative mb-6 w-full font-sans">
            <input
              type="text"
              placeholder={isAr ? 'ابحث عن قناة' : 'Search for a channel...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] hover:bg-white/[0.06] text-white placeholder-white/35 pr-11 pl-11 py-3 px-4 rounded-xl border border-white/10 focus:border-amber-500/50 focus:outline-none transition-all text-sm text-right"
              dir="rtl"
            />
            {/* Search icon on right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-white/35 pointer-events-none">
              <Search size={16} />
            </div>
            {/* Clear 'X' on left */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-white/35 hover:text-white transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* Tab System Filter Switcher */}
        {!loading && !error && channels.length > 0 && (
          <div className="flex items-center justify-center gap-6 sm:gap-8 text-base sm:text-lg md:text-xl font-sans pb-4 border-b border-white/5 mb-8 w-full" dir="rtl">
            <button
              onClick={() => setActiveTab('all')}
              className={`transition-all duration-300 py-2 cursor-pointer select-none font-bold relative ${
                activeTab === 'all'
                  ? 'text-white scale-[1.03]'
                  : 'text-white/35 hover:text-white/70'
              }`}
            >
              {isAr ? 'جميع القنوات' : 'All Channels'}
            </button>
            <span className="text-white/20 select-none text-lg sm:text-xl font-light">|</span>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`transition-all duration-300 py-2 flex items-center gap-2 cursor-pointer select-none font-bold relative ${
                activeTab === 'favorites'
                  ? 'text-white scale-[1.03]'
                  : 'text-white/35 hover:text-white/70'
              }`}
            >
              {isAr ? 'القنوات المفضلة' : 'Favorite Channels'}
              {favorites.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none bg-white/10 text-white/90">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Channel Gallery Layout */}
        {!loading && !error && channels.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest font-black text-dark-accent bg-dark-accent/10 px-3 py-1 rounded-full border border-dark-accent/20">
                {activeTab === 'all' 
                  ? (isAr ? `${channels.length} قناة متاحة` : `${channels.length} Channels Online`)
                  : (isAr ? `${displayedChannels.length} قنوات مفضلة` : `${displayedChannels.length} Starred Channels`)
                }
              </span>
              {searchQuery && (
                <span className="text-[10px] uppercase tracking-widest font-black text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  {isAr ? `تطابق ${filteredChannels.length} قنوات` : `${filteredChannels.length} Match(es)`}
                </span>
              )}
            </div>

            {filteredChannels.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center py-16 px-6 bg-amber-500/[0.02] rounded-[32px] border border-amber-500/10"
              >
                {searchQuery ? (
                  <>
                    <Search className="text-white/20 mb-4 animate-pulse block mx-auto" size={56} />
                    <h4 className="text-base font-black text-white/95 mb-2">
                      {isAr ? 'لا توجد نتائج مطابقة' : 'No Channels Found'}
                    </h4>
                    <p className="text-xs text-white/55 leading-relaxed max-w-sm">
                      {isAr 
                        ? `لا توجد قناة باسم "${searchQuery}". يرجى تجربة اسم آخر.`
                        : `No channels found matching "${searchQuery}". Please try another name.`}
                    </p>
                  </>
                ) : (
                  <>
                    <Heart className="text-amber-500/25 mb-4 animate-pulse animate-duration-1000 block mx-auto" size={56} />
                    <h4 className="text-base font-black text-white/95 mb-2">
                      {isAr ? 'قائمة المفضلة فارغة' : 'No Favorites Yet'}
                    </h4>
                    <p className="text-xs text-white/55 leading-relaxed max-w-sm">
                      {isAr 
                        ? 'لم تقم بإضافة أي قناة لقائمتك المفضلة بعد. اضغط على رمز القلب في أسفل يسار أي بطاقة قناة لإضافتها هنا.'
                        : 'You have not added any channel to your favorites yet. Tap the heart icon in the bottom-left of any card to add it here.'}
                    </p>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-5 w-full"
              >
                <AnimatePresence mode="popLayout">
                {filteredChannels.map((channel) => {
                  const isFavorite = favorites.includes(channel.id);
                  const curProg = getCurrentProgramForChannel(channel.id, channel.name);
                  return (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      isFavorite={isFavorite}
                      curProg={curProg}
                      isAr={isAr}
                      setActiveChannel={setActiveChannel}
                      toggleFavorite={toggleFavorite}
                    />
                  );
                })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen Video Streaming Mode (Clean HUD Overlay) */}
      <AnimatePresence>
        {activeChannel && (
          <motion.div
            ref={playerContainerRef}
            initial={{ opacity: 0, scale: 0.95, y: 15, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.05, y: -10, filter: "blur(15px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-black z-50 overflow-hidden"
          >
            <div
              className="w-full h-full flex flex-col justify-between absolute inset-0 transition-all duration-300"
              style={getRotationStyle()}
            >
              {/* Top Bar Overlay */}
              <AnimatePresence>
                {showControls && (
                  <motion.header 
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/95 via-black/45 to-transparent flex justify-between items-center z-50 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Three circular buttons on top left */}
                    <div className="flex items-center gap-2">
                      {/* Close Button X */}
                      <button
                        onClick={handleClosePlayer}
                        className="w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-90 text-white rounded-full transition-all flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg group pointer-events-auto cursor-pointer"
                        aria-label="Exit Player"
                      >
                        <X size={18} className="transition-transform group-hover:rotate-90 duration-300" />
                      </button>

                      {/* Scale/Zoom (Maximize/Minimize) */}
                      <button
                        onClick={toggleFullscreen}
                        className="w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg group pointer-events-auto cursor-pointer"
                        title={isFullscreen ? (isAr ? "خروج من ملء الشاشة" : "Exit Fullscreen") : (isAr ? "ملء الشاشة" : "Fullscreen")}
                        aria-label="Toggle Fullscreen"
                      >
                        {isFullscreen ? (
                          <Minimize2 size={18} className="transition-transform group-hover:scale-110 duration-300 text-amber-500" />
                        ) : (
                          <Maximize2 size={18} className="transition-transform group-hover:scale-110 duration-300" />
                        )}
                      </button>

                      {/* Screen Rotation */}
                      <button
                        onClick={() => setRotation(r => (r === 0 ? 90 : r === 90 ? 270 : 0))}
                        className="w-10 h-10 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg group pointer-events-auto cursor-pointer"
                        title={isAr ? "تدوير الشاشة" : "Rotate Screen"}
                        aria-label="Rotate Screen"
                      >
                        <RotateCw size={18} className="transition-transform group-hover:rotate-180 duration-500 text-white" />
                      </button>
                    </div>

                    {/* Name and logo on top right */}
                    <div className="flex items-center gap-3 select-none" dir="rtl">
                      <h3 className="text-white font-black text-base tracking-wide font-sans leading-none">
                        {activeChannel.name}
                      </h3>
                      <div className="w-10 h-10 bg-white/15 backdrop-blur-md rounded-xl overflow-hidden shadow border border-white/10 p-1 flex items-center justify-center">
                        <img
                          src={activeChannel.logoUrl}
                          alt={activeChannel.name}
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  </motion.header>
                )}
              </AnimatePresence>

              {/* Video Canvas Container */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 w-full h-full flex items-center justify-center bg-black relative select-none overflow-hidden"
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onClick={handleOverlayClick}
              >
              
              {/* Spinning status index during initialization */}
              {playerLoading && !playerError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs p-4 gap-4 text-center z-40 pointer-events-none">
                  <div className="relative flex justify-center items-center">
                    {/* Smooth glowing amber spinner */}
                    <div className="w-14 h-14 rounded-full border-3 border-white/5 border-t-amber-500 animate-spin shadow-[0_0_15px_rgba(245,158,11,0.2)]" />
                    {/* Central pulsing core */}
                    <div className="absolute w-4 h-4 rounded-full bg-amber-500 animate-ping opacity-75" />
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  </div>
                  <div className="space-y-1 bg-black/40 px-5 py-2.5 rounded-2xl backdrop-blur-md border border-white/5">
                    <p className="text-white text-xs sm:text-sm font-black tracking-wide font-sans">
                      {playerStatusText || (isAr ? 'جاري الاتصال بالقناة المباشرة...' : 'Connecting to the live broadcast...')}
                    </p>
                    <p className="text-[10px] sm:text-xs text-white/50 font-mono tracking-wider">
                      {isAr ? 'رجاءً انتظر برهة...' : 'please wait a moment...'}
                    </p>
                  </div>
                </div>
              )}

              {/* Playback Crash HUD */}
              {playerError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 gap-4 text-center z-40">
                  <AlertOctagon className="text-red-500 animate-bounce" size={48} />
                  <div className="space-y-1">
                    <h4 className="text-white font-black text-base">
                      {isAr ? 'خطأ في تشغيل القناة' : 'Streaming Failed'}
                    </h4>
                    <p className="text-xs text-white/50 max-w-xs mx-auto">
                      {playerError}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (!activeChannel) return;
                        setPlayerLoading(true);
                        setPlayerError(null);
                        setHasTriedProxy(false);
                        const origUrl = getSecureStreamUrl(activeChannel.streamUrl);
                        setPlayUrl('');
                        setTimeout(() => setPlayUrl(origUrl), 50);
                      }}
                      className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-black rounded-full transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCw size={14} />
                      {isAr ? 'تحديث القناة' : 'Refresh Channel'}
                    </button>
                    <button
                      onClick={handleClosePlayer}
                      className="px-6 py-2.5 bg-white/10 hover:bg-white/15 active:scale-95 text-white/90 text-xs font-bold rounded-full border border-white/10 transition-all shadow-md cursor-pointer"
                    >
                      {isAr ? 'العودة للخلف' : 'Back to Gallery'}
                    </button>
                  </div>
                </div>
              )}

              {/* Central Player Area */}
              <div 
                className="w-full h-full flex items-center justify-center relative"
              >
                {/* Dual Player: YouTube Iframe vs Standard Native Video */}
                {(() => {
                  const isYouTube = ytEmbedUrl !== null;

                  if (isYouTube) {
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <iframe
                          ref={iframeRef}
                          src={ytEmbedUrl || ''}
                          title={activeChannel?.name}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          className="w-full h-full border-0 max-h-screen relative z-10"
                          onLoad={() => setPlayerLoading(false)}
                        />
                      </div>
                    );
                  } else {
                    return (
                      <div className="relative w-full h-full flex items-center justify-center font-sans" data-vjs-player>
                        <video
                          key={activeChannel?.id}
                          ref={videoRef}
                          className="video-js vjs-default-skin w-full h-full object-contain max-h-screen relative z-10"
                          playsInline
                          crossOrigin="anonymous"
                        />
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Unified Controls Overlay aligned cleanly on bottom/middle */}
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute bottom-16 left-0 right-0 z-30 flex justify-center items-center gap-16 pointer-events-auto cursor-default select-none lg:gap-24"
                    dir="ltr"
                    style={{ direction: 'ltr' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Previous Channel Button Container */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handlePrevChannel}
                        className="w-16 h-16 bg-white/5 hover:bg-white/15 active:scale-90 text-white rounded-full border border-white/5 shadow-2xl flex items-center justify-center transition-all cursor-pointer group"
                        title={isAr ? "القناة السابقة" : "Previous Channel"}
                      >
                        <ChevronsLeft size={32} className="transition-transform group-hover:-translate-x-1 duration-300" />
                      </button>
                      <span className="text-[11px] sm:text-xs font-black text-white/70 tracking-wide font-sans text-center">
                        {isAr ? "القناة السابقة" : "Previous Channel"}
                      </span>
                    </div>

                    {/* Play/Pause Button Container */}
                    <div className="flex flex-col items-center justify-center">
                      <button
                        onClick={togglePlayPause}
                        className="w-20 h-20 bg-white/10 hover:bg-white/20 active:scale-90 text-white rounded-full border border-white/10 shadow-2xl flex items-center justify-center transition-all cursor-pointer group"
                        title={isPlaying ? (isAr ? "إيقاف مؤقت" : "Pause") : (isAr ? "تشغيل" : "Play")}
                      >
                        {isPlaying ? (
                          <Pause size={40} className="fill-white text-white hover:text-amber-400 group-hover:scale-105 transition-transform" />
                        ) : (
                          <Play size={40} className="fill-white text-white hover:text-amber-400 ml-1.5 group-hover:scale-105 transition-transform" />
                        )}
                      </button>
                    </div>

                    {/* Next Channel Button Container */}
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handleNextChannel}
                        className="w-16 h-16 bg-white/5 hover:bg-white/15 active:scale-90 text-white rounded-full border border-white/5 shadow-2xl flex items-center justify-center transition-all cursor-pointer group"
                        title={isAr ? "القناة التالية" : "Next Channel"}
                      >
                        <ChevronsRight size={32} className="transition-transform group-hover:translate-x-1 duration-300" />
                      </button>
                      <span className="text-[11px] sm:text-xs font-black text-white/70 tracking-wide font-sans text-center">
                        {isAr ? "القناة التالية" : "Next Channel"}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>

            {/* Bottom HUD Glow aesthetics */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* EPG Programs Drawer Overlay */}
            <AnimatePresence>
              {showEpgDrawer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 z-40 backdrop-blur-md flex items-end justify-center"
                  onClick={() => setShowEpgDrawer(false)}
                >
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="w-full max-w-2xl bg-slate-950 border-t border-white/10 rounded-t-[40px] p-6 max-h-[80vh] overflow-y-auto flex flex-col gap-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                    dir="rtl"
                  >
                    <div className="flex justify-between items-center pb-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                          <Calendar size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-white">
                            {isAr ? 'جدول برامج اليوم' : "Today's Schedule"}
                          </h3>
                          <p className="text-xs text-white/40">
                            {activeChannel.name}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowEpgDrawer(false)}
                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Schedule list */}
                    <div className="flex flex-col gap-3 py-2 overflow-y-auto">
                      {getChannelPrograms(activeChannel.id, activeChannel.name).map((prog) => {
                        const isPlayingNow = isCurrentProgram(prog.startTime, prog.endTime);
                        return (
                          <div
                            key={prog.id}
                            className={`p-4 rounded-3xl border transition-all duration-300 flex flex-col gap-1 relative overflow-hidden text-right ${
                              isPlayingNow
                                ? "border-amber-500 bg-amber-500/[0.04] shadow-[0_4px_24px_rgba(245,158,11,0.1)] scale-[1.02]"
                                : "border-white/5 bg-white/[0.02] hover:border-white/15"
                            }`}
                          >
                            {/* Current Item indicator */}
                            {isPlayingNow && (
                              <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1 h-1 bg-slate-950 rounded-full animate-ping" />
                                {isAr ? 'يعرض الآن' : 'Now Playing'}
                              </div>
                            )}

                            <div className="flex justify-between items-center gap-4 flex-wrap">
                              <h4 className={`text-sm font-black ${isPlayingNow ? "text-amber-400" : "text-white/90"}`}>
                                {prog.title}
                              </h4>
                              <div className="text-xs font-mono font-bold text-white/50 bg-black/40 px-2 py-1 rounded-lg border border-white/5 flex items-center gap-1.5 direction-ltr">
                                <span>{prog.startTime}</span>
                                <span>-</span>
                                <span>{prog.endTime}</span>
                              </div>
                            </div>
                            {prog.description && (
                              <p className="text-xs text-white/60 leading-relaxed font-sans max-w-xl mt-1">
                                {prog.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};



interface ChannelCardProps {
  channel: any;
  isFavorite: boolean;
  curProg: any;
  isAr: boolean;
  setActiveChannel: (channel: any) => void;
  toggleFavorite: (channelId: string, event: React.MouseEvent) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isFavorite,
  curProg,
  isAr,
  setActiveChannel,
  toggleFavorite,
}) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate a size large enough to cover the rectangular card boundary
    const size = Math.max(rect.width, rect.height) * 2.5;

    const newRipple = {
      id: Date.now() + Math.random(),
      x,
      y,
      size,
    };

    setRipples((prev) => [...prev, newRipple]);
    setActiveChannel(channel);

    // Clean up current ripple node once animation ends
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  return (
    <motion.div
      layout
      variants={itemVariants}
      onClick={handleCardClick}
      whileHover={{ 
        y: -4, 
        transition: { type: "spring", stiffness: 400, damping: 20 }
      }}
      whileTap={{ scale: 0.98 }}
      className="bg-transparent cursor-pointer flex flex-col group relative overflow-hidden transition-all duration-300"
    >
      {/* Absolute overlay of responsive ripples */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute bg-amber-500/20 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
      </AnimatePresence>

      {/* 16:9 aspect ratio container for Channel Logo */}
      <div className="aspect-video w-full bg-white/[0.03] flex items-center justify-center relative overflow-hidden rounded-[18px] border border-white/5 pointer-events-none select-none z-10">
        <img
          src={channel.logoUrl}
          alt={channel.name}
          onError={(e) => {
            // Minimalist safe fallback if image link is broken
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            target.style.display = 'none';
            const fallbackFrame = target.parentElement?.querySelector('.fallback-circle') as HTMLElement;
            if (fallbackFrame) fallbackFrame.style.display = 'flex';
          }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {/* fallback circle for missing or broken assets */}
        <div 
          className="fallback-circle absolute inset-0 hidden flex-col items-center justify-center bg-gradient-to-br from-dark-accent/20 to-slate-900 text-white font-black text-xs select-none animate-pulse"
        >
          {channel.name.trim().charAt(0)}
        </div>
        
        {/* Hover play icon representation */}
        <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-9 h-9 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center text-white scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg">
            <Play size={16} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info row directly below the image */}
      <div className="mt-2.5 px-0.5 flex items-center justify-between gap-2 font-sans relative z-10 w-full" dir="rtl">
        {/* Right side: Channel Name */}
        <div className="text-right flex-1 truncate">
          <h4 className="text-xs sm:text-sm font-bold text-white/90 truncate font-sans">
            {channel.name}
          </h4>
        </div>

        {/* Left side: Heart Favorite Icon */}
        <button
          onClick={(e) => toggleFavorite(channel.id, e)}
          className="p-1.5 rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer pointer-events-auto z-20 flex-shrink-0"
          aria-label={isAr ? "إضافة للمفضلة" : "Toggle Favorite"}
        >
          <Heart
            size={18}
            fill={isFavorite ? "#ef4444" : "none"}
            className={isFavorite ? "text-red-500" : "text-white/40 hover:text-red-400 transition-colors"}
          />
        </button>
      </div>
    </motion.div>
  );
};

export default Television;
