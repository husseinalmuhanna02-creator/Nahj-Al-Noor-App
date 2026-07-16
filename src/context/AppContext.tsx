/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSettings, Language } from '../types';
import { countries } from '../data/locations';
import { App } from '@capacitor/app';

export interface AppContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  gpsCoords: { lat: number; lng: number } | null;
  gpsError: string | null;
  isFetchingGps: boolean;
  gpsCityName: { ar: string; en: string } | null;
  resolvedCoords: { lat: number; lng: number };
  refreshGps: () => Promise<void>;
  registerBackHandler: (handler: () => boolean) => () => void;
  triggerBack: () => Promise<void>;
}

export function findNearestCity(lat: number, lng: number) {
  let nearestCity = countries[0].cities[0];
  let nearestCountry = countries[0];
  let minDistance = Infinity;

  for (const country of countries) {
    for (const city of country.cities) {
      const dLat = city.lat - lat;
      const dLng = city.lng - lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDistance) {
        minDistance = dist;
        nearestCountry = country;
        nearestCity = city;
      }
    }
  }

  return {
    city: nearestCity.nameEn,
    country: nearestCountry.nameEn,
    nameAr: nearestCity.nameAr,
    nameEn: nearestCity.nameEn,
    countryAr: nearestCountry.nameAr,
  };
}

