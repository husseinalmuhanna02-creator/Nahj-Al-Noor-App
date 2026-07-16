/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence, useAnimation } from 'motion/react';
import { RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';

type TasbihMode = 'open' | 'zahra' | 'presets';
type ZahraPhase = 'allahu' | 'alhamdu' | 'subhan';

interface DhikrPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  target: number;
}

const DHIKR_PRESETS: DhikrPreset[] = [
  { id: 'subhanallah', labelAr: 'سبحان الله', labelEn: 'Subhan Allah', target: 33 },
  { id: 'alhamdulillah', labelAr: 'الحمد لله', labelEn: 'Alhamdulillah', target: 33 },
  { id: 'allahuakbar', labelAr: 'الله أكبر', labelEn: 'Allahu Akbar', target: 34 },
  { id: 'laillaha', labelAr: 'لا إله إلا الله', labelEn: 'La ilaha illa Allah', target: 100 },
  { id: 'astaghfirullah', labelAr: 'أستغفر الله', labelEn: 'Astaghfirullah', target: 100 },
  { id: 'salawat', labelAr: 'اللهم صل على محمد وآل محمد', labelEn: 'Salawat', target: 100 },
];

const Tasbih: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const isAr = settings.language === 'ar';
  
  const [mode, setMode] = useState<TasbihMode>('zahra');
  const [count, setCount] = useState(0);
  const [zahraPhase, setZahraPhase] = useState<ZahraPhase>('allahu');
  const [selectedPreset, setSelectedPreset] = useState<DhikrPreset>(DHIKR_PRESETS[0]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const soundEnabled = settings.tasbihSoundEnabled;

  const controls = useAnimation();
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const initAudio = () => {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    window.addEventListener('click', initAudio, { once: true });
    return () => window.removeEventListener('click', initAudio);
  }, []);

  const playClickSound = () => {
    if (!soundEnabled || !audioContext.current) return;
    
    const ctx = audioContext.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(err => console.error('Failed to resume audio context', err?.message || err));
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Start with a higher frequency for a crisp "tick"
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);
    
    // Quick gain ramp for a short click
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  };

  const triggerHaptic = (duration = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  };

  const handlePress = useCallback(() => {
    if (isCompleted) {
      reset();
      return;
    }

    playClickSound();
    triggerHaptic();
    
    controls.start({
      scale: [1, 0.95, 1.05, 1],
      transition: { duration: 0.15 }
    });

    if (mode === 'open') {
      setCount(prev => prev + 1);
    } else if (mode === 'presets') {
      if (count < selectedPreset.target - 1) {
        setCount(prev => prev + 1);
      } else {
        setCount(prev => prev + 1);
        setIsCompleted(true);
        triggerHaptic(200);
      }
    } else {
      if (zahraPhase === 'allahu') {
        if (count < 33) {
          setCount(prev => prev + 1);
        } else {
          setZahraPhase('alhamdu');
          setCount(0);
          triggerHaptic(100);
        }
      } else if (zahraPhase === 'alhamdu') {
        if (count < 32) {
          setCount(prev => prev + 1);
        } else {
          setZahraPhase('subhan');
          setCount(0);
          triggerHaptic(100);
        }
      } else if (zahraPhase === 'subhan') {
        if (count < 32) {
          setCount(prev => prev + 1);
        } else {
          setCount(prev => prev + 1);
          setIsCompleted(true);
          triggerHaptic(300);
        }
      }
    }
  }, [mode, count, zahraPhase, isCompleted, selectedPreset, controls, soundEnabled]);

  const reset = () => {
    setCount(0);
    setZahraPhase('allahu');
    setIsCompleted(false);
    triggerHaptic(50);
  };

  const getPhaseData = () => {
    if (mode === 'open') return { label: isAr ? 'حر' : 'Open', target: 0 };
    if (mode === 'presets') return { label: isAr ? selectedPreset.labelAr : selectedPreset.labelEn, target: selectedPreset.target };
    
    switch (zahraPhase) {
      case 'allahu': return { label: isAr ? 'الله أكبر' : 'Allahu Akbar', target: 34 };
      case 'alhamdu': return { label: isAr ? 'الحمد لله' : 'Alhamdulillah', target: 33 };
      case 'subhan': return { label: isAr ? 'سبحان الله' : 'Subhan Allah', target: 33 };
    }
  };

  const { label, target } = getPhaseData();

  const strokeDasharray = 2 * Math.PI * 88;
  const strokeDashoffset = strokeDasharray - (strokeDasharray * (isCompleted ? 1 : (count / (target || 100))));

  return (
    <div className="h-full flex flex-col items-center justify-between p-6 pb-32 bg-transparent transition-all duration-500 overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-dark-accent rounded-full blur-[140px]" 
        />
      </div>

      {/* Header Controls */}
      <div className="w-full flex items-center justify-between z-10 px-2 lg:px-0">
        <div className="bg-slate-900/40 backdrop-blur-md p-1.5 rounded-[28px] border border-white/5 flex gap-1 shadow-xl">
          {(['zahra', 'open', 'presets'] as TasbihMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); reset(); if (m === 'presets') setShowPresets(true); else setShowPresets(false); }}
              className={`px-6 py-3 rounded-[22px] text-[10px] font-black uppercase tracking-wider transition-all duration-500 ${
                mode === m 
                  ? 'bg-dark-accent text-white shadow-lg scale-[1.03]' 
                  : 'text-white/30 hover:bg-white/5'
              }`}
            >
              {m === 'zahra' ? (isAr ? 'الزهراء (ع)' : 'Zahra') : m === 'open' ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'أذكار' : 'Dhikr')}
            </button>
          ))}
        </div>

        <button
          onClick={() => updateSettings({ tasbihSoundEnabled: !soundEnabled })}
          className={`w-12 h-12 rounded-[24px] flex items-center justify-center backdrop-blur-xl transition-all duration-300 border ${
            soundEnabled 
              ? 'bg-dark-accent/10 border-dark-accent/20 text-dark-accent shadow-[0_0_20px_rgba(180,83,9,0.1)]' 
              : 'bg-white/20 border-white/10 text-white/30'
          }`}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* Selector Container */}
      <div className="w-full relative z-20">
        <AnimatePresence>
          {mode === 'presets' && showPresets && (
            <motion.div 
              initial={{ y: -10, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -10, opacity: 0, scale: 0.98 }}
              className="w-full overflow-x-auto no-scrollbar flex gap-2 pt-6 pb-2 px-1"
            >
              {DHIKR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedPreset(p); reset(); }}
                  className={`px-6 py-3.5 rounded-[24px] whitespace-nowrap text-xs font-bold transition-all border shrink-0 backdrop-blur-xl ${
                    selectedPreset.id === p.id 
                      ? 'bg-dark-accent text-white border-transparent shadow-xl scale-105' 
                      : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {isAr ? p.labelAr : p.labelEn}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Counter Component */}
      <div className="flex-1 w-full max-w-sm flex flex-col items-center justify-center relative z-10 py-4">
        <section 
          onClick={handlePress}
          className="w-full relative group cursor-pointer selection:bg-transparent"
        >
          {/* Aesthetic Bezel / Shadow Ring */}
          <div className="absolute -inset-6 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 rounded-[80px] blur-[30px] opacity-30 pointer-events-none" />
          
          <motion.div 
            animate={controls}
            className="w-full aspect-[4/5] bg-slate-900/40 backdrop-blur-md rounded-[72px] border border-white/10 flex flex-col items-center justify-between py-12 relative overflow-hidden shadow-[0_48px_96px_-24px_rgba(0,0,0,0.15)] transition-all group-active:scale-[0.97]"
          >
            {/* Visual Textures */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_70%)] pointer-events-none" />
            
            <header className="flex flex-col items-center relative z-10">
              <span className="text-[10px] font-black tracking-[0.4em] uppercase text-dark-accent/80 mb-1">
                {mode === 'zahra' ? (isAr ? 'تسبيح الزهراء' : 'Tasbih Al-Zahra') : 
                 mode === 'presets' ? (isAr ? 'الذكر المختار' : 'Active Dhikr') : 
                 (isAr ? 'تسبيح حر' : 'Free Tasbih')}
              </span>
              <div className="w-8 h-[2px] bg-dark-accent/20 rounded-full" />
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={label + isCompleted}
                initial={{ y: 20, opacity: 0, filter: 'blur(8px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -20, opacity: 0, filter: 'blur(8px)' }}
                className="flex flex-col items-center text-center px-8 w-full relative z-10"
              >
                {isCompleted ? (
                  <div className="flex flex-col items-center">
                    <motion.div
                       initial={{ scale: 0, rotate: -45 }}
                       animate={{ scale: 1, rotate: 0 }}
                       transition={{ type: 'spring', damping: 12, stiffness: 120 }}
                    >
                      <div className="w-20 h-20 rounded-[32px] bg-yellow-500/10 backdrop-blur-md border border-yellow-500/20 flex items-center justify-center mb-6 shadow-xl shadow-yellow-500/5">
                        <Sparkles className="text-yellow-400" size={32} fill="currentColor" fillOpacity={0.1} />
                      </div>
                    </motion.div>
                    <h2 className="text-4xl font-black text-white leading-tight">
                      {isAr ? 'تقبل الله' : 'Accepted'}
                    </h2>
                    <p className="text-[10px] font-black text-white/20 mt-4 tracking-[0.2em] uppercase">
                      {isAr ? 'تم الانتهاء من الورد' : 'Dhikr completed'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className={`font-bold text-white font-arabic leading-tight drop-shadow-sm transition-all duration-300 ${
                      label.length > 20 ? 'text-2xl' : label.length > 10 ? 'text-3xl' : 'text-4xl'
                    }`}>
                      {label}
                    </h3>
                    {target > 0 && (
                      <div className="flex items-center justify-center gap-3">
                        <div className="px-3 py-1 rounded-full bg-dark-accent/5 border border-dark-accent/10">
                          <span className="text-[10px] font-black text-dark-accent tabular-nums tracking-wider uppercase">
                            {count} / {target}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Circular Display */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-4 rounded-full border border-white/5 shadow-inner bg-gradient-to-t from-white/5 to-transparent" />
              
              <svg className="absolute w-full h-full -rotate-90">
                <circle 
                  cx="128" cy="128" r="92" 
                  stroke="rgba(255,255,255,0.03)" 
                  strokeWidth="6" fill="transparent" 
                />
                <motion.circle
                  cx="128" cy="128" r="92"
                  stroke="#F59E0B" 
                  strokeWidth="10" strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 92}
                  animate={{ strokeDashoffset: 2 * Math.PI * 92 - (2 * Math.PI * 92 * (isCompleted ? 1 : (count / (target || 100)))) }}
                  transition={{ type: 'spring', damping: 30, stiffness: 60 }}
                />
              </svg>

              <div className="text-center z-10 flex flex-col items-center">
                <AnimatePresence mode="popLayout">
                  <motion.span 
                    key={count}
                    initial={{ scale: 0.85, y: 10, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 1.1, y: -10, opacity: 0 }}
                    className="text-[90px] font-black text-white tabular-nums leading-none tracking-tighter drop-shadow-md"
                  >
                    {isCompleted ? '✓' : count}
                  </motion.span>
                </AnimatePresence>
                {!isCompleted && (
                  <div className="flex gap-1.5 mt-2">
                    {[...Array(3)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                          i < (count % 3) + 1 ? 'bg-dark-accent scale-110' : 'bg-white/10'
                        }`} 
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="w-24 h-1 bg-white/5 rounded-full relative z-10" />
          </motion.div>
        </section>
      </div>

      {/* Counter Controls */}
      <div className="w-full max-w-sm grid grid-cols-3 gap-5 z-10 px-2 lg:px-0">
        <button
          onClick={reset}
          className="h-20 rounded-[36px] border border-white/5 bg-white/5 backdrop-blur-xl flex items-center justify-center text-white/30 shadow-xl active:scale-[0.85] transition-all hover:bg-white/10 group"
          title={isAr ? 'إعادة تعيين' : 'Reset'}
        >
          <RotateCcw size={24} className="group-hover:rotate-180 transition-transform duration-700" />
        </button>
        
        <button
          onClick={handlePress}
          className="col-span-2 h-20 bg-dark-accent text-white rounded-[36px] font-black text-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.4)] active:scale-[0.96] transition-all relative overflow-hidden flex items-center justify-center gap-4 group"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition-opacity" />
          {isCompleted ? (
            <>
              <RotateCcw size={20} />
              <span className="tracking-tight text-lg uppercase">{isAr ? 'البدء من جديد' : 'RESTART'}</span>
            </>
          ) : (
            <span className="tracking-[0.4em] font-black text-xl">{isAr ? 'تـسـبـيـح' : 'TAP'}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Tasbih;
