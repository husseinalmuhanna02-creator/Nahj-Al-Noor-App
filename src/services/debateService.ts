import { 
  ref, 
  set, 
  get, 
  update, 
  onValue, 
  onChildAdded,
  remove, 
  push,
  serverTimestamp,
  type Unsubscribe 
} from 'firebase/database';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  addDoc, 
  query, 
  where,
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, rtdb, isFirebaseEnabled } from './firebase';
import type { 
  DebateRoomData, 
  DebaterProfile, 
  SharedDebateImage, 
  DebateRole, 
  DebateMessage, 
  DebateCategory, 
  LiveReactionPayload,
  DebaterLeaderboardEntry,
  LeaderboardTimeframe
} from '../types';

// Fallback in-memory and localStorage cache for robust local preview and resilience
const LOCAL_STORAGE_ROOMS_KEY = 'nahj_debate_rooms_cache';

// Default Mock Rooms is empty by default - absolutely no mock/default rooms
export const DEFAULT_MOCK_ROOMS: DebateRoomData[] = [];

/**
 * Checks if a room is an artificial/mock/demo room that should be removed
 */
export function isDemoOrMockRoom(room: Partial<DebateRoomData> | null | undefined): boolean {
  if (!room) return false;
  const id = room.id || '';
  const title = room.title || '';
  const topic = room.topic || '';
  const debaterAUid = room.debaterA?.uid || '';
  const debaterBUid = room.debaterB?.uid || '';

  if (
    id.startsWith('room_demo') ||
    id.includes('demo') ||
    id === 'room_demo_aqeedah' ||
    id === 'room_demo_fiqh' ||
    id === 'room_demo_history' ||
    id === 'room_demo_quran' ||
    id.startsWith('mock_') ||
    id.includes('default') ||
    id.includes('test')
  ) {
    return true;
  }

  if (
    debaterAUid.startsWith('debater_') ||
    debaterBUid.startsWith('debater_') ||
    debaterAUid === 'debater_1' ||
    debaterAUid === 'debater_2' ||
    debaterAUid === 'debater_3' ||
    debaterAUid === 'debater_4' ||
    debaterAUid === 'debater_5' ||
    debaterAUid === 'debater_6'
  ) {
    return true;
  }

  if (
    title.includes('حوار في المنهج المعرفي') ||
    title.includes('مناظرة أصولية') ||
    title.includes('تحقيق تاريخي في مسار') ||
    title.includes('قواعد التفسير الموضوعي') ||
    title.includes('غرفة افتراضية') ||
    title.includes('الخلافة') ||
    topic.includes('أهمية التوثيق المنهجي') ||
    topic.includes('دراسة فقهية مقارنة بين مدرسة') ||
    topic.includes('الخلافة')
  ) {
    return true;
  }

  return false;
}

/**
 * Purge all mock, demo, and legacy default rooms from local cache and Firebase
 */
export async function purgeAllDefaultAndMockRooms(): Promise<void> {
  try {
    // Clear local cache completely to remove any stale mock rooms
    localStorage.removeItem(LOCAL_STORAGE_ROOMS_KEY);
  } catch (e) {
    console.warn('Failed to clean local rooms cache:', e);
  }

  if (isFirebaseEnabled()) {
    try {
      const snap = await get(ref(rtdb, 'debate_rooms'));
      if (snap.exists()) {
        const val = snap.val();
        const promises: Promise<any>[] = [];
        Object.keys(val).forEach((key) => {
          const item = val[key];
          if (isDemoOrMockRoom(item) || key.startsWith('room_demo_') || item?.status === 'ended') {
            promises.push(remove(ref(rtdb, `debate_rooms/${key}`)));
            promises.push(deleteDoc(doc(db, 'debate_rooms', key)));
          }
        });
        await Promise.allSettled(promises);
      }
    } catch (e) {
      console.warn('Failed to purge mock rooms from Firebase:', e);
    }
  }
}

// Automatically trigger purge of default mock rooms on initial script load
purgeAllDefaultAndMockRooms().catch(() => {});

