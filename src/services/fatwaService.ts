import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp,
  doc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db, auth, isFirebaseEnabled } from './firebase';

const TELEGRAM_BOT_TOKEN = '8673039648:AAFd0npkMDfggj9voisJQxWdDlhdbKiGIww';
const TELEGRAM_CHAT_ID = '-1001716344540';

export interface FatwaQuestion {
  id?: string;
  userId: string;
  question: string;
  answer: string;
  status: 'pending' | 'answered';
  timestamp: Timestamp | any;
  telegramMessageId: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const fatwaService = {
  async submitQuestion(question: string, userId: string = 'anonymous') {
    try {
      if (!db) throw new Error('Database is not initialized');
      
      // استخدام بروكسي CodeTabs القوي لتخطي حظر المتصفحات
      const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(question)}`;
      const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(tgUrl)}`;
      
      const tgRes = await fetch(proxyUrl);
      const tgData = await tgRes.json();
      
      let msgId = tgData.ok ? tgData.result.message_id : null;

      await addDoc(collection(db, 'fatwa_questions'), {
        userId: userId,
        text: question,
        question: question,
        status: 'pending',
        telegramMessageId: msgId,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      
      return true;
    } catch (error: any) {
      console.error("Submit Error:", error);
      return false;
    }
  },

  async getUserQuestions(): Promise<FatwaQuestion[]> {
    if (!isFirebaseEnabled() || !db) {
      console.warn('Firebase disabled or DB not initialized');
      return [];
    }

    const path = 'fatwa_questions';
    const currentUser = auth?.currentUser;

    try {
      // Query questions corresponding to user's UID or 'anonymous' for guest session
      const q = query(
        collection(db, path),
        where('userId', '==', currentUser?.uid || 'anonymous')
      );
      const snapshot = await getDocs(q);
      const questionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FatwaQuestion[];

      // Sort locally by timestamp or createdAt descending
      questionsList.sort((a, b) => {
        const timeA = a.timestamp?.toDate 
          ? a.timestamp.toDate().getTime() 
          : new Date(a.timestamp || (a as any).createdAt || 0).getTime();
        const timeB = b.timestamp?.toDate 
          ? b.timestamp.toDate().getTime() 
          : new Date(b.timestamp || (b as any).createdAt || 0).getTime();
        return timeB - timeA;
      });

      return questionsList;
    } catch (error: any) {
      console.error("Error in getUserQuestions:", error);
      handleFirestoreError(error, OperationType.LIST, path, auth);
      return [];
    }
  },

  async subscribeToUserQuestions(callback: (questions: FatwaQuestion[]) => void, onError?: (error: any) => void) {
    if (!isFirebaseEnabled() || !db || !auth?.currentUser) {
      console.warn('Firebase disabled or user not logged in - subscription failed');
      return () => {};
    }

    const path = 'fatwa_questions';
    const currentUser = auth.currentUser;
    if (!currentUser) return () => {};

    const q = query(
      collection(db, path),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const questions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FatwaQuestion[];
      callback(questions);
    }, (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path, auth);
    });
  }
};
