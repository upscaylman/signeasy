import React from 'react';
import Icon from '../Icon';
import styles from './Logo.module.css';

const Logo: React.FC = () => {
  return (
    <div className={styles.logo}>
      <Icon name="PenTool" size="lg" />
      <span className={styles.text}>
        <span className={styles.primary}>SignEase</span>
        <span className={styles.secondary}> by FO Metaux</span>
      </span>
    </div>
  );
};

export default Logo;