export const getLocalRooms = (): Record<string, DebateRoomData> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ROOMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Clean out any legacy mock demo rooms, ended rooms, or expired rooms
        const filtered: Record<string, DebateRoomData> = {};
        let hadGarbage = false;
        const now = Date.now();
        Object.entries(parsed).forEach(([key, val]) => {
          const roomObj = val as DebateRoomData;
          const isExpired = roomObj?.startedAt && (now - roomObj.startedAt > ((roomObj.totalDurationSeconds || 3600) * 1000 + 60000));
          if (
            key.startsWith('room_demo_') || 
            isDemoOrMockRoom(roomObj) || 
            roomObj?.status === 'ended' ||
            isExpired
          ) {
            hadGarbage = true;
          } else if (roomObj && typeof roomObj === 'object' && roomObj.id) {
            filtered[key] = roomObj;
          }
        });
        if (hadGarbage || Object.keys(filtered).length !== Object.keys(parsed).length) {
          localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(filtered));
        }
        return filtered;
      }
    }
  } catch {
    // ignore
  }

  return {};
};

export const removeLocalRoom = (roomId: string) => {
  try {
    const rooms = getLocalRooms();
    if (rooms[roomId]) {
      delete rooms[roomId];
      localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    }
  } catch (e) {
    console.warn('Failed to remove local room', e);
  }
};

export const saveLocalRoom = (room: DebateRoomData) => {
  if (!room || room.status === 'ended') {
    if (room?.id) {
      removeLocalRoom(room.id);
    }
    return;
  }
  try {
    const rooms = getLocalRooms();
    rooms[room.id] = room;
    localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(rooms));
  } catch (e) {
    console.warn('Failed to cache local room', e);
  }
};

/**
 * Creates a helper to race promises against a 1-second timeout
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 1000, fallbackValue: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallbackValue);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    return fallbackValue;
  }
}

/**
 * Creates a new turn-based debate room
 */
export async function createDebateRoom(params: {
  title: string;
  topic?: string;
  category?: DebateCategory;
  creatorName: string;
  creatorUid: string;
  creatorAvatar?: string;
  asDebater?: boolean;
}): Promise<DebateRoomData> {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  const debaterA: DebaterProfile | null = params.asDebater !== false ? {
    uid: params.creatorUid,
    name: params.creatorName || 'المناظر الأول',
    avatar: params.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    role: 'debaterA',
    joinedAt: now
  } : null;

  const newRoom: DebateRoomData = {
    id: roomId,
    title: params.title || 'مناظرة فكرية وعلمية',
    topic: params.topic || 'حوار منهجي هادئ وبناء',
    category: params.category || 'general',
    status: 'waiting',
    createdAt: now,
    totalDurationSeconds: 3600, // 60 minutes
    turnDurationSeconds: 180,   // 3 minutes
    currentTurn: 'debaterA',
    turnStartTime: now,
    roundNumber: 1,
    debaterA,
    debaterB: null,
    currentSharedImage: null,
    listenersCount: params.asDebater !== false ? 0 : 1,
    streamCallId: roomId
  };

  // 1. Immediately save locally to guarantee 0-latency feedback
  saveLocalRoom(newRoom);

  // 2. Try Firebase with strict timeout guard so it never hangs or blocks the UI
  if (isFirebaseEnabled()) {
    try {
      const syncPromise = (async () => {
        try {
          const roomRef = ref(rtdb, `debate_rooms/${roomId}`);
          await set(roomRef, newRoom);
        } catch (e) {
          console.warn('[DebateService] RTDB write error:', e);
        }
        try {
          const docRef = doc(db, 'debate_rooms', roomId);
          await setDoc(docRef, newRoom);
        } catch (e) {
          console.warn('[DebateService] Firestore write error:', e);
        }
      })();

      // Max 1000ms network wait
      await withTimeout(syncPromise, 1000, null);
    } catch (err) {
      console.warn('[DebateService] Network sync timed out or failed, using local room:', err);
    }
  }

  return newRoom;
}

/**
 * Join an existing debate room
 */
