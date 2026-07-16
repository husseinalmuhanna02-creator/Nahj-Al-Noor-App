import { collection, getDocs, query } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Supplication } from '../types';

enum OperationType {
  LIST = 'list',
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Fetches shubhat from the "shubhat" collection on Firestore.
 */
export const fetchShubuhatFromFirebase = async (): Promise<Supplication[]> => {
  if (!db) return [];

  const path = 'shubhat';
  try {
    const shubhatCol = collection(db, path);
    const q = query(shubhatCol);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      // Ensure we extract title and content, with graceful fallbacks
      return {
        id: doc.id,
        title: data.title || data.titleAr || data.name || 'بدون عنوان',
        content: data.content || data.contentAr || data.text || '',
        category: 'شبهات وردود',
        description: data.description || 'تم الجلب من قاعدة البيانات'
      } as Supplication;
    });
  } catch (error) {
    console.error('Error fetching shubhat:', error);
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};
