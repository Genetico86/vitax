import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Ce fichier est utilisé uniquement pour la version Web.
 * Il configure le mode Standalone / PWA (Plein écran sans barre d'adresse sur iPhone et Android).
 */
export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, user-scalable=no"
        />

        {/* Configuration Apple iOS Web App (PWA) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Vitax" />
        <link rel="apple-touch-icon" href="/icon.png" />

        {/* Configuration Android & Universelle */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF5A1F" />
        <meta name="application-name" content="Vitax" />
        <meta name="mobile-web-app-capable" content="yes" />

        <title>Vitax - Musculation & Fitness</title>

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: pwaStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const pwaStyles = `
html, body {
  background-color: #0D1117;
  color: #FFFFFF;
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
#root {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
`;