export async function joinDebateRoom(
  roomId: string,
  user: { uid: string; name: string; avatar?: string },
  desiredRole: DebateRole
): Promise<{ success: boolean; role: DebateRole; room: DebateRoomData | null; message?: string }> {
  let room: DebateRoomData | null = null;

  // Read current room state with 1000ms timeout
  if (isFirebaseEnabled()) {
    try {
      const readPromise = (async () => {
        try {
          const roomRef = ref(rtdb, `debate_rooms/${roomId}`);
          const snap = await get(roomRef);
          if (snap.exists()) {
            return snap.val() as DebateRoomData;
          }
        } catch (e) {
          console.warn('[DebateService] RTDB get failed:', e);
        }

        try {
          const docRef = doc(db, 'debate_rooms', roomId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            return snap.data() as DebateRoomData;
          }
        } catch (e) {
          console.warn('[DebateService] Firestore get failed:', e);
        }
        return null;
      })();

      room = await withTimeout(readPromise, 1000, null);
    } catch (e) {
      console.warn('[DebateService] Network get room timeout:', e);
    }
  }

  if (!room) {
    room = getLocalRooms()[roomId] || null;
  }

  if (!room) {
    return { success: false, role: 'listener', room: null, message: 'الغرفة غير موجودة' };
  }

  if (room.status === 'ended') {
    return { success: false, role: 'listener', room, message: 'انتهت مدة هذه المناظرة وتم إغلاق الغرفة' };
  }

  let finalRole: DebateRole = desiredRole;
  const updates: Partial<DebateRoomData> = {};

  if (desiredRole === 'debaterA') {
    if (!room.debaterA || room.debaterA.uid === user.uid) {
      updates.debaterA = {
        uid: user.uid,
        name: user.name,
        avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        role: 'debaterA',
        joinedAt: Date.now()
      };
      finalRole = 'debaterA';
    } else {
      // Slot A taken, fallback to listener or Debater B if free
      if (!room.debaterB) {
        finalRole = 'debaterB';
        updates.debaterB = {
          uid: user.uid,
          name: user.name,
          avatar: user.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
          role: 'debaterB',
          joinedAt: Date.now()
        };
      } else {
        finalRole = 'listener';
        updates.listenersCount = (room.listenersCount || 0) + 1;
      }
    }
  } else if (desiredRole === 'debaterB') {
    if (!room.debaterB || room.debaterB.uid === user.uid) {
      updates.debaterB = {
        uid: user.uid,
        name: user.name,
        avatar: user.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        role: 'debaterB',
        joinedAt: Date.now()
      };
      finalRole = 'debaterB';
    } else {
      finalRole = 'listener';
      updates.listenersCount = (room.listenersCount || 0) + 1;
    }
  } else {
    finalRole = 'listener';
    const currentListeners = room.listeners || [];
    const exists = currentListeners.some(l => l.uid === user.uid);
    const updatedListeners = exists
      ? currentListeners
      : [
          ...currentListeners,
          {
            uid: user.uid,
            name: user.name || 'مستمع',
            avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
            joinedAt: Date.now()
          }
        ];
    updates.listeners = updatedListeners;
    updates.listenersCount = updatedListeners.length;
  }

  // If both debaters are now present and status was waiting, activate debate!
  const hasA = !!(updates.debaterA || room.debaterA);
  const hasB = !!(updates.debaterB || room.debaterB);
  if (hasA && hasB && room.status === 'waiting') {
    updates.status = 'active';
    updates.startedAt = Date.now();
    updates.turnStartTime = Date.now();
    updates.currentTurn = 'debaterA';
    updates.roundNumber = 1;
  }

  const updatedRoom: DebateRoomData = { ...room, ...updates };
  saveLocalRoom(updatedRoom);

  // Sync updates
  if (isFirebaseEnabled()) {
    try {
      const roomRef = ref(rtdb, `debate_rooms/${roomId}`);
      await update(roomRef, updates);
    } catch (e) {
      console.warn('[DebateService] RTDB update error:', e);
    }

    try {
      const docRef = doc(db, 'debate_rooms', roomId);
      await updateDoc(docRef, updates);
    } catch (e) {
      console.warn('[DebateService] Firestore update error:', e);
    }
  }

  return { success: true, role: finalRole, room: updatedRoom };
}

/**
 * Start or unpause the debate
 */
export async function startDebateSession(roomId: string): Promise<void> {
  const now = Date.now();
  const updates: Partial<DebateRoomData> = {
    status: 'active',
    startedAt: now,
    turnStartTime: now,
    currentTurn: 'debaterA',
    roundNumber: 1
  };

  await updateRoomData(roomId, updates);
}

/**
 * Switch turn to the other debater strictly after 3 minutes (180s) or manual pass
 */
export async function switchDebateTurn(roomId: string, currentTurn: 'debaterA' | 'debaterB', roundNumber: number): Promise<void> {
  const nextTurn: 'debaterA' | 'debaterB' = currentTurn === 'debaterA' ? 'debaterB' : 'debaterA';
  const now = Date.now();
  
  const updates: Partial<DebateRoomData> = {
    currentTurn: nextTurn,
    turnStartTime: now,
    roundNumber: currentTurn === 'debaterB' ? roundNumber + 1 : roundNumber
  };

  await updateRoomData(roomId, updates);
}

/**
 * Share an image from gallery to the entire debate arena
 */
