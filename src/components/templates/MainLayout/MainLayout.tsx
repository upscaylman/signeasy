import React from 'react';
import PropTypes from 'prop-types';
import Header from '../../organisms/Header';
import Footer from '../../organisms/Footer';
import styles from './MainLayout.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface MainLayoutProps {
  children: React.ReactNode;
  navItems?: NavItem[];
  onSearch?: (value: string) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  navItems = [],
  onSearch,
}) => {
  return (
    <div className={styles.layout}>
      <Header navItems={navItems} onSearch={onSearch} />
      <main className={styles.content}>{children}</main>
      <Footer />
    </div>
  );
};

MainLayout.propTypes = {
  children: PropTypes.node.isRequired,
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      to: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })
  ),
  onSearch: PropTypes.func,
};

export default MainLayout;

