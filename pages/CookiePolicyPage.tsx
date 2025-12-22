import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Shield, BarChart3, Settings2, Megaphone, ExternalLink } from 'lucide-react';
import Button from '../components/Button';
import { CookieSettingsButton } from '../components/CookieBanner';

const CookiePolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard">
            <Button variant="text" icon={ArrowLeft} size="small">
              Retour au tableau de bord
            </Button>
          </Link>
        </div>

        {/* Titre */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-primary/10 mb-4">
            <Cookie className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-onSurface mb-2">Politique des Cookies</h1>
          <p className="text-onSurfaceVariant">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        {/* Contenu */}
        <div className="space-y-8 text-onSurface">
          {/* Introduction */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-onSurfaceVariant leading-relaxed">
              SignEase, édité par FO Métaux, utilise des cookies et technologies similaires pour améliorer 
              votre expérience sur notre plateforme de signature électronique. Cette politique explique 
              ce que sont les cookies, comment nous les utilisons et quelles sont vos options.
            </p>
          </section>

          {/* Qu'est-ce qu'un cookie */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-4">2. Qu'est-ce qu'un cookie ?</h2>
            <p className="text-onSurfaceVariant leading-relaxed mb-4">
              Un cookie est un petit fichier texte stocké sur votre appareil (ordinateur, tablette, smartphone) 
              lorsque vous visitez un site web. Les cookies permettent au site de mémoriser vos actions et 
              préférences (comme la connexion, la langue, la taille de police et autres préférences d'affichage) 
              pendant une période donnée, pour que vous n'ayez pas à les indiquer à chaque visite.
            </p>
            <div className="bg-surfaceVariant/30 rounded-xl p-4">
              <p className="text-sm text-onSurfaceVariant">
                <strong>Note :</strong> Les cookies ne peuvent pas endommager votre appareil et ne contiennent 
                pas de virus. Ils ne peuvent pas accéder aux autres fichiers de votre appareil.
              </p>
            </div>
          </section>

          {/* Types de cookies */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-6">3. Types de cookies que nous utilisons</h2>
            
            <div className="space-y-6">
              {/* Cookies essentiels */}
              <div className="border border-outline/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Cookies essentiels</h3>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Toujours actifs</span>
                  </div>
                </div>
                <p className="text-onSurfaceVariant text-sm mb-3">
                  Ces cookies sont nécessaires au fonctionnement de SignEase. Sans eux, la plateforme ne 
                  pourrait pas fonctionner correctement. Ils ne peuvent pas être désactivés.
                </p>
                <ul className="text-sm text-onSurfaceVariant list-disc list-inside space-y-1">
                  <li>Maintien de votre session de connexion</li>
                  <li>Mémorisation de vos préférences de cookies</li>
                  <li>Sécurité et protection contre la fraude</li>
                </ul>
              </div>

              {/* Cookies fonctionnels */}
              <div className="border border-outline/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Settings2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold">Cookies fonctionnels</h3>
                </div>
                <p className="text-onSurfaceVariant text-sm mb-3">
                  Ces cookies permettent d'améliorer les fonctionnalités et la personnalisation de SignEase.
                </p>
                <ul className="text-sm text-onSurfaceVariant list-disc list-inside space-y-1">
                  <li>Mémorisation de votre thème préféré (clair/sombre)</li>
                  <li>Langue d'affichage préférée</li>
                  <li>Accès rapide aux documents récents</li>
                </ul>
              </div>

              {/* Cookies analytiques */}
              <div className="border border-outline/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold">Cookies analytiques</h3>
                </div>
                <p className="text-onSurfaceVariant text-sm mb-3">
                  Ces cookies nous aident à comprendre comment les visiteurs utilisent SignEase pour l'améliorer.
                </p>
                <ul className="text-sm text-onSurfaceVariant list-disc list-inside space-y-1">
                  <li>Nombre de visiteurs et pages consultées</li>
                  <li>Temps passé sur chaque page</li>
                  <li>Sources de trafic (comment vous êtes arrivé sur le site)</li>
                </ul>
              </div>

              {/* Cookies marketing */}
              <div className="border border-outline/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Megaphone className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold">Cookies marketing</h3>
                </div>
                <p className="text-onSurfaceVariant text-sm mb-3">
                  Ces cookies sont utilisés pour mesurer l'efficacité de nos campagnes publicitaires.
                </p>
                <ul className="text-sm text-onSurfaceVariant list-disc list-inside space-y-1">
                  <li>Suivi des conversions publicitaires</li>
                  <li>Personnalisation des publicités sur d'autres sites</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Gestion des cookies */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-4">4. Comment gérer vos cookies ?</h2>
            <p className="text-onSurfaceVariant leading-relaxed mb-4">
              Vous pouvez à tout moment modifier vos préférences de cookies en utilisant notre outil de gestion :
            </p>
            <div className="flex justify-center mb-6">
              <CookieSettingsButton className="bg-primary/10 px-4 py-2 rounded-xl hover:bg-primary/20" />
            </div>
            <p className="text-onSurfaceVariant leading-relaxed mb-4">
              Vous pouvez également contrôler les cookies via les paramètres de votre navigateur :
            </p>
            <ul className="space-y-2">
              {[
                { name: 'Google Chrome', url: 'https://support.google.com/chrome/answer/95647' },
                { name: 'Mozilla Firefox', url: 'https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent' },
                { name: 'Safari', url: 'https://support.apple.com/fr-fr/guide/safari/sfri11471/mac' },
                { name: 'Microsoft Edge', url: 'https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09' },
              ].map((browser) => (
                <li key={browser.name}>
                  <a
                    href={browser.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    {browser.name}
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          {/* Durée de conservation */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-4">5. Durée de conservation</h2>
            <p className="text-onSurfaceVariant leading-relaxed mb-4">
              La durée de conservation des cookies varie selon leur type :
            </p>
            <div className="bg-surfaceVariant/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline/10">
                    <th className="text-left p-3 font-medium text-onSurface">Type de cookie</th>
                    <th className="text-left p-3 font-medium text-onSurface">Durée</th>
                  </tr>
                </thead>
                <tbody className="text-onSurfaceVariant">
                  <tr className="border-b border-outline/5">
                    <td className="p-3">Cookies de session</td>
                    <td className="p-3">Supprimés à la fermeture du navigateur</td>
                  </tr>
                  <tr className="border-b border-outline/5">
                    <td className="p-3">Consentement cookies</td>
                    <td className="p-3">1 an</td>
                  </tr>
                  <tr className="border-b border-outline/5">
                    <td className="p-3">Préférences utilisateur</td>
                    <td className="p-3">1 an</td>
                  </tr>
                  <tr>
                    <td className="p-3">Cookies analytiques (Google)</td>
                    <td className="p-3">2 ans maximum</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Vos droits */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-4">6. Vos droits</h2>
            <p className="text-onSurfaceVariant leading-relaxed mb-4">
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
            </p>
            <ul className="text-onSurfaceVariant list-disc list-inside space-y-2">
              <li>Droit d'accès à vos données personnelles</li>
              <li>Droit de rectification des données inexactes</li>
              <li>Droit à l'effacement (« droit à l'oubli »)</li>
              <li>Droit à la limitation du traitement</li>
              <li>Droit à la portabilité des données</li>
              <li>Droit d'opposition au traitement</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="bg-surface rounded-2xl p-6 elevation-1">
            <h2 className="text-xl font-semibold mb-4">7. Contact</h2>
            <p className="text-onSurfaceVariant leading-relaxed">
              Pour toute question concernant cette politique des cookies ou pour exercer vos droits, 
              vous pouvez nous contacter à l'adresse suivante :
            </p>
            <div className="mt-4 p-4 bg-surfaceVariant/30 rounded-xl">
              <p className="font-medium text-onSurface">FO Métaux</p>
              <p className="text-onSurfaceVariant">9 rue Baudoin, 75013 Paris</p>
              <a href="mailto:contact@fo-metaux.fr" className="text-primary hover:underline">
                contact@fo-metaux.fr
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicyPage;
