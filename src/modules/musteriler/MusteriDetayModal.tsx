import { useMemo, useState } from 'react'
import { X, Pencil, Phone, MapPin, Share2, Wallet } from 'lucide-react'
import { useVeresiyeKayitlar } from '../veresiye/data'
import { useVeresiyeOdemeler } from '../veresiye/odemeData'
import { unHesabiAktifMi, cuvalGoster } from '../../shared/unHesabi'
import { musteriHitabi, portalMesajOlustur } from '../../shared/musteriYardimci'
import BakiyeGonderModal from './BakiyeGonderModal'
import DurumRozeti from '../../shared/DurumRozeti'
import { formatTutar } from '../../shared/TutarGoster'
import { isAdmin, useSession } from '../../lib/session'
import { useToast } from '../../shared/Toast'
import type { Musteri } from '../../lib/types'

const MODUL_ETIKETI: Record<string, string> = { siparis: 'Sipariş', veresiye: 'Veresiye', okul: 'Okul' }

interface Props {
  musteri: Musteri
  // Personel için salt-okunur açılır (bkz. veresiye/VeresiyeMusterilerPage) —
  // bu durumda düzenleme butonu gösterilmez.
  onDuzenle?: () => void
  onKapat: () => void
}

/**
 * Salt-okunur müşteri profili — listede isme tıklandığında açılır. Doğrudan
 * düzenleme formuna gitmeden bakiye/iletişim/son hareketleri görmek için.
 */
