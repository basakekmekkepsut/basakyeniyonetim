import { type ReactNode, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ClipboardList, HandCoins, School, LogOut, Moon, Settings, Sun, User } from 'lucide-react'
import { requireAuth } from '../lib/firebase'
import { hasModule, isAdmin, useSession } from '../lib/session'
import { temaBaslat, temaDegistir, yaziBoyutuBaslat, yaziBoyutuDegistir, type Tema, type YaziBoyutu } from '../shared/gorunum'
import type { Modul } from '../lib/types'

const MODUL_TANIMLARI: { key: Modul; yol: string; etiket: string; Icon: typeof ClipboardList }[] = [
  { key: 'siparis', yol: '/siparis', etiket: 'Sipariş', Icon: ClipboardList },
  { key: 'veresiye', yol: '/veresiye', etiket: 'Veresiye', Icon: HandCoins },
  { key: 'okul', yol: '/okul', etiket: 'Okul', Icon: School }
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

  if (session.status !== 'signed-in') return null
  const { profile } = session

  const gorunurModuller = MODUL_TANIMLARI.filter((m) => hasModule(profile, m.key))

  return (
    <div className="flex min-h-screen flex-col bg-bakery-cream-50">
      <header className="sticky top-0 z-20 bg-bakery-coffee-800/95 pt-[env(safe-area-inset-top,0px)] shadow-card backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <Link to={hasModule(profile, 'veresiye') ? '/veresiye' : '/'} className="flex items-end gap-1.5 text-white">
            <img src="/logo-mark.webp" alt="Başak Ekmek" className="logo-on-dark h-9 w-28 object-contain object-center" />
            <span className="mb-0.5 text-[10px] font-medium text-white/50">v{__APP_VERSION__}</span>
          </Link>

          <nav className="hidden gap-1 md:flex">
            {gorunurModuller.map(({ key, yol, etiket, Icon }) => (
              <NavLink key={key} to={yol} className={({ isActive }) => navLinkClass(isActive)}>
                <Icon size={16} />
                {etiket}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setYaziBoyutu((v) => yaziBoyutuDegistir(v))}
              className="rounded-full bg-bakery-surface/10 px-2.5 py-2 text-xs font-bold text-white hover:bg-bakery-surface/20"
              aria-label="Yazı boyutu"
              title={`Yazı boyutu: ${yaziBoyutu === 'normal' ? 'Normal' : yaziBoyutu === 'buyuk' ? 'Büyük' : 'Ekstra Büyük'} — değiştirmek için tıklayın`}
            >
              Aa
            </button>
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
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 border-t border-bakery-cream-200 bg-bakery-surface/90 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)] shadow-elevated backdrop-blur-md md:hidden">
        {gorunurModuller.map(({ key, yol, etiket, Icon }) => (
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
