import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined
}

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
)

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let functions: Functions | undefined

const useEmulator = import.meta.env.DEV && env.VITE_USE_EMULATOR === 'true'

if (isFirebaseConfigured) {
  app = initializeApp(config as Required<typeof config>)
  auth = getAuth(app)
  db = useEmulator
    ? initializeFirestore(app, {})
    : initializeFirestore(app, { localCache: persistentLocalCache() })
  functions = getFunctions(app, 'europe-west1')

  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    // eslint-disable-next-line no-console
    console.info('[firebase] Emülatör moduna bağlanıldı (Auth :9099, Firestore :8080, Functions :5001).')
  }
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[firebase] Ortam değişkenleri eksik — .env dosyanızı .env.example üzerinden oluşturun.'
  )
}

export { app, auth, db, functions }

export function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase Auth yapılandırılmadı — .env dosyasını kontrol edin.')
  return auth
}

export function requireDb(): Firestore {
  if (!db) throw new Error('Firestore yapılandırılmadı — .env dosyasını kontrol edin.')
  return db
}

export function requireFunctions(): Functions {
  if (!functions) throw new Error('Firebase Functions yapılandırılmadı — .env dosyasını kontrol edin.')
  return functions
}
