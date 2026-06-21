<<<<<<< HEAD
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight, ShieldCheck, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingIcons } from "@/components/shared/FloatingIcons";
import { categories, testimonials } from "@/data/site";

const features = [
  "Instant Credibility",
  "Targeted Audience",
  "Save Time & Effort",
  "Strategic Expansion",
  "Secure Transactions",
];

const stats = [
  { icon: ShieldCheck, label: "Verified Accounts", value: "10K+" },
  { icon: Users, label: "Happy Customers", value: "5K+" },
  { icon: Zap, label: "Instant Delivery", value: "24/7" },
];

export default function HomePage() {
  return (
    <>
      <section className="relative w-full bg-gradient-to-b from-brand-cream to-background py-16 md:py-24 overflow-hidden">
        <FloatingIcons />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange/10 px-4 py-1.5 text-xs font-medium text-brand-orange uppercase tracking-wider"
            >
              Trusted partner since 2023
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold text-brand-navy leading-[1.1] tracking-tight"
            >
              Social media growth,{" "}
              <span className="text-brand-orange">made easy.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-muted-foreground text-base md:text-lg leading-relaxed max-w-3xl mx-auto"
            >
              Discover professional digital solutions and creative services for growing your social media presence. Expert strategies tailored for Instagram, TikTok, Facebook, YouTube, and more.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2"
            >
              {categories.slice(0, 5).map((category, idx) => (
                <span key={category.id} className="flex items-center text-sm">
                  <Link to={`/products?cat=${category.slug}`} className="text-muted-foreground hover:text-brand-orange transition-colors">
                    {category.name}
                  </Link>
                  {idx < 4 && <span className="text-border ml-5">|</span>}
                </span>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                asChild
                size="lg"
                className="bg-brand-orange hover:bg-brand-orange-hover text-white px-8 h-12 text-base font-semibold shadow-lg shadow-brand-orange/20"
              >
                <Link to="/products">Explore Products</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-brand-orange/30 text-brand-orange hover:bg-brand-orange hover:text-white px-8 h-12 text-base font-semibold"
              >
                <Link to="/contact">Contact Us</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="w-full bg-background border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 justify-center">
                <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand-navy">{value}</div>
                  <div className="text-sm text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img src="/images/about-promo.svg" alt="Kamzybot's Media" className="w-full h-auto object-cover" />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-orange/15 rounded-full -z-10" />
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-brand-navy/10 rounded-full -z-10" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-0.5 bg-brand-orange" />
                <span className="text-brand-orange font-medium uppercase tracking-wider text-sm">About Us</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-brand-navy leading-tight tracking-tight">
                Unlock the power of an established social media presence.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Building a strong following from scratch takes years. Kamzybot's Media
                gives you a secure, seamless way to acquire verified
                accounts and accelerate your social growth.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span className="text-foreground text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <Button asChild variant="link" className="text-brand-orange hover:text-brand-orange-hover p-0 h-auto font-semibold">
                  <Link to="/about" className="inline-flex items-center gap-2">
                    Learn more about us <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="w-full bg-muted/40 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="w-10 h-0.5 bg-brand-orange" />
              <span className="text-brand-orange font-medium uppercase tracking-wider text-sm">Testimonials</span>
              <div className="w-10 h-0.5 bg-brand-orange" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-brand-navy tracking-tight">
              Trusted by thousands of users
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((t, index) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-border"
              >
                <div className="text-brand-orange text-3xl leading-none mb-3">"</div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">{t.content}</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <h4 className="font-semibold text-brand-navy">{t.name}</h4>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
=======
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Facebook, Instagram, Mail, Music2, Shield, MessageCircle,
  ArrowRight, Check, Globe, Lock, BadgeCheck, Tag, Zap, Users, Award, Folder, Heart,
  Send, LifeBuoy, Twitter, Linkedin, AtSign, Inbox, Gift, Menu
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, signOut } from "@/hooks/use-auth";

const CONTACTS = {
  whatsappMessage: "https://wa.me/2348159696814",
  whatsappCommunity: "https://chat.whatsapp.com/EvXxgtIsxPiDsEGFQcMP9v",
  telegramChannel: "https://t.me/kamzybotsmedia01",
  telegramContact: "https://t.me/Kamzybotsmedia",
  email: "kamzybotsmedia@gmail.com",
  emailHref: "mailto:kamzybotsmedia@gmail.com",
  address: "023 Old Poly Quarters, Lokoja, Kogi State, Nigeria",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KAMZYBOT'S MEDIA — Premium Social Media Logs & Digital Services" },
      { name: "description", content: "KAMZYBOT'S MEDIA is a trusted platform for premium social media logs, digital services, and online growth solutions with fast delivery and reliable support." },
      { property: "og:title", content: "KAMZYBOT'S MEDIA — Premium Social Media Logs & Digital Services" },
      { property: "og:description", content: "KAMZYBOT'S MEDIA is a trusted platform for premium social media logs, digital services, and online growth solutions with fast delivery and reliable support." },
      { property: "og:url", content: "https://kamzybotsmedia.store/" },
    ],
    links: [
      { rel: "canonical", href: "https://kamzybotsmedia.store/" },
    ],
  }),
  component: Home,
});

const platforms = [
  { name: "Facebook", icon: Facebook, color: "var(--brand-fb)", bg: "oklch(0.95 0.04 255)" },
  { name: "Instagram", icon: Instagram, color: "var(--brand-ig)", bg: "oklch(0.96 0.04 350)" },
  { name: "Gmail", icon: Mail, color: "var(--brand-gmail)", bg: "oklch(0.96 0.04 25)" },
  { name: "TikTok", icon: Music2, color: "var(--brand-tiktok)", bg: "oklch(0.95 0.005 260)" },
  { name: "VPN", icon: Shield, color: "var(--brand-vpn)", bg: "oklch(0.96 0.04 155)" },
  { name: "Reddit", icon: MessageCircle, color: "var(--brand-reddit)", bg: "oklch(0.96 0.04 35)" },
  { name: "X (Twitter)", icon: Twitter, color: "oklch(0.2 0 0)", bg: "oklch(0.95 0 0)" },
  { name: "LinkedIn", icon: Linkedin, color: "oklch(0.45 0.13 240)", bg: "oklch(0.95 0.04 240)" },
  { name: "Firstmail", icon: AtSign, color: "oklch(0.55 0.18 200)", bg: "oklch(0.96 0.04 200)" },
  { name: "Yahoo Mail", icon: Inbox, color: "oklch(0.45 0.2 300)", bg: "oklch(0.96 0.04 300)" },
  { name: "Gift Card", icon: Gift, color: "oklch(0.6 0.22 15)", bg: "oklch(0.96 0.04 15)" },
];

const features = [
  { icon: Globe, title: "Global Accounts", text: "Access accounts and numbers from multiple regions to fit any market or verification need worldwide." },
  { icon: Lock, title: "Secure Payment", text: "Encrypted checkout and trusted payment methods. Your data and transactions stay protected." },
  { icon: BadgeCheck, title: "Verified Only", text: "Tested, verified, and fully functional accounts. No recycled, broken or low-quality stock." },
  { icon: Tag, title: "Affordable Pricing", text: "Premium accounts at fair, competitive prices — get the best without overspending." },
];

const steps = [
  { n: "01", title: "Browse and Select", text: "Explore our wide range of accounts. Filter by platform, niche, follower count, and engagement." },
  { n: "02", title: "Review Account Details", text: "Inspect demographics, engagement, and history. Make an informed decision before checkout." },
  { n: "03", title: "Purchase and Transfer", text: "Pay through our secure gateway. Our team transfers ownership safely with full support." },
];

const stats = [
  { v: "15", l: "Team members", icon: Users },
  { v: "23", l: "Awards won", icon: Award },
  { v: "320+", l: "Completed projects", icon: Folder },
  { v: "5.4K", l: "Happy clients", icon: Heart },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <PlatformGrid />
      <About />
      <Marquee />
      <Process />
      <StatsBar />
      <PopularAccounts />
      <Features />
      <SendGift />
      <Contact />
      <Newsletter />
      <Footer />
      <FloatingContact />
    </div>
  );
}

