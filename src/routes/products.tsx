<<<<<<< HEAD
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Facebook, Instagram, Twitter, Youtube, Linkedin, Music2, Send, MessageCircle, Globe, ShoppingBag, Loader2, ShoppingCart, X, Copy, CheckCheck, PackageCheck, AlertCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/sections/PageHero";
import { categories as staticCategories } from "@/data/site";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { assignCredentialToOrder } from "@/lib/api/delivery";
import { PaystackTopUpDialog } from "@/components/wallet/PaystackTopUpDialog";

type DbCategory = { id: string; name: string; slug: string; description: string | null };
type Product = { id: string; title: string; price: number; stock: number; description: string | null; image_url: string | null; slug: string; currency: string };
type DeliveredCred = { content: string; label: string | null };

const CRED_FIELDS = ["Username", "Password", "Email", "Email Password", "2FA Code"];
function parseCred(content: string) {
  const parts = content.split(/\||\//).map((part) => part.trim());
  return CRED_FIELDS.map((label, i) => ({ label, value: parts[i] ?? "" })).filter((f) => f.value);
}

type CategoryMeta = { Icon: React.ElementType; iconColor: string; bg: string };
function getCategoryMeta(slug: string, name: string): CategoryMeta {
  const s = (slug ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (s.includes("twitter") || s.includes("-x-") || s.endsWith("-x") || n.includes("twitter") || / x$/.test(n))
    return { Icon: Twitter, iconColor: "text-slate-900", bg: "bg-slate-100" };
  if (s.includes("instagram") || n.includes("instagram"))
    return { Icon: Instagram, iconColor: "text-pink-600", bg: "bg-pink-100" };
  if (s.includes("facebook") || n.includes("facebook") || s.includes("fb-") || n.includes(" fb "))
    return { Icon: Facebook, iconColor: "text-blue-600", bg: "bg-blue-100" };
  if (s.includes("youtube") || n.includes("youtube"))
    return { Icon: Youtube, iconColor: "text-red-600", bg: "bg-red-100" };
  if (s.includes("tiktok") || n.includes("tiktok"))
    return { Icon: Music2, iconColor: "text-slate-800", bg: "bg-slate-100" };
  if (s.includes("linkedin") || n.includes("linkedin"))
    return { Icon: Linkedin, iconColor: "text-blue-700", bg: "bg-blue-100" };
  if (s.includes("telegram") || n.includes("telegram"))
    return { Icon: Send, iconColor: "text-sky-500", bg: "bg-sky-100" };
  if (s.includes("whatsapp") || n.includes("whatsapp"))
    return { Icon: MessageCircle, iconColor: "text-green-600", bg: "bg-green-100" };
  if (s.includes("website") || s.includes("web") || n.includes("website") || n.includes("web"))
    return { Icon: Globe, iconColor: "text-brand-orange", bg: "bg-brand-orange/10" };
  return { Icon: ShoppingBag, iconColor: "text-gray-500", bg: "bg-gray-100" };
}

export default function ProductsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const activeCat = searchParams.get("cat") ?? undefined;
  const activeCategory = dbCategories.find((c) => c.slug === activeCat);

  useEffect(() => {
    supabase.from("product_categories").select("*").order("name").then(({ data }) => {
      if (data?.length) setDbCategories(data as DbCategory[]);
    });
  }, []);

  useEffect(() => {
    if (!activeCat) { setProducts([]); return; }
    setProductsLoading(true);
    const catId = dbCategories.find((c) => c.slug === activeCat)?.id ?? "";
    if (!catId) { setProductsLoading(false); return; }
    supabase
      .from("products")
      .select("id, title, price, stock, description, image_url, slug, currency")
      .eq("published", true)
      .eq("category_id", catId)
      .order("price")
      .then(({ data }) => { setProducts((data as Product[]) ?? []); setProductsLoading(false); });
  }, [activeCat, dbCategories]);

  const displayCategories = dbCategories.length > 0
    ? dbCategories
    : staticCategories.map((c) => ({ id: String(c.id), name: c.name, slug: c.slug, description: null }));

  const setCat = (slug: string | undefined) => {
    if (slug) setSearchParams({ cat: slug });
    else setSearchParams({});
  };

  const handleProductClick = (product: Product) => {
    navigate(`/products/${product.slug}`);
  };

  return (
    <>
      <PageHero title="Our Products" subtitle="Verified accounts across every major social platform." breadcrumbs={[{ name: "Products" }]} />

      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-12">
            <h3 className="text-lg font-semibold text-brand-foreground/80">Handpicked categories</h3>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold">Verified accounts for sale</h2>
          </motion.div>

          {/* Categories */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            {displayCategories.map((c) => {
              const meta = getCategoryMeta(c.slug, c.name);
              const active = activeCategory?.id === c.id;
              return (
                <button key={c.id} onClick={() => setCat(c.slug)} aria-pressed={active} className={`group p-3 rounded-lg flex flex-col items-center justify-center space-y-2 ${meta.bg} ${active ? 'ring-2 ring-offset-2 ring-brand-500' : ''}`}>
                  <meta.Icon className={`w-6 h-6 ${meta.iconColor}`} />
                  <div className="text-xs text-slate-700 mt-1">{c.name}</div>
                </button>
              );
            })}
          </div>

          {/* Products grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {productsLoading ? (
              <div className="col-span-full text-center py-12"><Loader2 className="mx-auto" /></div>
            ) : products.map((p) => (
              <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleProductClick(p)}>
                <CardContent className="p-0">
                  {/* Product Image Placeholder */}
                  <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.title} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    ) : (
                      <ShoppingBag className="w-12 h-12 text-slate-300" />
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-brand-navy line-clamp-2">{p.title}</h3>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <div className="text-2xl font-bold text-brand-orange">
                          ₦{p.price.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.stock > 0 ? `${p.stock} available` : 'Out of stock'}
                        </div>
                      </div>
                      <div>
                        {p.stock > 0 ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">In Stock</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 text-xs">Out of Stock</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!productsLoading && products.length === 0 && activeCat && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No products available in this category.</p>
            </div>
          )}
        </div>
      </section>
    </>
=======
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, Send, LifeBuoy, ShoppingCart, Package, Sparkles, Menu, Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, signOut } from "@/hooks/use-auth";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Products — KAMZYBOT'S MEDIA Service Marketplace" },
      { name: "description", content: "Browse all verified accounts, VPNs, mails, gift cards & more on KAMZYBOT'S MEDIA. Instant delivery, secure checkout." },
      { property: "og:title", content: "Products — KAMZYBOT'S MEDIA" },
      { property: "og:description", content: "All categories: Facebook, Instagram, X, TikTok, Telegram, Netflix, Spotify & more." },
    ],
  }),
  component: ProductsPage,
});

