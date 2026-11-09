import React from 'react';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';

interface MajorStayMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  variant?: 'gold' | 'terracotta' | 'monochrome' | 'inverted';
}

/**
 * Ícone Emblema MajorStay:
 * Fusão harmónica do "M" monumental com a arquitectura de hotelaria boutique:
 * pórtico com arco clássico, frontão triangular/telhado de suíte e o fecho/portal de boas-vindas dourado.
 */
export function MajorStayMark({
  size = 40,
  className,
  variant = 'gold',
  ...props
}: MajorStayMarkProps) {
  const sizeNum = typeof size === 'number' ? size : parseInt(size, 10) || 40;

  return (
    <svg
      width={sizeNum}
      height={sizeNum}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none transition-transform duration-200', className)}
      aria-label={`${BRAND.name} Emblema`}
      {...props}
    >
      <defs>
        {/* Gradiente Terracota Hotelaria */}
        <linearGradient id="ms-terracotta" x1="12" y1="12" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#BA5A1A" />
          <stop offset="55%" stopColor="#A04812" />
          <stop offset="100%" stopColor="#6E2D07" />
        </linearGradient>

        {/* Gradiente Ouro Champagne */}
        <linearGradient id="ms-gold" x1="20" y1="16" x2="100" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5D59A" />
          <stop offset="30%" stopColor="#E2A648" />
          <stop offset="70%" stopColor="#C97920" />
          <stop offset="100%" stopColor="#9C4E0E" />
        </linearGradient>

        {/* Gradiente de Fundo Nobre para o Cartão */}
        <linearGradient id="ms-badge-bg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2E231D" />
          <stop offset="100%" stopColor="#191310" />
        </linearGradient>

        {/* Sombra Suave de Profundidade */}
        <filter id="ms-shadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1F1510" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Base / Fundo Arredondado Nobre (Squircle) */}
      <rect
        x="6"
        y="6"
        width="108"
        height="108"
        rx="26"
        fill="url(#ms-badge-bg)"
        stroke="url(#ms-gold)"
        strokeWidth="1.5"
        strokeOpacity="0.45"
      />

      <g filter="url(#ms-shadow)">
        {/* Telhado / Frontão Arquitetónico Superior (Linha Nobre de Hotel) */}
        <path
          d="M 28 44 L 60 22 L 92 44"
          stroke="url(#ms-gold)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pilar Esquerdo do "M" */}
        <path
          d="M 32 46 L 32 94"
          stroke="url(#ms-gold)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Pilar Direito do "M" */}
        <path
          d="M 88 46 L 88 94"
          stroke="url(#ms-gold)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Diagonais Centrais do "M" convergindo para o Arco de Entrada */}
        <path
          d="M 32 46 L 60 70 L 88 46"
          stroke="url(#ms-terracotta)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Arco do Pórtico de Entrada (Hotel Portal / Archway) */}
        <path
          d="M 46 94 L 46 76 C 46 68 52 62 60 62 C 68 62 74 68 74 76 L 74 94"
          stroke="url(#ms-gold)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Sol / Medalhão Central de Boas-Vindas (Chave / Luminária de Recepção) */}
        <circle
          cx="60"
          cy="40"
          r="4.5"
          fill="url(#ms-gold)"
        />

        {/* Linha de Base / Soleira de Mármore */}
        <path
          d="M 24 94 L 96 94"
          stroke="url(#ms-gold)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />
      </g>
    </svg>
  );
}

interface MajorStayLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  horizontal?: boolean;
}

/**
 * Logótipo Completo MajorStay:
 * Marca visual com tipografia de alta classe, adaptável para modo claro/escuro
 * e com hierarquia nítida (MAJOR em tom neutro refinado, STAY em terracota/ouro).
 */
export function MajorStayLogo({
  size = 'md',
  showTagline = false,
  className,
  horizontal = true,
}: MajorStayLogoProps) {
  const markSize = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 60,
  }[size];

  const titleSize = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }[size];

  const badgeSize = {
    sm: 'text-[9px] tracking-widest',
    md: 'text-[10px] tracking-widest',
    lg: 'text-xs tracking-widest',
    xl: 'text-sm tracking-widest',
  }[size];

  return (
    <div
      className={cn(
        'flex items-center gap-3 select-none',
        !horizontal && 'flex-col text-center',
        className
      )}
    >
      <MajorStayMark size={markSize} />
      <div className={cn('flex flex-col justify-center leading-none', !horizontal && 'items-center mt-1')}>
        <div className={cn('font-headline font-extrabold tracking-tight flex items-baseline', titleSize)}>
          <span className="text-[#251D18] dark:text-[#F5EFEB] tracking-[0.06em]">MAJOR</span>
          <span className="bg-gradient-to-r from-[#BA5A1A] via-[#DF9E42] to-[#BA5A1A] bg-clip-text text-transparent ml-1 font-black">
            STAY
          </span>
        </div>
        {showTagline && (
          <span className={cn('uppercase font-semibold text-[#8B7E74] dark:text-[#B5A89E] mt-1', badgeSize)}>
            Hospitality Suite
          </span>
        )}
      </div>
    </div>
  );
}