export default function MusteriDetayModal({ musteri: m, onDuzenle, onKapat }: Props) {
  const session = useSession()
  const toast = useToast()
  const veresiyeSecili = m.moduller.includes('veresiye')
  const unMusterisi = unHesabiAktifMi(m)
  const admin = session.status === 'signed-in' && isAdmin(session.profile)

  // Veresiye'de olmayan müşteri için sorguyu atlamak yerine (hook'lar koşulsuz
  // çağrılmalı) hiçbir dokümanla eşleşmeyecek bir musteriId veriyoruz.
  const filtre = useMemo(
    () => ({ baslangic: null, bitis: null, musteriId: veresiyeSecili ? m.id : '__yok__' }),
    [m.id, veresiyeSecili]
  )
  const { kayitlar } = useVeresiyeKayitlar(filtre)
  const { odemeler } = useVeresiyeOdemeler(filtre)

  const hareketler = useMemo(() => {
    const t = kayitlar.map((k) => ({
      tarih: k.tarih,
      aciklama: `${k.adet}× ${k.urunAdi}`,
      tutar: k.tutar,
      tur: 'kayit' as const,
      durum: k.durum
    }))
    const o = odemeler.map((od) => ({
      tarih: od.tarih,
      aciklama: od.not || 'Ödeme',
      tutar: od.tutar,
      tur: 'odeme' as const,
      durum: null
    }))
    return [...t, ...o].sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 8)
  }, [kayitlar, odemeler])

  function whatsappGonder() {
    const numara = m.telefon.replace(/\D/g, '')
    if (!numara) return
    const mesaj = portalMesajOlustur(m)
    if (!mesaj) {
      toast.hata('Bu müşterinin portal şifresi yok.')
      return
    }
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank')
  }

  const [bakiyeAcik, setBakiyeAcik] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bakery-coffee-900/40 backdrop-blur-sm animate-fade-in md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-bakery-surface shadow-elevated animate-slide-up md:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-bakery-cream-100 bg-bakery-surface/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-bakery-ink-900">{m.ad}</h3>
              {!m.aktif && (
                <span className="rounded-full bg-bakery-cream-100 px-2 py-0.5 text-xs font-medium text-bakery-ink-500">Pasif</span>
              )}
              {m.gecici && (
                <span className="rounded-full bg-bakery-amber-500/10 px-2 py-0.5 text-xs font-medium text-bakery-amber-600">Geçici</span>
              )}
            </div>
            {m.adSoyad && <p className="mt-0.5 text-sm text-bakery-ink-500">{musteriHitabi(m)}</p>}
          </div>
          <button onClick={onKapat} className="rounded-full p-1.5 text-bakery-ink-400 hover:bg-bakery-cream-100" aria-label="Kapat">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {(m.telefon || m.adres) && (
            <div className="space-y-1.5 text-sm text-bakery-ink-600">
              {m.telefon && (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Phone size={14} className="text-bakery-ink-400" />
                    {m.telefon}
                  </span>
                  <div className="flex items-center gap-1.5">
                  {veresiyeSecili && (
                    <button
                      onClick={() => setBakiyeAcik(true)}
                      className="flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20"
                      title="Yalnızca güncel bakiyeyi WhatsApp'tan gönder"
                    >
                      <Wallet size={12} />
                      Bakiye Gönder
                    </button>
                  )}
                  <button
                    onClick={whatsappGonder}
                    className="flex items-center gap-1 rounded-full bg-green-600/10 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20"
                    title="Portal linkini WhatsApp'tan gönder"
                  >
                    <Share2 size={12} />
                    Portal Linki
                  </button>
                  </div>
                </div>
              )}
              {m.adres && (
                <p className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-bakery-ink-400" />
                  {m.adres}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {m.moduller.map((mod) => (
              <span key={mod} className="rounded-full bg-bakery-cream-100 px-2.5 py-1 text-xs font-medium text-bakery-ink-600">
                {MODUL_ETIKETI[mod] ?? mod}
              </span>
            ))}
            {unMusterisi && <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600">Un Hesabı</span>}
          </div>

          {veresiyeSecili && (
            <div className="rounded-2xl bg-bakery-cream-50 p-4">
              {unMusterisi ? (
                <>
                  <p className="text-xs text-bakery-ink-500">Un Bakiyesi</p>
                  <p
                    className={`text-xl font-bold ${
                      (m.unHesabi?.birikenEsdegerAdet ?? 0) > 0 ? 'text-bakery-danger' : 'text-bakery-success'
                    }`}
                  >
                    {cuvalGoster(m.unHesabi?.birikenEsdegerAdet ?? 0, m.unHesabi?.adetPerCuval ?? null)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-bakery-ink-500">Veresiye Bakiyesi</p>
                  <p className={`text-xl font-bold ${m.veresiyeBakiye > 0 ? 'text-bakery-danger' : 'text-bakery-success'}`}>
                    {formatTutar(m.veresiyeBakiye)}
                  </p>
                </>
              )}
            </div>
          )}

          {veresiyeSecili && Object.keys(m.ozelFiyatlar).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-bakery-ink-400">Özel Fiyatlar</p>
              <p className="text-sm text-bakery-ink-600">{Object.keys(m.ozelFiyatlar).length} üründe özel fiyat tanımlı</p>
            </div>
          )}

          {veresiyeSecili && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-bakery-ink-400">Son Hareketler</p>
              {hareketler.length === 0 ? (
                <p className="text-sm text-bakery-ink-400">Henüz hareket yok.</p>
              ) : (
                <ul className="space-y-2">
                  {hareketler.map((h, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 border-b border-bakery-cream-100 pb-2 text-sm last:border-0">
                      <div>
                        <p className="text-bakery-ink-800">{h.aciklama}</p>
                        <p className="text-xs text-bakery-ink-400">{h.tarih}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={h.tur === 'odeme' ? 'font-medium text-bakery-success' : 'font-medium text-bakery-ink-900'}>
                          {h.tur === 'odeme' ? '+ ' : ''}
                          {formatTutar(h.tutar)}
                        </span>
                        {h.durum && <DurumRozeti durum={h.durum} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-bakery-cream-100 bg-bakery-surface/95 px-5 py-3.5 backdrop-blur">
          <button onClick={onKapat} className="rounded-xl px-4 py-2 text-sm font-medium text-bakery-ink-600 hover:bg-bakery-cream-100">
            Kapat
          </button>
          {admin && onDuzenle && (
            <button
              onClick={onDuzenle}
              className="flex items-center gap-1.5 rounded-xl bg-bakery-amber-600 px-4 py-2 text-sm font-medium text-white shadow-soft hover:bg-bakery-amber-500"
            >
              <Pencil size={14} />
              Düzenle
            </button>
          )}
        </div>
      </div>
      {bakiyeAcik && <BakiyeGonderModal musteri={m} onKapat={() => setBakiyeAcik(false)} />}
    </div>
  )
}
