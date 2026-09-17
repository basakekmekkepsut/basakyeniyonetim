import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useVeresiyeKayitlar } from './data'
import { useVeresiyeOdemeler } from './odemeData'
import { donemAraligiHesapla, type DonemAnahtari } from '../../shared/DonemFiltre'
import TutarGoster, { formatTutar } from '../../shared/TutarGoster'
import BosDurum from '../../shared/BosDurum'
import DurumRozeti from '../../shared/DurumRozeti'
import { isAdmin, useSession } from '../../lib/session'
import type { VeresiyeKaydi, VeresiyeOdeme } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

// Bu sayfa özellikle "geçmiş ayın toplamıyla fatura kesme" ihtiyacı için, hem
// ileri hem geri dönük tüm dönemleri (Geçen Hafta/Geçen Ay dahil) tek yerde
// toplar — bu yüzden DonemFiltre'nin paylaşılan pil listesini kullanmak yerine
// kendi (bilerek dar) seçenek setini gösterir.
const DONEM_SECENEKLERI: { key: DonemAnahtari; etiket: string }[] = [
  { key: 'bugun', etiket: 'Bugün' },
  { key: 'dun', etiket: 'Dün' },
  { key: 'bu_hafta', etiket: 'Bu Hafta' },
  { key: 'gecen_hafta', etiket: 'Geçen Hafta' },
  { key: 'bu_ay', etiket: 'Bu Ay' },
  { key: 'gecen_ay', etiket: 'Geçen Ay' },
  { key: 'ozel', etiket: 'Özel Aralık' }
]

interface UrunToplami {
  urunAdi: string
  adet: number
  tutar: number
}

interface MusteriSatiri {
  musteriId: string
  musteriAdi: string
  teslimatTutar: number
  odemeTutar: number
  kayitSayisi: number
  unEsdeger: number
  urunler: UrunToplami[]
  kayitlarListesi: VeresiyeKaydi[]
  odemelerListesi: VeresiyeOdeme[]
}

const tarihSirala = (a: { tarih: string }, b: { tarih: string }) => b.tarih.localeCompare(a.tarih)

