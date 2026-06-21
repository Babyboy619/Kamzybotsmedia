<<<<<<< HEAD
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, CheckCircle2, MessageCircle, Users } from "lucide-react";
import { PageHero } from "@/components/sections/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { contactInfo } from "@/data/site";

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: "", email: "", subject: "", message: "" });
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const contacts = [
    { icon: Mail, label: "Email", value: contactInfo.email, href: `mailto:${contactInfo.email}` },
    { icon: Phone, label: "Call Line", value: contactInfo.phone, href: `tel:${contactInfo.phoneRaw}` },
    { icon: MessageCircle, label: "WhatsApp", value: contactInfo.whatsappNumber, href: contactInfo.whatsappSupport },
    { icon: Users, label: "WhatsApp Community", value: "Join our community", href: contactInfo.whatsappGroup },
    { icon: TelegramIcon, label: "Telegram", value: "@Kamzybotsmedia", href: contactInfo.telegramSupport },
    { icon: TelegramIcon, label: "Telegram Channel", value: "@kamzybotsmedia01", href: contactInfo.telegramChannel },
    { icon: MapPin, label: "Location", value: contactInfo.location },
  ];

  return (
    <>
      <PageHero
        title="Contact Us"
        subtitle="We're here to help — reach out any time."
        breadcrumbs={[{ name: "Contact" }]}
      />
      <section className="w-full bg-background py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {contacts.map(({ icon: Icon, label, value, href }) => (
                <div key={label} className="bg-muted/40 rounded-2xl p-6 border border-border">
                  <div className="w-12 h-12 bg-brand-orange/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <h3 className="text-base font-semibold text-brand-navy mb-1">{label}</h3>
                  {href ? (
                    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-brand-orange transition-colors text-sm break-all">
                      {value}
                    </a>
                  ) : (
                    <p className="text-muted-foreground text-sm">{value}</p>
                  )}
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="lg:col-span-2"
            >
              <form
                onSubmit={handleSubmit}
                className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border space-y-5"
              >
                {submitted && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Thanks! Your message has been sent. We'll be in touch shortly.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field id="name" label="Name" value={formData.name} onChange={handleChange} placeholder="Your name" />
                  <Field id="email" label="Email" type="email" value={formData.email} onChange={handleChange} placeholder="you@email.com" />
                </div>
                <Field id="subject" label="Subject" value={formData.subject} onChange={handleChange} placeholder="What's this about?" />
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-brand-navy font-medium">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us what you need…"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="border-border focus-visible:ring-brand-orange/30 resize-none"
                  />
                </div>
                <Button type="submit" className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white h-12 font-semibold">
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ id, label, value, onChange, placeholder, type = "text" }: {
  id: string; label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-brand-navy font-medium">{label}</Label>
      <Input id={id} name={id} type={type} placeholder={placeholder} value={value}
        onChange={onChange} required className="border-border focus-visible:ring-brand-orange/30 h-11" />
    </div>
  );
}
=======
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Mail, MessageCircle, Send, Users, AtSign, LifeBuoy, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — KAMZYBOT'S MEDIA" },
      { name: "description", content: "Reach KAMZYBOT'S MEDIA on WhatsApp, Telegram, or email. Fast support for verified accounts, digital assets, and orders." },
      { property: "og:title", content: "Contact KAMZYBOT'S MEDIA" },
      { property: "og:description", content: "Get in touch with KAMZYBOT'S MEDIA on WhatsApp, Telegram, or email." },
      { property: "og:url", content: "https://kamzybotsmedia.store/contact" },
    ],
    links: [{ rel: "canonical", href: "https://kamzybotsmedia.store/contact" }],
  }),
  component: ContactPage,
});

const CONTACTS = {
  whatsappMessage: "https://wa.me/2348159696814",
  whatsappCommunity: "https://chat.whatsapp.com/EvXxgtIsxPiDsEGFQcMP9v",
  telegramChannel: "https://t.me/kamzybotsmedia01",
  telegramContact: "https://t.me/Kamzybotsmedia",
  email: "kamzybotsmedia@gmail.com",
  emailHref: "mailto:kamzybotsmedia@gmail.com",
  address: "023 Old Poly Quarters, Lokoja, Kogi State, Nigeria",
};

function ContactPage() {
  const channels = [
    { name: "Message us on WhatsApp", desc: "Chat directly with our team — fast replies, real humans.", cta: "Open WhatsApp", href: CONTACTS.whatsappMessage, icon: MessageCircle, color: "oklch(0.65 0.18 150)" },
    { name: "WhatsApp Community", desc: "Join our active community for deals, drops & instant support.", cta: "Join community", href: CONTACTS.whatsappCommunity, icon: Users, color: "oklch(0.6 0.18 145)" },
    { name: "Telegram Channel", desc: "Subscribe for the latest stock updates and announcements.", cta: "Open channel", href: CONTACTS.telegramChannel, icon: Send, color: "oklch(0.65 0.16 240)" },
    { name: "Telegram Contact", desc: "Send us a direct message on Telegram for personal support.", cta: "Message on Telegram", href: CONTACTS.telegramContact, icon: AtSign, color: "oklch(0.6 0.16 235)" },
    { name: "Email Us", desc: CONTACTS.email, cta: "Send an email", href: CONTACTS.emailHref, icon: Mail, color: "oklch(0.6 0.2 295)" },
    { name: "Visit / Mail Us", desc: CONTACTS.address, cta: "Get directions", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACTS.address)}`, icon: LifeBuoy, color: "oklch(0.62 0.17 30)" },
  ];
  const nav = [
    { label: "Home", href: "/" },
    { label: "Products", href: "/products" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Login", href: "/login" },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="container mx-auto max-w-7xl px-6 h-18 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cta-gradient flex items-center justify-center text-primary-foreground font-bold shadow-soft">K</div>
            <span className="font-display font-bold text-xl tracking-tight">KAMZYBOT'S <span className="text-gradient">MEDIA</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {nav.map(i => <a key={i.label} href={i.href} className="hover:text-foreground transition-colors">{i.label}</a>)}
          </nav>
          <Sheet>
            <SheetTrigger aria-label="Open menu" className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border/70 bg-card/60 hover:bg-card transition-colors shadow-soft">
              <Menu className="w-6 h-6 text-foreground" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[88vw] sm:max-w-sm p-0 flex flex-col">
              <SheetHeader className="px-6 py-5 border-b border-border/60 text-left">
                <SheetTitle className="font-display text-xl">KAMZYBOT'S <span className="text-gradient">MEDIA</span></SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto px-2 py-4">
                {nav.map(i => (
                  <a key={i.label} href={i.href} className="block px-5 py-4 text-lg font-medium text-foreground/90 hover:bg-muted/60 rounded-lg transition-colors">{i.label}</a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-sm font-semibold text-primary uppercase tracking-wider">Get in touch</div>
          <h1 className="mt-3 font-display font-bold text-4xl md:text-5xl">Connect with KAMZYBOT'S MEDIA</h1>
          <p className="mt-4 text-muted-foreground">Pick the channel that works best for you — we reply fast.</p>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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
      </main>
    </div>
  );
}
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
