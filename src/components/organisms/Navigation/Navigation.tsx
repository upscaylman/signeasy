import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import Icon from '../../atoms/Icon';
import styles from './Navigation.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavigationProps {
  items: NavItem[];
}

const Navigation: React.FC<NavigationProps> = ({ items }) => {
  return (
    <nav className={styles.navigation}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.active : ''}`
          }
        >
          <Icon name={item.icon as any} size="md" />
          <span className={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

Navigation.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      to: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default Navigation;

