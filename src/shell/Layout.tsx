import { type ReactNode, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ClipboardList, HandCoins, School, LogOut, Moon, RefreshCw, Settings, Store, Sun, User, Users, Package } from 'lucide-react'
import { requireAuth } from '../lib/firebase'
import { hasModule, isAdmin, useSession } from '../lib/session'
import { temaBaslat, temaDegistir, yaziBoyutuBaslat, yaziBoyutuSec, YAZI_ETIKETLERI, YAZI_SIRASI, type Tema, type YaziBoyutu } from '../shared/gorunum'
import type { Modul } from '../lib/types'
import { useToast } from '../shared/Toast'
import { useGuncelleme } from './useGuncelleme'
import CiftKayitBanner from './CiftKayitBanner'

const MODUL_TANIMLARI: { key: Modul; yol: string; etiket: string; Icon: typeof ClipboardList }[] = [
  { key: 'siparis', yol: '/siparis', etiket: 'Sipariş', Icon: ClipboardList },
  { key: 'veresiye', yol: '/veresiye', etiket: 'Veresiye', Icon: HandCoins },
  { key: 'okul', yol: '/okul', etiket: 'Okul', Icon: School },
  { key: 'gunluk', yol: '/gunluk', etiket: 'Günlük', Icon: Store }
]

const navLinkClass = (aktif: boolean) =>
  `flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all ${
    aktif ? 'bg-bakery-coffee-600 text-white shadow-soft' : 'text-bakery-cream-100/90 hover:bg-bakery-surface/10'
  }`

const bottomNavLinkClass = (aktif: boolean) =>
  `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-all ${
    aktif ? 'text-bakery-amber-600' : 'text-bakery-ink-400'
  }`

