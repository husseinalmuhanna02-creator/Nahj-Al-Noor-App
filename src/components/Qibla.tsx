/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Compass, RotateCw, MapPin, ChevronDown, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Destination {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
}

const DESTINATIONS: Destination[] = [
  { id: 'qibla', nameAr: 'القبلة المشرفة', nameEn: 'The Holy Qibla', lat: 21.4225, lng: 39.8262 },
  { id: 'ali', nameAr: 'مرقد الإمام علي (ع)', nameEn: 'Imam Ali Holy Shrine', lat: 31.9957, lng: 44.3148 },
  { id: 'hussain', nameAr: 'مرقد الإمام الحسين (ع)', nameEn: 'Imam Hussain Holy Shrine', lat: 32.6164, lng: 44.0324 },
  { id: 'abbas', nameAr: 'مرقد الإمام العباس (ع)', nameEn: 'Imam Abbas Holy Shrine', lat: 32.6163, lng: 44.0360 },
  { id: 'kadhimayn', nameAr: 'مرقد الإمامين الكاظمين (ع)', nameEn: 'Kadhimiya Holy Shrines', lat: 33.3797, lng: 44.3350 },
  { id: 'askarayn', nameAr: 'مرقد الإمامين العسكريين (ع)', nameEn: 'Samarra Holy Shrines', lat: 34.1988, lng: 43.8735 },
  { id: 'reza', nameAr: 'مرقد الإمام الرضا (ع)', nameEn: 'Imam Reza Holy Shrine', lat: 36.2890, lng: 59.6175 },
];

type ViewMode = 'initial' | 'compass' | 'distance';

