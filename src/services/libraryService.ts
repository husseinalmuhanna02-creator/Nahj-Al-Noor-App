import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, auth } from './firebase';
import { LibraryItem, Supplication } from '../types';

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

export const fetchBooksFromFirebase = async (): Promise<LibraryItem[]> => {
  if (!db) return [];

  const path = 'books';
  try {
    const booksCol = collection(db, path);
    const q = query(booksCol, orderBy('title', 'asc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'بدون عنوان',
        author: data.author || 'مجهول',
        url: data.pdfUrl || '',
        category: 'كتب',
        subItems: [] // Dynamic books are assumed simple for now
      } as LibraryItem;
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

