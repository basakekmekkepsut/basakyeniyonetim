const formatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatTutar(tutar: number): string {
  return formatter.format(tutar)
}

export default function TutarGoster({ tutar, className }: { tutar: number; className?: string }) {
  return <span className={className}>{formatTutar(tutar)}</span>
}
