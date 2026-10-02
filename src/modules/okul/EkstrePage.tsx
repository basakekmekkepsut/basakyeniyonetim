import { useMemo, useState } from 'react'
import { ChevronDown, Lock, LockOpen, Trash2 } from 'lucide-react'
import { useOkullar } from './data'
import { useUrunler } from '../urunler/data'
import { useMusteriler } from '../musteriler/data'
import {
  useAcikOkulOrders,
  useOkulTeslimatlar,
  useOkulKapanislar,
  gunuKapat,
  gununKapanisiniGeriAl,
  okulSiparisSil
} from './orderData'
import { useOkulPayments, okulOdemeEkle, okulOdemeGuncelle, okulOdemeSil } from './paymentData'
import OkulOdemeFormModal from './OkulOdemeFormModal'
import ConfirmModal from '../../shared/ConfirmModal'
import BosDurum from '../../shared/BosDurum'
import TutarGoster from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { isAdmin, useSession } from '../../lib/session'
import type { OkulOrder, OkulPayment, OkulPaymentFormVerisi } from '../../lib/types'

function bugunStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function EkstrePage() {
  const { okullar } = useOkullar()
  const { urunler } = useUrunler()
  const { musteriler } = useMusteriler()
  const { orders: acikOrders } = useAcikOkulOrders()
  const { teslimatlar } = useOkulTeslimatlar()
  const { payments } = useOkulPayments()
  const { kapanislar } = useOkulKapanislar()
  const session = useSession()
  const toast = useToast()

  const [acikTarih, setAcikTarih] = useState<string | null>(null)
  const [acikKapananTarih, setAcikKapananTarih] = useState<string | null>(null)
  const [acikOkulId, setAcikOkulId] = useState<string | null>(null)
  const [kapatilacakTarih, setKapatilacakTarih] = useState<string | null>(null)
  const [kapatiliyor, setKapatiliyor] = useState(false)
  const [acilacakTarih, setAcilacakTarih] = useState<string | null>(null)
  const [aciliyor, setAciliyor] = useState(false)
  const [odemeFormOkul, setOdemeFormOkul] = useState<{ id: string; ad: string } | undefined>()
  const [duzenlenenOdeme, setDuzenlenenOdeme] = useState<OkulPayment | undefined>()
  const [silinecekOdeme, setSilinecekOdeme] = useState<OkulPayment | undefined>()
  const [silinecekSatir, setSilinecekSatir] = useState<OkulOrder | undefined>()

  const beklemedeGunler = useMemo(() => {
    const map = new Map<string, { tarih: string; tutar: number; satirlar: typeof acikOrders }>()
    for (const o of acikOrders) {
      // Silinmiş okul/hat satırları Günü Kapat'ta ücretlendirilmez — tahmine de girmesin.
      const hatVarMi = okullar.find((ok) => ok.id === o.schoolId)?.lines.some((l) => l.id === o.lineId)
      if (!hatVarMi) continue
      // Günü Kapat'ın kullanacağı fiyatla aynı: okulun bağlı Veresiye
      // müşterisinde ürüne özel fiyat varsa o, yoksa liste fiyatı.
      const urun = urunler.find((u) => u.id === o.productId)
      const musteriId = okullar.find((ok) => ok.id === o.schoolId)?.musteriId
      const ozelFiyat = musteriId ? musteriler.find((m) => m.id === musteriId)?.ozelFiyatlar?.[o.productId] : undefined
      const tutar = o.adet * (ozelFiyat ?? urun?.fiyat ?? 0)
      const g = map.get(o.tarih) ?? { tarih: o.tarih, tutar: 0, satirlar: [] }
      g.tutar += tutar
      g.satirlar.push(o)
      map.set(o.tarih, g)
    }
    return [...map.values()].sort((a, b) => a.tarih.localeCompare(b.tarih))
  }, [acikOrders, urunler, okullar, musteriler])

  const sonKapanan = useMemo(
    () => [...kapanislar].filter((k) => k.kapandi).sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 10),
    [kapanislar]
  )

  const okulBakiyeleri = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of teslimatlar) {
      map.set(t.schoolId, (map.get(t.schoolId) ?? 0) + t.tutar)
    }
    for (const p of payments) {
      map.set(p.hedefId, (map.get(p.hedefId) ?? 0) - p.tutar)
    }
    return map
  }, [teslimatlar, payments])

  if (session.status !== 'signed-in') return null
  const admin = isAdmin(session.profile)
  const kullanici = { uid: session.user.uid }

  async function handleKapat(tarih: string) {
    setKapatiliyor(true)
    try {
      const { satirSayisi, veresiyeYansimayan } = await gunuKapat(tarih, okullar, urunler, kullanici)
      toast.basari(
        `${tarih} kapatıldı — ${satirSayisi} satır kesinleşti.` +
          (veresiyeYansimayan > 0 ? ` ${veresiyeYansimayan} satır için bağlı Veresiye müşterisi yok, yansıtılmadı.` : '')
      )
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Kapatılamadı.')
    } finally {
      setKapatiliyor(false)
      setKapatilacakTarih(null)
    }
  }

  async function handleGeriAl(tarih: string) {
    setAciliyor(true)
    try {
      await gununKapanisiniGeriAl(tarih)
      toast.basari(`${tarih} yeniden açıldı — sipariş adetlerini düzeltip tekrar kapatabilirsiniz.`)
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Yeniden açılamadı.')
    } finally {
      setAciliyor(false)
      setAcilacakTarih(null)
    }
  }

  async function handleOdemeKaydet(veri: OkulPaymentFormVerisi) {
    if (duzenlenenOdeme) {
      await okulOdemeGuncelle(duzenlenenOdeme.id, veri)
      toast.basari('Ödeme güncellendi.')
    } else {
      await okulOdemeEkle(veri, kullanici)
      toast.basari('Ödeme eklendi.')
    }
  }

  async function handleOdemeSil() {
    if (!silinecekOdeme) return
    try {
      await okulOdemeSil(silinecekOdeme.id)
      toast.basari('Ödeme silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecekOdeme(undefined)
    }
  }

  async function handleSatirSil() {
    if (!silinecekSatir) return
    try {
      await okulSiparisSil(silinecekSatir.id)
      toast.basari('Satır silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setSilinecekSatir(undefined)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-semibold text-bakery-ink-900">Beklemede</h2>
        {beklemedeGunler.length === 0 ? (
          <BosDurum baslik="Beklemede gün yok" aciklama="Tüm siparişler kapatılmış." />
        ) : (
          <div className="space-y-2">
            {beklemedeGunler.map((g) => {
              const acik = acikTarih === g.tarih
              return (
                <div key={g.tarih} className="rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
                  <button
                    onClick={() => setAcikTarih(acik ? null : g.tarih)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <p className="font-medium text-bakery-ink-900">{g.tarih}</p>
                      <p className="text-xs text-bakery-ink-500">{g.satirlar.length} satır — tahmini tutar</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-bakery-amber-600">
                        <TutarGoster tutar={g.tutar} />
                      </span>
                      <ChevronDown size={18} className={`text-bakery-ink-400 transition ${acik ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {acik && (
                    <div className="border-t border-bakery-cream-100 px-4 py-3">
                      <ul className="mb-3 space-y-1 text-sm text-bakery-ink-600">
                        {g.satirlar.map((s) => {
                          const okul = okullar.find((o) => o.id === s.schoolId)
                          const urun = urunler.find((u) => u.id === s.productId)
                          return (
                            <li key={s.id} className="flex items-center justify-between gap-2">
                              <span>
                                {okul?.ad ?? '—'} — {urun?.ad ?? '—'}
                              </span>
                              <div className="flex shrink-0 items-center gap-2">
                                <span>{s.adet} adet</span>
                                <button
                                  onClick={() => setSilinecekSatir(s)}
                                  className="rounded-lg p-1 text-bakery-danger hover:bg-bakery-danger/10"
                                  aria-label="Satırı sil"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                      {admin &&
                        (g.tarih > bugunStr() ? (
                          <p className="text-xs text-bakery-ink-400">
                            Bu tarih henüz gelmedi — siparişler kesinleşmeden kapatılamaz.
                          </p>
                        ) : (
                          <button
                            onClick={() => setKapatilacakTarih(g.tarih)}
                            className="flex items-center gap-1.5 rounded-lg bg-bakery-coffee-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-bakery-coffee-600"
                          >
                            <Lock size={14} />
                            Günü Kapat
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {admin && sonKapanan.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-bakery-ink-900">Son Kapatılan Günler</h2>
          <div className="space-y-2">
            {sonKapanan.map((k) => {
              const acik = acikKapananTarih === k.tarih
              const gunTeslimatlari = teslimatlar
                .filter((t) => t.tarih === k.tarih)
                .map((t) => ({ ...t, okulAdi: okullar.find((o) => o.id === t.schoolId)?.ad ?? '—' }))
                .sort((a, b) => a.okulAdi.localeCompare(b.okulAdi, 'tr-TR'))
              const gunToplami = gunTeslimatlari.reduce((s, t) => s + t.tutar, 0)
              return (
                <div key={k.tarih} className="rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
                  <button
                    onClick={() => setAcikKapananTarih(acik ? null : k.tarih)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <p className="font-medium text-bakery-ink-900">{k.tarih}</p>
                      <p className="text-xs text-bakery-ink-500">
                        {k.satirSayisi} satır kesinleşti{k.kapatanUid === 'otomatik' ? ' — otomatik kapatıldı' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-bakery-ink-700">
                        <TutarGoster tutar={gunToplami} />
                      </span>
                      <ChevronDown size={18} className={`text-bakery-ink-400 transition ${acik ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {acik && (
                    <div className="border-t border-bakery-cream-100 px-4 py-3">
                      {gunTeslimatlari.length === 0 ? (
                        <p className="mb-3 text-sm text-bakery-ink-400">Bu gün için kesinleşmiş teslimat yok.</p>
                      ) : (
                        <ul className="mb-3 space-y-1 text-sm text-bakery-ink-600">
                          {gunTeslimatlari.map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-2">
                              <span>
                                {t.okulAdi} — {t.urunAdi}
                              </span>
                              <span className="shrink-0 text-right">
                                {t.adet} × ₺{t.birimFiyat.toLocaleString('tr-TR')} ={' '}
                                <span className="font-medium text-bakery-ink-800">
                                  <TutarGoster tutar={t.tutar} />
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => setAcilacakTarih(k.tarih)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-bakery-ink-500 hover:bg-bakery-cream-100"
                      >
                        <LockOpen size={14} />
                        Yeniden Aç
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-bakery-ink-900">Kesinleşmiş Bakiyeler</h2>
        {okullar.length === 0 ? (
          <BosDurum baslik="Henüz okul yok" />
        ) : (
          <div className="space-y-2">
            {okullar.map((okul) => {
              const bakiye = okulBakiyeleri.get(okul.id) ?? 0
              const acik = acikOkulId === okul.id
              const okulTeslimatlari = teslimatlar.filter((t) => t.schoolId === okul.id)
              const okulOdemeleri = payments.filter((p) => p.hedefId === okul.id)

              return (
                <div key={okul.id} className="rounded-xl bg-bakery-surface shadow-sm shadow-bakery-coffee-900/5">
                  <button
                    onClick={() => setAcikOkulId(acik ? null : okul.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-bakery-ink-900">{okul.ad}</p>
                      {okul.okulDegil && (
                        <span className="rounded-full bg-bakery-coffee-100 px-1.5 py-0.5 text-[10px] font-medium text-bakery-ink-500">
                          Okul Dışı
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${bakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                        <TutarGoster tutar={bakiye} />
                      </span>
                      <ChevronDown size={18} className={`text-bakery-ink-400 transition ${acik ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {acik && (
                    <div className="border-t border-bakery-cream-100 px-4 py-3">
                      <button
                        onClick={() => setOdemeFormOkul({ id: okul.id, ad: okul.ad })}
                        className="mb-3 rounded-lg bg-bakery-amber-500/10 px-3 py-1.5 text-xs font-medium text-bakery-amber-600 hover:bg-bakery-amber-500/20"
                      >
                        + Ödeme Ekle
                      </button>
                      {okulTeslimatlari.length === 0 && okulOdemeleri.length === 0 ? (
                        <p className="text-sm text-bakery-ink-400">Henüz kesinleşmiş hareket yok.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {okulTeslimatlari.map((t) => (
                            <li key={t.id} className="flex justify-between text-bakery-ink-600">
                              <span>
                                {t.tarih} — {t.adet}× {t.urunAdi}
                              </span>
                              <span className="text-bakery-danger">
                                <TutarGoster tutar={t.tutar} />
                              </span>
                            </li>
                          ))}
                          {okulOdemeleri.map((p) => (
                            <li key={p.id} className="flex items-center justify-between text-bakery-ink-600">
                              <span>
                                {p.tarih} — Ödeme {p.not && `(${p.not})`}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-bakery-success">
                                  <TutarGoster tutar={p.tutar} />
                                </span>
                                <button onClick={() => setDuzenlenenOdeme(p)} className="text-bakery-ink-400 hover:text-bakery-ink-600">
                                  Düzenle
                                </button>
                                <button onClick={() => setSilinecekOdeme(p)} className="text-bakery-danger hover:text-red-700">
                                  Sil
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {kapatilacakTarih && (
        <ConfirmModal
          baslik="Günü kapat"
          mesaj={`${kapatilacakTarih} tarihini kapatmak istediğinize emin misiniz? Kapatma sonrası bu tarihteki siparişler değiştirilemez ve tutar kesinleşir.`}
          onayEtiketi={kapatiliyor ? 'Kapatılıyor…' : 'Kapat'}
          onOnayla={() => handleKapat(kapatilacakTarih)}
          onVazgec={() => setKapatilacakTarih(null)}
        />
      )}

      {acilacakTarih && (
        <ConfirmModal
          baslik="Günü yeniden aç"
          mesaj={`${acilacakTarih} tarihini yeniden açmak istediğinize emin misiniz? O tarihe ait kesinleşmiş teslimatlar (ve varsa Veresiye'ye yansıyan tutar) geri alınır, sipariş adetleri korunur — düzeltip tekrar kapatabilirsiniz.`}
          onayEtiketi={aciliyor ? 'Açılıyor…' : 'Yeniden Aç'}
          tehlikeli
          onOnayla={() => handleGeriAl(acilacakTarih)}
          onVazgec={() => setAcilacakTarih(null)}
        />
      )}

      {(odemeFormOkul || duzenlenenOdeme) && (
        <OkulOdemeFormModal
          hedefId={duzenlenenOdeme?.hedefId ?? odemeFormOkul!.id}
          hedefAdi={duzenlenenOdeme ? (okullar.find((o) => o.id === duzenlenenOdeme.hedefId)?.ad ?? '') : odemeFormOkul!.ad}
          mevcut={duzenlenenOdeme}
          onKaydet={handleOdemeKaydet}
          onKapat={() => {
            setOdemeFormOkul(undefined)
            setDuzenlenenOdeme(undefined)
          }}
        />
      )}
      {silinecekOdeme && (
        <ConfirmModal
          baslik="Ödemeyi sil"
          mesaj="Bu ödemeyi silmek istediğinize emin misiniz?"
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleOdemeSil}
          onVazgec={() => setSilinecekOdeme(undefined)}
        />
      )}
      {silinecekSatir && (
        <ConfirmModal
          baslik="Satırı sil"
          mesaj="Bu bekleyen sipariş satırını silmek istediğinize emin misiniz?"
          onayEtiketi="Sil"
          tehlikeli
          onOnayla={handleSatirSil}
          onVazgec={() => setSilinecekSatir(undefined)}
        />
      )}
    </div>
  )
}
