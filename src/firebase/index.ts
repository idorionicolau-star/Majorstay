'use client';

export * from './provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';

// Re-export the firestore instance as 'db' to match usage in new contexts
// Re-export the firestore instance as 'db' to match usage in new contexts
import { getFirestore } from 'firebase/firestore';
import { initializeFirebase } from './provider';

const { firebaseApp } = initializeFirebase();
export const app = firebaseApp;
export const db = getFirestore(app);
