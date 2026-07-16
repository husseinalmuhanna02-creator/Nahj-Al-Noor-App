/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'IslamicAppAudioDB';
const STORE_NAME = 'audioStore';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export const saveAudio = async (id: string, blob: Blob) => {
  const db = await getDB();
  await db.put(STORE_NAME, blob, id);
};

export const getAudio = async (id: string): Promise<Blob | undefined> => {
  const db = await getDB();
  return db.get(STORE_NAME, id);
};

export const deleteAudio = async (id: string) => {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
};

export const isAudioDownloaded = async (id: string): Promise<boolean> => {
  const db = await getDB();
  const blob = await db.get(STORE_NAME, id);
  return !!blob;
};