const fetchReverseGeocode = async (lat: number, lng: number): Promise<{ ar: string; en: string }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar,en`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'ar,en',
          'User-Agent': 'NahjAlNurPrayerApp/1.0'
        }
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      let nameAr = '';
      let nameEn = '';

      if (data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || data.address.state || '';
        const country = data.address.country || '';
        
        nameAr = city ? `${city}` : country;
        nameEn = city ? `${city}` : country;
      }

      if (!nameAr) {
        nameAr = data.display_name?.split(',')[0] || '';
        nameEn = data.display_name?.split(',')[0] || '';
      }

      if (nameAr) {
        return { ar: nameAr, en: nameEn };
      }
    }
  } catch (error) {
    console.warn("Reverse geocode request failed or timed out", error);
  } finally {
    clearTimeout(timeoutId);
  }

  // Fallback to local nearest city
  const nearest = findNearestCity(lat, lng);
  return { ar: nearest.nameAr, en: nearest.nameEn };
};

const defaultSettings: AppSettings = {
  language: 'ar',
  theme: 'dark',
  hijriOffset: 0,
  country: 'Iraq',
  city: 'Al-Qadisiyah (Diwaniyah)',
  autoLocation: true,
  adhanEnabled: {
    fajr: true,
    dhuhr: true,
    asr: true,
    maghrib: true,
    isha: true,
  },
  backgroundImage: undefined,
  selectedAdhanUrl: 'abathar.mp3',
  tasbihSoundEnabled: true,
  prayerOffsets: {
    fajr: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0,
  },
  prayerAngles: {
    fajr: 16.0,
    maghrib: 4.0,
    isha: 14.0,
  },
  prayerAlertsEnabled: true,
  prayerAlertMinutesBefore: 15,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('nahj_al_nur_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.theme = 'dark'; // Always ensure dark
        return {
          ...defaultSettings,
          ...parsed,
          prayerOffsets: {
            ...defaultSettings.prayerOffsets,
            ...(parsed.prayerOffsets || {}),
          },
          prayerAngles: {
            ...defaultSettings.prayerAngles,
            ...(parsed.prayerAngles || {}),
          },
          adhanEnabled: {
            ...defaultSettings.adhanEnabled,
            ...(parsed.adhanEnabled || {}),
          }
        };
      } catch (e) {
        console.error("Failed to parse settings", e);
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const [activeTab, setActiveTabRaw] = useState('home');
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  const setActiveTab = (tab: string) => {
    setActiveTabRaw(prev => {
      if (prev !== tab) {
        // Prevent duplicate consecutive values
        setTabHistory(h => {
          const updated = [...h, prev];
          if (updated.length > 50) updated.shift();
          return updated;
        });
      }
      return tab;
    });
  };

  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(() => {
    const saved = localStorage.getItem('nahj_al_nur_gps_coords');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [gpsCityName, setGpsCityName] = useState<{ ar: string; en: string } | null>(() => {
    const saved = localStorage.getItem('nahj_al_nur_gps_city_name');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  const refreshGps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !("geolocation" in navigator)) {
        const err = "Geolocation is not supported by your browser.";
        setGpsError(err);
        reject(err);
        return;
      }
      setIsFetchingGps(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setGpsCoords(coords);
          localStorage.setItem('nahj_al_nur_gps_coords', JSON.stringify(coords));
          setGpsError(null);
          setIsFetchingGps(false);

          // Perform reverse geocoding to lock in the name
          fetchReverseGeocode(coords.lat, coords.lng)
            .then((info) => {
              setGpsCityName(info);
              localStorage.setItem('nahj_al_nur_gps_city_name', JSON.stringify(info));
              resolve();
            })
            .catch(() => {
              const localMatch = findNearestCity(coords.lat, coords.lng);
              const info = { ar: localMatch.nameAr, en: localMatch.nameEn };
              setGpsCityName(info);
              localStorage.setItem('nahj_al_nur_gps_city_name', JSON.stringify(info));
              resolve();
            });
        },
        (error) => {
          console.warn("GPS detection failed:", error);
          let errMsg = "Failed to detect location";
          if (error.code === error.PERMISSION_DENIED) {
            errMsg = "Permission denied";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errMsg = "Position unavailable";
          } else if (error.code === error.TIMEOUT) {
            errMsg = "GPS timeout";
          }
          setGpsError(errMsg);
          setIsFetchingGps(false);
          reject(errMsg);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  useEffect(() => {
    if (settings.autoLocation) {
      refreshGps().catch(() => {});
    }
  }, [settings.autoLocation]);

  useEffect(() => {
    localStorage.setItem('nahj_al_nur_settings', JSON.stringify(settings));
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
    
    // Permanently apply dark mode
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.body.classList.add('dark');
  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const backHandlersRef = React.useRef<(() => boolean)[]>([]);

  const registerBackHandler = (handler: () => boolean) => {
    backHandlersRef.current.push(handler);
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter(h => h !== handler);
    };
  };

  const activeTabRef = React.useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const triggerBack = async () => {
    const handlers = backHandlersRef.current;
    for (let i = handlers.length - 1; i >= 0; i--) {
      try {
        const consumed = handlers[i]();
        if (consumed) return;
      } catch (err) {
        console.error("Error executing custom back handler:", err);
      }
    }

    if (tabHistory.length > 0) {
      const prevTab = tabHistory[tabHistory.length - 1];
      setTabHistory(h => h.slice(0, -1));
      setActiveTabRaw(prevTab);
    } else if (activeTabRef.current !== 'home') {
      setActiveTabRaw('home');
    } else {
      try {
        await App.exitApp();
      } catch (e) {
        console.warn('App.exitApp is only available on native platforms.', e);
      }
    }
  };

  useEffect(() => {
    let sub: any;
    const setupListener = async () => {
      try {
        sub = await App.addListener('backButton', () => {
          triggerBack();
        });
      } catch (e) {
        console.log('Capacitor App key backButton listener is not active in standard web browsers.');
      }
    };
    setupListener();
    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, []);

  // Find coordinates based on selected city/country
  const selectedCountry = countries.find(c => c.nameEn === settings.country) || countries[0];
  const selectedCity = selectedCountry.cities.find(c => c.nameEn === settings.city) || selectedCountry.cities[0];

  const resolvedCoords = settings.autoLocation && gpsCoords
    ? gpsCoords
    : { lat: selectedCity.lat, lng: selectedCity.lng };

  return (
    <AppContext.Provider value={{ 
      settings, 
      updateSettings, 
      activeTab, 
      setActiveTab,
      gpsCoords,
      gpsError,
      isFetchingGps,
      gpsCityName,
      resolvedCoords,
      refreshGps,
      registerBackHandler,
      triggerBack
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
