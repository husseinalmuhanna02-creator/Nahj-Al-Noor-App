/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalculationMethod, CalculationParameters, Coordinates, Madhab, PrayerTimes, SunnahTimes, Rounding } from 'adhan';
import { formatInTimeZone } from 'date-fns-tz';
import { countries } from '../data/locations';

export const PRAYER_METHODS = {
  LEVA_QUM: new CalculationParameters('Other', 16.0, 14.0, 0, 4.0),
  NORTH_AMERICA: CalculationMethod.NorthAmerica(),
};

/**
 * Finds the nearest predefined city to the given coordinates to read its elevation.
 */
export const findNearestCityInService = (lat: number, lng: number) => {
  let nearestCity = countries[0].cities[0];
  let minDistance = Infinity;

  for (const country of countries) {
    for (const city of country.cities) {
      const dLat = city.lat - lat;
      const dLng = city.lng - lng;
      const dist = dLat * dLat + dLng * dLng;
      if (dist < minDistance) {
        minDistance = dist;
        nearestCity = city;
      }
    }
  }
  return nearestCity;
};

/**
 * Calculates prayer times using the Qom Leva Institute parameters (Shia standard: 16.0deg Fajr, 4.0deg Maghrib)
 * with support for manual offsets for Sharia precaution.
 * Integrates precision Jafari Midnight calculation.
 */
export const getPrayerTimes = (
  coords: { lat: number; lng: number; elevation?: number }, 
  offsets: { fajr: number; dhuhr: number; asr: number; maghrib: number; isha: number } = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  date: Date = new Date(),
  angles: { fajr: number; maghrib: number; isha: number } = { fajr: 16.0, maghrib: 4.0, isha: 14.0 }
) => {
  const coordinates = new Coordinates(coords.lat, coords.lng);
  
  // Custom Shia Parameters conforming to user's calibrated angles
  // e.g. default 16.0 degrees Fajr angle, 14.0 degrees Isha angle, 4.0 degrees Maghrib angle
  const params = new CalculationParameters('Other', angles.fajr, angles.isha, 0, angles.maghrib);
  params.madhab = Madhab.Shafi; // Jafari preferred Asr matches Shafi shadow factor of 1
  params.rounding = Rounding.Nearest; // Set rounding to standard nearest minute as requested
 
  // Clean all method adjustments to ensure NO hidden standard offsets
  params.methodAdjustments = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  
  // Apply manual offsets for "Sharia Precaution" (Default is 0)
  params.adjustments.fajr = offsets.fajr || 0;
  params.adjustments.dhuhr = offsets.dhuhr || 0;
  params.adjustments.asr = offsets.asr || 0;
  params.adjustments.maghrib = offsets.maghrib || 0;
  params.adjustments.isha = offsets.isha || 0;
 
  const prayerTimes = new PrayerTimes(coordinates, date, params);
  
  // Altitude / Elevation Correction disabled as requested for pure astronomical Flat Horizon calculation.

  // Shia Jafari Midnight (Midpoint between physical sunset and Fajr of the next day)
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowPrayers = new PrayerTimes(coordinates, tomorrow, params);
  
  const tomorrowFajr = tomorrowPrayers.fajr;
 
  if (prayerTimes.sunset && tomorrowFajr) {
    const midnightInterval = (tomorrowFajr.getTime() - prayerTimes.sunset.getTime()) / 2;
    (prayerTimes as any).midnight = new Date(prayerTimes.sunset.getTime() + midnightInterval);
  } else {
    const sunnah = new SunnahTimes(prayerTimes);
    (prayerTimes as any).midnight = sunnah.middleOfTheNight;
  }
 
  return prayerTimes;
};

// Precise Hijri conversion with offset
export const getHijriDate = (offset: number, locale: string = 'ar') => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  
  // Use nu-arab for Arabic locale for traditional feel, otherwise standard latn
  const numberingSystem = locale === 'ar' ? 'arab' : 'latn';
  
  return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura-nu-${numberingSystem}`, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};