export async function shareDebateImage(
  roomId: string, 
  imageData: { url: string; caption?: string; sharedBy: string; sharedByRole: 'debaterA' | 'debaterB' }
): Promise<void> {
  const sharedImage: SharedDebateImage = {
    id: `img_${Date.now()}`,
    url: imageData.url,
    caption: imageData.caption || '',
    sharedBy: imageData.sharedBy,
    sharedByRole: imageData.sharedByRole,
    timestamp: Date.now()
  };

  await updateRoomData(roomId, { currentSharedImage: sharedImage });
}

/**
 * Remove current shared image
 */
export async function removeSharedDebateImage(roomId: string): Promise<void> {
  await updateRoomData(roomId, { currentSharedImage: null });
}

/**
 * Permanently delete and purge a debate room so it completely disappears from all listings & databases
 */
export async function deleteDebateRoom(roomId: string): Promise<void> {
  if (!roomId) return;

  // 1. Remove from local cache immediately
  removeLocalRoom(roomId);

  // 2. Remove from Firebase RTDB and Firestore
  if (isFirebaseEnabled()) {
    try {
      const rtdbPromise = remove(ref(rtdb, `debate_rooms/${roomId}`));
      const firestorePromise = deleteDoc(doc(db, 'debate_rooms', roomId));
      await withTimeout(Promise.allSettled([rtdbPromise, firestorePromise]), 1200, null);
    } catch (e) {
      console.warn('[DebateService] Failed to permanently delete room from Firebase:', e);
    }
  }
}

/**
 * End debate and permanently delete & purge the room so it completely disappears
 */
export async function endDebateRoom(roomId: string): Promise<void> {
  if (!roomId) return;

  // 1. Mark as ended in local storage to prevent any local rendering
  removeLocalRoom(roomId);

  // 2. Update status to 'ended' so any active listeners know it closed
  try {
    await updateRoomData(roomId, { status: 'ended' });
  } catch (e) {
    console.warn('[DebateService] Update room to ended notice warning:', e);
  }

  // 3. Permanently purge from RTDB and Firestore
  if (isFirebaseEnabled()) {
    try {
      const rtdbPromise = remove(ref(rtdb, `debate_rooms/${roomId}`));
      const firestorePromise = deleteDoc(doc(db, 'debate_rooms', roomId));
      await withTimeout(Promise.allSettled([rtdbPromise, firestorePromise]), 1200, null);
    } catch (e) {
      console.warn('[DebateService] Failed to permanently purge ended room:', e);
    }
  }
}

/**
 * Leave room / decrease listener count
 */
export async function leaveDebateRoom(roomId: string, role: DebateRole, userId: string): Promise<void> {
  if (role === 'listener') {
    const room = getLocalRooms()[roomId];
    if (room) {
      const listenersCount = Math.max(0, (room.listenersCount || 1) - 1);
      await updateRoomData(roomId, { listenersCount });
    }
  } else if (role === 'debaterA') {
    await updateRoomData(roomId, { debaterA: null });
  } else if (role === 'debaterB') {
    await updateRoomData(roomId, { debaterB: null });
  }
}

/**
 * Helper to push updates to RTDB, Firestore, and localStorage
 */
async function updateRoomData(roomId: string, updates: Partial<DebateRoomData>): Promise<void> {
  if (updates.status === 'ended') {
    removeLocalRoom(roomId);
  } else {
    const local = getLocalRooms()[roomId];
    if (local) {
      saveLocalRoom({ ...local, ...updates });
    }
  }

  if (isFirebaseEnabled()) {
    try {
      const roomRef = ref(rtdb, `debate_rooms/${roomId}`);
      await withTimeout(update(roomRef, updates), 1000, null);
    } catch (e) {
      console.warn('[DebateService] RTDB update error:', e);
    }

    try {
      const docRef = doc(db, 'debate_rooms', roomId);
      await withTimeout(updateDoc(docRef, updates), 1000, null);
    } catch (e) {
      console.warn('[DebateService] Firestore update error:', e);
    }
  }
}

/**
 * Real-time subscription to room state
 */
