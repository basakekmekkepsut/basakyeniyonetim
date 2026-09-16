import { useMemo, useState } from 'react'
import { Pencil, Plus, RotateCcw, Search, Share2, Trash2 } from 'lucide-react'
import {
  useMusteriler,
  musteriEkle,
  musteriGuncelle,
  musteriCopeTasi,
  musteriGeriYukle,
  musteriKaliciSil
} from './data'
import MusteriFormModal from './MusteriFormModal'
import MusteriDetayModal from './MusteriDetayModal'
import BosDurum from '../../shared/BosDurum'
import ConfirmModal from '../../shared/ConfirmModal'
import { formatTutar } from '../../shared/TutarGoster'
import { useToast } from '../../shared/Toast'
import { musteriHitabi } from '../../shared/musteriYardimci'
import { unHesabiAktifMi, cuvalKisaGoster } from '../../shared/unHesabi'
import { useSession, isAdmin } from '../../lib/session'
import type { Musteri, MusteriGirisi } from '../../lib/types'

export default function MusterilerPage() {
  const session = useSession()
  const [copKutusu, setCopKutusu] = useState(false)
  const { musteriler, yukleniyor, hata } = useMusteriler({ copKutusu })
  const toast = useToast()
  const [arama, setArama] = useState('')
  const [geciciGoster, setGeciciGoster] = useState(false)
  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<Musteri | undefined>()
  const [gosterilen, setGosterilen] = useState<Musteri | undefined>()
  const [copeTasinacak, setCopeTasinacak] = useState<Musteri | undefined>()
  const [kaliciSilinecek, setKaliciSilinecek] = useState<Musteri | undefined>()

  const geciciSayisi = musteriler.filter((m) => m.gecici).length

  const filtrelenmis = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    return musteriler.filter((m) => {
      if (!copKutusu && !geciciGoster && m.gecici) return false
      if (!q) return true
      return m.ad.toLocaleLowerCase('tr-TR').includes(q) || m.telefon.includes(q)
    })
  }, [musteriler, arama, geciciGoster, copKutusu])

  async function handleKaydet(girisi: MusteriGirisi) {
    if (duzenlenen) {
      await musteriGuncelle(duzenlenen.id, girisi)
      toast.basari('Müşteri güncellendi.')
    } else {
      await musteriEkle(girisi)
      toast.basari('Müşteri eklendi.')
    }
  }

  async function handleCopeTasi() {
    if (!copeTasinacak) return
    try {
      await musteriCopeTasi(copeTasinacak)
      toast.basari('Müşteri çöp kutusuna taşındı.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Taşınamadı.')
    } finally {
      setCopeTasinacak(undefined)
    }
  }

  async function handleGeriYukle(m: Musteri) {
    try {
      await musteriGeriYukle(m)
      toast.basari('Müşteri geri yüklendi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Geri yüklenemedi.')
    }
  }

  async function handleKaliciSil() {
    if (!kaliciSilinecek) return
    try {
      await musteriKaliciSil(kaliciSilinecek)
      toast.basari('Müşteri kalıcı olarak silindi.')
    } catch (err) {
      toast.hata(err instanceof Error ? err.message : 'Silinemedi.')
    } finally {
      setKaliciSilinecek(undefined)
    }
  }

  function whatsappGonder(m: Musteri) {
    const numara = m.telefon.replace(/\D/g, '')
    if (!numara) {
      toast.hata('Bu müşterinin telefon numarası kayıtlı değil.')
      return
    }
    const mesaj = `Merhaba ${musteriHitabi(m)},`
    window.open(`https://wa.me/${numara}?text=${encodeURIComponent(mesaj)}`, '_blank')
  }

  const admin = session.status === 'signed-in' && isAdmin(session.profile)

  if (hata) {
    return <p className="rounded-lg bg-bakery-danger/10 px-4 py-3 text-sm text-bakery-danger">{hata}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-bakery-ink-900">Müşteriler</h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bakery-ink-400" />
            <input
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              placeholder="Ad veya telefon ara…"
              className="w-full rounded-xl border border-bakery-cream-200 bg-bakery-surface py-2 pl-9 pr-3 text-sm shadow-soft outline-none focus:border-bakery-amber-500 focus:ring-2 focus:ring-bakery-amber-500/30"
            />
          </div>
          {!copKutusu && (
            <button
              onClick={() => {
                setDuzenlenen(undefined)
                setFormAcik(true)
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-bakery-amber-600 px-3.5 py-2 text-sm font-medium text-white shadow-soft hover:bg-bakery-amber-500 hover:shadow-card"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Yeni Müşteri</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!copKutusu && geciciSayisi > 0 ? (
          <label className="flex w-fit items-center gap-2 text-sm text-bakery-ink-600">
            <input type="checkbox" checked={geciciGoster} onChange={(e) => setGeciciGoster(e.target.checked)} />
            Geçici / Düğün müşterilerini de göster ({geciciSayisi})
          </label>
        ) : (
          <span />
        )}
        <button
          onClick={() => setCopKutusu((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            copKutusu ? 'bg-bakery-danger/10 text-bakery-danger' : 'text-bakery-ink-500 hover:bg-bakery-cream-100'
          }`}
        >
          {copKutusu ? 'Çöp Kutusundan Çık' : 'Çöp Kutusu'}
        </button>
      </div>

      {yukleniyor ? (
        <p className="text-sm text-bakery-ink-500">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <BosDurum
          baslik={copKutusu ? 'Çöp kutusu boş' : musteriler.length === 0 ? 'Henüz müşteri eklenmedi' : 'Aramanızla eşleşen müşteri yok'}
          aciklama={!copKutusu && musteriler.length === 0 ? 'İlk müşteriyi eklemek için yukarıdaki butonu kullanın.' : undefined}
        />
      ) : (
        <div className="divide-y divide-bakery-cream-100 overflow-hidden rounded-2xl bg-bakery-surface shadow-soft">
          {filtrelenmis.map((m) => {
            const unMusterisi = unHesabiAktifMi(m)
            return (
              <div key={m.id} className="flex items-center gap-2 px-3.5 py-2.5 sm:gap-3 sm:px-4">
                <button
                  onClick={() => setGosterilen(m)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-label={`${m.ad} detayını göster`}
                >
                  <span className="min-w-0 truncate font-medium text-bakery-ink-900 underline decoration-bakery-cream-200 decoration-2 underline-offset-2">
                    {m.ad}
                  </span>
                  {!m.aktif && <span className="shrink-0 text-xs text-bakery-ink-400">Pasif</span>}
                  {m.gecici && !copKutusu && <span className="shrink-0 text-xs text-bakery-amber-600">Geçici</span>}
                </button>

                {m.moduller.includes('veresiye') && (
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
                )}

                <div className="flex shrink-0 items-center gap-0.5">
                  {copKutusu ? (
                    <>
                      <button
                        onClick={() => handleGeriYukle(m)}
                        className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                        aria-label="Geri yükle"
                        title="Geri yükle"
                      >
                        <RotateCcw size={16} />
                      </button>
                      {admin && (
                        <button
                          onClick={() => setKaliciSilinecek(m)}
                          className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                          aria-label="Kalıcı sil"
                          title="Kalıcı sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => whatsappGonder(m)}
                        className="rounded-lg p-1.5 text-green-600 hover:bg-green-600/10"
                        aria-label="WhatsApp'tan gönder"
                        title="WhatsApp'tan gönder"
                      >
                        <Share2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setDuzenlenen(m)
                          setFormAcik(true)
                        }}
                        className="rounded-lg p-1.5 text-bakery-ink-500 hover:bg-bakery-cream-100"
                        aria-label="Düzenle"
                        title="Düzenle"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setCopeTasinacak(m)}
                        className="rounded-lg p-1.5 text-bakery-danger hover:bg-bakery-danger/10"
                        aria-label="Çöp kutusuna taşı"
                        title="Çöp kutusuna taşı"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {gosterilen && (
        <MusteriDetayModal
          musteri={gosterilen}
          onKapat={() => setGosterilen(undefined)}
          onDuzenle={() => {
            setDuzenlenen(gosterilen)
            setGosterilen(undefined)
            setFormAcik(true)
          }}
        />
      )}

      {formAcik && (
        <MusteriFormModal
          mevcut={duzenlenen}
          onKaydet={handleKaydet}
          onKapat={() => setFormAcik(false)}
        />
      )}

      {copeTasinacak && (
        <ConfirmModal
          baslik="Çöp kutusuna taşı"
          mesaj={`"${copeTasinacak.ad}" çöp kutusuna taşınacak — kalıcı olarak silinmez, istediğiniz zaman "Çöp Kutusu" görünümünden geri yükleyebilirsiniz.`}
          onayEtiketi="Çöp Kutusuna Taşı"
          tehlikeli
          onOnayla={handleCopeTasi}
          onVazgec={() => setCopeTasinacak(undefined)}
        />
      )}

      {kaliciSilinecek && (
        <ConfirmModal
          baslik="Kalıcı olarak sil"
          mesaj={`"${kaliciSilinecek.ad}" kalıcı olarak silinecek. Bu işlem GERİ ALINAMAZ. Emin misiniz?`}
          onayEtiketi="Kalıcı Sil"
          tehlikeli
          onOnayla={handleKaliciSil}
          onVazgec={() => setKaliciSilinecek(undefined)}
        />
      )}
    </div>
  )
}
