/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseEnabled } from '../services/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import { 
  MapPin, 
  Home as HomeIcon, 
  Plus, 
  Phone, 
  Users, 
  Check, 
  HeartHandshake, 
  X, 
  Building, 
  UsersRound, 
  Info, 
  AlertCircle, 
  User, 
  ArrowRightLeft, 
  Trash2,
  Edit,
  Calendar,
  Map as MapIcon,
  List,
  Eye,
  CheckCircle,
  Share2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface HostingPost {
  id: string;
  publisherId: string;
  publisherName: string;
  governorate: string;
  city: string;
  placeType: 'بيت' | 'حسينية' | 'موكب';
  capacity: number;
  phone: string;
  notes: string;
  bookings: string[]; // List of userIds who booked this post
  createdAt: string;
  lat: number;
  lng: number;
}

// Simulated User Profiles
interface SimulatedUser {
  id: string;
  name: string;
  role: 'host' | 'visitor';
}

const SIMULATED_USERS: SimulatedUser[] = [
  { id: 'user_karbalai_host', name: 'الحاج أبو كرار (كربلاء المقدسة)', role: 'host' },
  { id: 'user_najafi_host', name: 'السيد أبو الحسن (النجف الأشرف)', role: 'host' },
  { id: 'visitor_basra', name: 'الزائر أبو علي (من البصرة)', role: 'visitor' },
  { id: 'visitor_baghdad', name: 'الزائر أبو مصطفى (من بغداد)', role: 'visitor' },
];

const IRAQI_GOVERNORATES = [
  'كربلاء المقدسة',
  'النجف الأشرف',
  'بغداد',
  'بابل',
  'البصرة',
  'القادسية',
  'المثنى',
  'ذي قار',
  'ميسان',
  'واسط',
  'ديالى',
  'صلاح الدين',
  'الأنبار',
  'كركوك',
  'نينوى',
  'دهوك',
  'أربيل',
  'السليمانية',
  'حلبجة'
];

// Map governorates to central coordinates in Iraq
const GOVERNORATE_COORDS: { [key: string]: [number, number] } = {
  'كربلاء المقدسة': [32.6160, 44.0249],
  'النجف الأشرف': [31.9922, 44.3510],
  'بغداد': [33.3152, 44.3661],
  'بابل': [32.4812, 44.4305],
  'البصرة': [30.5081, 47.7835],
  'القادسية': [31.9904, 44.9252],
  'المثنى': [31.3315, 45.2818],
  'ذي قار': [31.0579, 46.2289],
  'ميسان': [31.8494, 47.1449],
  'واسط': [32.5111, 45.8113],
  'ديالى': [33.7981, 44.6497],
  'صلاح الدين': [34.6001, 43.6782],
  'الأنبار': [33.4214, 43.3031],
  'كركوك': [35.4687, 44.3922],
  'نينوى': [36.3489, 43.1531],
  'دهوك': [36.8621, 42.9884],
  'أربيل': [36.1901, 44.0089],
  'السليمانية': [35.5617, 45.4411],
  'حلبجة': [35.1777, 45.9861]
};

const PLACE_TYPES = [
  { value: 'بيت', label: 'بيت (منزل سكني)' },
  { value: 'حسينية', label: 'حسينية مباركة' },
  { value: 'موكب', label: 'موكب خدمي / إيواء' }
] as const;

// Seed data to make the page populated and engaging on first load
const SEED_POSTS: HostingPost[] = [
  {
    id: 'post_seed_1',
    publisherId: 'user_karbalai_host',
    publisherName: 'الحاج أبو كرار (كربلاء المقدسة)',
    governorate: 'كربلاء المقدسة',
    city: 'حي العباس - قرب العتبة',
    placeType: 'بيت',
    capacity: 25,
    phone: '07701234567',
    notes: 'نهيئ مبيت متكامل لزوار أبي عبد الله الحسين عليه السلام، متوفر وجبات طعام ووسائل راحة وإنترنت مجاني.',
    bookings: ['visitor_basra'],
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), // 2 days ago
    lat: 32.6190,
    lng: 44.0210
  },
  {
    id: 'post_seed_2',
    publisherId: 'user_najafi_host',
    publisherName: 'السيد أبو الحسن (النجف الأشرف)',
    governorate: 'النجف الأشرف',
    city: 'شارع الرسول - قرب مرقد الإمام علي (ع)',
    placeType: 'حسينية',
    capacity: 100,
    phone: '07809876543',
    notes: 'حسينية مجهزة بالكامل لاستقبال زوار الأربعينية. تتوفر قاعات منفصلة للرجال والنساء وحمامات خارجية متكاملة.',
    bookings: [],
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
    lat: 31.9950,
    lng: 44.3480
  },
  {
    id: 'post_seed_3',
    publisherId: 'visitor_basra', // Simulated as if this visitor also hosts in Basra
    publisherName: 'الزائر أبو علي (من البصرة)',
    governorate: 'البصرة',
    city: 'قضاء القرنة - شارع السدرة',
    placeType: 'موكب',
    capacity: 50,
    phone: '07503334445',
    notes: 'موكب أهالي البصرة الخدمي، مستعدون لاستضافة الزوار القادمين من المحافظات الجنوبية والمنافذ الحدودية متوفر غداء وعشاء.',
    bookings: ['visitor_baghdad'],
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(), // 1.5 days ago
    lat: 30.5120,
    lng: 47.7880
  }
];

