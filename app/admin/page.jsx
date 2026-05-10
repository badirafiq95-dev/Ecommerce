import { AdminPanel } from "../../components/AdminPanel";
import { CartDrawer } from "../../components/CartDrawer";
import { Header } from "../../components/Header";

export const metadata = {
  title: "Admin Login | Freaking Collectibles"
};

export default function AdminPage() {
  return (
    <>
      <Header />
      <CartDrawer />
      <AdminPanel />
    </>
  );
}