export function subscribeToDebateRoom(
  roomId: string, 
  callback: (room: DebateRoomData | null) => void
): () => void {
  let unsubRTDB: Unsubscribe | null = null;
  let unsubFirestore: (() => void) | null = null;

  // Provide initial local state immediately
  const initialLocal = getLocalRooms()[roomId] || null;
  if (initialLocal && initialLocal.status !== 'ended') {
    callback(initialLocal);
  }

  if (isFirebaseEnabled()) {
    try {
      const roomRef = ref(rtdb, `debate_rooms/${roomId}`);
      unsubRTDB = onValue(roomRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() as DebateRoomData;
          if (data.status === 'ended') {
            removeLocalRoom(roomId);
            callback(null);
          } else {
            saveLocalRoom(data);
            callback(data);
          }
        } else {
          // If not found in RTDB, check if locally cached or removed
          const local = getLocalRooms()[roomId] || null;
          if (!local || local.status === 'ended') {
            callback(null);
          } else {
            callback(local);
          }
        }
      }, (error) => {
        console.warn('[DebateService] RTDB listen error, trying Firestore:', error);
      });
    } catch (e) {
      console.warn('[DebateService] RTDB setup error:', e);
    }

    try {
      const docRef = doc(db, 'debate_rooms', roomId);
      unsubFirestore = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as DebateRoomData;
          if (data.status === 'ended') {
            removeLocalRoom(roomId);
            callback(null);
          } else {
            saveLocalRoom(data);
            callback(data);
          }
        }
      }, (err) => {
        console.warn('[DebateService] Firestore listener error:', err);
      });
    } catch (e) {
      console.warn('[DebateService] Firestore setup error:', e);
    }
  }

  // Polling fallback to ensure ultra-smooth timer ticks & cross-tab local syncing
  const interval = setInterval(() => {
    const fresh = getLocalRooms()[roomId];
    if (fresh && fresh.status !== 'ended') {
      callback(fresh);
    }
  }, 1000);

  return () => {
    clearInterval(interval);
    if (unsubRTDB) unsubRTDB();
    if (unsubFirestore) unsubFirestore();
  };
}

/**
 * Fetch list of active public debate rooms (filters out and deletes ended ones)
 */
export async function getActiveDebateRooms(): Promise<DebateRoomData[]> {
  const result: DebateRoomData[] = [];
  const now = Date.now();

  // 1. Fetch from Firebase with strict 1000ms timeout
  if (isFirebaseEnabled()) {
    try {
      const fetchPromise = (async () => {
        const netRooms: DebateRoomData[] = [];
        try {
          const roomsRef = ref(rtdb, 'debate_rooms');
          const snap = await get(roomsRef);
          if (snap.exists()) {
            const val = snap.val();
            Object.keys(val).forEach((key) => {
              const item = val[key] as DebateRoomData;
              if (item) {
                const isExpired = item?.startedAt && (now - item.startedAt > ((item.totalDurationSeconds || 3600) * 1000 + 60000));
                if (isDemoOrMockRoom(item) || key.startsWith('room_demo_') || item.status === 'ended' || isExpired) {
                  // Asynchronously purge ended / legacy demo room from RTDB and Firestore
                  remove(ref(rtdb, `debate_rooms/${key}`)).catch(() => {});
                  deleteDoc(doc(db, 'debate_rooms', key)).catch(() => {});
                  removeLocalRoom(key);
                } else {
                  netRooms.push(item);
                }
              }
            });
          }
        } catch (e) {
          console.warn('[DebateService] Failed to load RTDB rooms:', e);
        }
        return netRooms;
      })();

      const netResult = await withTimeout(fetchPromise, 1000, []);
      if (netResult && netResult.length > 0) {
        netResult.forEach(r => {
          if (!isDemoOrMockRoom(r) && r.status !== 'ended') {
            result.push(r);
          }
        });
      }
    } catch (e) {
      console.warn('[DebateService] Network rooms fetch error:', e);
    }
  }

  // 2. Merge local rooms
  const local = getLocalRooms();
  Object.values(local).forEach(r => {
    const isExpired = r?.startedAt && (now - r.startedAt > ((r.totalDurationSeconds || 3600) * 1000 + 60000));
    if (r && r.status !== 'ended' && !isExpired && !isDemoOrMockRoom(r) && !result.some(existing => existing.id === r.id)) {
      result.push(r);
    } else if (r && (r.status === 'ended' || isExpired)) {
      removeLocalRoom(r.id);
    }
  });

  return result.filter(r => !isDemoOrMockRoom(r) && r.status !== 'ended');
}

/**
 * Real-time subscription to active rooms list so any ended room disappears immediately for all users
 */