const CONTACTS = {
  whatsapp: "https://wa.me/?text=Hi%20KAMZYBOT%27S%20MEDIA",
  telegram: "https://t.me/kamzybot",
  support: "mailto:support@kamzybotsmedia.store",
};

const ALL = "All";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>(ALL);

  useEffect(() => {
    (async () => {
      const [{ data: prods }, { data: logs }] = await Promise.all([
        supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: false }),
        supabase.from("product_logins").select("product_id").eq("status", "available"),
      ]);
      const counts: Record<string, number> = {};
      (logs ?? []).forEach((r: any) => { counts[r.product_id] = (counts[r.product_id] ?? 0) + 1; });
      setProducts((prods ?? []) as Product[]);
      setStock(counts);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(products.map(p => p.category || "Others")))],
    [products]
  );
  const visible = activeCat === ALL ? products : products.filter(p => (p.category || "Others") === activeCat);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PageHero count={products.length} />
      <CategoryNav categories={categories} active={activeCat} onChange={setActiveCat} />
      <main className="container mx-auto max-w-7xl px-6 pb-24 pt-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-display text-xl font-bold">No products yet</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              {activeCat === ALL
                ? "Our admins haven't uploaded any products yet. Check back soon."
                : `No products listed under "${activeCat}" right now.`}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visible.map(p => <ProductCard key={p.id} product={p} stock={stock[p.id] ?? 0} />)}
          </div>
        )}
      </main>
      <CTA />
      <Footer />
      <FloatingContact />
    </div>
  );
}

function Header() {
  const { isAuthed } = useAuth();
  const navItems = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    ...(isAuthed
      ? [{ label: "Dashboard", href: "/dashboard" }, { label: "Wallet", href: "/wallet" }]
      : [{ label: "Login", href: "/login" }, { label: "Register", href: "/register" }]),
  ];
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground font-bold shadow-soft">K</div>
          <span className="font-display font-bold text-xl tracking-tight">KAMZYBOT'S <span className="text-gradient">MEDIA</span></span>
        </Link>
        <Sheet>
          <SheetTrigger aria-label="Open menu" className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-colors shadow-soft">
            <Menu className="w-6 h-6 text-foreground" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[88vw] sm:max-w-sm p-0 flex flex-col">
            <SheetHeader className="px-6 py-5 border-b border-border/60 text-left">
              <SheetTitle className="font-display text-xl">KAMZYBOT'S <span className="text-gradient">MEDIA</span></SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto px-2 py-4">
              {navItems.map(i => (
                <a key={i.label} href={i.href} className="block px-5 py-4 text-lg font-medium text-foreground/90 hover:bg-muted/60 rounded-lg transition-colors">
                  {i.label}
                </a>
              ))}
              {isAuthed && (
                <button onClick={() => signOut().then(() => window.location.reload())} className="w-full text-left block px-5 py-4 text-lg font-medium text-destructive hover:bg-muted/60 rounded-lg transition-colors">
                  Logout
                </button>
              )}
            </nav>
            <div className="p-5 border-t border-border/60">
              <a href={CONTACTS.whatsapp} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full rounded-full bg-cta-gradient text-primary-foreground px-6 py-3.5 text-base font-semibold shadow-soft hover:scale-[1.02] transition-transform">
                Order Now
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function PageHero({ count }: { count: number }) {
  return (
    <section className="relative overflow-hidden bg-hero-glow border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-card">
          <Package className="w-3.5 h-3.5 text-primary" /> SERVICE MARKETPLACE
        </div>
        <h1 className="mt-6 font-display font-extrabold text-5xl md:text-6xl leading-[1.05] max-w-3xl">
          All <span className="text-gradient">products & services</span> in one place.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Browse every category — Facebook, Instagram, TikTok, Telegram, Netflix, Spotify and more.
          Buy instantly with your wallet — login is delivered immediately.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 text-sm">
            <ShoppingCart className="w-4 h-4 text-primary" /> {count} live products
          </span>
          <Link to="/shop" className="inline-flex items-center gap-2 rounded-full bg-cta-gradient text-primary-foreground px-5 py-2 text-sm font-semibold shadow-soft hover:scale-[1.02] transition-transform">
            <Sparkles className="w-4 h-4" /> Go to Shop
          </Link>
        </div>
      </div>
    </section>
  );
}

