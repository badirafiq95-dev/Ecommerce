import "./globals.css";
import { CartProvider } from "../components/CartProvider";
import { CustomerAuthProvider } from "../components/CustomerAuthProvider";
import { PremiumMotion } from "../components/PremiumMotion";

export const metadata = {
  title: "Mint Lane Cards",
  description: "Fast, premium trading card singles, sealed products, graded cards, and supplies."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
