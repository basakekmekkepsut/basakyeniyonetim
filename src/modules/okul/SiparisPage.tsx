import { useEffect, useState } from 'react'
import { MessageSquarePlus, MessageSquareText } from 'lucide-react'
import { useOkullar, okulGuncelle, yeniHatId, okullariGrupla } from './data'
import {
  useOkulOrders,
  useOkulKapanis,
  okulSiparisMiktariGuncelle,
  okulSiparisNotuGuncelle,
  okullariTatileAl,
  varsayilanSiparisleriHazirla
} from './orderData'
import { useUrunler } from '../urunler/data'
import { useMusteriler } from '../musteriler/data'
import BosDurum from '../../shared/BosDurum'
import { useToast } from '../../shared/Toast'
import type { OkulSchool } from '../../lib/types'

function yarinStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function SiparisPage() {
  const { okullar, yukleniyor: okulYukleniyor } = useOkullar()
  const { urunler } = useUrunler()
  const { musteriler } = useMusteriler()
  const toast = useToast()
  const [tarih, setTarih] = useState(yarinStr())
  const { orders, yukleniyor: ordersYukleniyor } = useOkulOrders(tarih)
  const { kapanis, yukleniyor: kapanisYukleniyor } = useOkulKapanis(tarih)

  const [degerler, setDegerler] = useState<Record<string, number>>({})
  const [notlar, setNotlar] = useState<Record<string, string>>({})
  // Not kutusu varsayılan kapalı (sayfa kısa kalsın); notu olan satırda otomatik açık görünür.
  const [acikNotlar, setAcikNotlar] = useState<Set<string>>(new Set())
  const okulUrunleri = urunler.filter((u) => u.aktif && u.modules.includes('okul'))

  // "+ Ürün Ekle": okulun sabit hat listesinde olmayan bir ürünü o okula, adet 0
  // ile kalıcı bir hat olarak ekler (Okullar sayfasına gitmeye gerek kalmadan) —
  // günlük miktar zaten aşağıdaki inputtan girilir, gelecek günlerde bu hat 0
  // adetle sessiz kalır, tekrar sipariş edilirse aynı şekilde miktar girilir.
  async function urunEkle(okul: OkulSchool, productId: string) {
    if (!productId) return
    const urun = okulUrunleri.find((u) => u.id === productId)
    if (!urun) return
    try {
      await okulGuncelle(okul.id, {
        ad: okul.ad,
        musteriId: okul.musteriId ?? null,
        lines: [...okul.lines, { id: yeniHatId(), productId, urunAdi: urun.ad, adet: 0, aktif: true, gunler: [0, 1, 2, 3, 4, 5, 6] }],
        // Bu özellikten önce oluşturulmuş okul belgelerinde bu alanlar yok —
        // undefined yazmak Firestore'un reddetmesine yol açar (bkz. Sipariş
        // modülündeki benzer adres/telefon hatası), bu yüzden varsayılan verilir.
        acikGunler: okul.acikGunler ?? [0, 1, 2, 3, 4, 5, 6],
        okulDegil: okul.okulDegil ?? false
      })
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Ürün eklenemedi.')
    }
  }

  useEffect(() => {
    // Bu tarih için henüz sipariş girilmemiş hatlarda, okulun standart günlük
    // adedini varsayılan olarak gösteriyoruz — her gün sıfırdan girmeye gerek
    // kalmasın, personel sadece istisnaları (kapalı okul, ekstra sipariş) düzeltsin.
    const yeni: Record<string, number> = {}
    for (const okul of okullar) {
      for (const l of okul.lines) {
        if (l.aktif) yeni[l.id] = l.adet
      }
    }
    for (const o of orders) yeni[o.lineId] = o.adet
    setDegerler(yeni)

    const yeniNotlar: Record<string, string> = {}
    for (const o of orders) if (o.not) yeniNotlar[o.lineId] = o.not
    setNotlar(yeniNotlar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarih, orders.length, okullar.length, orders.map((o) => o.adet).join(',')])

  useEffect(() => {
    // Ekranda gösterilen varsayılanların gerçekten kaydedilmiş olduğundan emin ol
    // (bkz. varsayilanSiparisleriHazirla yorumu) — kapanmış bir günde asla çalışmaz.
    if (okulYukleniyor || ordersYukleniyor || kapanisYukleniyor || kapanis?.kapandi) return
    varsayilanSiparisleriHazirla(tarih, okullar, orders).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarih, okulYukleniyor, ordersYukleniyor, kapanisYukleniyor, kapanis?.kapandi, okullar.length, orders.length])

  function lineOrder(lineId: string) {
    return orders.find((o) => o.lineId === lineId)
  }

  async function commit(schoolId: string, lineId: string, productId: string, adet: number) {
    await okulSiparisMiktariGuncelle(tarih, schoolId, lineId, productId, adet)
  }

  async function commitNot(schoolId: string, lineId: string, productId: string, not: string) {
    try {
      await okulSiparisNotuGuncelle(tarih, schoolId, lineId, productId, not)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Not kaydedilemedi.')
    }
  }

  async function tatilUygula(geriAl: boolean) {
    if (!geriAl && !window.confirm(`${tarih} için tüm okulların siparişleri 0 yapılsın mı? (Okul dışı müşterilere dokunulmaz.)`)) return
    try {
      const n = await okullariTatileAl(tarih, okullar, orders, geriAl)
      toast.basari(geriAl ? `${n} satır standart adetlere döndürüldü.` : `${n} satır 0 yapıldı.`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'İşlem yapılamadı.')
    }
  }

  const aktifOkullar = okullar.filter((o) => o.lines.some((l) => l.aktif))
  const gruplar = okullariGrupla(aktifOkullar, musteriler)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Sipariş</h2>
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-2.5 py-2 text-sm outline-none focus:border-bakery-amber-500"
        />
      </div>

      {!kapanis?.kapandi && !okulYukleniyor && !ordersYukleniyor && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => tatilUygula(false)}
            className="rounded-lg border border-bakery-cream-200 bg-bakery-surface px-3 py-1.5 text-xs font-medium text-bakery-ink-700 hover:bg-bakery-cream-100"
          >
            Bu günü okullar için tatil yap
          </button>
          <button
            type="button"
            onClick={() => tatilUygula(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-bakery-ink-500 hover:bg-bakery-cream-100"
          >
            Standart adetlere dön
          </button>
        </div>
      )}

      {kapanis?.kapandi && (
        <p className="rounded-lg bg-bakery-cream-100 px-4 py-2.5 text-sm font-medium text-bakery-ink-600">
          Bu tarih kapatılmış — satırlar salt okunur.
        </p>
      )}

      {okulYukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : aktifOkullar.length === 0 ? (
        <BosDurum baslik="Aktif hat tanımlı okul yok" aciklama="Okullar sekmesinden okul ve hat ekleyin." />
      ) : (
        <div className="space-y-4">
          {gruplar.map((grup) => (
              <div key={grup.anahtar} className="rounded-xl bg-bakery-surface p-4 shadow-sm shadow-bakery-coffee-900/5">
                <h3 className="mb-3 text-sm font-semibold text-bakery-ink-700">{grup.baslik}</h3>
                <div className="space-y-3">
                  {grup.okullar.map((okul) => {
                    const eklenebilirUrunler = okulUrunleri.filter(
                      (u) => !okul.lines.some((l) => l.productId === u.id)
                    )
                    return (
                      <div key={okul.id}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-bakery-ink-900">{okul.ad}</p>
                          {!kapanis?.kapandi && eklenebilirUrunler.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => urunEkle(okul, e.target.value)}
                              className="w-28 rounded-lg border border-dashed border-bakery-cream-300 bg-transparent px-1.5 py-0.5 text-xs text-bakery-ink-500 outline-none focus:border-bakery-amber-500"
                            >
                              <option value="">+ Ürün</option>
                              {eklenebilirUrunler.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.ad}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="space-y-1 pl-2">
                          {okul.lines
                            .filter((l) => l.aktif)
                            .map((l) => {
                              const order = lineOrder(l.id)
                              const kapali = order?.kapandiMi ?? false
                              const notVar = !!notlar[l.id]
                              const notAcik = notVar || acikNotlar.has(l.id)
                              return (
                                <div key={l.id} className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="min-w-0 flex-1 truncate text-bakery-ink-600">{l.urunAdi}</span>
                                    <div className="flex items-center gap-1.5">
                                      {kapali && <span className="text-xs text-bakery-ink-400">Kapandı</span>}
                                      {!kapali && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAcikNotlar((prev) => {
                                              const yeni = new Set(prev)
                                              if (yeni.has(l.id)) yeni.delete(l.id)
                                              else yeni.add(l.id)
                                              return yeni
                                            })
                                          }
                                          className={`rounded-lg p-1.5 ${notVar ? 'text-bakery-amber-600' : 'text-bakery-ink-400'} hover:bg-bakery-cream-100`}
                                          aria-label="Not ekle"
                                          title="Not ekle"
                                        >
                                          {notVar ? <MessageSquareText size={16} /> : <MessageSquarePlus size={16} />}
                                        </button>
                                      )}
                                      <input
                                        type="number"
                                        min={0}
                                        disabled={kapali}
                                        value={degerler[l.id] ?? ''}
                                        placeholder="0"
                                        onChange={(e) =>
                                          setDegerler((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))
                                        }
                                        onBlur={(e) => commit(okul.id, l.id, l.productId, Number(e.target.value) || 0)}
                                        className="w-20 rounded-lg border border-bakery-cream-200 bg-bakery-cream-50 px-2 py-1 text-center outline-none focus:border-bakery-amber-500 disabled:bg-bakery-cream-100 disabled:text-bakery-ink-400"
                                      />
                                    </div>
                                  </div>
                                  {notAcik && (
                                    <input
                                      type="text"
                                      disabled={kapali}
                                      value={notlar[l.id] ?? ''}
                                      placeholder="Not ekle… (ör. dilimli, sabaha)"
                                      onChange={(e) => setNotlar((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                      onBlur={(e) => commitNot(okul.id, l.id, l.productId, e.target.value)}
                                      className="w-full rounded-lg border border-dashed border-bakery-cream-200 bg-transparent px-2 py-1 text-xs text-bakery-ink-500 outline-none focus:border-bakery-amber-500 disabled:bg-bakery-cream-100"
                                    />
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  )
}
