// Okul modülünden veresiyeye yansıyan kayıtlarda urunAdi, kaynak izlenebilirliği
// için "{okulAdı} — {ürünAdı}" biçiminde saklanır (bkz. okul/orderData.ts
// gunuKapat). Birden çok okul aynı veresiye hesabına (ör. "Yeniçeri") bağlıysa
// bu, aynı ürünün okul başına ayrı satırlar olarak görünmesine yol açar — ürün
// bazlı TOPLAM alırken gerçek ürün adını (son " — " sonrası) çıkarmak gerekir.
export function anaUrunAdi(urunAdi: string): string {
  const index = urunAdi.lastIndexOf(' — ')
  return index === -1 ? urunAdi : urunAdi.slice(index + 3)
}
