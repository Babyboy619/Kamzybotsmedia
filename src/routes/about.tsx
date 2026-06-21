<<<<<<< HEAD
import { motion } from "framer-motion";
import { Check, Shield, Users, Zap, Target, Clock } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";

const benefits = [
  { icon: Shield, title: "Verified Accounts", description: "Every account is thoroughly authenticated before listing." },
  { icon: Users, title: "Trusted Community", description: "Join thousands of satisfied customers across the world." },
  { icon: Zap, title: "Instant Delivery", description: "Get immediate access via our streamlined transfer process." },
  { icon: Target, title: "Targeted Audience", description: "Match accounts to your niche and target demographics." },
  { icon: Clock, title: "24/7 Support", description: "Our team is available around the clock to assist you." },
  { icon: Check, title: "Secure Transactions", description: "Safe escrow-style handovers protect every purchase." },
];

const features = [
  "Instant Credibility",
  "Targeted Audience",
  "Save Time and Effort",
  "Strategic Expansion",
  "Secure Transactions",
  "Verified Accounts",
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        title="About Us"
        subtitle="A trusted marketplace for verified social media accounts."
        breadcrumbs={[{ name: "About" }]}
      />

      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
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
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-brand-navy leading-tight tracking-tight">
                Unlock the power of professional digital solutions and social media growth.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Social media is essential for individuals, businesses, and influencers alike. Growing your presence organically takes time — Kamzybot's Media provides expert creative services, strategic guidance, and proven solutions to accelerate your success.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We offer comprehensive digital solutions across all major platforms, with transparency, authentic engagement strategies, and dedicated support at every step of your growth journey.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span className="text-foreground font-medium text-sm">{feature}</span>
                  </div>
                ))}
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
            <h2 className="text-3xl md:text-4xl font-bold text-brand-navy mb-3 tracking-tight">Why choose us</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">A complete solution for your social media account needs.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-border"
              >
                <div className="w-12 h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center mb-4">
                  <b.icon className="w-6 h-6 text-brand-orange" />
                </div>
                <h3 className="text-lg font-semibold text-brand-navy mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
=======
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Globe,
  ShieldCheck,
  BadgeCheck,
  Tag,
  RefreshCw,
  Headphones,
  Lock,
  KeyRound,
  MessageCircle,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — KAMZYBOT'S MEDIA" },
      {
        name: "description",
        content:
          "Learn about KAMZYBOT'S MEDIA — your trusted store for verified digital accounts, premium tools, VPNs, websites, and apps.",
      },
      { property: "og:title", content: "About — KAMZYBOT'S MEDIA" },
      {
        property: "og:description",
        content:
          "Trusted by over 1M+ users. Verified accounts, secure payments, premium tools, and 24/7 support.",
      },
    ],
  }),
  component: AboutPage,
});

const highlights = [
  "Tools for professional photo and video editing",
  "Working tools, updates, and license keys",
  "Premium VPNs for every region",
  "Custom websites and apps built to order",
  "Trusted by over 1M+ users",
  "Verified social media accounts",
];

const stats = [
  { value: "15", label: "Team members" },
  { value: "23", label: "Winning awards" },
  { value: "32", label: "Completed projects" },
  { value: "546", label: "Happy clients" },
];

const features = [
  {
    icon: Globe,
    title: "Global Accounts",
    desc: "Access accounts and numbers from multiple regions to fit your business, marketing, and verification needs worldwide.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payment",
    desc: "Shop with confidence through encrypted checkout and trusted payment methods. Your data and transactions stay protected.",
  },
  {
    icon: BadgeCheck,
    title: "Verified Accounts Only",
    desc: "Every account is tested, verified, and fully functional. No recycled, broken, or low-quality accounts.",
  },
  {
    icon: Tag,
    title: "Affordable Pricing",
    desc: "Premium accounts at fair, competitive prices — so you get the best without overspending.",
  },
];

