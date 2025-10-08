import { initFirebase } from '../auth/firebase';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase (will use ADC and FIREBASE_PROJECT_ID)
initFirebase();

// Export Firestore instance
export const db = getFirestore();

// Converter helpers for ISO date serialization
export const firestoreConverter = <T>() => ({
  toFirestore: (data: T): FirebaseFirestore.DocumentData => {
    // Convert to plain object, dates already as ISO strings
    return data as FirebaseFirestore.DocumentData;
  },
  fromFirestore: (snapshot: FirebaseFirestore.QueryDocumentSnapshot): T => {
    return snapshot.data() as T;
  },
});
