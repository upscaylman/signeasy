import React from 'react';
import { Facebook, Twitter, Linkedin, Youtube, Instagram } from 'lucide-react';
import Tooltip from './Tooltip';

const Footer: React.FC = () => {
  const footerLinks = [
    { name: 'A propos de nous', href: 'https://www.fo-metaux.org/pages/organisation-fo-metaux' },
    { name: 'Contact', href: '#' },
    { name: 'Mentions Légales', href: 'https://www.fo-metaux.org/mentions-legales' },
    { name: 'Politique de confidentialité', href: 'https://www.fo-metaux.org/politique-de-confidentialite' },
    { name: 'Site internet', href: 'https://www.fo-metaux.fr/' },
  ];

  const socialLinks = [
    { name: 'Facebook', href: 'https://www.facebook.com/federationfometaux', icon: Facebook },
    { name: 'X', href: 'https://x.com/fedefometaux', icon: Twitter },
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/f%C3%A9d%C3%A9ration-fo-de-la-m%C3%A9tallurgie/', icon: Linkedin },
    { name: 'YouTube', href: 'https://www.youtube.com/user/fometauxtpe', icon: Youtube },
    { name: 'Instagram', href: 'https://www.instagram.com/fometallurgie/', icon: Instagram },
  ];

  return (
    <footer className="bg-inverseSurface text-inverseOnSurface">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold">SignEase by FO Metaux</h3>
            <p className="text-sm text-inverseOnSurface/80">Votre solution de signature électronique.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="text-sm hover:underline"
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {link.name}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-8 pt-6 border-t border-inverseOnSurface/20">
          <div className="flex flex-col items-center gap-4">
            {/* Réseaux sociaux */}
            <div className="flex items-center gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <Tooltip key={social.name} content={`Suivez-nous sur ${social.name}`} position="top">
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-inverseOnSurface/70 hover:text-inverseOnSurface transition-colors duration-200"
                      aria-label={social.name}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  </Tooltip>
                );
              })}
            </div>
            {/* Copyright */}
            <p className="text-xs text-inverseOnSurface/60">
              Site réalisé par FO Métaux © {new Date().getFullYear()} FO Métaux. Tous droits réservés.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
