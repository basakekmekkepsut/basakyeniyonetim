import { getToken } from 'firebase/messaging'
import { httpsCallable } from 'firebase/functions'
import { pushMessagingGetir, requireFunctions } from '../lib/firebase'

// Firebase Console > Proje Ayarları > Cloud Messaging > Web push sertifikaları
// bölümünden üretilen "Anahtar çifti" değeri — bkz. .env.example.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

export type PushDurum = 'desteklenmiyor' | 'izin_verilmedi' | 'reddedildi' | 'aktif'

export async function pushDurumuGetir(): Promise<PushDurum> {
  if (typeof Notification === 'undefined') return 'desteklenmiyor'
  const messaging = await pushMessagingGetir()
  if (!messaging) return 'desteklenmiyor'
  if (Notification.permission === 'granted') return 'aktif'
  if (Notification.permission === 'denied') return 'reddedildi'
  return 'izin_verilmedi'
}

async function tokenAl(): Promise<string> {
  if (!VAPID_KEY) {
    throw new Error('Bildirim sistemi henüz yapılandırılmadı (VAPID anahtarı eksik) — yöneticinize bildirin.')
  }
  const messaging = await pushMessagingGetir()
  if (!messaging) {
    throw new Error('Bu tarayıcı/cihaz push bildirimini desteklemiyor.')
  }
  const izin = await Notification.requestPermission()
  if (izin !== 'granted') {
    throw new Error('Bildirim izni verilmedi.')
  }
  const kayit = await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: kayit })
  if (!token) {
    throw new Error('Bildirim token\'ı alınamadı — lütfen tekrar deneyin.')
  }
  return token
}

/** Personel/admin için — girişli kullanıcının kendi hesabına bildirim tokenı kaydeder. */
export async function personelBildirimleriEtkinlestir(): Promise<void> {
  const token = await tokenAl()
  const cagir = httpsCallable<{ token: string }, { basarili: boolean }>(requireFunctions(), 'pushTokenKaydet')
  await cagir({ token })
}

/** Müşteri portalı için — kod+şifre ile doğrulanmış müşteriye bildirim tokenı kaydeder. */
export async function portalBildirimleriEtkinlestir(musteriId: string, sifre: string): Promise<void> {
  const token = await tokenAl()
  const cagir = httpsCallable<{ musteriId: string; sifre: string; token: string }, { basarili: boolean }>(
    requireFunctions(),
    'portalPushTokenKaydet'
  )
  await cagir({ musteriId, sifre, token })
}
