import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useMusteriler } from '../musteriler/data'
import MusteriDetayModal from '../musteriler/MusteriDetayModal'
import BosDurum from '../../shared/BosDurum'
import { formatTutar } from '../../shared/TutarGoster'
import { unHesabiAktifMi, cuvalKisaGoster } from '../../shared/unHesabi'
import { useVeresiyeMusteriFiltresi } from '../../shared/veresiyeErisim'
import type { Musteri } from '../../lib/types'

/**
 * Veresiye içinden erişilen, salt-okunur müşteri hesap dokümanı listesi —
 * Ayarlar > Müşteriler'in aksine personel de görebilir, ama sadece kendi
 * yetkili olduğu müşterileri (bkz. useVeresiyeMusteriFiltresi) ve düzenleme/
 * silme imkânı olmadan (MusteriDetayModal'a onDuzenle verilmez).
 */
export default function VeresiyeMusterilerPage() {
  const { musteriler, yukleniyor, hata } = useMusteriler()
  const musteriErisimi = useVeresiyeMusteriFiltresi()
  const [arama, setArama] = useState('')
  const [gosterilen, setGosterilen] = useState<Musteri | undefined>()

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    return musteriler.filter((m) => {
      if (m.gecici || !m.moduller.includes('veresiye') || !musteriErisimi(m)) return false
      if (!q) return true
      return m.ad.toLocaleLowerCase('tr-TR').includes(q) || m.telefon.includes(q)
    })
  }, [musteriler, arama, musteriErisimi])

  if (hata) {
    return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>
  }

  return (
    <div className="space-y-4">
      <div className="relative sm:max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Ad veya telefon ara…"
          className="w-full rounded-xl border border-bakery-cream-200 bg-bakery-surface py-2 pl-9 pr-3 text-sm shadow-soft outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
        />
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum baslik="Görebileceğiniz müşteri yok" />
      ) : (
        <div className="divide-y divide-bakery-cream-100 overflow-hidden rounded-2xl bg-bakery-surface shadow-soft">
          {filtrelenmis.map((m) => {
            const unMusterisi = unHesabiAktifMi(m)
            return (
              <button
                key={m.id}
                onClick={() => setGosterilen(m)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bakery-cream-50"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-bakery-ink-900">{m.ad}</span>
                <span
                  className={`shrink-0 whitespace-nowrap text-sm font-semibold ${
                    unMusterisi
                      ? m.unHesabi!.birikenEsdegerAdet > 0
                        ? 'text-bakery-danger'
                        : 'text-bakery-success'
                      : m.veresiyeBakiye > 0
                        ? 'text-bakery-danger'
                        : 'text-bakery-success'
                  }`}
                >
                  {unMusterisi ? cuvalKisaGoster(m.unHesabi!.birikenEsdegerAdet, m.unHesabi!.adetPerCuval) : formatTutar(m.veresiyeBakiye)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {gosterilen && <MusteriDetayModal musteri={gosterilen} onKapat={() => setGosterilen(undefined)} />}
    </div>
  )
}
