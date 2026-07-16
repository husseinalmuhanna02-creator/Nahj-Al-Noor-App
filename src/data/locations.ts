/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface City {
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
  elevation?: number; // Elevation in meters above sea level
}

export interface Country {
  nameAr: string;
  nameEn: string;
  cities: City[];
}

export const countries: Country[] = [
  {
    nameAr: 'العراق',
    nameEn: 'Iraq',
    cities: [
      { nameAr: 'القادسية (الديوانية)', nameEn: 'Al-Qadisiyah (Diwaniyah)', lat: 31.9904, lng: 44.9213, elevation: 30 },
      { nameAr: 'النجف الأشرف', nameEn: 'Najaf', lat: 31.9922, lng: 44.3508, elevation: 60 },
      { nameAr: 'كربلاء المقدسة', nameEn: 'Karbala', lat: 32.6160, lng: 44.0248, elevation: 30 },
      { nameAr: 'بغداد', nameEn: 'Baghdad', lat: 33.3152, lng: 44.3661, elevation: 34 },
      { nameAr: 'البصرة', nameEn: 'Basra', lat: 30.5081, lng: 47.7835, elevation: 5 },
      { nameAr: 'الموصَل', nameEn: 'Mosul', lat: 36.3489, lng: 43.1577, elevation: 223 },
      { nameAr: 'أربيل', nameEn: 'Erbil', lat: 36.1901, lng: 44.0094, elevation: 390 },
      { nameAr: 'السليمانية', nameEn: 'Sulaymaniyah', lat: 35.5620, lng: 45.4330, elevation: 830 },
      { nameAr: 'كركوك', nameEn: 'Kirkuk', lat: 35.4687, lng: 44.3922, elevation: 350 },
      { nameAr: 'بابل (الحلة)', nameEn: 'Babylon', lat: 32.4841, lng: 44.4314, elevation: 34 },
      { nameAr: 'الأنبار (الرمادي)', nameEn: 'Anbar', lat: 33.4243, lng: 43.2987, elevation: 50 },
      { nameAr: 'ديالى (بعقوبة)', nameEn: 'Diyala', lat: 33.7436, lng: 44.6461, elevation: 48 },
      { nameAr: 'صلاح الدين (تكريت)', nameEn: 'Saladin', lat: 34.6000, lng: 43.6800, elevation: 100 },
      { nameAr: 'ذي قار (الناصرية)', nameEn: 'Dhi Qar', lat: 31.0500, lng: 46.2570, elevation: 10 },
      { nameAr: 'ميسان (العمارة)', nameEn: 'Maysan', lat: 31.8350, lng: 47.1450, elevation: 10 },
      { nameAr: 'المثنى (السماوة)', nameEn: 'Muthanna', lat: 31.3121, lng: 45.2758, elevation: 12 },
      { nameAr: 'واسط (الكوت)', nameEn: 'Wasit', lat: 32.5028, lng: 45.8239, elevation: 20 },
      { nameAr: 'دهوك', nameEn: 'Dohuk', lat: 36.8660, lng: 42.9920, elevation: 565 },
      { nameAr: 'حلبجة', nameEn: 'Halabja', lat: 35.1770, lng: 45.9860, elevation: 730 }
    ]
  },
  {
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    cities: [
      { nameAr: 'مكة المكرمة', nameEn: 'Mecca', lat: 21.4225, lng: 39.8262, elevation: 277 },
      { nameAr: 'المدينة المنورة', nameEn: 'Medina', lat: 24.4672, lng: 39.6068, elevation: 608 },
      { nameAr: 'الرياض', nameEn: 'Riyadh', lat: 24.7136, lng: 46.6753, elevation: 612 },
      { nameAr: 'جدة', nameEn: 'Jeddah', lat: 21.5433, lng: 39.1728, elevation: 12 },
      { nameAr: 'الدمام', nameEn: 'Dammam', lat: 26.4207, lng: 50.0888, elevation: 10 },
      { nameAr: 'القطيف', nameEn: 'Qatif', lat: 26.5210, lng: 50.0244, elevation: 5 },
      { nameAr: 'الخبر', nameEn: 'Al Khobar', lat: 26.2762, lng: 50.2081, elevation: 5 }
    ]
  },
  {
    nameAr: 'إيران',
    nameEn: 'Iran',
    cities: [
      { nameAr: 'قم المقدسة', nameEn: 'Qom', lat: 34.6416, lng: 50.8746, elevation: 930 },
      { nameAr: 'مشهد المقدسة', nameEn: 'Mashhad', lat: 36.2972, lng: 59.6067, elevation: 985 },
      { nameAr: 'طهران', nameEn: 'Tehran', lat: 35.6892, lng: 51.3890, elevation: 1189 },
      { nameAr: 'اصفهان', nameEn: 'Isfahan', lat: 32.6546, lng: 51.6680, elevation: 1574 },
      { nameAr: 'شيراز', nameEn: 'Shiraz', lat: 29.5918, lng: 52.5837, elevation: 1500 },
      { nameAr: 'تبريز', nameEn: 'Tabriz', lat: 38.0800, lng: 46.2919, elevation: 1340 },
      { nameAr: 'الأهواز', nameEn: 'Ahvaz', lat: 31.3183, lng: 48.6706, elevation: 17 }
    ]
  },
  {
    nameAr: 'الكويت',
    nameEn: 'Kuwait',
    cities: [
      { nameAr: 'الكويت', nameEn: 'Kuwait City', lat: 29.3759, lng: 47.9774, elevation: 10 },
      { nameAr: 'الأحمدي', nameEn: 'Ahmadi', lat: 29.0769, lng: 48.0839, elevation: 75 },
      { nameAr: 'الجهراء', nameEn: 'Jahra', lat: 29.3375, lng: 47.6581, elevation: 30 },
      { nameAr: 'السالمية', nameEn: 'Salmiya', lat: 29.3333, lng: 48.0667, elevation: 10 },
      { nameAr: 'حولي', nameEn: 'Hawally', lat: 29.3403, lng: 48.0139, elevation: 15 }
    ]
  },
  {
    nameAr: 'البحرين',
    nameEn: 'Bahrain',
    cities: [
      { nameAr: 'المنامة', nameEn: 'Manama', lat: 26.2285, lng: 50.5860, elevation: 5 },
      { nameAr: 'المحرق', nameEn: 'Muharraq', lat: 26.2572, lng: 50.6094, elevation: 5 },
      { nameAr: 'الرفاع', nameEn: 'Riffa', lat: 26.1300, lng: 50.5550, elevation: 70 },
      { nameAr: 'سترة', nameEn: 'Sitra', lat: 26.1550, lng: 50.6200, elevation: 5 },
      { nameAr: 'مدينة حمد', nameEn: 'Hamad Town', lat: 26.1156, lng: 50.5064, elevation: 40 }
    ]
  },
  {
    nameAr: 'لبنان',
    nameEn: 'Lebanon',
    cities: [
      { nameAr: 'بيروت', nameEn: 'Beirut', lat: 33.8938, lng: 35.5018, elevation: 0 },
      { nameAr: 'صيدا', nameEn: 'Sidon', lat: 33.5606, lng: 35.3694, elevation: 10 },
      { nameAr: 'صور', nameEn: 'Tyre', lat: 33.2705, lng: 35.1966, elevation: 10 },
      { nameAr: 'بعلبك', nameEn: 'Baalbek', lat: 34.0044, lng: 36.2110, elevation: 1170 },
      { nameAr: 'طرابلس', nameEn: 'Tripoli', lat: 34.4367, lng: 35.8497, elevation: 10 },
      { nameAr: 'النبطية', nameEn: 'Nabatieh', lat: 33.3789, lng: 35.4839, elevation: 415 }
    ]
  },
  {
    nameAr: 'مصر',
    nameEn: 'Egypt',
    cities: [
      { nameAr: 'القاهرة', nameEn: 'Cairo', lat: 30.0444, lng: 31.2357, elevation: 23 },
      { nameAr: 'الإسكندرية', nameEn: 'Alexandria', lat: 31.2001, lng: 29.9187, elevation: 5 },
      { nameAr: 'الجيزة', nameEn: 'Giza', lat: 30.0081, lng: 31.2064, elevation: 20 },
      { nameAr: 'بورسعيد', nameEn: 'Port Said', lat: 31.2653, lng: 32.3019, elevation: 1 }
    ]
  },
  {
    nameAr: 'الإمارات العربية المتحدة',
    nameEn: 'United Arab Emirates',
    cities: [
      { nameAr: 'أبو ظبي', nameEn: 'Abu Dhabi', lat: 24.4539, lng: 54.3773, elevation: 10 },
      { nameAr: 'دبي', nameEn: 'Dubai', lat: 25.2048, lng: 55.2708, elevation: 5 },
      { nameAr: 'الشارقة', nameEn: 'Sharjah', lat: 25.3463, lng: 55.4209, elevation: 5 },
      { nameAr: 'عجمان', nameEn: 'Ajman', lat: 25.4111, lng: 55.4350, elevation: 5 },
      { nameAr: 'العين', nameEn: 'Al Ain', lat: 24.1302, lng: 55.8023, elevation: 292 }
    ]
  },
  {
    nameAr: 'سلطنة عمان',
    nameEn: 'Oman',
    cities: [
      { nameAr: 'مسقط', nameEn: 'Muscat', lat: 23.5859, lng: 58.4059, elevation: 5 },
      { nameAr: 'صلالة', nameEn: 'Salalah', lat: 17.0151, lng: 54.0924, elevation: 15 },
      { nameAr: 'صحار', nameEn: 'Sohar', lat: 24.3461, lng: 56.7075, elevation: 10 },
      { nameAr: 'نزوى', nameEn: 'Nizwa', lat: 22.9333, lng: 57.5333, elevation: 580 }
    ]
  },
  {
    nameAr: 'قطر',
    nameEn: 'Qatar',
    cities: [
      { nameAr: 'الدوحة', nameEn: 'Doha', lat: 25.2854, lng: 51.5310, elevation: 13 },
      { nameAr: 'الوكرة', nameEn: 'Al Wakrah', lat: 25.1768, lng: 51.6048, elevation: 9 },
      { nameAr: 'الخور', nameEn: 'Al Khor', lat: 25.6839, lng: 51.4981, elevation: 5 },
      { nameAr: 'الريان', nameEn: 'Rayyan', lat: 25.2917, lng: 51.4244, elevation: 30 }
    ]
  },
  {
    nameAr: 'سوريا',
    nameEn: 'Syria',
    cities: [
      { nameAr: 'دمشق', nameEn: 'Damascus', lat: 33.5138, lng: 36.2765, elevation: 680 },
      { nameAr: 'حلب', nameEn: 'Aleppo', lat: 36.2021, lng: 37.1343, elevation: 379 },
      { nameAr: 'حمص', nameEn: 'Homs', lat: 34.7324, lng: 36.7137, elevation: 501 },
      { nameAr: 'اللاذقية', nameEn: 'Latakia', lat: 35.5312, lng: 35.7921, elevation: 5 },
      { nameAr: 'حماة', nameEn: 'Hama', lat: 35.1318, lng: 36.7578, elevation: 312 }
    ]
  },
  {
    nameAr: 'اليمن',
    nameEn: 'Yemen',
    cities: [
      { nameAr: 'صنعاء', nameEn: 'Sana\'a', lat: 15.3694, lng: 44.1910, elevation: 2250 },
      { nameAr: 'عدن', nameEn: 'Aden', lat: 12.7855, lng: 45.0186, elevation: 5 },
      { nameAr: 'تعز', nameEn: 'Taiz', lat: 13.5795, lng: 44.0205, elevation: 1400 },
      { nameAr: 'الحديدة', nameEn: 'Hodeidah', lat: 14.7978, lng: 42.9530, elevation: 5 },
      { nameAr: 'صعدة', nameEn: 'Sa\'dah', lat: 16.9404, lng: 43.7639, elevation: 1800 },
      { nameAr: 'المكلا', nameEn: 'Mukalla', lat: 14.5422, lng: 49.1242, elevation: 10 }
    ]
  },
  {
    nameAr: 'الأردن',
    nameEn: 'Jordan',
    cities: [
      { nameAr: 'عمان', nameEn: 'Amman', lat: 31.9522, lng: 35.9106, elevation: 800 },
      { nameAr: 'الزرقاء', nameEn: 'Zarqa', lat: 32.0608, lng: 36.0942, elevation: 619 },
      { nameAr: 'إربد', nameEn: 'Irbid', lat: 32.5514, lng: 35.8514, elevation: 620 },
      { nameAr: 'العقبة', nameEn: 'Aqaba', lat: 29.5267, lng: 35.0078, elevation: 5 }
    ]
  },
  {
    nameAr: 'المملكة المتحدة',
    nameEn: 'United Kingdom',
    cities: [
      { nameAr: 'لندن', nameEn: 'London', lat: 51.5074, lng: -0.1278, elevation: 15 },
      { nameAr: 'مانشستر', nameEn: 'Manchester', lat: 53.4808, lng: -2.2426, elevation: 38 },
      { nameAr: 'برمنغهام', nameEn: 'Birmingham', lat: 52.4862, lng: -1.8904, elevation: 140 },
      { nameAr: 'غلاسكو', nameEn: 'Glasgow', lat: 55.8642, lng: -4.2518, elevation: 26 },
      { nameAr: 'ليفربول', nameEn: 'Liverpool', lat: 53.4084, lng: -2.9916, elevation: 25 }
    ]
  },
  {
    nameAr: 'الولايات المتحدة الأمريكية',
    nameEn: 'United States',
    cities: [
      { nameAr: 'ديربورن', nameEn: 'Dearborn', lat: 42.3223, lng: -83.1763, elevation: 183 },
      { nameAr: 'ديترويت', nameEn: 'Detroit', lat: 42.3314, lng: -83.0458, elevation: 200 },
      { nameAr: 'نيويورك', nameEn: 'New York', lat: 40.7128, lng: -74.0060, elevation: 10 },
      { nameAr: 'لوس أنجلوس', nameEn: 'Los Angeles', lat: 34.0522, lng: -118.2437, elevation: 71 },
      { nameAr: 'شيكاغو', nameEn: 'Chicago', lat: 41.8781, lng: -87.6298, elevation: 180 },
      { nameAr: 'واشنطن', nameEn: 'Washington D.C.', lat: 38.9072, lng: -77.0369, elevation: 10 },
      { nameAr: 'هيوستن', nameEn: 'Houston', lat: 29.7604, lng: -95.3698, elevation: 25 }
    ]
  },
  {
    nameAr: 'كندا',
    nameEn: 'Canada',
    cities: [
      { nameAr: 'تورونتو', nameEn: 'Toronto', lat: 43.6532, lng: -79.3832, elevation: 76 },
      { nameAr: 'مونتريال', nameEn: 'Montreal', lat: 45.5017, lng: -73.5673, elevation: 37 },
      { nameAr: 'فانكوفر', nameEn: 'Vancouver', lat: 49.2827, lng: -123.1207, elevation: 4 },
      { nameAr: 'أوتاوا', nameEn: 'Ottawa', lat: 45.4215, lng: -75.6972, elevation: 70 },
      { nameAr: 'كالغاري', nameEn: 'Calgary', lat: 51.0447, lng: -114.0719, elevation: 1045 }
    ]
  },
  {
    nameAr: 'السويد',
    nameEn: 'Sweden',
    cities: [
      { nameAr: 'ستوكهولم', nameEn: 'Stockholm', lat: 59.3293, lng: 18.0686, elevation: 15 },
      { nameAr: 'غوتنبرغ', nameEn: 'Gothenburg', lat: 57.7089, lng: 11.9746, elevation: 12 },
      { nameAr: 'مالمو', nameEn: 'Malmo', lat: 55.6050, lng: 13.0038, elevation: 10 }
    ]
  },
  {
    nameAr: 'أستراليا',
    nameEn: 'Australia',
    cities: [
      { nameAr: 'سيدني', nameEn: 'Sydney', lat: -33.8688, lng: 151.2093, elevation: 25 },
      { nameAr: 'ملبورن', nameEn: 'Melbourne', lat: -37.8136, lng: 144.9631, elevation: 15 },
      { nameAr: 'بريزبان', nameEn: 'Brisbane', lat: -27.4705, lng: 153.0260, elevation: 15 }
    ]
  },
  {
    nameAr: 'باكستان',
    nameEn: 'Pakistan',
    cities: [
      { nameAr: 'كاراتشي', nameEn: 'Karachi', lat: 24.8607, lng: 67.0011, elevation: 10 },
      { nameAr: 'لاهور', nameEn: 'Lahore', lat: 31.5204, lng: 74.3587, elevation: 217 },
      { nameAr: 'إسلام آباد', nameEn: 'Islamabad', lat: 33.6844, lng: 73.0479, elevation: 507 }
    ]
  }
];
