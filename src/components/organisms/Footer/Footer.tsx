import PropTypes from "prop-types";
import React from "react";
import styles from "./Footer.module.css";

interface FooterLink {
  name: string;
  href: string;
}

interface FooterProps {
  links?: FooterLink[];
  copyright?: string;
}

const Footer: React.FC<FooterProps> = ({
  links = [],
  copyright = `© ${new Date().getFullYear()} FO Métaux. Tous droits réservés.`,
}) => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.brand}>
            <h3 className={styles.title}>SignEase by FO Metaux</h3>
            <p className={styles.description}>
              Votre solution de signature électronique.
            </p>
          </div>
          {links.length > 0 && (
            <nav className={styles.nav}>
              {links.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className={styles.link}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={
                    link.href.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                >
                  {link.name}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div className={styles.divider}></div>
        <p className={styles.copyright}>{copyright}</p>
      </div>
    </footer>
  );
};

Footer.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
    }).isRequired
  ) as any,
  copyright: PropTypes.string,
};

export default Footer;