export default function RaporPage() {
  const session = useSession()
  const [donem, setDonem] = useState<DonemAnahtari>('gecen_ay')
  const [ozelBaslangic, setOzelBaslangic] = useState(bugunStr())
  const [ozelBitis, setOzelBitis] = useState(bugunStr())
  const [arama, setArama] = useState('')
  const [acikMusteriId, setAcikMusteriId] = useState<string | null>(null)

  const { baslangic, bitis } = donemAraligiHesapla(donem, ozelBaslangic, ozelBitis)
  const filtre = { baslangic, bitis, musteriId: null }
  const { kayitlar, yukleniyor: kYukleniyor } = useVeresiyeKayitlar(filtre)
  const { odemeler, yukleniyor: oYukleniyor } = useVeresiyeOdemeler(filtre)

  const musteriRaporu = useMemo(() => {
    const map = new Map<string, MusteriSatiri>()
    const satirGetir = (musteriId: string, musteriAdi: string) => {
      const mevcut = map.get(musteriId)
      if (mevcut) return mevcut
      const yeni: MusteriSatiri = {
        musteriId,
        musteriAdi,
        teslimatTutar: 0,
        odemeTutar: 0,
        kayitSayisi: 0,
        unEsdeger: 0,
        urunler: [],
        kayitlarListesi: [],
        odemelerListesi: []
      }
      map.set(musteriId, yeni)
      return yeni
    }
    for (const k of kayitlar) {
      const satir = satirGetir(k.musteriId, k.musteriAdi)
      if (k.durum === 'veresiye') satir.teslimatTutar += k.tutar
      if (k.durum === 'un_odemeli') satir.unEsdeger += k.esdegerAdet
      satir.kayitSayisi += 1
      satir.kayitlarListesi.push(k)
      // Ödeme durumundan bağımsız — "kaç ekmek aldı" sorusuna cevap, borç değil.
      const urun = satir.urunler.find((u) => u.urunAdi === k.urunAdi)
      if (urun) {
        urun.adet += k.adet
        urun.tutar += k.tutar
      } else {
        satir.urunler.push({ urunAdi: k.urunAdi, adet: k.adet, tutar: k.tutar })
      }
    }
    for (const o of odemeler) {
      const satir = satirGetir(o.musteriId, o.musteriAdi)
      satir.odemeTutar += o.tutar
      satir.odemelerListesi.push(o)
    }
    let liste = [...map.values()].map((s) => ({
      ...s,
      urunler: [...s.urunler].sort((a, b) => b.tutar - a.tutar),
      kayitlarListesi: [...s.kayitlarListesi].sort(tarihSirala),
      odemelerListesi: [...s.odemelerListesi].sort(tarihSirala)
    }))
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (q) liste = liste.filter((s) => s.musteriAdi.toLocaleLowerCase('tr-TR').includes(q))
    return liste.sort((a, b) => b.teslimatTutar - a.teslimatTutar)
  }, [kayitlar, odemeler, arama])

  const genelToplam = useMemo(
    () =>
      musteriRaporu.reduce(
        (s, m) => ({ teslimat: s.teslimat + m.teslimatTutar, odeme: s.odeme + m.odemeTutar }),
        { teslimat: 0, odeme: 0 }
      ),
    [musteriRaporu]
  )

  if (session.status !== 'signed-in') return null
  if (!isAdmin(session.profile)) {
    return <p className="text-sm text-bakery-ink-500">Bu sayfa yalnızca yöneticiler içindir.</p>
  }

  const yukleniyor = kYukleniyor || oYukleniyor

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-bakery-ink-900">Rapor</h2>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-bakery-cream-100 p-1">
          {DONEM_SECENEKLERI.map((s) => (
            <button
              key={s.key}
              onClick={() => setDonem(s.key)}
              className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                donem === s.key ? 'bg-bakery-surface text-bakery-ink-900 shadow-sm' : 'text-bakery-ink-500 hover:text-bakery-ink-700'
              }`}
            >
              {s.etiket}
            </button>
          ))}
        </div>

        {donem === 'ozel' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={ozelBaslangic}
              onChange={(e) => setOzelBaslangic(e.target.value)}
              className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
            />
            <span className="text-bakery-ink-400">–</span>
            <input
              type="date"
              value={ozelBitis}
              onChange={(e) => setOzelBitis(e.target.value)}
              className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2 py-1.5 text-sm outline-none focus:border-bakery-amber-500"
            />
          </div>
        )}
      </div>

      <div className="relative max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Müşteri ara…"
          className="w-full rounded-lg border border-bakery-cream-200 bg-bakery-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
        />
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : musteriRaporu.length === 0 ? (
        <BosDurum baslik="Bu aralıkta kayıt yok" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-ink-500">Toplam Teslimat</p>
              <p className="text-xl font-semibold text-bakery-ink-900">
                <TutarGoster tutar={genelToplam.teslimat} />
              </p>
            </div>
            <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-ink-500">Toplam Tahsilat</p>
              <p className="text-xl font-semibold text-bakery-success">
                <TutarGoster tutar={genelToplam.odeme} />
              </p>
            </div>
            <div className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
              <p className="text-xs text-bakery-ink-500">Müşteri Sayısı</p>
              <p className="text-xl font-semibold text-bakery-ink-900">{musteriRaporu.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            {musteriRaporu.map((m) => {
              const acik = acikMusteriId === m.musteriId
              return (
                <div key={m.musteriId} className="rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
                  <button
                    type="button"
                    onClick={() => setAcikMusteriId(acik ? null : m.musteriId)}
                    className="flex w-full items-center justify-between gap-2 p-3.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-bakery-ink-900">{m.musteriAdi}</p>
                      {m.urunler.length > 0 && (
                        <p className="truncate text-xs text-bakery-ink-500">
                          {m.urunler.map((u) => `${u.urunAdi}: ${u.adet}`).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-bakery-ink-900">
                          <TutarGoster tutar={m.teslimatTutar} />
                        </p>
                        <p className="text-xs text-bakery-ink-400">{m.kayitSayisi} kayıt</p>
                      </div>
                      <ChevronDown size={18} className={`text-bakery-ink-400 transition-transform ${acik ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {acik && (
                    <div className="space-y-3 border-t border-bakery-cream-100 p-3.5 pt-3">
                      {m.odemeTutar > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-bakery-ink-500">Tahsilat</span>
                          <span className="font-medium text-bakery-success">
                            <TutarGoster tutar={m.odemeTutar} />
                          </span>
                        </div>
                      )}
                      {m.unEsdeger > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-bakery-ink-500">Un Eşdeğeri</span>
                          <span className="font-medium text-blue-600">{m.unEsdeger} adet</span>
                        </div>
                      )}

                      {m.urunler.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-bakery-ink-500">
                            Ürün Bazlı Toplam
                          </h3>
                          <div className="overflow-x-auto rounded-lg bg-bakery-cream-50">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-bakery-ink-500">
                                  <th className="px-2.5 py-1.5 font-medium">Ürün</th>
                                  <th className="px-2.5 py-1.5 font-medium">Adet</th>
                                  <th className="px-2.5 py-1.5 font-medium">Tutar</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.urunler.map((u) => (
                                  <tr key={u.urunAdi} className="border-t border-bakery-cream-100">
                                    <td className="px-2.5 py-1.5 text-bakery-ink-800">{u.urunAdi}</td>
                                    <td className="px-2.5 py-1.5 text-bakery-ink-600">{u.adet} adet</td>
                                    <td className="px-2.5 py-1.5 font-medium text-bakery-ink-900">{formatTutar(u.tutar)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {m.odemelerListesi.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-bakery-ink-500">
                            Ödemeleri
                          </h3>
                          <div className="overflow-x-auto rounded-lg bg-bakery-cream-50">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs text-bakery-ink-500">
                                  <th className="px-2.5 py-1.5 font-medium">Tarih</th>
                                  <th className="px-2.5 py-1.5 font-medium">Tutar</th>
                                  <th className="px-2.5 py-1.5 font-medium">Not</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.odemelerListesi.map((o) => (
                                  <tr key={o.id} className="border-t border-bakery-cream-100">
                                    <td className="px-2.5 py-1.5 text-bakery-ink-600">{o.tarih}</td>
                                    <td className="px-2.5 py-1.5 font-medium text-bakery-success">{formatTutar(o.tutar)}</td>
                                    <td className="px-2.5 py-1.5 text-bakery-ink-500">{o.not || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {m.kayitlarListesi.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-bakery-ink-500">
                            Tüm İşlemler
                          </h3>
                          <div className="max-h-72 overflow-y-auto overflow-x-auto rounded-lg bg-bakery-cream-50">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="sticky top-0 bg-bakery-cream-50 text-left text-xs text-bakery-ink-500">
                                  <th className="px-2.5 py-1.5 font-medium">Tarih</th>
                                  <th className="px-2.5 py-1.5 font-medium">Ürün</th>
                                  <th className="px-2.5 py-1.5 font-medium">Adet</th>
                                  <th className="px-2.5 py-1.5 font-medium">Tutar</th>
                                  <th className="px-2.5 py-1.5 font-medium">Durum</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.kayitlarListesi.map((k) => (
                                  <tr key={k.id} className="border-t border-bakery-cream-100">
                                    <td className="px-2.5 py-1.5 text-bakery-ink-600">{k.tarih}</td>
                                    <td className="px-2.5 py-1.5 text-bakery-ink-800">{k.urunAdi}</td>
                                    <td className="px-2.5 py-1.5 text-bakery-ink-600">{k.adet}</td>
                                    <td className="px-2.5 py-1.5 font-medium text-bakery-ink-900">{formatTutar(k.tutar)}</td>
                                    <td className="px-2.5 py-1.5">
                                      <DurumRozeti durum={k.durum} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
