import { type ReactNode, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ClipboardList, HandCoins, School, LogOut, Settings, User } from 'lucide-react'
import { requireAuth } from '../lib/firebase'
import { hasModule, isAdmin, useSession } from '../lib/session'
import type { Modul } from '../lib/types'

const MODUL_TANIMLARI: { key: Modul; yol: string; etiket: string; Icon: typeof ClipboardList }[] = [
  { key: 'siparis', yol: '/siparis', etiket: 'Sipariş', Icon: ClipboardList },
  { key: 'veresiye', yol: '/veresiye', etiket: 'Veresiye', Icon: HandCoins },
  { key: 'okul', yol: '/okul', etiket: 'Okul', Icon: School }
]

const navLinkClass = (aktif: boolean) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
    aktif ? 'bg-bakery-coffee-600 text-white' : 'text-bakery-cream-100/90 hover:bg-bakery-coffee-600/60'
  }`

const bottomNavLinkClass = (aktif: boolean) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
    aktif ? 'text-bakery-amber-600' : 'text-bakery-coffee-500'
  }`

export default function Layout() {
  const session = useSession()
  const [menuAcik, setMenuAcik] = useState(false)

  if (session.status !== 'signed-in') return null
  const { profile } = session

  const gorunurModuller = MODUL_TANIMLARI.filter((m) => hasModule(profile, m.key))

  return (
    <div className="flex min-h-screen flex-col bg-bakery-cream-50">
      <header className="sticky top-0 z-20 bg-bakery-coffee-800 pt-[env(safe-area-inset-top,0px)] shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <img src="/logo.webp" alt="Başak Ekmek" className="h-9 w-28 rounded object-cover object-center" />
          </div>

          <nav className="hidden gap-1 md:flex">
            {gorunurModuller.map(({ key, yol, etiket, Icon }) => (
              <NavLink key={key} to={yol} className={({ isActive }) => navLinkClass(isActive)}>
                <Icon size={16} />
                {etiket}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin(profile) && (
              <Link
                to="/ayarlar"
                className="rounded-full bg-bakery-coffee-700 p-2 text-white hover:bg-bakery-coffee-600"
                aria-label="Ayarlar"
              >
                <Settings size={16} />
              </Link>
            )}

            <div className="relative">
              <button
                onClick={() => setMenuAcik((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-bakery-coffee-700 px-3 py-1.5 text-sm text-white hover:bg-bakery-coffee-600"
              >
                <User size={16} />
                <span className="hidden sm:inline">{profile.ad}</span>
              </button>
              {menuAcik && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-white p-1 shadow-lg shadow-bakery-coffee-900/20">
                  <div className="px-3 py-2 text-xs text-bakery-coffee-500">
                    {profile.rol === 'admin' ? 'Yönetici' : 'Personel'}
                  </div>
                  <button
                    onClick={() => signOut(requireAuth())}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-bakery-danger hover:bg-bakery-cream-100"
                  >
                    <LogOut size={16} />
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-20 md:pb-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-bakery-cream-200 bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        {gorunurModuller.map(({ key, yol, etiket, Icon }) => (
          <NavLink key={key} to={yol} className={({ isActive }) => bottomNavLinkClass(isActive)}>
            <Icon size={20} />
            {etiket}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function Placeholder({ baslik, children }: { baslik: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm shadow-bakery-coffee-900/5">
      <h2 className="mb-2 text-lg font-semibold text-bakery-coffee-900">{baslik}</h2>
      {children ?? <p className="text-sm text-bakery-coffee-500">Bu modül henüz geliştirilme aşamasında.</p>}
    </div>
  )
}