export function subscribeToActiveRooms(
  callback: (rooms: DebateRoomData[]) => void
): () => void {
  let unsubRTDB: Unsubscribe | null = null;
  const now = Date.now();

  // 1. Initial callback with local active rooms
  const local = getLocalRooms();
  const initialLocal = Object.values(local).filter(r => {
    const isExpired = r?.startedAt && (now - r.startedAt > ((r.totalDurationSeconds || 3600) * 1000 + 60000));
    return r && r.status !== 'ended' && !isExpired && !isDemoOrMockRoom(r);
  });
  callback(initialLocal);

  // 2. Real-time Firebase listener
  if (isFirebaseEnabled()) {
    try {
      const roomsRef = ref(rtdb, 'debate_rooms');
      unsubRTDB = onValue(roomsRef, (snapshot) => {
        const rooms: DebateRoomData[] = [];
        const currentTime = Date.now();
        if (snapshot.exists()) {
          const val = snapshot.val();
          Object.keys(val).forEach((key) => {
            const item = val[key] as DebateRoomData;
            if (item) {
              const isExpired = item?.startedAt && (currentTime - item.startedAt > ((item.totalDurationSeconds || 3600) * 1000 + 60000));
              if (isDemoOrMockRoom(item) || key.startsWith('room_demo_') || item.status === 'ended' || isExpired) {
                // Purge immediately
                remove(ref(rtdb, `debate_rooms/${key}`)).catch(() => {});
                deleteDoc(doc(db, 'debate_rooms', key)).catch(() => {});
                removeLocalRoom(key);
              } else {
                rooms.push(item);
              }
            }
          });
        }

        // Merge valid non-ended local rooms
        const currentLocal = getLocalRooms();
        Object.values(currentLocal).forEach(r => {
          const isExpired = r?.startedAt && (currentTime - r.startedAt > ((r.totalDurationSeconds || 3600) * 1000 + 60000));
          if (r && r.status !== 'ended' && !isExpired && !isDemoOrMockRoom(r) && !rooms.some(existing => existing.id === r.id)) {
            rooms.push(r);
          }
        });

        callback(rooms.filter(r => !isDemoOrMockRoom(r) && r.status !== 'ended'));
      }, (err) => {
        console.warn('[DebateService] RTDB active rooms subscription warning:', err);
      });
    } catch (e) {
      console.warn('[DebateService] RTDB active rooms setup error:', e);
    }
  }

  // Polling fallback to keep all clients and tabs in sync
  const interval = setInterval(async () => {
    const active = await getActiveDebateRooms();
    callback(active);
  }, 4000);

  return () => {
    clearInterval(interval);
    if (unsubRTDB) unsubRTDB();
  };
}

/**
 * Broadcast a live reaction event to all users in the room
 */
export async function sendDebateLiveReaction(payload: LiveReactionPayload): Promise<void> {
  // Also record reaction to the debater's leaderboard stats
  if (payload.targetRole === 'debaterA' || payload.targetRole === 'debaterB') {
    recordDebaterReactionInLeaderboard({
      debaterUid: payload.targetRole === 'debaterA' ? `debA_${payload.roomId}` : `debB_${payload.roomId}`,
      debaterName: payload.targetDebaterName,
      emoji: payload.emoji,
      isNegative: payload.isNegative,
      roomId: payload.roomId,
      roomTitle: 'مناظرة حية',
      roomCategory: 'general'
    }).catch(() => {});
  }

  if (isFirebaseEnabled()) {
    try {
      const reactionRef = ref(rtdb, `debate_rooms/${payload.roomId}/recent_reactions/${payload.id}`);
      await withTimeout(set(reactionRef, payload), 800, null);
    } catch (e) {
      console.warn('[DebateService] RTDB reaction send error:', e);
    }
  }
}

/**
 * Real-time listener for live reaction events in a debate room
 */
export function subscribeToDebateLiveReactions(
  roomId: string,
  onReactionReceived: (reaction: LiveReactionPayload) => void
): () => void {
  if (!isFirebaseEnabled()) {
    return () => {};
  }
  try {
    const reactionsRef = ref(rtdb, `debate_rooms/${roomId}/recent_reactions`);
    const unsub = onChildAdded(reactionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() as LiveReactionPayload;
        // Only trigger if reaction is reasonably recent
        if (val && (!val.timestamp || Math.abs(Date.now() - val.timestamp) < 15000)) {
          onReactionReceived(val);
        }
      }
    });
    return unsub;
  } catch (e) {
    console.warn('[DebateService] RTDB reactions subscription error:', e);
    return () => {};
  }
}

// ==========================================
// Debater Leaderboard & Reaction Persistence
// ==========================================

const LOCAL_STORAGE_LEADERBOARD_KEY = 'nahj_debater_leaderboard_v1';

export const INITIAL_LEADERBOARD_ENTRIES: DebaterLeaderboardEntry[] = [];

/**
 * Get all debater entries stored locally or default
 */