function Contact() {
  const channels = [
    {
      name: "Message us on WhatsApp",
      desc: "Chat directly with our team — fast replies, real humans.",
      cta: "Open WhatsApp",
      href: CONTACTS.whatsappMessage,
      icon: MessageCircle,
      color: "oklch(0.65 0.18 150)",
    },
    {
      name: "WhatsApp Community",
      desc: "Join our active community for deals, drops & instant support.",
      cta: "Join community",
      href: CONTACTS.whatsappCommunity,
      icon: Users,
      color: "oklch(0.6 0.18 145)",
    },
    {
      name: "Telegram Channel",
      desc: "Subscribe for the latest stock updates and announcements.",
      cta: "Open channel",
      href: CONTACTS.telegramChannel,
      icon: Send,
      color: "oklch(0.65 0.16 240)",
    },
    {
      name: "Telegram Contact",
      desc: "Send us a direct message on Telegram for personal support.",
      cta: "Message on Telegram",
      href: CONTACTS.telegramContact,
      icon: AtSign,
      color: "oklch(0.6 0.16 235)",
    },
    {
      name: "Email Us",
      desc: CONTACTS.email,
      cta: "Send an email",
      href: CONTACTS.emailHref,
      icon: Mail,
      color: "oklch(0.6 0.2 295)",
    },
    {
      name: "Visit / Mail Us",
      desc: CONTACTS.address,
      cta: "Get directions",
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACTS.address)}`,
      icon: LifeBuoy,
      color: "oklch(0.62 0.17 30)",
    },
  ];
  return (
    <section id="contact" className="container mx-auto max-w-7xl px-6 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-sm font-semibold text-primary uppercase tracking-wider">Get in touch</div>
        <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl">Connect with KAMZYBOT'S MEDIA</h2>
        <p className="mt-4 text-muted-foreground">Pick the channel that works best for you — we reply fast.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map(c => {
          const Icon = c.icon;
          return (
            <a key={c.name} href={c.href} target="_blank" rel="noopener noreferrer"
              className="group rounded-3xl border border-border bg-card p-7 hover:shadow-soft transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-soft" style={{ background: c.color }}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="mt-5 font-bold text-xl">{c.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed break-words">{c.desc}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                {c.cta} <ArrowRight className="w-4 h-4" />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function FloatingContact() {
  const items = [
    { href: CONTACTS.whatsappMessage, icon: MessageCircle, label: "Message us on WhatsApp", bg: "oklch(0.65 0.18 150)" },
    { href: CONTACTS.telegramChannel, icon: Send, label: "Telegram channel", bg: "oklch(0.65 0.16 240)" },
    { href: CONTACTS.emailHref, icon: Mail, label: "Email support", bg: "oklch(0.6 0.2 295)" },
  ];
  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-3">
      {items.map(i => {
        const Icon = i.icon;
        return (
          <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer"
            aria-label={i.label}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-soft hover:scale-110 transition-transform"
            style={{ background: i.bg }}>
            <Icon className="w-5 h-5" />
          </a>
        );
      })}
    </div>
  );
}

function Header() {
  const { isAuthed } = useAuth();
  const baseItems = [
    { label: "Product", href: "/products" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "#contact" },
  ];
  const authItems = isAuthed
    ? [{ label: "Dashboard", href: "/dashboard" }]
    : [
        { label: "Login", href: "/login" },
        { label: "Register", href: "/register" },
      ];
  const navItems = [...baseItems, ...authItems];
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="container mx-auto max-w-7xl px-6 h-18 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground font-bold shadow-soft">K</div>
          <span className="font-display font-bold text-xl tracking-tight">KAMZYBOT'S <span className="text-gradient">MEDIA</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          {navItems.map(i => (
            <a key={i.label} href={i.href} className="hover:text-foreground transition-colors">{i.label}</a>
          ))}
          {isAuthed && (
            <button onClick={() => signOut().then(() => window.location.reload())} className="hover:text-foreground transition-colors">Logout</button>
          )}
        </nav>
        <Sheet>
          <SheetTrigger
            aria-label="Open menu"
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-colors shadow-soft"
          >
            <Menu className="w-6 h-6 text-foreground" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[88vw] sm:max-w-sm p-0 flex flex-col">
            <SheetHeader className="px-6 py-5 border-b border-border/60 text-left">
              <SheetTitle className="font-display text-xl">
                KAMZYBOT'S <span className="text-gradient">MEDIA</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto px-2 py-4">
              {navItems.map(i => (
                <a
                  key={i.label}
                  href={i.href}
                  className="block px-5 py-4 text-lg font-medium text-foreground/90 hover:bg-muted/60 rounded-lg transition-colors"
                >
                  {i.label}
                </a>
              ))}
              {isAuthed && (
                <button
                  onClick={() => signOut().then(() => window.location.reload())}
                  className="w-full text-left block px-5 py-4 text-lg font-medium text-destructive hover:bg-muted/60 rounded-lg transition-colors"
                >
                  Logout
                </button>
              )}
            </nav>
            <div className="p-5 border-t border-border/60">
              <a
                href="/products"
                className="flex items-center justify-center w-full rounded-full bg-cta-gradient text-primary-foreground px-6 py-3.5 text-base font-semibold shadow-soft hover:scale-[1.02] transition-transform"
              >
                Shop Now
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-hero-glow">
      <div className="container mx-auto max-w-7xl px-6 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-card">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> WELCOME TO KAMZYBOT'S MEDIA
          </div>
          <h1 className="mt-6 font-display font-extrabold text-5xl md:text-6xl lg:text-7xl leading-[1.05]">
            Premium <span className="text-gradient">Digital Assets</span> for Professionals.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Unlock instant access to verified Facebook, Instagram, and Google Voice accounts.
            KAMZYBOT'S MEDIA delivers secure, battle-tested accounts designed to scale your business or personal reach instantly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/products" className="group inline-flex items-center gap-2 rounded-full bg-foreground text-background px-7 py-3.5 font-semibold shadow-soft hover:bg-foreground/90 transition-all">
              Start Shopping
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="#pricing" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3.5 font-semibold hover:bg-secondary transition-colors">
              View Pricing
            </a>
          </div>
          <div className="mt-12 pt-8 border-t border-border grid grid-cols-3 gap-6 max-w-lg">
            {[["1M+", "Trusted users"], ["24/7", "Instant delivery"], ["100%", "Secure accounts"]].map(([v, l]) => (
              <div key={l}>
                <div className="font-display font-bold text-2xl">{v}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right visual */}
        <div className="relative hidden lg:block">
          <div className="absolute -top-10 -left-10 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 -right-10 w-80 h-80 rounded-full bg-accent-purple/20 blur-3xl" />
          <div className="relative grid grid-cols-2 gap-4">
            {platforms.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={p.name}
                  className={`rounded-2xl p-6 shadow-card border border-border/60 ${i % 2 ? "translate-y-8" : ""}`}
                  style={{ background: p.bg }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: p.color }}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="mt-4 font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Verified accounts</div>
                </div>
              );
            })}
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-card rounded-full shadow-soft border border-border px-5 py-3 flex items-center gap-3 animate-float">
            <div className="w-9 h-9 rounded-full bg-cta-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Delivery time</div>
              <div className="text-sm font-semibold">Instant</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlatformGrid() {
  return (
    <section id="products" className="container mx-auto max-w-7xl px-6 py-12">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {platforms.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.name} className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center gap-3 hover:shadow-card hover:-translate-y-1 transition-all">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white" style={{ background: p.color }}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold">{p.name}</div>
            </div>
          );
        })}
        <a href="#contact" className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 flex flex-col items-center justify-center gap-3 hover:bg-primary/10 hover:-translate-y-1 transition-all group">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-cta-gradient text-primary-foreground shadow-soft">
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="text-sm font-semibold text-primary">+ Many more</div>
        </a>
      </div>
      <div className="mt-8 flex flex-col items-center gap-2 text-muted-foreground">
        <p className="text-sm">Scroll to explore everything we offer</p>
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/40 flex items-start justify-center p-1.5">
          <div className="w-1 h-2 rounded-full bg-muted-foreground/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="container mx-auto max-w-5xl px-6 py-20 text-center">
      <h2 className="font-display font-bold text-4xl md:text-5xl">
        KAMZYBOT'S MEDIA — Your Trusted Source for <span className="text-gradient">Verified Digital Accounts</span>
      </h2>
      <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
        At KAMZYBOT'S MEDIA, we make it simple, safe and reliable for you to get the accounts you need to grow your digital presence. Whether you're a business owner, marketer, or individual looking for verified accounts, we've got you covered.
      </p>
    </section>
  );
}

function Marquee() {
  const items = [
    "TOOLS FOR PROFESSIONAL PHOTO & VIDEO EDITING",
    "WORKING TOOLS AND UPDATES",
    "ALL SORTS OF VPN",
    "WE BUILD WEBSITES & APPS",
    "TRUSTED BY OVER 1M+ USERS",
    "SOCIAL MEDIA ACCOUNTS",
  ];
  return (
    <div className="border-y border-border bg-foreground text-background overflow-hidden py-6">
      <div className="flex gap-12 animate-marquee whitespace-nowrap">
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} className="font-display font-bold text-xl tracking-tight flex items-center gap-12">
            {t}
            <span className="w-2 h-2 rounded-full bg-cta-gradient" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Process() {
  return (
    <section className="container mx-auto max-w-7xl px-6 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-sm font-semibold text-primary uppercase tracking-wider">Working Process</div>
        <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl">Simple, secure, transparent</h2>
        <p className="mt-4 text-muted-foreground">Every step of the KAMZYBOT'S MEDIA experience is built for peace of mind, fast delivery, and real value.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-6">
        {steps.map((s, i) => (
          <div key={s.n} className="relative rounded-3xl border border-border bg-card p-8 shadow-card hover:shadow-soft transition-shadow">
            <div className="text-7xl font-display font-extrabold text-gradient leading-none">{s.n}</div>
            <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{s.text}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden md:block absolute top-1/2 -right-5 w-8 h-8 text-border" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="container mx-auto max-w-7xl px-6">
      <div className="rounded-3xl bg-cta-gradient text-primary-foreground p-10 md:p-14 grid grid-cols-2 md:grid-cols-4 gap-8 shadow-soft">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.l} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <div className="font-display font-bold text-3xl">{s.v}</div>
                <div className="text-sm opacity-80">{s.l}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PopularAccounts() {
  const items = platforms.slice(0, 4);
  return (
    <section className="container mx-auto max-w-7xl px-6 py-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-sm font-semibold text-primary uppercase tracking-wider">Popular</div>
          <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl max-w-xl">Popular Digital Accounts</h2>
          <p className="mt-3 text-muted-foreground max-w-lg">Choose from our wide selection of verified accounts across major platforms.</p>
        </div>
        <a href="#" className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all">
          View all products <ArrowRight className="w-4 h-4" />
        </a>
      </div>
      <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map(p => {
          const Icon = p.icon;
          return (
            <div key={p.name} className="group rounded-3xl border border-border bg-card p-6 hover:shadow-soft transition-all hover:-translate-y-1">
              <div className="aspect-[4/3] rounded-2xl flex items-center justify-center" style={{ background: p.bg }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-soft" style={{ background: p.color }}>
                  <Icon className="w-8 h-8" />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-bold">{p.name} Accounts</h3>
              <p className="text-sm text-muted-foreground mt-1">Verified · Instant delivery</p>
              <a href="#" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                View details <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="bg-secondary/50 border-y border-border">
      <div className="container mx-auto max-w-7xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-semibold text-primary uppercase tracking-wider">Why KAMZYBOT'S MEDIA</div>
          <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl">Many features, one trusted store</h2>
          <p className="mt-4 text-muted-foreground">Everything you need to buy verified accounts with confidence.</p>
        </div>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-3xl bg-card border border-border p-7 hover:shadow-soft transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground shadow-soft">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="mt-5 font-bold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-primary font-semibold">
                  <Check className="w-4 h-4" /> Included
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SendGift() {
  const giftTypes = ["Amazon Gift Card", "Apple Gift Card", "Google Play", "Steam", "Visa Prepaid", "iTunes"];
  const amounts = ["$25", "$50", "$100", "$250", "$500", "Custom"];
  return (
    <section id="gifts" className="container mx-auto max-w-7xl px-6 py-24">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-sm font-semibold text-primary uppercase tracking-wider">For Businesses</div>
          <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl leading-tight">
            Send <span className="text-gradient">gift cards</span> to your clients in seconds
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
            Show appreciation, close deals, or thank loyal clients. Choose a gift card,
            add a personal note, and we'll deliver it instantly to their inbox.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Bulk send to multiple clients",
              "Personalized branded message",
              "Instant email delivery",
              "Track redemption status",
            ].map(b => (
              <li key={b} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-cta-gradient flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget as HTMLFormElement);
            const text = `Hi! I'd like to send a gift card.%0A%0ARecipient: ${encodeURIComponent(String(fd.get("recipient") || ""))}%0AEmail: ${encodeURIComponent(String(fd.get("email") || ""))}%0AGift: ${encodeURIComponent(String(fd.get("gift") || ""))}%0AAmount: ${encodeURIComponent(String(fd.get("amount") || ""))}%0AMessage: ${encodeURIComponent(String(fd.get("message") || ""))}`;
            window.open(`${CONTACTS.whatsappMessage}?text=${text}`, "_blank");
          }}
          className="rounded-3xl border border-border bg-card p-7 md:p-9 shadow-card space-y-4"
        >
          <div className="flex items-center gap-3 pb-2">
            <div className="w-12 h-12 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground shadow-soft">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Send a Gift</h3>
              <p className="text-xs text-muted-foreground">Fill the form — we'll handle delivery</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Recipient name</label>
              <input name="recipient" required maxLength={100}
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Recipient email</label>
              <input name="email" type="email" required maxLength={255}
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="jane@company.com" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Gift card type</label>
            <select name="gift" required
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {giftTypes.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Amount</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {amounts.map((a, i) => (
                <label key={a} className="cursor-pointer">
                  <input type="radio" name="amount" value={a} defaultChecked={i === 1} className="peer sr-only" />
                  <span className="inline-block px-4 py-2 rounded-full border border-border text-sm font-semibold peer-checked:bg-cta-gradient peer-checked:text-primary-foreground peer-checked:border-transparent transition-all">
                    {a}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Personal message (optional)</label>
            <textarea name="message" rows={3} maxLength={500}
              className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Thanks for being an amazing client!" />
          </div>

          <button type="submit"
            className="w-full rounded-full bg-cta-gradient text-primary-foreground px-6 py-3.5 font-semibold shadow-soft hover:scale-[1.02] transition-transform inline-flex items-center justify-center gap-2">
            <Gift className="w-4 h-4" /> Send Gift
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Your request will be sent via WhatsApp for fast confirmation.
          </p>
        </form>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="container mx-auto max-w-7xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl bg-foreground text-background p-10 md:p-16">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-accent-purple/30 blur-3xl" />
        <div className="relative grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="font-display font-bold text-4xl md:text-5xl">Subscribe to our newsletter</h2>
            <p className="mt-4 text-background/70">Stay updated with our latest offers, drops, and account listings.</p>
          </div>
          <form className="flex flex-col sm:flex-row gap-3" onSubmit={e => e.preventDefault()}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="flex-1 rounded-full bg-white/10 border border-white/20 px-6 py-4 text-background placeholder:text-background/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button className="rounded-full bg-cta-gradient text-primary-foreground px-8 py-4 font-semibold shadow-soft hover:scale-105 transition-transform">
              Subscribe
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto max-w-7xl px-6 py-14 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground font-bold">K</div>
            <span className="font-display font-bold text-xl">KAMZYBOT'S <span className="text-gradient">MEDIA</span></span>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            Premium verified digital accounts delivered instantly. Trusted by professionals worldwide.
          </p>
          <address className="not-italic mt-5 text-sm text-muted-foreground space-y-2">
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <span>{CONTACTS.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0 text-primary" />
              <a href={CONTACTS.emailHref} className="hover:text-foreground">{CONTACTS.email}</a>
            </div>
          </address>
        </div>
        <div>
          <div className="font-semibold mb-3">Shop</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {["Facebook", "Instagram", "Gmail", "TikTok", "VPN"].map(l => (
              <li key={l}><a href="#" className="hover:text-foreground">{l}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Connect</div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href={CONTACTS.whatsappMessage} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Message us on WhatsApp</a></li>
            <li><a href={CONTACTS.whatsappCommunity} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-2"><Users className="w-4 h-4" /> WhatsApp community</a></li>
            <li><a href={CONTACTS.telegramChannel} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-2"><Send className="w-4 h-4" /> Telegram channel</a></li>
            <li><a href={CONTACTS.telegramContact} target="_blank" rel="noreferrer" className="hover:text-foreground inline-flex items-center gap-2"><AtSign className="w-4 h-4" /> Telegram contact</a></li>
            <li><a href={CONTACTS.emailHref} className="hover:text-foreground inline-flex items-center gap-2"><Mail className="w-4 h-4" /> Email us</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row gap-2 justify-between text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} KAMZYBOT'S MEDIA. All rights reserved.</div>
          <div>Made with care for digital professionals.</div>
        </div>
      </div>
    </footer>
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
  );
}
