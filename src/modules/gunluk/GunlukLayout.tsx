import { NavLink, Outlet } from 'react-router-dom'

const SEKMELER = [
  { yol: '/gunluk', etiket: 'Veresiye' },
  { yol: '/gunluk/giris', etiket: 'Günlük Giriş' },
  { yol: '/gunluk/musteriler', etiket: 'Müşteriler' },
  { yol: '/gunluk/urunler', etiket: 'Ürünler' }
]

export default function GunlukLayout() {
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-bakery-cream-200">
        {SEKMELER.map((s) => (
          <NavLink
            key={s.yol}
            to={s.yol}
            end={s.yol === '/gunluk'}
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