export function getLeaderboardEntriesFromStorage(): DebaterLeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LEADERBOARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out any mock entries
        return parsed.filter((p: any) => p && !p.uid?.startsWith('debater_scholar_') && !p.uid?.includes('demo') && !p.uid?.includes('mock'));
      }
    }
  } catch (e) {
    console.warn('Error reading leaderboard storage:', e);
  }
  return [];
}

/**
 * Save debaters leaderboard entries to localStorage and optionally sync to Firebase
 */
export function saveLeaderboardEntries(entries: DebaterLeaderboardEntry[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_LEADERBOARD_KEY, JSON.stringify(entries));
    // Dispatch custom event for immediate UI updates in any open tab/component
    window.dispatchEvent(new CustomEvent('debater_leaderboard_updated', { detail: entries }));
  } catch (e) {
    console.warn('Error writing leaderboard storage:', e);
  }

  if (isFirebaseEnabled()) {
    try {
      const dbRef = ref(rtdb, 'debater_leaderboard_cache');
      set(dbRef, {
        updatedAt: Date.now(),
        entries: entries.slice(0, 30) // top 30
      }).catch(() => {});
    } catch {
      // Safe fallback
    }
  }
}

/**
 * Fetch debaters sorted by rank according to specified timeframe (daily, weekly, all)
 */
export async function getDebaterLeaderboard(
  timeframe: LeaderboardTimeframe = 'all',
  category?: DebateCategory
): Promise<DebaterLeaderboardEntry[]> {
  let entries = getLeaderboardEntriesFromStorage();

  // Try fetching fresh cloud stats with short timeout
  if (isFirebaseEnabled()) {
    try {
      const netPromise = (async () => {
        const dbRef = ref(rtdb, 'debater_leaderboard_cache');
        const snap = await get(dbRef);
        if (snap.exists()) {
          const val = snap.val();
          if (val && Array.isArray(val.entries) && val.entries.length > 0) {
            return val.entries as DebaterLeaderboardEntry[];
          }
        }
        return null;
      })();
      const netEntries = await withTimeout(netPromise, 800, null);
      if (netEntries && netEntries.length > 0) {
        entries = netEntries;
        try {
          localStorage.setItem(LOCAL_STORAGE_LEADERBOARD_KEY, JSON.stringify(netEntries));
        } catch {}
      }
    } catch (e) {
      console.warn('Network leaderboard fetch fallback:', e);
    }
  }

  // Filter by category if not 'all'
  let filtered = [...entries];
  if (category && category !== 'all') {
    filtered = filtered.filter(e => e.topCategory === category);
  }

  // Sort by positive reactions based on chosen timeframe
  filtered.sort((a, b) => {
    if (timeframe === 'daily') {
      const scoreA = a.dailyPositiveReactions ?? 0;
      const scoreB = b.dailyPositiveReactions ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.acceptanceRate || 0) - (a.acceptanceRate || 0);
    } else if (timeframe === 'weekly') {
      const scoreA = a.weeklyPositiveReactions ?? 0;
      const scoreB = b.weeklyPositiveReactions ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.acceptanceRate || 0) - (a.acceptanceRate || 0);
    } else {
      const scoreA = a.totalPositiveReactions ?? 0;
      const scoreB = b.totalPositiveReactions ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (b.acceptanceRate || 0) - (a.acceptanceRate || 0);
    }
  });

  return filtered;
}

/**
 * Record a positive or negative live reaction for a debater in the persistent leaderboard
 */
