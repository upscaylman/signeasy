import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text' | 'danger';
  isLoading?: boolean;
  children: React.ReactNode;
  icon?: React.ElementType;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'filled',
  isLoading = false,
  children,
  icon: Icon,
  ...props
}) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none whitespace-nowrap";

  const variantClasses = {
    filled: 'bg-primary text-onPrimary hover:shadow-md focus:ring-primary',
    outlined: 'bg-surface text-primary border border-outline hover:bg-primary/10 focus:ring-primary',
    text: 'bg-transparent text-primary hover:bg-primary/10 focus:ring-primary shadow-none',
    danger: 'bg-error text-onError hover:shadow-md focus:ring-error',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${props.className || ''}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
      ) : (
        <>
          {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
          <span className="flex-shrink-0">{children}</span>
        </>
      )}
    </button>
  );
};

export default Button;