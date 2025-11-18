import React from 'react';
import PropTypes from 'prop-types';
import styles from './LoadingIndicator.module.css';

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'tertiary';
  className?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
}) => {
  return (
    <div
      className={`${styles.loadingIndicator} ${styles[size]} ${styles[variant]} ${className}`}
      role="progressbar"
      aria-label="Chargement en cours"
      aria-busy="true"
      style={{ minWidth: size === 'sm' ? '24px' : size === 'md' ? '40px' : '56px', minHeight: size === 'sm' ? '24px' : size === 'md' ? '40px' : '56px' }}
    >
      <svg
        className={styles.spinner}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <circle
          className={styles.active}
          cx="24"
          cy="24"
          r="20"
          fill="none"
          style={{ 
            stroke: variant === 'primary' ? 'var(--color-primary, #b71c1c)' : variant === 'secondary' ? 'var(--color-secondary, #775651)' : 'var(--color-tertiary, #705c2e)',
            strokeWidth: size === 'sm' ? '3' : size === 'md' ? '4' : '4.5'
          }}
        />
      </svg>
    </div>
  );
};

LoadingIndicator.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary']),
  className: PropTypes.string,
};

export default LoadingIndicator;