export async function recordDebaterReactionInLeaderboard(params: {
  debaterUid: string;
  debaterName: string;
  debaterAvatar?: string;
  emoji: string;
  isNegative: boolean;
  roomId: string;
  roomTitle: string;
  roomCategory?: DebateCategory;
}): Promise<void> {
  const { debaterUid, debaterName, debaterAvatar, emoji, isNegative, roomId, roomTitle, roomCategory } = params;
  if (!debaterName || debaterName === 'غير محدد') return;

  const entries = getLeaderboardEntriesFromStorage();
  let existingIndex = entries.findIndex(e => e.uid === debaterUid || e.name.trim() === debaterName.trim());

  let entry: DebaterLeaderboardEntry;

  if (existingIndex >= 0) {
    entry = { ...entries[existingIndex] };
  } else {
    // Create new debater entry
    entry = {
      uid: debaterUid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: debaterName,
      avatar: debaterAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
      totalPositiveReactions: 0,
      totalNegativeReactions: 0,
      totalReactions: 0,
      acceptanceRate: 100,
      debatesCount: 1,
      speakingTimeSeconds: 180,
      topCategory: roomCategory || 'general',
      badges: ['⭐ مناظر مميز'],
      recentDebateTitles: [roomTitle || 'مناظرة فكرية وعلمية'],
      lastActiveTimestamp: Date.now(),
      dailyPositiveReactions: 0,
      weeklyPositiveReactions: 0,
      dailyNegativeReactions: 0,
      weeklyNegativeReactions: 0,
      dailyDebatesCount: 1,
      weeklyDebatesCount: 1,
      breakdown: {
        strongArgument: 0,
        evidence: 0,
        solidDefense: 0,
        negativeCritique: 0
      },
      recentDebates: [
        {
          id: roomId,
          title: roomTitle || 'مناظرة فكرية وعلمية',
          category: roomCategory || 'general',
          timestamp: Date.now(),
          positiveEarned: 0,
          acceptanceRate: 100
        }
      ]
    };
  }

  // Update counts
  entry.lastActiveTimestamp = Date.now();
  if (debaterAvatar && (!entry.avatar || entry.avatar.includes('unsplash'))) {
    entry.avatar = debaterAvatar;
  }

  if (roomTitle && !entry.recentDebateTitles.includes(roomTitle)) {
    entry.recentDebateTitles = [roomTitle, ...entry.recentDebateTitles.slice(0, 4)];
  }

  if (!entry.breakdown) {
    entry.breakdown = { strongArgument: 0, evidence: 0, solidDefense: 0, negativeCritique: 0 };
  }

  if (!isNegative) {
    // Positive reaction
    entry.totalPositiveReactions = (entry.totalPositiveReactions || 0) + 1;
    entry.dailyPositiveReactions = (entry.dailyPositiveReactions || 0) + 1;
    entry.weeklyPositiveReactions = (entry.weeklyPositiveReactions || 0) + 1;

    if (emoji === '👏' || emoji === '👍') {
      entry.breakdown.strongArgument = (entry.breakdown.strongArgument || 0) + 1;
    } else if (emoji === '📜' || emoji === '💡') {
      entry.breakdown.evidence = (entry.breakdown.evidence || 0) + 1;
    } else if (emoji === '🌟' || emoji === '🛡️') {
      entry.breakdown.solidDefense = (entry.breakdown.solidDefense || 0) + 1;
    }
  } else {
    // Negative reaction
    entry.totalNegativeReactions = (entry.totalNegativeReactions || 0) + 1;
    entry.dailyNegativeReactions = (entry.dailyNegativeReactions || 0) + 1;
    entry.weeklyNegativeReactions = (entry.weeklyNegativeReactions || 0) + 1;
    entry.breakdown.negativeCritique = (entry.breakdown.negativeCritique || 0) + 1;
  }

  entry.totalReactions = (entry.totalPositiveReactions || 0) + (entry.totalNegativeReactions || 0);
  if (entry.totalReactions > 0) {
    entry.acceptanceRate = Math.round((entry.totalPositiveReactions / entry.totalReactions) * 100);
  }

  // Update dynamic badges based on achievements
  const currentBadges = new Set(entry.badges || []);
  if (entry.totalPositiveReactions >= 200) currentBadges.add('👑 فارس المنطق والكلام');
  if (entry.breakdown.evidence >= 80) currentBadges.add('📜 استدلال موثق');
  if (entry.breakdown.strongArgument >= 100) currentBadges.add('👏 حجة بالغة');
  if (entry.dailyPositiveReactions >= 50) currentBadges.add('🌟 متصدر اليوم');
  if (entry.weeklyPositiveReactions >= 150) currentBadges.add('⭐ بطل الأسبوع');
  entry.badges = Array.from(currentBadges).slice(0, 4);

  // Put back in list
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  saveLeaderboardEntries(entries);
}

// استماع لحظي لتحديثات الغرفة (المناظرين والمستمعين والحالة)
// استماع لحظي لتحديثات الغرفة (المناظرين والمستمعين والحالة) //
export const subscribeToRoom = (roomId: string, callback: (room: any) => void) => {
  // البحث بالحقل id بدلاً من معرف المستند المباشر
  const roomsRef = collection(db, 'debateRooms');
  const q = query(roomsRef, where('id', '==', roomId));

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      // محاولة احتياطية في حال كان المستند مخزناً بـ ID مباشر
      const docRef = doc(db, 'debateRooms', roomId);
      getDoc(docRef).then((docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() });
        } else {
          callback(null);
        }
      });
    }
  }, (error) => {
    console.error("خطأ في الاستماع للفايربيس:", error);
    callback(null);
  });
};

