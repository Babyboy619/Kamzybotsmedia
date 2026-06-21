import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { FloatingActions } from "@/components/layout/FloatingActions";
import { AnnouncementBanner } from "@/components/layout/AnnouncementBanner";
import HomePage from "@/routes/index";
import AboutPage from "@/routes/about";
import BlogPage from "@/routes/blog";
import ContactPage from "@/routes/contact";
import AuthPage from "@/routes/auth";
import DashboardPage from "@/routes/dashboard";
import WalletPage from "@/routes/wallet";
import ProductsPage from "@/routes/products";
import ProductDetailPage from "@/routes/product-detail";
import AdminPage from "@/routes/admin";
import ResetPasswordPage from "@/routes/reset-password";
import OrdersPage from "@/routes/orders";
import TermsPage from "@/routes/terms";
import PrivacyPage from "@/routes/privacy";

export default function App() {
  return (
    <>
      <SiteHeader />
      <AnnouncementBanner />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy-policy" element={<PrivacyPage />} />
        </Routes>
      </main>
      <SiteFooter />
      <FloatingActions />
      <Toaster richColors position="top-right" />
    </>
  );
}
