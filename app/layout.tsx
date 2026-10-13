import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { IdentitySync } from "@/components/providers/identity-sync";
import { SessionProvider } from "@/components/providers/session-provider";
import { currentIdentity } from "@/lib/auth/identity";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Leafwright",
    template: "%s · Leafwright",
  },
  description: "Houseplants, planters, and plant-care goods from independent nurseries.",
};

/**
 * Loads the agent script and starts an anonymous session before the app hydrates. It runs once
 * per page load; `IdentitySync` attaches the signed-in user afterwards.
 */
const AGENT_SCRIPT = `(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track', 'trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('b2777e59-90ce-461d-a0a7-92968688d4a1');
pendo.initialize({ visitor: { id: '' } });`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AGENT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SessionProvider>{children}</SessionProvider>
        <Suspense fallback={null}>
          <SignedInIdentity />
        </Suspense>
      </body>
    </html>
  );
}

async function SignedInIdentity() {
  const identity = await currentIdentity();
  return identity ? <IdentitySync identity={identity} /> : null;
}
