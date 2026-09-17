import { NavLink, Outlet } from 'react-router-dom'
import { isAdmin, useSession } from '../../lib/session'

const SEKMELER = [
  { yol: '/veresiye', etiket: 'Özet', sadeceAdmin: false },
  { yol: '/veresiye/musteriler', etiket: 'Müşteriler', sadeceAdmin: false },
  { yol: '/veresiye/rapor', etiket: 'Rapor', sadeceAdmin: true },
  { yol: '/veresiye/gunluk-giris', etiket: 'Günlük Giriş', sadeceAdmin: false },
  { yol: '/veresiye/un-hesapli-giris', etiket: 'Un Hesaplı Giriş', sadeceAdmin: false },
  { yol: '/veresiye/giris-sablonu', etiket: 'Giriş Şablonu', sadeceAdmin: false }
]

export default function VeresiyeLayout() {
  const session = useSession()
  const admin = session.status === 'signed-in' && isAdmin(session.profile)
  const sekmeler = SEKMELER.filter((s) => !s.sadeceAdmin || admin)

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {sekmeler.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.yol === '/veresiye'}
            className={({ isActive }) =>
              `shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-bakery-amber-600 text-bakery-amber-600'
                  : 'border-transparent text-bakery-ink-500 hover:text-bakery-ink-700'
              }`
            }
          >
            {s.etiket}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
