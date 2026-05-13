import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>Rrëy: JÏT</title>
        <ScrollViewStyleReset />
        {/* SVG favicon — scales crisply at any resolution */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Fallback .ico for older browsers */}
        <link rel="alternate icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