const Qibla: React.FC = () => {
  const { settings } = useApp();
  const isAr = settings.language === 'ar';
  const [heading, setHeading] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('initial');
  const [isCompassActive, setIsCompassActive] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [sensorWarning, setSensorWarning] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<boolean>(false);
  const [selectedDestId, setSelectedDestId] = useState(DESTINATIONS[0].id);
  const [showSelector, setShowSelector] = useState(false);
  const dataReceivedRef = useRef(false);

  const selectedDest = DESTINATIONS.find(d => d.id === selectedDestId) || DESTINATIONS[0];

  // Geolocation with watchPosition for real-time tracking
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationError(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Great-circle bearing algorithm
  const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
    const startLatRad = (startLat * Math.PI) / 180;
    const startLngRad = (startLng * Math.PI) / 180;
    const destLatRad = (destLat * Math.PI) / 180;
    const destLngRad = (destLng * Math.PI) / 180;

    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x =
      Math.cos(startLatRad) * Math.sin(destLatRad) -
      Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
    
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  };

  // Haversine distance formula (returns distance in km)
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistanceParts = (km: number) => {
    if (km < 1) {
      const meters = Math.round(km * 1000);
      return { value: meters.toString(), unit: isAr ? 'م' : 'm' };
    }
    const cleanKm = km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString();
    return { value: cleanKm, unit: isAr ? 'كم' : 'km' };
  };

  const targetBearing = userLocation 
    ? calculateBearing(userLocation.lat, userLocation.lng, selectedDest.lat, selectedDest.lng)
    : 180; 

  const distanceRaw = userLocation
    ? calculateDistanceKm(userLocation.lat, userLocation.lng, selectedDest.lat, selectedDest.lng)
    : 0;

  const distParts = userLocation ? formatDistanceParts(distanceRaw) : { value: '', unit: '' };

  const isAligned = Math.abs((heading - targetBearing + 540) % 360 - 180) < 5;

  const startCompass = () => {
    const handler = (e: any) => {
      let currentHeading = 0;
      if (e.webkitCompassHeading !== undefined) {
        currentHeading = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        currentHeading = (360 - e.alpha) % 360;
      }

      if (currentHeading !== 0) {
        dataReceivedRef.current = true;
        setHeading(currentHeading);
      }
    };

    const win = window as any;
    if ('ondeviceorientationabsolute' in win) {
      win.addEventListener('deviceorientationabsolute', handler, true);
    }
    win.addEventListener('deviceorientation', handler, true);
    setIsCompassActive(true);

    setTimeout(() => {
      if (!dataReceivedRef.current) {
        setSensorWarning(true);
      }
    }, 3000);
  };

  const handleRequestPermission = async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          startCompass();
          setPermissionError(null);
          setViewMode('compass');
        } else {
          setPermissionError(isAr ? 'تم رفض صلاحية الوصول للمستشعرات' : 'Permission to access sensors was denied');
        }
      } catch (e: any) {
        setPermissionError(isAr ? 'حدث خطأ أثناء طلب الصلاحية' : 'Error requesting orientation permission');
      }
    } else {
      startCompass();
      setViewMode('compass');
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-start p-6 bg-transparent transition-all duration-300 pt-12 overflow-y-auto pb-24 relative">
      {/* Back Button for Sub-modes */}
      {viewMode !== 'initial' && (
        <button 
          onClick={() => setViewMode('initial')}
          className="absolute top-8 right-6 z-[60] p-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-full border border-white/20 dark:border-white/10 shadow-lg active:scale-90 transition-all text-natural-dark dark:text-white"
        >
          {isAr ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
        </button>
      )}

      {/* Global Title & Selector (Visible in all modes for context) */}
      <div className="text-center mb-8 w-full max-w-sm relative z-50">
        <h1 className="text-3xl font-bold text-natural-dark dark:text-dark-accent font-serif-header">
          {isAr ? 'البوصلة الروحية' : 'Spiritual Compass'}
        </h1>
        
        {/* Destination Dropdown */}
        <div className="mt-6 relative">
          <button 
            onClick={() => setShowSelector(!showSelector)}
            className="w-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-[24px] px-5 py-3 flex items-center justify-between shadow-lg active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-natural-accent/10 flex items-center justify-center text-natural-accent">
                <MapPin size={16} />
              </div>
              <div className="text-right flex flex-col">
                <span className="text-sm font-black text-natural-dark dark:text-white">
                  {isAr ? selectedDest.nameAr : selectedDest.nameEn}
                </span>
                <span className="text-[9px] font-medium text-natural-dark/50 dark:text-white/40 uppercase tracking-wider">
                  {isAr ? 'الوجهة المختارة' : 'Selected Destination'}
                </span>
              </div>
            </div>
            <ChevronDown className={`text-natural-dark/40 transition-transform ${showSelector ? 'rotate-180' : ''}`} size={18} />
          </button>

          <AnimatePresence>
            {showSelector && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-[24px] shadow-2xl overflow-hidden z-50 py-2"
              >
                {DESTINATIONS.map((dest) => (
                  <button
                    key={dest.id}
                    onClick={() => {
                      setSelectedDestId(dest.id);
                      setShowSelector(false);
                    }}
                    className={`w-full px-5 py-3 text-right flex items-center justify-between hover:bg-natural-accent/5 transition-colors ${selectedDestId === dest.id ? 'bg-natural-accent/10' : ''}`}
                  >
                    <div className="flex flex-col text-right">
                      <span className={`text-sm font-bold ${selectedDestId === dest.id ? 'text-natural-accent' : 'text-natural-dark dark:text-white'}`}>
                        {isAr ? dest.nameAr : dest.nameEn}
                      </span>
                    </div>
                    {selectedDestId === dest.id && <div className="w-2 h-2 rounded-full bg-natural-accent shadow-[0_0_8px_rgba(180,83,9,1)]" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'initial' && (
          <motion.div 
            key="initial"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-12 text-center w-full max-w-sm gap-6"
          >
            <div className="w-24 h-24 rounded-[32px] bg-natural-soft/50 dark:bg-white/5 backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 text-natural-accent shadow-xl">
              <Compass size={48} />
            </div>

            <div className="flex flex-col gap-4 w-full px-4">
              <button 
                onClick={handleRequestPermission}
                className="w-full bg-natural-dark dark:bg-dark-accent text-white px-8 py-5 rounded-[28px] font-black text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-between hover:translate-y-[-2px] group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Compass size={22} className="group-hover:rotate-45 transition-transform" />
                  </div>
                  <span className="text-base">{isAr ? 'تفعيل البوصلة' : 'تفعيل البوصلة 🧭'}</span>
                </div>
                {isAr ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
              </button>

              <button 
                onClick={() => setViewMode('distance')}
                className="w-full bg-white/60 dark:bg-slate-900/60 text-natural-dark dark:text-white px-8 py-5 rounded-[28px] font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-between hover:translate-y-[-2px] border border-white/20 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-natural-accent/10 flex items-center justify-center text-natural-accent">
                    <MapPin size={22} className="group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-base">{isAr ? 'قياس المسافة الفاصلة' : 'قياس المسافة الفاصلة 📍'}</span>
                </div>
                {isAr ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
              </button>
            </div>

            {permissionError && (
              <p className="text-[10px] text-red-500 mt-4 font-black bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">{permissionError}</p>
            )}

            <p className="text-[10px] text-natural-dark/40 dark:text-white/30 max-w-[240px] mt-6 leading-relaxed font-bold uppercase tracking-widest">
              {isAr ? 'يرجى السماح بالوصول للمستشعرات والموقع لضمان دقة النتائج' : 'Please allow sensor and location access for accurate results'}
            </p>
          </motion.div>
        )}

        {viewMode === 'compass' && (
          <motion.div 
            key="compass"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col items-center w-full max-w-sm"
          >
            <div className="bg-white/30 dark:bg-slate-950/40 backdrop-blur-sm rounded-[48px] p-8 shadow-2xl border border-white/20 dark:border-white/10 flex flex-col items-center w-full relative overflow-hidden">
              <h3 className="text-[11px] font-black text-natural-dark/60 dark:text-white/50 mb-8 self-start border-r-4 border-natural-accent dark:border-dark-accent pr-4 uppercase tracking-[0.2em] relative z-10">
                {isAr ? `الاتجاه نحو ${selectedDest.nameAr}` : `Towards ${selectedDest.nameEn}`}
              </h3>
              
              <div className={`relative w-64 h-64 flex items-center justify-center rounded-full border-4 transition-all duration-700 z-10 ${isAligned ? 'border-natural-accent scale-105 shadow-[0_0_80px_rgba(180,83,9,0.5)] bg-natural-accent/5' : 'border-white/20 dark:border-white/5 shadow-2xl bg-white/40 dark:bg-black/20'}`}>
                {isAligned && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.5, 0.1] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-natural-accent/40 blur-3xl"
                  />
                )}

                <div className="absolute inset-3 rounded-full border-2 border-white/10 dark:border-white/5 border-dashed" />
                
                <div className="absolute inset-0 p-1 opacity-40">
                  {[...Array(24)].map((_, i) => (
                    <div 
                      key={i} 
                      className="absolute inset-0 flex justify-center"
                      style={{ transform: `rotate(${i * 15}deg)` }}
                    >
                      <div className={`rounded-full transition-all duration-700 ${isAligned && (Math.abs(i * 15 - targetBearing) < 7.5 || Math.abs(i * 15 - (targetBearing + 180) % 360) < 7.5) ? 'h-5 bg-natural-accent w-1 shadow-[0_0_8px_rgba(180,83,9,1)]' : (i % 2 === 0 ? 'h-3.5 bg-natural-dark/20 dark:bg-white/20 w-0.5' : 'h-2 bg-natural-dark/10 dark:bg-white/10 w-0.5')}`} />
                    </div>
                  ))}
                </div>

                <motion.div 
                  animate={{ rotate: -heading }}
                  className="relative w-full h-full p-4"
                >
                  <div className={`absolute inset-0 flex items-center justify-center text-[11px] font-black pb-1 transition-colors duration-500 ${isAligned ? 'text-natural-accent' : 'text-natural-dark/40 dark:text-white/40'}`}>
                    <span className="absolute top-3 text-red-600 dark:text-red-500 font-black">N</span>
                    <span className="absolute right-3">E</span>
                    <span className="absolute bottom-3">S</span>
                    <span className="absolute left-3">W</span>
                  </div>

                  <motion.div 
                    initial={false}
                    animate={{ rotate: targetBearing }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="relative flex flex-col items-center">
                      <motion.div 
                        animate={isAligned ? { scale: [1, 1.3, 1], y: [0, -3, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[32px] border-b-natural-accent dark:border-b-dark-accent drop-shadow-[0_0_15px_rgba(180,83,9,0.6)] mb-[-4px] relative z-20"
                      />
                      <div className={`w-2.5 h-36 rounded-full transition-all duration-500 ${isAligned ? 'bg-natural-accent/80 dark:bg-dark-accent/80 shadow-[0_0_20px_rgba(180,83,9,0.4)]' : 'bg-black/10 dark:bg-white/10'}`} />
                    </div>
                  </motion.div>
                </motion.div>

                <div className="absolute w-8 h-8 flex items-center justify-center z-20">
                  <div className="w-6 h-6 bg-natural-dark dark:bg-dark-accent rounded-full border-[6px] border-white dark:border-dark-bg shadow-2xl relative z-10" />
                </div>
              </div>

              <div className="mt-8 relative z-10">
                {isAligned && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 text-center"
                  >
                    <span className="text-[11px] font-black text-natural-accent dark:text-dark-accent bg-natural-accent/20 backdrop-blur-md px-6 py-2 rounded-full border border-natural-accent/30 animate-pulse shadow-xl">
                      {isAr ? 'الاتجاه صحيح' : 'ALIGNED CORRECTLY'}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-2 opacity-50">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-black text-natural-dark dark:text-white">{Math.round(heading)}</span>
                <span className="text-lg font-mono font-black text-natural-dark dark:text-white">°</span>
              </div>
              <span className="text-[9px] font-black text-natural-dark/40 dark:text-white/40 uppercase tracking-[0.3em]">
                {isAr ? 'شمال مغناطيسي' : 'Magnetic North'}
              </span>
            </div>
          </motion.div>
        )}

        {viewMode === 'distance' && (
          <motion.div 
            key="distance"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full max-w-sm"
          >
            <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-[48px] p-10 shadow-3xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-natural-accent/5 blur-[80px] rounded-full -mr-16 -mt-16" />
              
              {locationError ? (
                <div className="flex flex-col items-center gap-6 text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner">
                    <MapPin size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-red-600 dark:text-red-400 mb-2">
                       {isAr ? 'فشل تحديد الموقع' : 'Location Not Found'}
                    </h3>
                    <p className="text-xs font-bold text-natural-dark/50 dark:text-white/40 max-w-[220px] leading-relaxed">
                      {isAr ? 'يرجى التأكد من تفعيل الـ GPS ومنح التطبيق إذن الوصول للموقع.' : 'Please ensure GPS is on and the app has location permissions.'}
                    </p>
                  </div>
                </div>
              ) : userLocation ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-natural-accent/10 flex items-center justify-center text-natural-accent mb-8 shadow-inner">
                    <MapPin size={32} />
                  </div>
                  
                  <span className="text-[11px] font-black text-natural-dark/40 dark:text-white/40 uppercase tracking-[0.4em] mb-6">
                    {isAr ? 'المسافة المتبقية' : 'Distance Remaining'}
                  </span>
                  
                  <div className="flex flex-col items-center gap-2 mb-10">
                    <div className="flex items-baseline gap-4">
                      <motion.span 
                        key={distParts.value}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-8xl font-mono font-black text-natural-dark dark:text-white tracking-tighter"
                      >
                        {distParts.value}
                      </motion.span>
                      <span className="text-3xl font-black text-natural-accent dark:text-dark-accent uppercase">
                        {distParts.unit}
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-gradient-to-r from-transparent via-natural-dark/10 dark:via-white/10 to-transparent mb-8" />

                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 bg-green-500/10 px-5 py-2 rounded-full border border-green-500/20">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest">
                        {isAr ? 'تحديث لحظي مفعل' : 'Real-time Tracking'}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold text-natural-dark/30 dark:text-white/30 text-center max-w-[200px] leading-relaxed uppercase tracking-widest">
                      {isAr ? 'يتم حساب المسافة بناءً على إحداثيات جهازك الحالية' : 'Calculated based on your current device coordinates'}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-6 py-12">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-natural-accent/20 border-t-natural-accent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-natural-accent">
                      <MapPin size={24} className="animate-pulse" />
                    </div>
                  </div>
                  <span className="text-[11px] font-black text-natural-dark/40 dark:text-white/40 uppercase tracking-[0.5em] animate-pulse">
                    {isAr ? 'جاري التحديد...' : 'Locating...'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Qibla;
