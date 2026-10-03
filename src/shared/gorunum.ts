// Tema (açık/koyu) ve yazı boyutu tercihleri — tarayıcıya kalıcı kaydedilir,
// index.css'teki CSS custom property'leri (:root / :root[data-tema='koyu'])
// üzerinden TÜM uygulamaya (hem ana uygulama hem müşteri portalı) yansır.

export type Tema = 'acik' | 'koyu'
export type YaziBoyutu = 'cok_kucuk' | 'kucuk' | 'normal' | 'buyuk' | 'ekstra'

const TEMA_KEY = 'basak-tema'
const YAZI_KEY = 'basak-yazi-boyutu'
export const YAZI_SIRASI: YaziBoyutu[] = ['cok_kucuk', 'kucuk', 'normal', 'buyuk', 'ekstra']
export const YAZI_ETIKETLERI: Record<YaziBoyutu, string> = {
  cok_kucuk: 'Çok Küçük',
  kucuk: 'Küçük',
  normal: 'Normal',
  buyuk: 'Büyük',
  ekstra: 'Ekstra Büyük'
}
const YAZI_OLCEKLERI: Record<YaziBoyutu, string> = {
  cok_kucuk: '81.25%',
  kucuk: '90%',
  normal: '100%',
  buyuk: '112.5%',
  ekstra: '125%'
}

// localStorage bazı ortamlarda (gizli sekme, depolama engelli) erişilemez
// olabilir — bu durumda sessizce sadece o oturum için varsayılana düşülür.
function guvenliOku(anahtar: string): string | null {
  try {
    return localStorage.getItem(anahtar)
  } catch {
    return null
  }
}
function guvenliYaz(anahtar: string, deger: string) {
  try {
    localStorage.setItem(anahtar, deger)
  } catch {
    // yoksay
  }
}

export function temaUygula(tema: Tema) {
  document.documentElement.setAttribute('data-tema', tema)
}

/** Sayfa ilk yüklenirken ÇAĞRILMALI (React render'ından önce) — yanlış temanın
 * bir anlığına gözükmesini (flash) önler. */
export function temaBaslat(): Tema {
  const kayitli = guvenliOku(TEMA_KEY)
  const tema: Tema =
    kayitli === 'koyu' || kayitli === 'acik'
      ? kayitli
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'koyu'
        : 'acik'
  temaUygula(tema)
  return tema
}

export function temaDegistir(mevcut: Tema): Tema {
  const yeni: Tema = mevcut === 'koyu' ? 'acik' : 'koyu'
  guvenliYaz(TEMA_KEY, yeni)
  temaUygula(yeni)
  return yeni
}

export function yaziBoyutuUygula(boyut: YaziBoyutu) {
  document.documentElement.style.fontSize = YAZI_OLCEKLERI[boyut]
}

export function yaziBoyutuBaslat(): YaziBoyutu {
  const kayitli = guvenliOku(YAZI_KEY)
  const boyut: YaziBoyutu = YAZI_SIRASI.includes(kayitli as YaziBoyutu) ? (kayitli as YaziBoyutu) : 'normal'
  yaziBoyutuUygula(boyut)
  return boyut
}

/** "Aa" menüsünden seçilen boyutu uygular ve kalıcı kaydeder. */
export function yaziBoyutuSec(yeni: YaziBoyutu): YaziBoyutu {
  guvenliYaz(YAZI_KEY, yeni)
  yaziBoyutuUygula(yeni)
  return yeni
}
