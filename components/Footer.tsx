import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import React from "react";
import packageJson from "../package.json";
import { CookieSettingsButton } from "./CookieBanner";
import Tooltip from "./Tooltip";

const Footer: React.FC = () => {
  const footerLinks = [
    {
      name: "A propos de nous",
      href: "https://www.fo-metaux.org/pages/organisation-fo-metaux",
    },
    { name: "Contact", href: "https://www.fo-metaux.fr/nous-contacter" },
    {
      name: "Mentions Légales",
      href: "https://www.fo-metaux.org/mentions-legales",
    },
    {
      name: "Politique de confidentialité",
      href: "https://www.fo-metaux.org/politique-de-confidentialite",
    },
    { name: "fo-metaux.fr", href: "https://www.fo-metaux.fr/" },
  ];

  const socialLinks = [
    {
      name: "Facebook",
      href: "https://www.facebook.com/federationfometaux",
      icon: Facebook,
    },
    { name: "X", href: "https://x.com/fedefometaux", icon: Twitter },
    {
      name: "LinkedIn",
      href: "https://www.linkedin.com/company/f%C3%A9d%C3%A9ration-fo-de-la-m%C3%A9tallurgie/",
      icon: Linkedin,
    },
    {
      name: "YouTube",
      href: "https://www.youtube.com/user/fometauxtpe",
      icon: Youtube,
    },
    {
      name: "Instagram",
      href: "https://www.instagram.com/fometallurgie/",
      icon: Instagram,
    },
  ];

  return (
    <footer
      className="relative overflow-hidden"
      style={{ backgroundColor: "rgb(69, 58, 56)" }}
    >
      {/* Effet de mesh gradient décoratif animé */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-white/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold text-white">
              SignEase by FO Metaux
            </h3>
            <p className="text-sm text-white/80">
              Votre solution de signature électronique.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {footerLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm text-white/90 underline"
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
        </div>
        <div className="divider-gradient my-8"></div>
        <div className="flex flex-col items-center gap-4">
          {/* Réseaux sociaux */}
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Tooltip
                  key={social.name}
                  content={`Suivez-nous sur ${social.name}`}
                  position="top"
                >
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 min-h-[40px] min-w-[40px] p-2 rounded-full"
                    aria-label={social.name}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                </Tooltip>
              );
            })}
          </div>
          {/* Copyright et paramètres cookies */}
          <div className="flex flex-col items-center gap-2">
            <CookieSettingsButton className="text-white/70 hover:text-white" />
            <p className="text-xs text-white/70">
              Site réalisé par FO Métaux © {new Date().getFullYear()} FO Métaux.
              Tous droits réservés.
              <span className="ml-2 font-bold text-white">
                Version {packageJson.version}
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