const Zowar: React.FC = () => {
  const { settings } = useApp();
  const isAr = settings.language === 'ar';

  // State
  const [posts, setPosts] = useState<HostingPost[]>([]);
  const [authUserId, setAuthUserId] = useState<string>('anonymous');
  const [authUserName, setAuthUserName] = useState<string>('زائر كريم');
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<HostingPost | null>(null);
  
  // Form fields
  const [hostNameInput, setHostNameInput] = useState('');
  const [selectedGovernorate, setSelectedGovernorate] = useState(IRAQI_GOVERNORATES[0]);
  const [cityInput, setCityInput] = useState('');
  const [placeType, setPlaceType] = useState<'بيت' | 'حسينية' | 'موكب'>('بيت');
  const [capacity, setCapacity] = useState<number>(10);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formCoords, setFormCoords] = useState<[number, number]>([32.6160, 44.0249]);
  
  // Filtering & Map Settings
  const [filterGovernorate, setFilterGovernorate] = useState<string>('all');
  const [filterPlaceType, setFilterPlaceType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'both' | 'list' | 'map'>('both');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // Map references
  const mainMapContainerRef = useRef<HTMLDivElement | null>(null);
  const mainMapRef = useRef<L.Map | null>(null);
  const mainMarkersGroupRef = useRef<L.FeatureGroup | null>(null);

  const modalMapContainerRef = useRef<HTMLDivElement | null>(null);
  const modalMapRef = useRef<L.Map | null>(null);
  const modalMarkerRef = useRef<L.Marker | null>(null);

  // Initialize and load saved posts from Firestore
  useEffect(() => {
    if (!isFirebaseEnabled()) {
      return;
    }

    // Validate connection to Firestore on boot (as requested by skill rules)
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Listen to Firebase auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUserId(user.uid);
        setAuthUserName(user.isAnonymous ? 'زائر كريم' : (user.displayName || 'زائر كريم'));
      } else {
        setAuthUserId('anonymous');
        setAuthUserName('زائر كريم');
      }
    });

    const pathForOnSnapshot = 'zowar_posts';
    const unsubscribeSnapshot = onSnapshot(collection(db, pathForOnSnapshot), (snapshot) => {
      const loadedPosts: HostingPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedPosts.push({
          id: docSnap.id,
          publisherId: data.publisherId || '',
          publisherName: data.publisherName || '',
          governorate: data.governorate || '',
          city: data.city || '',
          placeType: data.placeType || 'بيت',
          capacity: Number(data.capacity) || 10,
          phone: data.phone || '',
          notes: data.notes || '',
          bookings: Array.isArray(data.bookings) ? data.bookings : [],
          createdAt: data.createdAt || new Date().toISOString(),
          lat: typeof data.lat === 'number' ? data.lat : 32.6160,
          lng: typeof data.lng === 'number' ? data.lng : 44.0249,
        });
      });
      // Sort posts by createdAt desc
      loadedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPosts(loadedPosts);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
    });

    // Adapt viewMode based on screen size on mount
    if (window.innerWidth < 768) {
      setViewMode('list');
    }

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []);

  // Generate beautiful custom glowing HTML icons for Leaflet Map
  const createCustomMarkerIcon = (type: 'بيت' | 'حسينية' | 'موكب', isSelected: boolean) => {
    let colorClass = 'bg-blue-500';
    let borderClass = 'border-blue-300';
    let label = '🏠';

    if (type === 'حسينية') {
      colorClass = 'bg-purple-500';
      borderClass = 'border-purple-300';
      label = '🕌';
    } else if (type === 'موكب') {
      colorClass = 'bg-emerald-500';
      borderClass = 'border-emerald-300';
      label = '🚩';
    }

    return L.divIcon({
      className: 'custom-leaflet-marker-icon',
      html: `
        <div class="relative flex items-center justify-center transition-all duration-300 transform ${isSelected ? 'scale-125 z-[9999]' : 'hover:scale-110'}">
          <div class="absolute w-8 h-8 rounded-full ${colorClass} opacity-30 animate-ping"></div>
          <div class="relative w-8 h-8 rounded-full ${colorClass} border-2 ${borderClass} flex items-center justify-center shadow-lg text-white font-bold text-xs">
            ${label}
          </div>
          ${isSelected ? `<div class="absolute -bottom-1 w-2 h-2 bg-amber-500 rotate-45 border-r border-b border-amber-300"></div>` : ''}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  // Helper to add a small random offset to coordinates to avoid perfect overlapping
  const addJitter = (coords: [number, number]): [number, number] => {
    const jitterLat = (Math.random() - 0.5) * 0.015;
    const jitterLng = (Math.random() - 0.5) * 0.015;
    return [coords[0] + jitterLat, coords[1] + jitterLng];
  };

  // Set coordinates when Governorate changes in publishing form
  useEffect(() => {
    const baseCoords = GOVERNORATE_COORDS[selectedGovernorate] || [32.6160, 44.0249];
    setFormCoords(baseCoords);

    if (modalMapRef.current && modalMarkerRef.current) {
      modalMapRef.current.setView(baseCoords, 11);
      modalMarkerRef.current.setLatLng(baseCoords);
    }
  }, [selectedGovernorate]);

  // Handle publishing form submit
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hostNameInput.trim()) {
      alert(isAr ? 'يرجى كتابة اسم صاحب المضيف' : 'Please provide the host owner name');
      return;
    }

    if (!cityInput.trim()) {
      alert(isAr ? 'يرجى كتابة اسم المدينة أو الحي' : 'Please fill in city/district name');
      return;
    }

    if (!phone.trim()) {
      alert(isAr ? 'يرجى كتابة رقم الهاتف للتواصل' : 'Please provide a contact phone number');
      return;
    }

    try {
      if (editingPost) {
        // Editing existing post in Firestore
        const postDocRef = doc(db, 'zowar_posts', editingPost.id);
        await setDoc(postDocRef, {
          publisherName: hostNameInput.trim(),
          governorate: selectedGovernorate,
          city: cityInput.trim(),
          placeType: placeType,
          capacity: Number(capacity) || 10,
          phone: phone.trim(),
          notes: notes.trim(),
          lat: formCoords[0],
          lng: formCoords[1]
        }, { merge: true });
      } else {
        // Creating new post in Firestore
        const finalCoords = addJitter(formCoords);
        const newPost = {
          publisherId: authUserId,
          publisherName: hostNameInput.trim(),
          governorate: selectedGovernorate,
          city: cityInput.trim(),
          placeType: placeType,
          capacity: Number(capacity) || 10,
          phone: phone.trim(),
          notes: notes.trim(),
          bookings: [],
          createdAt: new Date().toISOString(),
          lat: finalCoords[0],
          lng: finalCoords[1]
        };
        await addDoc(collection(db, 'zowar_posts'), newPost);
      }

      // Reset Form & Close
      setHostNameInput('');
      setCityInput('');
      setPhone('');
      setNotes('');
      setCapacity(10);
      setPlaceType('بيت');
      setEditingPost(null);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'zowar_posts');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPost(null);
    setHostNameInput('');
    setSelectedGovernorate(IRAQI_GOVERNORATES[0]);
    setCityInput('');
    setPlaceType('بيت');
    setCapacity(10);
    setPhone('');
    setNotes('');
    setFormCoords(GOVERNORATE_COORDS[IRAQI_GOVERNORATES[0]] || [32.6160, 44.0249]);
    setIsModalOpen(true);
  };

  const handleStartEdit = (post: HostingPost) => {
    setEditingPost(post);
    setHostNameInput(post.publisherName);
    setSelectedGovernorate(post.governorate);
    setCityInput(post.city);
    setPlaceType(post.placeType);
    setCapacity(post.capacity);
    setPhone(post.phone);
    setNotes(post.notes);
    setFormCoords([post.lat, post.lng]);
    setIsModalOpen(true);
  };

  const handleBookingToggle = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const isBooked = post.bookings.includes(authUserId);
      const newBookings = isBooked 
        ? post.bookings.filter(id => id !== authUserId) 
        : [...post.bookings, authUserId];
      
      await setDoc(doc(db, 'zowar_posts', postId), {
        bookings: newBookings
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `zowar_posts/${postId}`);
    }
  };

  const handleDeletePostConfirm = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'zowar_posts', postId));
      setDeletingPostId(null);
      if (selectedPostId === postId) {
        setSelectedPostId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `zowar_posts/${postId}`);
    }
  };

  // Filter logic
  const filteredPosts = posts.filter(post => {
    const matchesGov = filterGovernorate === 'all' || post.governorate === filterGovernorate;
    const matchesType = filterPlaceType === 'all' || post.placeType === filterPlaceType;
    return matchesGov && matchesType;
  });

  // Handle map selection
  const handleSelectPostFromMap = (postId: string, coords: [number, number]) => {
    setSelectedPostId(postId);
    if (mainMapRef.current) {
      mainMapRef.current.setView(coords, 12, { animate: true, duration: 1 });
    }
    // Scroll list item to view
    const element = document.getElementById(`post-card-${postId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Initialize and Update Main Leaflet Map
  useEffect(() => {
    if (viewMode === 'list' || !mainMapContainerRef.current) {
      if (mainMapRef.current) {
        mainMapRef.current.remove();
        mainMapRef.current = null;
      }
      return;
    }

    // Create Map if it doesn't exist
    if (!mainMapRef.current) {
      // Iraq center
      const defaultCenter: [number, number] = [32.5000, 44.5000];
      const mapInstance = L.map(mainMapContainerRef.current, {
        center: defaultCenter,
        zoom: 7,
        zoomControl: true,
        attributionControl: false
      });

      // Add elegant dark theme tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(mapInstance);

      mainMapRef.current = mapInstance;
      mainMarkersGroupRef.current = L.featureGroup().addTo(mapInstance);
    }

    const markersGroup = mainMarkersGroupRef.current;
    if (!markersGroup || !mainMapRef.current) return;

    // Clear existing markers
    markersGroup.clearLayers();

    // Map each filtered post to a styled marker
    filteredPosts.forEach(post => {
      if (typeof post.lat !== 'number' || typeof post.lng !== 'number' || isNaN(post.lat) || isNaN(post.lng)) {
        return; // Guard against bad coordinates
      }
      const markerCoords: [number, number] = [post.lat, post.lng];
      const isSelected = post.id === selectedPostId;
      const marker = L.marker(markerCoords, {
        icon: createCustomMarkerIcon(post.placeType, isSelected)
      });

      // Custom HTML Popup Card inside Leaflet Map
      const popupHtml = `
        <div class="font-arabic text-right p-2 text-zinc-900 rounded-lg min-w-[200px]" dir="rtl">
          <div class="flex justify-between items-center mb-1">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              post.placeType === 'بيت' ? 'bg-blue-100 text-blue-800' : post.placeType === 'حسينية' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
            }">
              ${post.placeType}
            </span>
            <span class="text-[10px] font-bold text-orange-600">${post.governorate}</span>
          </div>
          <h4 class="font-bold text-xs text-zinc-800 mb-1">${post.city}</h4>
          <p class="text-[11px] text-zinc-600 line-clamp-2 mb-2 bg-zinc-50 p-1.5 rounded">${post.notes || 'لا توجد ملاحظات'}</p>
          <div class="flex items-center justify-between text-[10px] border-t pt-1.5">
            <span>السعة: <strong>${post.capacity} زائر</strong></span>
            <span class="text-orange-600 font-bold">هاتف: ${post.phone}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: false });
      
      marker.on('click', () => {
        handleSelectPostFromMap(post.id, markerCoords);
      });

      markersGroup.addLayer(marker);
    });

    // Auto-fit bounds if we have pins, otherwise reset to Iraq center
    if (filteredPosts.length > 0) {
      try {
        const bounds = markersGroup.getBounds();
        mainMapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      } catch (e) {}
    } else {
      mainMapRef.current.setView([32.5000, 44.5000], 7);
    }

    // Force resize check on Leaflet map
    setTimeout(() => {
      if (mainMapRef.current) mainMapRef.current.invalidateSize();
    }, 200);

    return () => {
      // Map is persistent until viewMode changes
    };
  }, [filteredPosts, viewMode, selectedPostId]);

  // Handle Mini-Map in the Modal
  useEffect(() => {
    if (!isModalOpen || !modalMapContainerRef.current) {
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
        modalMarkerRef.current = null;
      }
      return;
    }

    // Initialize Modal Mini-Map
    if (!modalMapRef.current) {
      const defaultCenter = formCoords;
      const miniMap = L.map(modalMapContainerRef.current, {
        center: defaultCenter,
        zoom: 11,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(miniMap);

      // Create a glowing Draggable marker to represent hosting address
      const customIcon = L.divIcon({
        className: 'modal-pin-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full bg-orange-500 opacity-40 animate-ping"></div>
            <div class="w-8 h-8 rounded-full bg-orange-500 border-2 border-white flex items-center justify-center shadow-lg text-white font-bold text-xs">
              📍
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const pinMarker = L.marker(defaultCenter, {
        draggable: true,
        icon: customIcon
      }).addTo(miniMap);

      // Update state coordinate when dragged
      pinMarker.on('dragend', () => {
        const latLng = pinMarker.getLatLng();
        setFormCoords([latLng.lat, latLng.lng]);
      });

      // Update state coordinate on map click
      miniMap.on('click', (e) => {
        pinMarker.setLatLng(e.latlng);
        setFormCoords([e.latlng.lat, e.latlng.lng]);
      });

      modalMapRef.current = miniMap;
      modalMarkerRef.current = pinMarker;
    }

    // Trigger size validation
    setTimeout(() => {
      if (modalMapRef.current) modalMapRef.current.invalidateSize();
    }, 250);

    return () => {
      // Cleaned up when modal closes
    };
  }, [isModalOpen]);

  // Zoom to specific post from the list card
  const handleFocusPost = (post: HostingPost) => {
    setSelectedPostId(post.id);
    if (mainMapRef.current) {
      mainMapRef.current.setView([post.lat, post.lng], 13, { animate: true, duration: 1 });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-32 font-arabic text-right" dir="rtl">
      
      {/* Header Banner */}
      <div className="text-center mb-8">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex p-3 bg-gradient-to-tr from-orange-500/10 to-amber-500/20 rounded-3xl text-orange-400 mb-3 shadow-inner"
        >
          <HeartHandshake size={44} />
        </motion.div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          مُضيف زوار الحسين (ع)
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          منصة تفاعلية مجهزة بخريطة لربط ومطابقة المستضيفين بالزوار الوافدين في مواسم الزيارات الدينية والزيارة الأربعينية المباركة.
        </p>
      </div>



      {/* Hero Banner Call To Action */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600/90 to-amber-600/90 rounded-[28px] p-6 sm:p-8 shadow-xl shadow-orange-500/10 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-1.5 text-right md:max-w-md">
          <h2 className="text-lg sm:text-xl font-bold text-white">هل ترغب بتسجيل مكان لاستضافة الزوار الكرام؟</h2>
          <p className="text-xs text-orange-100 leading-relaxed">
            اضغط لتحديد بيتك أو حسينيتك على خريطة العراق، وسجل السعة الاستيعابية ليتسنى للزوار التواصل معك والحجز بنقرة واحدة.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="w-full md:w-auto px-6 py-3 rounded-2xl bg-white hover:bg-zinc-100 text-orange-700 font-bold text-xs sm:text-sm shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>إدراج استضافة زوار</span>
        </button>

        {/* Decorative ambient blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-6 -mb-6 pointer-events-none" />
      </div>

      {/* Main Grid: Toggle Filters, Map, and Card list */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-white/5 pb-4">
        {/* Title and stats count */}
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <span>العروض النشطة</span>
            <span className="text-xs bg-white/10 text-zinc-400 px-2 py-0.5 rounded-lg font-mono">
              {filteredPosts.length}
            </span>
          </h3>
        </div>

        {/* Filters and View Toggles */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Governorate */}
          <select
            value={filterGovernorate}
            onChange={(e) => setFilterGovernorate(e.target.value)}
            className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 outline-none cursor-pointer"
          >
            <option value="all">كل المحافظات</option>
            {IRAQI_GOVERNORATES.map(gov => (
              <option key={gov} value={gov}>{gov}</option>
            ))}
          </select>

          {/* Place type */}
          <select
            value={filterPlaceType}
            onChange={(e) => setFilterPlaceType(e.target.value)}
            className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 outline-none cursor-pointer"
          >
            <option value="all">كل أنواع السكن</option>
            <option value="بيت">بيت</option>
            <option value="حسينية">حسينية</option>
            <option value="موكب">موكب</option>
          </select>

          {/* View Toggles (Responsive) */}
          <div className="bg-zinc-900/80 p-1 border border-white/5 rounded-xl flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'list' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="عرض القائمة فقط"
            >
              <List size={14} />
              <span className="hidden md:inline text-[10px]">قائمة</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'map' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="عرض الخريطة فقط"
            >
              <MapIcon size={14} />
              <span className="hidden md:inline text-[10px]">خريطة</span>
            </button>
            <button
              onClick={() => setViewMode('both')}
              className={`hidden md:flex p-1.5 rounded-lg text-xs font-bold items-center gap-1 transition-all cursor-pointer ${
                viewMode === 'both' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="عرض مشترك"
            >
              <Eye size={14} />
              <span className="text-[10px]">الكل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className={`grid gap-6 ${viewMode === 'both' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        
        {/* Left Side: Hosting list cards (occupied in 'both' and 'list' modes) */}
        {(viewMode === 'both' || viewMode === 'list') && (
          <div className={`space-y-4 ${viewMode === 'both' ? 'lg:col-span-5 max-h-[70vh] overflow-y-auto pr-1' : ''}`}>
            <AnimatePresence mode="popLayout">
              {filteredPosts.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-zinc-900/40 border border-white/5 rounded-3xl p-10 text-center text-zinc-500 flex flex-col items-center justify-center gap-3"
                >
                  <AlertCircle size={32} className="text-zinc-600" />
                  <p className="text-xs sm:text-sm">لم يتم العثور على أماكن تطابق تفضيلاتك.</p>
                  {(filterGovernorate !== 'all' || filterPlaceType !== 'all') && (
                    <button 
                      onClick={() => { setFilterGovernorate('all'); setFilterPlaceType('all'); }}
                      className="text-xs text-orange-400 font-bold hover:underline"
                    >
                      عرض جميع العروض
                    </button>
                  )}
                </motion.div>
              ) : (
                filteredPosts.map((post) => {
                  const isPublisher = post.publisherId === authUserId || post.publisherId === 'anonymous' || !post.publisherId;
                  const isBookedByMe = post.bookings.includes(authUserId);
                  const isSelected = post.id === selectedPostId;

                  return (
                    <motion.div
                      key={post.id}
                      id={`post-card-${post.id}`}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => handleFocusPost(post)}
                      className={`relative bg-zinc-900/60 border rounded-3xl p-4 flex flex-col justify-between shadow-md hover:bg-zinc-900/90 transition-all cursor-pointer ${
                        isSelected ? 'border-orange-500/80 ring-1 ring-orange-500/20' : 'border-white/5'
                      }`}
                    >
                      {/* Inline Confirmation Overlay (Iframe Safe) */}
                      {deletingPostId === post.id && (
                        <div className="absolute inset-0 bg-zinc-950/95 rounded-3xl z-20 flex flex-col items-center justify-center p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <AlertCircle className="text-red-500 mb-2 animate-bounce" size={28} />
                          <h4 className="text-sm font-bold text-white mb-1">هل أنت متأكد من حذف هذا الإعلان؟</h4>
                          <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed">لا يمكن التراجع عن هذا الإجراء وسيتم حذفه من قاعدة البيانات السحابية فوراً.</p>
                          <div className="flex gap-3 justify-center w-full">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleDeletePostConfirm(post.id);
                              }}
                              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                            >
                              نعم، احذف
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingPostId(null);
                              }}
                              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                        {/* Row 1: Badges */}
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            post.placeType === 'بيت' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                              : post.placeType === 'حسينية'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                          }`}>
                            {post.placeType === 'بيت' ? 'بيت' : post.placeType === 'حسينية' ? 'حسينية' : 'موكب'}
                          </span>

                          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                            <MapPin size={11} className="text-orange-500 shrink-0" />
                            <span className="font-bold text-zinc-300">{post.governorate}</span>
                            <span className="text-zinc-600">|</span>
                            <span className="truncate max-w-[120px]">{post.city}</span>
                          </div>
                        </div>

                        {/* Row 2: Note description */}
                        <p className="text-xs text-zinc-300 leading-relaxed bg-black/30 rounded-2xl p-3 min-h-[50px] border border-white/5">
                          {post.notes || 'لا توجد شروط أو ملاحظات إضافية.'}
                        </p>

                        {/* Row 3: Meta details */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 border-t border-white/5 pt-2.5">
                          <div className="flex items-center gap-1">
                            <Users size={11} className="text-zinc-500" />
                            <span>السعة: <strong className="text-zinc-300 font-bold">{post.capacity} زائر</strong></span>
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <Calendar size={11} className="text-zinc-500" />
                            <span>مستضاف منذ: <strong className="text-zinc-400">{new Date(post.createdAt).toLocaleDateString('ar-IQ')}</strong></span>
                          </div>
                        </div>

                        {/* Row 4: Publisher Name details */}
                        <div className="text-[10px] text-zinc-400 bg-white/5 rounded-xl px-2 py-1 flex items-center justify-between">
                          <span className="truncate">الناشر: {post.publisherName}</span>
                          {isPublisher ? (
                            <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded-full">إعلانك</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (mainMapRef.current) {
                                  mainMapRef.current.setView([post.lat, post.lng], 13);
                                }
                                setViewMode('both');
                              }}
                              className="text-[9px] text-orange-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>تحديد في الخريطة</span>
                              <MapIcon size={9} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Row 5: Actions Area (Phones, Buttons) */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex gap-2 items-center justify-between" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <a 
                            href={`tel:${post.phone}`} 
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-orange-400 hover:text-orange-300 transition-colors flex items-center justify-center cursor-pointer"
                            title="اتصال مباشر"
                          >
                            <Phone size={14} />
                          </a>
                          <span className="text-xs font-mono text-zinc-400" dir="ltr">{post.phone}</span>
                        </div>

                        {/* Interactive Publisher vs Visitor Actions */}
                        {isPublisher ? (
                          <div className="flex items-center gap-2">
                            <div className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold text-xs flex items-center gap-1 shadow-inner">
                              <UsersRound size={12} />
                              <span>الحاجزين: {post.bookings.length}</span>
                            </div>
                            <button
                              onClick={() => handleStartEdit(post)}
                              className="p-1.5 rounded-xl hover:bg-orange-500/10 text-zinc-500 hover:text-orange-400 transition-all cursor-pointer"
                              title="تعديل الإعلان"
                            >
                              <Edit size={14} />
                            </button>
                             <button
                               onClick={() => setDeletingPostId(post.id)}
                               className="p-1.5 rounded-xl hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                               title="حذف الإعلان نهائياً"
                             >
                               <Trash2 size={14} />
                             </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleBookingToggle(post.id)}
                            className={`px-3 py-2 rounded-xl font-bold text-xs transition-all duration-300 flex items-center gap-1 shadow-md cursor-pointer ${
                              isBookedByMe 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-orange-500 hover:bg-orange-600 text-white'
                            }`}
                          >
                            {isBookedByMe ? (
                              <>
                                <Check size={12} strokeWidth={2.5} />
                                <span>تم الحجز بنجاح</span>
                              </>
                            ) : (
                              <>
                                <HeartHandshake size={12} />
                                <span>حجز مكان</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Right Side: Interactive Map (occupied in 'both' and 'map' modes) */}
        {(viewMode === 'both' || viewMode === 'map') && (
          <div className={`${viewMode === 'both' ? 'lg:col-span-7 h-[400px] lg:h-[70vh]' : 'h-[60vh]'} relative rounded-3xl border border-white/5 overflow-hidden bg-zinc-950 flex flex-col`}>
            {/* Map title floating bar */}
            <div className="absolute top-3 right-3 left-3 z-[999] bg-zinc-900/90 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 flex items-center justify-between shadow-lg pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold text-zinc-200">الخريطة التفاعلية للاستضافات</span>
              </div>
              <span className="text-[10px] text-zinc-400">انقر على أي علم أو رمز لاستعراض السكن</span>
            </div>

            {/* Map Container Element */}
            <div 
              ref={mainMapContainerRef} 
              className="w-full h-full min-h-[300px] z-[1] outline-none" 
            />

            {/* No-posts Warning inside Map */}
            {filteredPosts.length === 0 && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10] text-center p-6">
                <div className="bg-zinc-900/95 border border-white/10 p-5 rounded-2xl max-w-xs space-y-2">
                  <AlertCircle className="text-orange-500 mx-auto" size={24} />
                  <h4 className="text-sm font-bold text-white">لا توجد أماكن على الخريطة</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">يرجى تعديل خيارات الفلترة لعرض أماكن الاستضافة المتاحة.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hosting Request Dialog Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xs z-10 cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-xl bg-zinc-900 border border-white/10 rounded-[28px] overflow-visible shadow-2xl z-20 flex flex-col max-h-[92vh] text-right pointer-events-auto"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-gradient-to-l from-orange-500/10 to-transparent relative z-10">
                <div className="flex items-center gap-2 text-orange-400">
                  <Building size={18} />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {editingPost ? 'تعديل بيانات الاستضافة' : 'تسجيل استضافة زائرين'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handlePublish} className="p-5 overflow-y-auto space-y-4 flex-1 rounded-b-[28px] relative z-10">
                {/* Host Name Input */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-zinc-400">اسم صاحب المضيف / الجهة المستضيفة *</label>
                  <input
                    type="text"
                    required
                    value={hostNameInput}
                    onChange={(e) => setHostNameInput(e.target.value)}
                    placeholder="مثال: الحاج أبو علي أو موكب أنصار الحسين"
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Governorate Dropdown */}
                  <div className="space-y-1.5 text-right relative z-30">
                    <label className="text-xs font-bold text-zinc-400">المحافظة *</label>
                    <select
                      value={selectedGovernorate}
                      onChange={(e) => setSelectedGovernorate(e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-white focus:border-orange-500 outline-none cursor-pointer relative z-30 pointer-events-auto"
                    >
                      {IRAQI_GOVERNORATES.map(gov => (
                        <option key={gov} value={gov} className="bg-zinc-800 text-white">{gov}</option>
                      ))}
                    </select>
                  </div>

                  {/* Place Type Dropdown */}
                  <div className="space-y-1.5 text-right relative z-30">
                    <label className="text-xs font-bold text-zinc-400">نوع مكان الاستضافة *</label>
                    <select
                      value={placeType}
                      onChange={(e) => setPlaceType(e.target.value as any)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-xl px-2.5 py-2 text-xs sm:text-sm text-white focus:border-orange-500 outline-none cursor-pointer relative z-30 pointer-events-auto"
                    >
                      {PLACE_TYPES.map(type => (
                        <option key={type.value} value={type.value} className="bg-zinc-800 text-white">{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* City Input */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-zinc-400">المدينة / القضاء أو الحي *</label>
                  <input
                    type="text"
                    required
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    placeholder="مثال: قضاء الهندية، حي الحسين، قرب مدرسة النور"
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none"
                  />
                </div>

                {/* Interactive Mini-Map for precise location pinning */}
                <div className="space-y-1.5 text-right">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-zinc-400 flex items-center gap-1">
                      <MapIcon size={12} className="text-orange-500" />
                      <span>تحديد العنوان الجغرافي على الخريطة *</span>
                    </label>
                    <span className="text-[10px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                      اسحب الدبوس البرتقالي بدقة
                    </span>
                  </div>
                  
                  {/* Leaflet Mini Map Container */}
                  <div className="relative w-full h-[150px] rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
                    <div 
                      ref={modalMapContainerRef} 
                      className="w-full h-full z-[1]" 
                    />
                    <div className="absolute bottom-2 right-2 z-[99] bg-zinc-900/90 text-[10px] text-zinc-300 px-2 py-1 rounded-lg border border-white/10">
                      إحداثياتك: {formCoords[0].toFixed(4)}, {formCoords[1].toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Capacity */}
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-zinc-400">السعة الاستيعابية (عدد الزوار) *</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      required
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:border-orange-500 outline-none"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-zinc-400">رقم الهاتف للتواصل *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="077XXXXXXXX"
                      className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white text-left placeholder-zinc-500 focus:border-orange-500 outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Notes Textarea */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-zinc-400">ملاحظات وشروط الاستضافة</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="اكتب هنا أي تفاصيل أخرى مثل توافر الطعام، التبريد، استقبال العوائل أو الرجال فقط، إلخ..."
                    className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:border-orange-500 outline-none resize-none"
                  />
                </div>

                {/* Actions Button */}
                <div className="pt-3 border-t border-white/5 flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-orange-500/10 transition-all cursor-pointer text-center"
                  >
                    {editingPost ? 'حفظ التعديلات' : 'نشر الإعلان وموقعه'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Zowar;
