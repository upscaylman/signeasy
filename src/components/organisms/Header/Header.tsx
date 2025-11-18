import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Logo from '../../atoms/Logo';
import Navigation from '../Navigation';
import SearchBar from '../../molecules/SearchBar';
import styles from './Header.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface HeaderProps {
  onSearch?: (value: string) => void;
  navItems?: NavItem[];
}

const Header: React.FC<HeaderProps> = ({ onSearch, navItems = [] }) => {
  return (
    <header className={styles.header}>
      <Link to="/dashboard" className={styles.logoLink}>
        <Logo />
      </Link>
      {navItems.length > 0 && <Navigation items={navItems} />}
      {onSearch && <SearchBar onSearch={onSearch} />}
    </header>
  );
};

Header.propTypes = {
  onSearch: PropTypes.func,
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      to: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })
  ),
};

export default Header;

