import React from 'react';
import PropTypes from 'prop-types';
import styles from './Card.module.css';

interface CardProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

const Card: React.FC<CardProps> = ({
  title,
  description,
  children,
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
    >
      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
  );
};

Card.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

export default Card;

