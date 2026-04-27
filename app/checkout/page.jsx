import { CartDrawer } from "../../components/CartDrawer";
import { CheckoutForm } from "../../components/CheckoutForm";
import { Header } from "../../components/Header";

export const metadata = {
  title: "Checkout | Mint Lane Cards"
};

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <CartDrawer />
      <CheckoutForm />
    </>
  );
}
