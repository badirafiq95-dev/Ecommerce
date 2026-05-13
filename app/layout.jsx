import "./globals.css";
import { CartProvider } from "../components/CartProvider";
import { CustomerAuthProvider } from "../components/CustomerAuthProvider";
import { PremiumMotion } from "../components/PremiumMotion";

export const metadata = {
  title: "Freaking Collectibles",
  description: "Fast, premium trading card singles, sealed products, graded cards, and supplies."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://accounts.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://apis.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.recaptcha.net" crossOrigin="anonymous" />
      </head>
      <body>
        <CustomerAuthProvider>
          <CartProvider>
            <PremiumMotion />
            {children}
          </CartProvider>
        </CustomerAuthProvider>
      </body>
    </html>
  );
}
