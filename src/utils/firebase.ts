import {FirebaseApp, FirebaseOptions, initializeApp} from 'firebase/app';
import {connectAuthEmulator, getAuth} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore} from 'firebase/firestore';
import {connectFunctionsEmulator, getFunctions} from 'firebase/functions';

export enum Env {
  PROD,
  DEV,
  TEST,
}

const getFirebaseAppOptions = (env: Env): FirebaseOptions => {
  switch (env) {
    case Env.DEV:
      return {
        projectId: 'chaas-dev',
        apiKey: 'fakeApiKey',
      };
    case Env.TEST:
      return {
        projectId: 'chaas-test',
        apiKey: 'fakeApiKey',
      };
    case Env.PROD:
      return {
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };
  }
};

export const createFirebaseApp = (env: Env): FirebaseApp => {
  const options = getFirebaseAppOptions(env);
  const app = initializeApp(options);

  if (env !== Env.PROD) {
    const firestore = getFirestore(app);
    connectFirestoreEmulator(firestore, 'localhost', 8080);
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://localhost:9099', {disableWarnings: true});
    const functions = getFunctions(app);
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }

  return app;
};
