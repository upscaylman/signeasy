import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text' | 'danger' | 'elevated' | 'tonal' | 'gradient' | 'glass';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  withGlow?: boolean;
  withShine?: boolean;
  children: React.ReactNode;
  icon?: React.ElementType;
}

interface RippleStyle {
  x: number;
  y: number;
  size: number;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  size = 'medium',
  isLoading = false,
  withGlow = false,
  withShine = false,
  children,
  icon: Icon,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<RippleStyle[]>([]);

  // Effet Ripple Material Design
  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current || props.disabled || isLoading) return;

    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const newRipple = { x, y, size };
    setRipples([...ripples, newRipple]);

    setTimeout(() => {
      setRipples((prevRipples) => prevRipples.slice(1));
    }, 600);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(e);
    if (props.onClick) {
      props.onClick(e);
    }
  };

  // Classes de base avec tailles tactiles Material Design
  const sizeClasses = {
    small: 'min-h-[40px] px-4 py-2 text-xs gap-1.5',
    medium: 'min-h-[44px] px-6 py-2.5 text-sm gap-2',
    large: 'min-h-[48px] px-8 py-3 text-base gap-2.5',
  };

  const baseClasses = `
    inline-flex items-center justify-center
    font-bold rounded-full
    focus:outline-none focus-ring focus:ring-2 focus:ring-offset-2 focus:ring-offset-background
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100
    whitespace-nowrap
    relative overflow-hidden press-effect
    ${sizeClasses[size]}
  `.trim().replace(/\s+/g, ' ');

  const variantClasses = {
    filled: `
      bg-primary text-onPrimary
      shadow-sm hover:shadow-md disabled:hover:shadow-sm
      focus:ring-primary
      state-layer state-layer-primary
      hover:scale-[1.02] active:scale-[0.98]
      disabled:hover:bg-primary disabled:active:bg-primary
    `,
    elevated: `
      bg-primaryContainer text-onPrimaryContainer
      elevation-1 elevation-hover-3
      focus:ring-primary
      state-layer state-layer-primary
      hover:scale-[1.02] active:scale-[0.98]
    `,
    tonal: `
      bg-secondaryContainer text-onSecondaryContainer
      hover:shadow-sm
      focus:ring-secondary
      state-layer state-layer-secondary
      hover:scale-[1.02] active:scale-[0.98]
    `,
    outlined: `
      bg-surface text-primary
      border-2 border-outline
      hover:bg-primary/5
      focus:ring-primary
      state-layer state-layer-primary
      hover:scale-[1.02] active:scale-[0.98]
    `,
    text: `
      bg-transparent text-primary
      hover:bg-primary/10
      focus:ring-primary
      shadow-none
      state-layer state-layer-primary
    `,
    danger: `
      bg-error text-onError
      shadow-sm hover:shadow-md
      focus:ring-error
      state-layer state-layer-error
      hover:scale-[1.02] active:scale-[0.98]
    `,
    gradient: `
      bg-gradient-primary text-onPrimary
      shadow-sm hover:shadow-lg
      focus:ring-primary
      state-layer
      hover:scale-[1.05] active:scale-[0.95]
      border-0
    `,
    glass: `
      glass-effect-strong text-primary
      border border-outline/20
      focus:ring-primary
      state-layer state-layer-primary
      hover:scale-[1.02] active:scale-[0.98]
    `,
  };

  // Classes conditionnelles pour les effets
  const effectClasses = [
    withGlow && 'glow-primary',
    withShine && 'shine-effect',
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={buttonRef}
      className={`${baseClasses} ${variantClasses[variant]} ${effectClasses} ${props.className || ''}`}
      disabled={isLoading || props.disabled}
      onClick={handleClick}
      aria-busy={isLoading}
      {...props}
    >
      {/* Effet Ripple */}
      {ripples.map((ripple, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}

      {/* Contenu du bouton */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
        ) : (
          <>
            {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
            {children}
          </>
        )}
      </span>
    </button>
  );
};

export default Button;