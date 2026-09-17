const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

/** "2026-09-19" -> "2026-09-19 Cumartesi" — Telegram/WhatsApp/push mesajlarındaki
 * tarih başlıklarında hangi güne denk geldiğini görmek için kullanılır. */
export function tarihGunAdiIle(tarihStr: string): string {
  const [y, m, d] = tarihStr.split('-').map(Number)
  const gunIndex = new Date(y, m - 1, d).getDay()
  return `${tarihStr} ${GUN_ADLARI[gunIndex]}`
}