function CategoryNav({ categories, active, onChange }: { categories: string[]; active: string; onChange: (c: string) => void }) {
  return (
    <div className="sticky top-[73px] z-30 bg-background/90 backdrop-blur border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-6 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
              active === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, stock }: { product: Product; stock: number }) {
  const inStock = stock > 0;
  return (
    <div className="group rounded-3xl border border-border bg-card overflow-hidden flex flex-col hover:shadow-soft hover:-translate-y-1 transition-all">
      <div className="aspect-[4/3] flex items-center justify-center relative bg-muted/40">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-soft bg-cta-gradient">
            <Package className="w-10 h-10" />
          </div>
        )}
        <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${inStock ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-destructive/15 text-destructive"}`}>
          {inStock ? `In Stock: ${stock}` : "Out of Stock"}
        </span>
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-card/90 text-primary">
          {product.category || "Others"}
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-sm leading-snug line-clamp-2">{product.name}</h3>
        {product.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-3 flex-1">{product.description}</p>}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</div>
            <div className="font-display font-bold text-lg text-gradient">₦{Number(product.price).toLocaleString()}</div>
          </div>
          {inStock ? (
            <Link to="/shop" className="rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-transform bg-cta-gradient text-primary-foreground shadow-soft group-hover:scale-105">
              Buy <ShoppingCart className="w-3 h-3" />
            </Link>
          ) : (
            <span className="rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 bg-muted text-muted-foreground opacity-70">
              Out <ShoppingCart className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CTA() {
  return (
    <section className="container mx-auto max-w-7xl px-6 pb-24">
      <div className="rounded-3xl bg-cta-gradient text-primary-foreground p-10 md:p-14 text-center shadow-soft">
        <h2 className="font-display font-bold text-3xl md:text-4xl">Can't find what you need?</h2>
        <p className="mt-3 max-w-xl mx-auto opacity-90">We stock dozens more services off-listing. Message support and we'll source it for you.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href={CONTACTS.whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white text-primary px-6 py-3 font-semibold inline-flex items-center gap-2 hover:scale-105 transition-transform">
            <MessageCircle className="w-4 h-4" /> WhatsApp us
          </a>
          <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 backdrop-blur border border-white/30 px-6 py-3 font-semibold inline-flex items-center gap-2 hover:bg-white/20 transition-colors">
            <Send className="w-4 h-4" /> Telegram
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto max-w-7xl px-6 py-10 flex flex-col sm:flex-row gap-3 justify-between items-center text-sm text-muted-foreground">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cta-gradient flex items-center justify-center text-primary-foreground text-xs font-bold">K</div>
          <span className="font-display font-bold">KAMZYBOT'S <span className="text-gradient">MEDIA</span></span>
        </Link>
        <div>© {new Date().getFullYear()} KAMZYBOT'S MEDIA. All rights reserved.</div>
      </div>
    </footer>
  );
}

function FloatingContact() {
  const items = [
    { href: CONTACTS.whatsapp, icon: MessageCircle, label: "WhatsApp", bg: "oklch(0.65 0.18 150)" },
    { href: CONTACTS.telegram, icon: Send, label: "Telegram", bg: "oklch(0.65 0.16 240)" },
    { href: CONTACTS.support, icon: LifeBuoy, label: "Support", bg: "oklch(0.6 0.2 295)" },
  ];
  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-3">
      {items.map(i => {
        const Icon = i.icon;
        return (
          <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer" aria-label={i.label} className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-soft hover:scale-110 transition-transform" style={{ background: i.bg }}>
            <Icon className="w-5 h-5" />
          </a>
        );
      })}
    </div>
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
  );
}
