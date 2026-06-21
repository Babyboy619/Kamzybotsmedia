<<<<<<< HEAD
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Loader2, Wallet, ShoppingBag, ExternalLink, MessageCircle, Users, Send, Mail, Key, Copy, CheckCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { contactInfo } from "@/data/site";

type WalletRow = { balance: number; currency: string; updated_at: string };
type OrderItem = { title: string; quantity: number; unit_price: number };
type Order = { id: string; total: number; currency: string; status: string; created_at: string; order_items: OrderItem[] };
type Profile = { display_name: string | null; email: string | null; phone: string | null; created_at: string };
type Credential = { id: string; content: string; label: string | null; delivered_at: string | null };

export default function DashboardPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/dashboard");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id).single(),
      supabase.from("orders").select("*, order_items(title, quantity, unit_price)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
    ]).then(([w, o, p]) => {
      setWallet(w.data as WalletRow | null);
      setOrders((o.data as Order[]) ?? []);
      setProfile(p.data as Profile | null);
      setDataLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel("dash-wallet-rt")
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "wallets",
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          setWallet(payload.new as WalletRow);
        })
        .subscribe();
    } catch { /* realtime optional */ }
    return () => { if (ch) supabase.removeChannel(ch).catch(() => {}); };
  }, [user]);

  if (loading || !user) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-orange" /></div>;

  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "User";
  const defaultTab = searchParams.get("tab") ?? "overview";

  return (
    <div className="min-h-[calc(100vh-200px)] bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Welcome, {displayName}</h1>
            <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white">
                <Link to="/admin">Admin Panel</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/orders"><ShoppingBag className="w-4 h-4 mr-1" />My Orders</Link>
            </Button>
            <Button asChild className="bg-brand-orange hover:bg-brand-orange-hover text-white" size="sm">
              <Link to="/wallet"><Wallet className="w-4 h-4 mr-1" />Wallet</Link>
            </Button>
          </div>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-orange" /></div>
        ) : (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mb-6 flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">My Orders</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="support">Support</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <Card className="border-brand-orange/20 bg-brand-orange/5">
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Wallet Balance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-brand-navy">₦{(wallet?.balance ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>
                    <Button asChild size="sm" className="mt-3 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs">
                      <Link to="/wallet">Fund Wallet</Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-brand-navy">{orders.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">All time purchases</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Member Since</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-brand-navy">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" }) : "—"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-brand-navy">Recent Orders</h2>
                <Button asChild variant="link" size="sm" className="text-brand-orange p-0"><Link to="/products">Shop More</Link></Button>
              </div>

              {orders.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No orders yet</p>
                    <Button asChild size="sm" className="mt-4 bg-brand-orange hover:bg-brand-orange-hover text-white">
                      <Link to="/products">Browse Products</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">{orders.slice(0, 5).map((o) => <OrderCard key={o.id} order={o} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="orders">
              <h2 className="text-lg font-semibold text-brand-navy mb-4">All Orders ({orders.length})</h2>
              {orders.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3 mt-4" />
                    <p className="text-muted-foreground text-sm">No orders yet</p>
                    <Button asChild size="sm" className="mt-4 bg-brand-orange hover:bg-brand-orange-hover text-white">
                      <Link to="/products">Browse Products</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">{orders.map((o) => <OrderCard key={o.id} order={o} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="profile">
              <ProfileTab profile={profile} user={user} />
            </TabsContent>

            <TabsContent value="support">
              <SupportTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700", refunded: "bg-blue-100 text-blue-700",
};

const CRED_FIELDS = ["Username", "Password", "Email", "Email Password", "2FA Code"];
function parseCredential(content: string) {
  const parts = content.split(/\||\//).map((part) => part.trim());
  return CRED_FIELDS.map((label, i) => ({ label, value: parts[i] ?? "" })).filter((f) => f.value);
}

function OrderCard({ order }: { order: Order }) {
  const [credOpen, setCredOpen] = useState(false);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [credsLoading, setCredsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCreds = async () => {
    setCredsLoading(true);
    const { data } = await supabase
      .from("product_credentials")
      .select("id, content, label, delivered_at")
      .eq("order_id", order.id);
    setCreds((data as Credential[]) ?? []);
    setCredsLoading(false);
  };

  const openCreds = () => { setCredOpen(true); fetchCreds(); };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">#{order.id.slice(-8).toUpperCase()}</span>
                <Badge className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}>{order.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {order.order_items?.length ? order.order_items.map((i) => `${i.title} ×${i.quantity}`).join(", ") : "—"}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="font-semibold text-brand-navy">₦{Number(order.total).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-NG")}</div>
              </div>
              <Button size="sm" variant="outline" onClick={openCreds}
                className="border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white text-xs h-8">
                <Key className="w-3 h-3 mr-1" />Credentials
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-4 h-4 text-brand-orange" />
              Order Credentials — #{order.id.slice(-8).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {credsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
            ) : creds.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                <div className="font-medium mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />Delivery pending</div>
                <p>Credentials for this order haven't been assigned yet. Please check back shortly or contact support.</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <a href={contactInfo.whatsappSupport} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-green-700 hover:underline">WhatsApp Support →</a>
                  <a href={contactInfo.telegramSupport} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sky-600 hover:underline">Telegram Support →</a>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{creds.length} credential{creds.length > 1 ? "s" : ""} delivered.</p>
                {creds.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border overflow-hidden">
                    {c.label && <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-brand-navy border-b border-border">{c.label}</div>}
                    <div className="relative p-4 bg-muted/20">
                      {parseCredential(c.content).length > 0 ? (
                        <div className="space-y-2">
                          {parseCredential(c.content).map(({ label, value }) => (
                            <div key={label} className="flex items-start gap-2 text-sm">
                              <span className="text-xs font-semibold text-brand-navy w-28 shrink-0 pt-0.5">{label}</span>
                              <span className="font-mono text-brand-navy break-all">{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre className="text-sm font-mono whitespace-pre-wrap break-all leading-relaxed">{c.content}</pre>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(c.content, c.id)}
                        className="absolute top-2 right-2 h-7 px-2 text-xs text-muted-foreground hover:text-brand-navy">
                        {copied === c.id ? <><CheckCheck className="w-3.5 h-3.5 mr-1 text-green-500" />Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1" />Copy</>}
                      </Button>
                    </div>
                    {c.delivered_at && (
                      <div className="bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground border-t border-border">
                        Delivered {new Date(c.delivered_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-500" />
                  Keep these credentials safe. Do not share them with anyone.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProfileTab({ profile, user }: { profile: Profile | null; user: import("@supabase/supabase-js").User }) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const onSaveProfile = async () => {
    setSaving(true);
    // Use upsert so the call succeeds whether or not a profile row already exists.
    // onConflict:"id" updates the existing row; if absent it inserts.
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    setSaving(false);
    if (error) {
      console.error("[Profile] Update error:", error);
      toast.error(error.message || "Failed to update profile");
    } else {
      toast.success("Profile updated!");
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    if (password.length < 8) return toast.error("Minimum 8 characters");
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwLoading(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated!"); setPassword(""); setConfirm(""); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-brand-navy text-base">Profile Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Email</Label><Input value={user.email ?? ""} readOnly className="mt-1 bg-muted text-muted-foreground" /></div>
          <div><Label>Display Name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1" /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+234..." /></div>
          <Button onClick={onSaveProfile} disabled={saving} className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-brand-navy text-base">Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onChangePassword} className="space-y-3">
            <div><Label>New Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" placeholder="Min. 8 characters" required /></div>
            <div><Label>Confirm Password</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" placeholder="Repeat password" required /></div>
            <Button type="submit" disabled={pwLoading} variant="outline" className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white">
              {pwLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SupportTab() {
  const links = [
    { icon: MessageCircle, label: "WhatsApp Support", href: contactInfo.whatsappSupport, color: "text-green-600", bg: "bg-green-50", desc: contactInfo.phone },
    { icon: Users, label: "WhatsApp Community", href: contactInfo.whatsappGroup, color: "text-green-600", bg: "bg-green-50", desc: "Join our community group" },
    { icon: Send, label: "Telegram Support", href: contactInfo.telegramSupport, color: "text-sky-500", bg: "bg-sky-50", desc: "@Kamzybotsmedia" },
    { icon: Send, label: "Telegram Channel", href: contactInfo.telegramChannel, color: "text-sky-500", bg: "bg-sky-50", desc: "@kamzybotsmedia01" },
  ];
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-brand-navy mb-1">Support & Community</h2>
      <p className="text-muted-foreground text-sm mb-6">Reach our team or join the community for updates and help.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {links.map(({ icon: Icon, label, href, color, bg, desc }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all group">
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}><Icon className={`w-6 h-6 ${color}`} /></div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-brand-navy group-hover:text-brand-orange transition-colors text-sm">{label}</div>
              <div className="text-xs text-muted-foreground truncate">{desc}</div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center shrink-0"><Mail className="w-5 h-5 text-brand-orange" /></div>
            <div>
              <div className="font-medium text-brand-navy text-sm">Email Support</div>
              <a href={`mailto:${contactInfo.email}`} className="text-sm text-brand-orange hover:underline">{contactInfo.email}</a>
              <p className="text-xs text-muted-foreground mt-0.5">We typically respond within 24 hours</p>
            </div>
          </div>
        </CardContent>
      </Card>
=======
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Menu, LogOut, Wallet, Search, ArrowRight, Send, ShoppingCart,
  Layers, Twitter, Instagram, Facebook, Youtube, Music2, Mail, Globe, X, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KAMZYBOT'S MEDIA" },
      { name: "description", content: "Your KAMZYBOT'S MEDIA service marketplace dashboard." },
    ],
  }),
  component: DashboardPage,
});

type Profile = {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  wallet_balance: number;
};

type Service = {
  category: string;
  icon: any;
  color: string;
  count: number;
  products: { title: string; stock: number; price: number; icon: any }[];
};

const SERVICES: Service[] = [
  {
    category: "9 PROXY", icon: Layers, color: "oklch(0.35 0.05 250)", count: 1,
    products: [
      { title: "9 PROXY | Premium Residential Proxy | 30 Days Unlimited Bandwidth", stock: 12, price: 4500, icon: Layers },
    ],
  },
  {
    category: "TWITTER", icon: Twitter, color: "oklch(0.65 0.18 230)", count: 3,
    products: [
      { title: "X OLD ACCOUNTS 1-50 FOLLOWERS | Registration 2009-2020, verified by email | mail+pass | 2FA, 80% USA", stock: 8, price: 1200, icon: X },
      { title: "X OLD ACCOUNTS 100-500 REAL FOLLOWERS | Aged accounts | email access included", stock: 5, price: 3500, icon: X },
      { title: "X PVA NEW ACCOUNTS | Phone Verified | USA IPs", stock: 22, price: 800, icon: X },
    ],
  },
  {
    category: "INSTAGRAM", icon: Instagram, color: "oklch(0.65 0.2 20)", count: 4,
    products: [
      { title: "Instagram Aged Accounts 2018-2022 | Email Access | High Quality", stock: 14, price: 2500, icon: Instagram },
      { title: "Instagram Followers 1K — Real & High Retention", stock: 99, price: 1500, icon: Instagram },
    ],
  },
  {
    category: "FACEBOOK", icon: Facebook, color: "oklch(0.5 0.18 250)", count: 2,
    products: [
      { title: "Facebook PVA Accounts | Email + Password | Profile Picture", stock: 30, price: 1800, icon: Facebook },
    ],
  },
  {
    category: "TIKTOK", icon: Music2, color: "oklch(0.25 0.02 280)", count: 2,
    products: [
      { title: "TikTok USA Aged Accounts | 1K+ Followers | Email Access", stock: 7, price: 3000, icon: Music2 },
    ],
  },
  {
    category: "YOUTUBE", icon: Youtube, color: "oklch(0.6 0.22 25)", count: 2,
    products: [
      { title: "YouTube Monetized Channel | 1K Subs + 4K Watch Hours", stock: 3, price: 95000, icon: Youtube },
    ],
  },
  {
    category: "VPN SERVICES", icon: Globe, color: "oklch(0.55 0.18 160)", count: 4,
    products: [
      { title: "HMA VPN | PREMIUM | One device, One user — 30 days | Mail | Password", stock: 8, price: 3000, icon: Globe },
      { title: "IPVANISH VPN | PREMIUM | Use Time: 30 days | Mail + Password", stock: 0, price: 3000, icon: Globe },
      { title: "NordVPN | 1 Year Subscription | Premium Account", stock: 4, price: 7500, icon: Globe },
    ],
  },
  {
    category: "EMAIL SERVICES", icon: Mail, color: "oklch(0.55 0.18 290)", count: 3,
    products: [
      { title: "Outlook Aged Email | 2020-2022 | POP/IMAP Enabled", stock: 50, price: 600, icon: Mail },
    ],
  },
];

function formatNGN(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name,last_name,username,email,wallet_balance")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
      }
      setProfile(
        data ?? {
          first_name: null, last_name: null, username: null,
          email: session.user.email ?? null, wallet_balance: 0,
        },
      );
      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/login" });
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate({ to: "/" });
  }

  const filtered = SERVICES.map(s => ({
    ...s,
    products: search
      ? s.products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
      : s.products,
  })).filter(s => !search || s.products.length > 0 || s.category.toLowerCase().includes(search.toLowerCase()));

  const displayName = profile?.first_name || profile?.username || profile?.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background border-b border-border/60 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border/70 bg-card hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <span className="font-display font-extrabold text-2xl tracking-tight text-primary">
              KAMZY<span className="text-gradient">BOT</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/wallet" className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-2 text-sm font-semibold border border-primary/20 hover:bg-primary/20 transition-colors">
              <Wallet className="w-4 h-4" />
              {loading ? "…" : formatNGN(profile?.wallet_balance ?? 0)}
            </Link>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside
            className="relative w-[82vw] max-w-xs h-full bg-card shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 bg-cta-gradient text-primary-foreground">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-xs opacity-80 truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-sm flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Wallet: <span className="font-bold ml-auto">{formatNGN(profile?.wallet_balance ?? 0)}</span>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {[
                { label: "Dashboard", to: "/dashboard" },
                { label: "Products", to: "/products" },
                { label: "Wallet", to: "/wallet" },
                { label: "Contact", to: "/contact" },
                { label: "About", to: "/about" },
                { label: "Home", to: "/" },
              ].map(item => (
                <Link key={item.label} to={item.to} onClick={() => setSidebarOpen(false)}
                  className="block px-6 py-4 text-base font-medium hover:bg-muted transition-colors border-b border-border/40">
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="w-full text-left px-6 py-4 text-base font-medium text-destructive hover:bg-destructive/10 transition-colors border-b border-border/40 inline-flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </nav>
          </aside>
        </div>
      )}

      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl text-primary tracking-tight">
            Service Marketplace
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Welcome back, <span className="font-semibold text-foreground">{displayName}</span> — browse premium digital assets below.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="What are you looking for today?"
              className="w-full h-14 rounded-2xl border border-border bg-card pl-12 pr-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Service categories */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(svc => {
            const Icon = svc.icon;
            return (
              <section key={svc.category} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-5 flex items-start gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-soft shrink-0"
                    style={{ background: svc.color }}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-xl font-bold tracking-tight">{svc.category}</h2>
                    <span
                      className="inline-block mt-1 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ background: svc.color }}
                    >
                      {svc.count} SERVICES
                    </span>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Premium high-quality services for {svc.category}. Boost your presence with our instant delivery solutions.
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <button
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-white font-semibold transition-transform hover:scale-[1.01]"
                    style={{ background: svc.color }}
                  >
                    Browse All <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="border-t border-border bg-muted/30 p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">Most Popular</h3>
                  <ul className="space-y-4">
                    {svc.products.slice(0, 2).map((p, i) => {
                      const PIcon = p.icon;
                      const out = p.stock === 0;
                      return (
                        <li key={i} className="rounded-xl bg-card border border-border/60 p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
                              <PIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold leading-snug">{p.title}</p>
                              <p className="text-xs mt-2">
                                <span className="text-muted-foreground">In Stock:</span>{" "}
                                <span className={out ? "text-destructive font-bold" : "text-foreground font-bold"}>
                                  {p.stock} qty.
                                </span>
                              </p>
                              <p className="text-xs">
                                <span className="text-muted-foreground">Per Quantity:</span>{" "}
                                <span className="font-bold">{formatNGN(p.price)}</span>
                              </p>
                              <button
                                disabled={out}
                                onClick={() => out ? toast.error("Out of stock") : toast.success(`Added "${p.title.slice(0, 30)}…" to cart`)}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold shadow-soft disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-transform"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" /> Purchase
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <a
        href="https://wa.me/2348159696814"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold shadow-soft hover:scale-105 transition-transform z-30"
      >
        <Send className="w-4 h-4" /> Message Us
      </a>
>>>>>>> 9a097937a83c99b045df78274b2e655078e2daaf
    </div>
  );
}
