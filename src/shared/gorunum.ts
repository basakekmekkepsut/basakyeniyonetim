// Tema (açık/koyu) ve yazı boyutu tercihleri — tarayıcıya kalıcı kaydedilir,
// index.css'teki CSS custom property'leri (:root / :root[data-tema='koyu'])
// üzerinden TÜM uygulamaya (hem ana uygulama hem müşteri portalı) yansır.

export type Tema = 'acik' | 'koyu'
export type YaziBoyutu = 'normal' | 'buyuk' | 'ekstra'

const TEMA_KEY = 'basak-tema'
const YAZI_KEY = 'basak-yazi-boyutu'
const YAZI_SIRASI: YaziBoyutu[] = ['normal', 'buyuk', 'ekstra']
const YAZI_OLCEKLERI: Record<YaziBoyutu, string> = {
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
  const boyut: YaziBoyutu = kayitli === 'buyuk' || kayitli === 'ekstra' ? kayitli : 'normal'
  yaziBoyutuUygula(boyut)
  return boyut
}

/** "Aa" butonuna her basışta normal → büyük → ekstra → normal döngüsünde ilerler. */
export function yaziBoyutuDegistir(mevcut: YaziBoyutu): YaziBoyutu {
  const index = YAZI_SIRASI.indexOf(mevcut)
  const yeni = YAZI_SIRASI[(index + 1) % YAZI_SIRASI.length]
  guvenliYaz(YAZI_KEY, yeni)
  yaziBoyutuUygula(yeni)
  return yeni
}
