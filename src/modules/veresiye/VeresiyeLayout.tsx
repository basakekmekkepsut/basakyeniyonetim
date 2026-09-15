import { NavLink, Outlet } from 'react-router-dom'

const SEKMELER = [
  { yol: '/veresiye', etiket: 'Özet' },
  { yol: '/veresiye/gunluk-giris', etiket: 'Günlük Giriş' },
  { yol: '/veresiye/un-hesapli-giris', etiket: 'Un Hesaplı Giriş' },
  { yol: '/veresiye/giris-sablonu', etiket: 'Giriş Şablonu' }
]

export default function VeresiyeLayout() {
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {SEKMELER.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.yol === '/veresiye'}
            className={({ isActive }) =>
              `shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-bakery-amber-600 text-bakery-amber-600'
                  : 'border-transparent text-bakery-coffee-500 hover:text-bakery-coffee-700'
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