export default function Layout() {
  const session = useSession()
  const [menuAcik, setMenuAcik] = useState(false)
  const [tema, setTema] = useState<Tema>(() => temaBaslat())
  const [yaziBoyutu, setYaziBoyutu] = useState<YaziBoyutu>(() => yaziBoyutuBaslat())
  const [yaziMenuAcik, setYaziMenuAcik] = useState(false)
  const { guncellemeVar, kontrolEdiliyor, guncelle } = useGuncelleme()
  const toast = useToast()

  if (session.status !== 'signed-in') return null
  const { profile } = session

  const gorunurModuller = MODUL_TANIMLARI.filter((m) => hasModule(profile, m.key))
  // Müşteri ve Ürün kartları bir modül değil — Ayarlar'da olduğu gibi yalnızca yöneticiye görünür.
  const menuOgeleri: { key: string; yol: string; etiket: string; Icon: typeof ClipboardList }[] = isAdmin(profile)
    ? [
        ...gorunurModuller,
        { key: 'musteriler', yol: '/musteriler', etiket: 'Müşteriler', Icon: Users },
        { key: 'urunler', yol: '/urunler', etiket: 'Ürünler', Icon: Package }
      ]
    : gorunurModuller

  return (
    <div className="flex min-h-screen flex-col bg-bakery-cream-50">
      <header className="sticky top-0 z-20 bg-bakery-coffee-800/95 pt-[env(safe-area-inset-top,0px)] shadow-card backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <Link to={hasModule(profile, 'veresiye') ? '/veresiye' : '/'} className="flex items-end gap-1.5 text-white">
            <img src="/logo-mark.webp" alt="Başak Ekmek" className="logo-on-dark h-9 w-28 object-contain object-center" />
            <span className="mb-0.5 text-[10px] font-medium text-white/50">v{__APP_VERSION__}</span>
          </Link>

          <nav className="hidden gap-1 md:flex">
            {menuOgeleri.map(({ key, yol, etiket, Icon }) => (
              <NavLink key={key} to={yol} className={({ isActive }) => navLinkClass(isActive)} title={etiket}>
                <Icon size={16} />
                <span className="hidden lg:inline">{etiket}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (kontrolEdiliyor) return
                const yenileniyor = await guncelle()
                if (yenileniyor === false) toast.basari(`Uygulama güncel (v${__APP_VERSION__}).`)
                else if (yenileniyor === null) toast.hata('Sunucuya ulaşılamadı, güncelleme kontrol edilemedi.')
              }}
              disabled={kontrolEdiliyor}
              className={
                guncellemeVar
                  ? 'flex animate-pulse items-center gap-1.5 rounded-full bg-bakery-amber-500 p-2.5 ring-2 ring-white/70 sm:px-3 text-xs font-bold text-white shadow-soft hover:bg-bakery-amber-600'
                  : 'rounded-full bg-bakery-surface/10 p-2.5 text-white hover:bg-bakery-surface/20 disabled:opacity-60'
              }
              aria-label={guncellemeVar ? 'Yeni sürüm hazır — güncelle' : 'Güncelleme kontrol et'}
              title={guncellemeVar ? 'Yeni sürüm hazır — güncellemek için tıklayın' : 'Güncelleme kontrol et'}
            >
              <RefreshCw size={16} className={kontrolEdiliyor ? 'animate-spin' : ''} />
              {guncellemeVar && <span className="hidden sm:inline">Güncelle</span>}
            </button>
            <div className="relative">
              <button
                onClick={() => setYaziMenuAcik((v) => !v)}
                className="rounded-full bg-bakery-surface/10 px-2.5 py-2 text-xs font-bold text-white hover:bg-bakery-surface/20"
                aria-label="Yazı boyutu"
                title={`Yazı boyutu: ${YAZI_ETIKETLERI[yaziBoyutu]}`}
              >
                Aa
              </button>
              {yaziMenuAcik && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setYaziMenuAcik(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-44 origin-top-right animate-pop-in rounded-2xl bg-bakery-surface p-1.5 shadow-elevated">
                    <div className="px-3 py-1.5 text-xs font-medium text-bakery-ink-500">Yazı boyutu</div>
                    {YAZI_SIRASI.map((b, i) => (
                      <button
                        key={b}
                        onClick={() => {
                          setYaziBoyutu(yaziBoyutuSec(b))
                          setYaziMenuAcik(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium ${
                          b === yaziBoyutu ? 'bg-bakery-amber-500/15 text-bakery-amber-600' : 'text-bakery-ink-700 hover:bg-bakery-cream-100'
                        }`}
                      >
                        {YAZI_ETIKETLERI[b]}
                        {/* Önizleme: menü kökü (rem) ölçeğinden bağımsız sabit px ile */}
                        <span style={{ fontSize: `${11 + i * 2}px` }} className="font-bold">
                          A
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setTema((v) => temaDegistir(v))}
              className="rounded-full bg-bakery-surface/10 p-2.5 text-white hover:bg-bakery-surface/20"
              aria-label="Karanlık/Aydınlık mod"
              title={tema === 'koyu' ? 'Aydınlık moda geç' : 'Karanlık moda geç'}
            >
              {tema === 'koyu' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {isAdmin(profile) && (
              <Link
                to="/ayarlar"
                className="rounded-full bg-bakery-surface/10 p-2.5 text-white hover:bg-bakery-surface/20"
                aria-label="Ayarlar"
              >
                <Settings size={16} />
              </Link>
            )}

            <div className="relative">
              <button
                onClick={() => setMenuAcik((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-bakery-surface/10 px-3 py-2 text-sm text-white hover:bg-bakery-surface/20"
              >
                <User size={16} />
                <span className="hidden sm:inline">{profile.ad}</span>
              </button>
              {menuAcik && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuAcik(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-48 origin-top-right animate-pop-in rounded-2xl bg-bakery-surface p-1.5 shadow-elevated">
                    <div className="px-3 py-2 text-xs font-medium text-bakery-ink-500">
                      {profile.rol === 'admin' ? 'Yönetici' : 'Personel'}
                    </div>
                    <button
                      onClick={() => signOut(requireAuth())}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-bakery-danger hover:bg-bakery-danger/10"
                    >
                      <LogOut size={16} />
                      Çıkış Yap
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-24 md:pb-6">
        {(isAdmin(profile) || hasModule(profile, 'veresiye')) && <CiftKayitBanner />}
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-bakery-cream-200 bg-bakery-surface/90 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)] shadow-elevated backdrop-blur-md md:hidden">
        {menuOgeleri.map(({ key, yol, etiket, Icon }) => (
          <NavLink key={key} to={yol} className={({ isActive }) => bottomNavLinkClass(isActive)}>
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-bakery-amber-500/15' : ''}`}>
                  <Icon size={20} />
                </span>
                {etiket}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function Placeholder({ baslik, children }: { baslik: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-bakery-surface p-6 shadow-sm shadow-bakery-coffee-900/5">
      <h2 className="mb-2 text-lg font-semibold text-bakery-ink-900">{baslik}</h2>
      {children ?? <p className="text-sm text-bakery-ink-500">Bu modül henüz geliştirilme aşamasında.</p>}
    </div>
  )
}
