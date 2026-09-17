import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isFirebaseConfigured } from './lib/firebase'
import { SessionProvider, hasModule, isAdmin, useSession } from './lib/session'
import { ToastProvider } from './shared/Toast'
import ConfigMissing from './shell/ConfigMissing'
import LoginPage from './shell/LoginPage'
import NoProfile from './shell/NoProfile'
import ErrorScreen from './shell/ErrorScreen'
import Layout from './shell/Layout'
import InstallPrompt from './shell/InstallPrompt'
import type { Modul } from './lib/types'

const SiparisLayout = lazy(() => import('./modules/siparis/SiparisLayout'))
const SiparislerPage = lazy(() => import('./modules/siparis/SiparislerPage'))
const SablonlarPage = lazy(() => import('./modules/siparis/SablonlarPage'))
const RaporPage = lazy(() => import('./modules/siparis/RaporPage'))
const SiparisMesajPage = lazy(() => import('./modules/siparis/MesajPage'))

const VeresiyeLayout = lazy(() => import('./modules/veresiye/VeresiyeLayout'))
const OzetPage = lazy(() => import('./modules/veresiye/OzetPage'))
const VeresiyeMusterilerPage = lazy(() => import('./modules/veresiye/VeresiyeMusterilerPage'))
const GunlukGirisPage = lazy(() => import('./modules/veresiye/GunlukGirisPage'))
const UnHesapliGirisPage = lazy(() => import('./modules/veresiye/UnHesapliGirisPage'))
const GirisSablonuPage = lazy(() => import('./modules/veresiye/GirisSablonuPage'))

const OkulLayout = lazy(() => import('./modules/okul/OkulLayout'))
const UretimPage = lazy(() => import('./modules/okul/UretimPage'))
const OkulSiparisPage = lazy(() => import('./modules/okul/SiparisPage'))
const OkullarPage = lazy(() => import('./modules/okul/OkullarPage'))
const EkstrePage = lazy(() => import('./modules/okul/EkstrePage'))
const OkulMesajPage = lazy(() => import('./modules/okul/MesajPage'))

const AyarlarLayout = lazy(() => import('./modules/ayarlar/AyarlarLayout'))
const MusterilerPage = lazy(() => import('./modules/musteriler/MusterilerPage'))
const UrunlerPage = lazy(() => import('./modules/urunler/UrunlerPage'))
const KullanicilarPage = lazy(() => import('./modules/ayarlar/kullanicilar/KullanicilarPage'))
const TelegramAyarlariPage = lazy(() => import('./modules/ayarlar/telegram/TelegramAyarlariPage'))
const HaftalikLogPage = lazy(() => import('./modules/ayarlar/HaftalikLogPage'))
const YedeklemePage = lazy(() => import('./modules/ayarlar/YedeklemePage'))

const MODUL_SIRASI: Modul[] = ['siparis', 'veresiye', 'okul']

export default function App() {
  if (!isFirebaseConfigured) return <ConfigMissing />

  return (
    <SessionProvider>
      <ToastProvider>
        <SessionGate />
        <InstallPrompt />
      </ToastProvider>
    </SessionProvider>
  )
}

function SessionGate() {
  const session = useSession()

  switch (session.status) {
    case 'loading':
      return <FullscreenLoading />
    case 'signed-out':
      return <LoginPage />
    case 'no-profile':
      return <NoProfile />
    case 'error':
      return <ErrorScreen message={session.message} />
    case 'signed-in': {
      if (!session.profile.aktif) {
        return <ErrorScreen message="Hesabınız pasif durumda. Lütfen yöneticinizle iletişime geçin." />
      }

      const ilkModul = MODUL_SIRASI.find((m) => hasModule(session.profile, m))
      if (!ilkModul) {
        return <ErrorScreen message="Hesabınıza henüz hiçbir modül için erişim tanımlanmamış." />
      }

      const admin = isAdmin(session.profile)

      return (
        <Suspense fallback={<FullscreenLoading />}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to={`/${ilkModul}`} replace />} />
              <Route path="/siparis" element={<SiparisLayout />}>
                <Route index element={<SiparislerPage />} />
                <Route path="sablonlar" element={<SablonlarPage />} />
                <Route path="rapor" element={<RaporPage />} />
                <Route path="mesaj" element={<SiparisMesajPage />} />
              </Route>
              <Route path="/veresiye" element={<VeresiyeLayout />}>
                <Route index element={<OzetPage />} />
                <Route path="musteriler" element={<VeresiyeMusterilerPage />} />
                <Route path="gunluk-giris" element={<GunlukGirisPage />} />
                <Route path="un-hesapli-giris" element={<UnHesapliGirisPage />} />
                <Route path="giris-sablonu" element={<GirisSablonuPage />} />
              </Route>
              <Route path="/okul" element={<OkulLayout />}>
                <Route index element={<UretimPage />} />
                <Route path="siparis" element={<OkulSiparisPage />} />
                <Route path="okullar" element={<OkullarPage />} />
                <Route path="ekstre" element={<EkstrePage />} />
                <Route path="urunler" element={<UrunlerPage />} />
                <Route path="mesaj" element={<OkulMesajPage />} />
              </Route>
              {admin && (
                <Route path="/ayarlar" element={<AyarlarLayout />}>
                  <Route index element={<Navigate to="musteriler" replace />} />
                  <Route path="musteriler" element={<MusterilerPage />} />
                  <Route path="urunler" element={<UrunlerPage />} />
                  <Route path="kullanicilar" element={<KullanicilarPage />} />
                  <Route path="telegram" element={<TelegramAyarlariPage />} />
                  <Route path="log" element={<HaftalikLogPage />} />
                  <Route path="yedekleme" element={<YedeklemePage />} />
                </Route>
              )}
              <Route path="*" element={<Navigate to={`/${ilkModul}`} replace />} />
            </Route>
          </Routes>
        </Suspense>
      )
    }
  }
}

function FullscreenLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bakery-cream-50">
      <div className="text-sm text-bakery-ink-500">Yükleniyor…</div>
    </div>
  )
}
