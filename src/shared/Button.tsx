import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Boyut = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  boyut?: Boyut
}

const VARYANT_SINIFI: Record<Variant, string> = {
  primary: 'bg-bakery-amber-600 text-white shadow-soft hover:bg-bakery-amber-500 hover:shadow-card disabled:hover:bg-bakery-amber-600',
  secondary: 'bg-bakery-cream-100 text-bakery-coffee-700 hover:bg-bakery-cream-200',
  danger: 'bg-bakery-danger/10 text-bakery-danger hover:bg-bakery-danger hover:text-white',
  ghost: 'text-bakery-coffee-600 hover:bg-bakery-cream-100'
}

const BOYUT_SINIFI: Record<Boyut, string> = {
  sm: 'gap-1 rounded-lg px-2.5 py-1.5 text-xs',
  md: 'gap-1.5 rounded-xl px-4 py-2.5 text-sm'
}

/**
 * Uygulama genelinde tutarlı, modern buton görünümü — yeni yazılan ekranlarda
 * ham className yerine bunu kullanın. Mevcut ekranlardaki inline butonlar
 * (geriye dönük uyumluluk için) dokunulmadan kalabilir.
 */
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', boyut = 'md', className = '', children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARYANT_SINIFI[variant]} ${BOYUT_SINIFI[boyut]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
