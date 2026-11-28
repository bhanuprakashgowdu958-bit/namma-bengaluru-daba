import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ??
    'AIzaSyBQQvqh3sGfwqmTXaxnRYaokYXWhEZRz0g',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
    'namma-bengaluru-daba.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'namma-bengaluru-daba',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ??
    'namma-bengaluru-daba.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '364600347510',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    '1:364600347510:web:731e5abd89e3837fdfc857',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-HML9833NNV'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
