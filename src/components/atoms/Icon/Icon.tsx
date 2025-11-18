import React from 'react';
import PropTypes from 'prop-types';
import * as LucideIcons from 'lucide-react';
import styles from './Icon.module.css';

interface IconProps {
  name: keyof typeof LucideIcons;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
}

const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  className = '',
  color,
}) => {
  const IconComponent = LucideIcons[name] as React.ComponentType<{
    className?: string;
    size?: number;
    color?: string;
  }>;

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const sizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <IconComponent
      className={`${styles.icon} ${styles[size]} ${className}`}
      size={sizeMap[size]}
      color={color}
    />
  );
};

Icon.propTypes = {
  name: PropTypes.string.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  color: PropTypes.string,
};

export default Icon;

