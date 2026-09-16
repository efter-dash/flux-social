import type { SVGProps } from 'react'

export interface FluxLogoProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  filled?: boolean
}

/**
 * Official FLUX brand logo — 8-pointed starflare with needle cardinal spikes and flared diagonal points.
 */
export function FluxLogo({ size = 24, className = '', filled = true, ...props }: FluxLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? 0 : 2}
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path d="M 50 1 C 50.2 34.0, 58.0 41.0, 70.0 30.0 C 59.0 42.0, 66.0 49.8, 99.0 50.0 C 66.0 50.2, 59.0 58.0, 70.0 70.0 C 58.0 59.0, 50.2 66.0, 50.0 99.0 C 49.8 66.0, 42.0 59.0, 30.0 70.0 C 41.0 58.0, 34.0 50.2, 1.0 50.0 C 34.0 49.8, 41.0 42.0, 30.0 30.0 C 42.0 41.0, 49.8 34.0, 50.0 1.0 Z" />
    </svg>
  )
}