const promises = [
  {
    n: "01",
    icon: RefreshCw,
    title: "Replacement Policy",
    desc: "We provide replacements for faulty accounts, but only if the issue is on our end and not due to usage.",
  },
  {
    n: "02",
    icon: Headphones,
    title: "Support Service",
    desc: "Our technical support team is available 24/7 to address any issues or concerns.",
  },
  {
    n: "03",
    icon: Lock,
    title: "Secure Transactions",
    desc: "Shop confidently, knowing our platform keeps you secure. Your payments are protected for every client.",
  },
  {
    n: "04",
    icon: KeyRound,
    title: "Secure Account Transfer",
    desc: "Accounts undergo thorough checks using our private program and mobile proxy to ensure 100% validity.",
  },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="container mx-auto max-w-7xl px-6 h-18 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground font-bold shadow-soft">
              K
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              KAMZYBOT'S <span className="text-gradient">MEDIA</span>
            </span>
          </Link>
          <Link
            to="/products"
            className="hidden sm:inline-flex items-center gap-2 rounded-full bg-cta-gradient text-primary-foreground px-5 py-2.5 text-sm font-semibold shadow-soft hover:scale-[1.02] transition-transform"
          >
            Shop Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-cta-gradient opacity-90" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_55%)]" />
          <div className="relative container mx-auto max-w-6xl px-6 py-20 md:py-28 text-primary-foreground text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" /> About Us
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-bold mt-5 leading-tight">
              Your Trusted Store for <br className="hidden md:block" />
              Verified Digital Accounts
            </h1>
            <p className="mt-5 max-w-2xl mx-auto text-base md:text-lg opacity-90">
              At KAMZYBOT'S MEDIA, we make it simple, safe, and reliable to get the accounts and digital tools you need to grow your presence — whether you're a business owner, marketer, or creator.
            </p>
          </div>
        </section>

        {/* Highlights */}
        <section className="container mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-4">
            {highlights.map((h) => (
              <div
                key={h}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
              >
                <BadgeCheck className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                <p className="text-sm md:text-base font-medium">{h}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="bg-card border-y border-border/60">
          <div className="container mx-auto max-w-6xl px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-4xl md:text-5xl font-bold text-gradient">{s.value}</div>
                <div className="mt-2 text-sm text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold tracking-wider uppercase text-primary">Our Features</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold mt-3">
              KAMZYBOT'S MEDIA Has Many Features
            </h2>
            <p className="text-muted-foreground mt-4">
              We make buying verified accounts simple, secure, and transparent. Every feature is designed for peace of mind, fast delivery, and real value.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground shadow-soft mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-sm mt-2">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Promises */}
        <section className="bg-card border-t border-border/60">
          <div className="container mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-semibold tracking-wider uppercase text-primary">Our Promise</span>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-3">Why Customers Trust Us</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {promises.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="relative rounded-2xl border border-border/60 bg-background p-6 shadow-soft"
                  >
                    <span className="absolute top-4 right-4 text-xs font-bold text-muted-foreground/60">
                      {p.n}
                    </span>
                    <Icon className="w-8 h-8 text-primary mb-4" />
                    <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                    <p className="text-muted-foreground text-sm mt-2">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="relative overflow-hidden rounded-3xl bg-cta-gradient p-10 md:p-14 text-primary-foreground text-center shadow-soft">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_30%,white,transparent_50%)]" />
            <div className="relative">
              <h2 className="font-display text-3xl md:text-4xl font-bold">Ready to get started?</h2>
              <p className="mt-3 max-w-xl mx-auto opacity-90">
                Browse our store or talk to our team to find the perfect digital asset for you.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-primary px-6 py-3 text-sm font-semibold shadow-soft hover:scale-[1.02] transition-transform"
                >
                  Start Shopping <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  Create an account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Message Us */}
      <a
        href="https://wa.me/2348159696814"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold shadow-soft hover:scale-105 transition-transform"
      >
        <MessageCircle className="w-4 h-4" /> Message Us
      </a>
    </div>
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
  );
}
