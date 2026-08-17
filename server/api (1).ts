import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import multer from "multer";
import { pool } from "./db";
import logsRouter from "./routes/logs";
import {
  neuraPayConfig,
  neuraPayRequest,
  neuraPayErrorMessage,
  isNeuraPaySuccess,
  isPaidStatus,
  extractValue,
  sbFetch,
  getIntent,
  creditWalletOnce,
  verifyAndCreditIntent,
  listPendingIntents,
} from "../functions/api/_neurapay.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";

// Prevent one unhandled error anywhere in the process from killing the whole
// server (which is what was causing Cloudflare-level 502 "Bad Gateway" pages —
// the origin process died, so Cloudflare couldn't reach it at all).
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

const app = express();
app.use(cors());
app.use(express.json());

// ─── File upload (multer) ──────────────────────────────────────────────────
const uploadsDir = path.resolve(__dirname, "../public/uploads");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// ─── Config ──────────────────────────────────────────────────────────
// Prefer VITE_SUPABASE_URL (the active project) over the legacy SUPABASE_URL
function readEnv(key: string) {
  const value = process.env[key];
  return value !== undefined && value !== null && value !== "" ? value : "";
}

const SUPABASE_URL = readEnv("VITE_SUPABASE_URL") || readEnv("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const NEURAPAY_SECRET_KEY = readEnv("NEURAPAY_SECRET_KEY");
const ADMIN_EMAIL = readEnv("ADMIN_EMAIL");
const ADMIN_API_TOKEN = readEnv("ADMIN_API_TOKEN");

// ─── Supabase admin client ─────────────────────────────────────────────────
let supabaseAdmin: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    console.log("[API] Supabase admin client initialized");
  } catch (e) {
    console.error("[API] Failed to initialize Supabase client:", e);
  }
} else {
  console.warn(
    "[API] ⚠️  SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set — auth-dependent routes will return 503",
  );
}

// ─── Admin auto-seeding ────────────────────────────────────────────────────
async function seedAdmin() {
  if (!supabaseAdmin || !ADMIN_EMAIL) return;
  try {
    // Find the user by email
    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr || !users) return;
    const adminUser = users.users.find((u) => u.email === ADMIN_EMAIL);
    if (!adminUser) {
      console.log(
        `[API] Admin seed: user ${ADMIN_EMAIL} not found in auth — they must sign up first`,
      );
      return;
    }
    // Check if role already exists
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .limit(1);
    if (existing && existing.length > 0) {
      console.log(`[API] Admin seed: ${ADMIN_EMAIL} already has admin role ✓`);
      return;
    }
    // Insert admin role
    const { error: insertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: adminUser.id, role: "admin" });
    if (insertErr) {
      console.error("[API] Admin seed: failed to insert role —", insertErr.message);
    } else {
      console.log(`[API] ✅ Admin role granted to ${ADMIN_EMAIL}`);
    }
  } catch (e) {
    console.error("[API] Admin seed error:", e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────
function requireSupabase(res: express.Response): supabaseAdmin is SupabaseClient {
  if (!supabaseAdmin) {
    res.status(503).json({
      error:
        "Service temporarily unavailable — Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Replit Secrets.",
    });
    return false;
  }
  return true;
}

type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  suspended: boolean;
  created_at: string;
};

type WalletRow = { user_id: string; balance: number };

async function getAuthUser(req: express.Request) {
  if (!supabaseAdmin) return null;
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function err(res: express.Response, status: number, msg: string) {
  return res.status(status).json({ error: msg });
}


// ─── Routes ──────────────────────────────────────────────────────────

// Image upload — no auth required (admin-only UI enforces access control)
app.post("/api/upload/image", upload.single("file"), (req, res) => {
  if (!req.file) return err(res, 400, "No file uploaded");
  const siteUrl =
    process.env.VITE_SITE_URL ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
  const url = siteUrl ? `${siteUrl}/uploads/${req.file.filename}` : `/uploads/${req.file.filename}`;
  return res.json({ url });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    supabase: !!supabaseAdmin,
    neurapay: !!NEURAPAY_SECRET_KEY,
    adminEmail: ADMIN_EMAIL || null,
  });
});

// ─── NeuraPay (dev/preview) — mirrors the Cloudflare Pages Functions exactly ──
// Both runtimes share functions/api/_neurapay.js so preview and production
// behave identically: init = POST /virtual-accounts, verify = GET
// /transactions/{reference}, credits are atomic + idempotent.

const MIN_TOPUP = 100;
const MAX_TOPUP = 1_000_000;

function npEnv() {
  const supabaseUrl = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { supabaseUrl, serviceKey, cfg: neuraPayConfig(process.env) };
}

app.get("/api/payment/neurapay-diagnostics", async (_req, res) => {
  const { supabaseUrl, serviceKey, cfg } = npEnv();
  let paymentIntents: { reachable: boolean; httpStatus: number; message: string | null } = {
    reachable: false,
    httpStatus: 0,
    message: null,
  };
  if (supabaseUrl && serviceKey) {
    try {
      const r = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/payment_intents?select=id&limit=1");
      const body = await r.text().catch(() => "");
      paymentIntents = { reachable: r.ok, httpStatus: r.status, message: r.ok ? null : body.slice(0, 300) };
    } catch (e) {
      paymentIntents = { reachable: false, httpStatus: 0, message: e instanceof Error ? e.message : String(e) };
    }
  }
  res.json({
    ok: true,
    runtime: "express-dev",
    variables: {
      NEURAPAY_SECRET_KEY: Boolean(cfg.secretKey),
      NEURAPAY_PUBLIC_KEY: Boolean(cfg.publicKey),
      NEURAPAY_WEBHOOK_SECRET: Boolean(cfg.webhookSecret),
      NEURAPAY_BUSINESS_ID: Boolean(cfg.businessId),
      NEURAPAY_BASE_URL: cfg.baseUrl,
      NEURAPAY_INIT_PATH: cfg.initPath,
      SUPABASE_URL: Boolean(supabaseUrl),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
    },
    paymentIntents,
  });
});

app.post("/api/payment/init-neurapay", async (req, res) => {
  try {
    const { supabaseUrl, serviceKey, cfg } = npEnv();
    if (!supabaseUrl || !serviceKey)
      return err(res, 503, "Payment initialization failed: server is missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    if (!cfg.secretKey)
      return err(res, 503, "Payment initialization failed: NEURAPAY_SECRET_KEY is not set on the server.");
    if (!cfg.businessId)
      return err(res, 503, "Payment initialization failed: NEURAPAY_BUSINESS_ID is not set on the server.");

    const user = await getAuthUser(req);
    if (!user) return err(res, 401, "Unauthorized");

    const { amount: rawAmount, userId: bodyUserId, reference: rawReference } = req.body as {
      amount?: number;
      userId?: string;
      reference?: string;
    };
    const amount = Number(rawAmount);
    const reference = String(rawReference ?? "").trim();
    if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP)
      return err(res, 400, `Enter an amount between ₦${MIN_TOPUP} and ₦${MAX_TOPUP.toLocaleString()}.`);
    if (!/^[A-Za-z0-9._-]{8,64}$/.test(reference)) return err(res, 400, "Invalid payment reference");
    if (bodyUserId && bodyUserId !== user.id) return err(res, 403, "Forbidden");
    const userId = user.id;

    const existing = await getIntent(supabaseUrl, serviceKey, reference, userId);
    if (existing?.status === "success")
      return res.json({ success: true, reference, amount: Number(existing.amount ?? amount), alreadyCredited: true });

    const nowIso = new Date().toISOString();
    const upsert = await sbFetch(supabaseUrl, serviceKey, "/rest/v1/payment_intents?on_conflict=reference", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        user_id: userId,
        provider: "neurapay",
        reference,
        amount,
        currency: "NGN",
        status: "pending",
        description: "Wallet funding via NeuraPay",
        created_at: nowIso,
        updated_at: nowIso,
      }),
    });

    if (!upsert.ok) {
      const detail = await upsert.text().catch(() => "");
      console.error("[API] init-neurapay supabase insert failed", upsert.status, detail);
      return err(
        res,
        500,
        `Payment initialization failed: payment_intents insert failed (HTTP ${upsert.status}) — ${detail.slice(0, 300)}`,
      );
    }

    const customerName = String(
      (user.user_metadata as Record<string, unknown> | undefined)?.full_name || user.email || "customer",
    ).split("@")[0];
    const siteUrl = process.env.VITE_SITE_URL ?? "https://kamzybotsmedia.store";

    const result = await neuraPayRequest(
      cfg,
      cfg.initPath,
      {
        customer_name: customerName,
        customer_email: user.email ?? "",
        amount,
        reference,
        currency: "NGN",
        description: `Wallet funding (${reference})`,
        callback_url: `${siteUrl}/wallet?ref=${encodeURIComponent(reference)}&provider=neurapay`,
      },
      cfg.initMethod,
    );

    if (!result.ok || !isNeuraPaySuccess(result.json)) {
      console.error("[API] NeuraPay init failed", result.status, result.networkError, result.raw?.slice(0, 500));
      await sbFetch(
        supabaseUrl,
        serviceKey,
        `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
        },
      );
      return err(
        res,
        400,
        result.networkError
          ? `Payment initialization failed: could not reach NeuraPay (${result.networkError})`
          : `Payment initialization failed: NeuraPay returned HTTP ${result.status} — ${neuraPayErrorMessage(result, "Could not start this payment")}`,
      );
    }

    const providerReference = extractValue(result.json, [
      "transactionId",
      "transaction_id",
      "transactionReference",
      "transaction_reference",
      "id",
      "reference",
    ]);

    await sbFetch(supabaseUrl, serviceKey, `/rest/v1/payment_intents?reference=eq.${encodeURIComponent(reference)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        raw: result.json,
        provider_reference: providerReference ? String(providerReference) : null,
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => {});

    const paymentUrl = extractValue(result.json, [
      "paymentUrl",
      "payment_url",
      "checkoutUrl",
      "checkout_url",
      "authorization_url",
      "link",
      "url",
    ]);
    const accountNumber = extractValue(result.json, [
      "accountNumber",
      "account_number",
      "virtualAccountNumber",
      "virtual_account_number",
      "accountNo",
      "account_no",
    ]);
    const bankName = extractValue(result.json, ["bankName", "bank_name", "bank", "accountBank"]);

    return res.json({
      success: true,
      reference,
      amount,
      providerReference: providerReference ? String(providerReference) : null,
      paymentUrl: paymentUrl ? String(paymentUrl) : null,
      accountNumber: accountNumber ? String(accountNumber) : null,
      bankName: bankName ? String(bankName) : null,
      publicKey: cfg.publicKey,
      instructions: paymentUrl
        ? "Continue to NeuraPay to complete your payment, then return here to verify."
        : "Transfer the exact amount to the account below, then tap Verify Payment.",
    });
  } catch (error) {
    console.error("[API] init-neurapay crashed", error);
    return err(res, 500, "Something went wrong starting this payment. Please try again.");
  }
});

app.post("/api/payment/verify-neurapay", async (req, res) => {
  try {
    const { supabaseUrl, serviceKey, cfg } = npEnv();
    if (!supabaseUrl || !serviceKey || !cfg.secretKey)
      return err(res, 503, "Payments are temporarily unavailable. Please try again later.");

    const user = await getAuthUser(req);
    if (!user) return err(res, 401, "Unauthorized");

    const { reference: rawReference, userId: bodyUserId } = req.body as {
      reference?: string;
      userId?: string;
    };
    const reference = String(rawReference ?? "").trim();
    if (!reference) return err(res, 400, "reference is required");
    if (bodyUserId && bodyUserId !== user.id) return err(res, 403, "Forbidden");

    const intent = await getIntent(supabaseUrl, serviceKey, reference, user.id);
    if (!intent) return err(res, 404, "Invalid or expired payment reference");

    const outcome = await verifyAndCreditIntent(cfg, supabaseUrl, serviceKey, intent);
    return res.json(outcome);
  } catch (error) {
    console.error("[API] verify-neurapay crashed", error);
    return err(res, 500, "Something went wrong verifying this payment. Please try again.");
  }
});

// Sweeps every pending NeuraPay intent for the caller and credits the ones
// NeuraPay confirms — the safety net when the user never returns to the tab.
app.post("/api/payment/reconcile-neurapay", async (req, res) => {
  try {
    const { supabaseUrl, serviceKey, cfg } = npEnv();
    if (!supabaseUrl || !serviceKey || !cfg.secretKey)
      return err(res, 503, "Payments are temporarily unavailable.");

    const user = await getAuthUser(req);
    if (!user) return err(res, 401, "Unauthorized");

    const pending = await listPendingIntents(supabaseUrl, serviceKey, user.id);
    let creditedCount = 0;
    let creditedAmount = 0;
    const results: Array<{ reference: string; status: string }> = [];
    for (const intent of pending) {
      const outcome = await verifyAndCreditIntent(cfg, supabaseUrl, serviceKey, intent);
      if (outcome.success && !outcome.alreadyCredited) {
        creditedCount += 1;
        creditedAmount += Number(outcome.amount ?? 0);
      }
      results.push({ reference: intent.reference, status: outcome.status });
    }

    return res.json({
      success: true,
      pending: pending.length,
      creditedCount,
      creditedAmount,
      results,
    });
  } catch (error) {
    console.error("[API] reconcile-neurapay crashed", error);
    return err(res, 500, "Could not check your pending payments right now.");
  }
});


app.post("/api/payment/admin-credit", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { targetUserId, amount, description } = req.body as {
    targetUserId?: string;
    amount?: number;
    description?: string;
  };
  if (!targetUserId || !amount || !description)
    return err(res, 400, "targetUserId, amount and description are required");

  const ref = `admin-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const { error: creditErr } = await supabaseAdmin!.rpc(
    "credit_wallet" as never,
    {
      _user_id: targetUserId,
      _amount: amount,
      _provider: "manual",
      _reference: ref,
      _description: description,
    } as never,
  );
  if (creditErr) return err(res, 500, (creditErr as { message: string }).message);

  await supabaseAdmin!.from("activity_logs").insert({
    actor_id: adminId,
    action: "admin_credit_wallet",
    target: targetUserId,
    metadata: { amount, description, ref },
  });

  return res.json({ success: true });
});

// New endpoint: Verify manual deposit (admin token or admin role)
app.post("/api/admin/manual-deposits/verify", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { reference } = req.body as { reference?: string };
  if (!reference) return err(res, 400, "reference is required");

  if (!pool) return err(res, 500, "Database not configured");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the payment_intent row
    const intentRes = await client.query(
      `SELECT reference, user_id, amount, provider, status
       FROM payment_intents
       WHERE reference = $1
       FOR UPDATE`,
      [reference],
    );

    if (intentRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return err(res, 404, "payment_intent not found");
    }

    const intent = intentRes.rows[0] as {
      reference: string;
      user_id: string;
      amount: number;
      provider: string;
      status: string;
    };

    if (intent.provider !== "manual") {
      await client.query("ROLLBACK");
      return err(res, 400, "intent is not a manual deposit");
    }

    if (intent.status === "completed" || intent.status === "success") {
      await client.query("ROLLBACK");
      return err(res, 409, "payment_intent already completed");
    }

    if (!["pending", "submitted"].includes(intent.status)) {
      await client.query("ROLLBACK");
      return err(res, 400, `cannot verify intent in status: ${intent.status}`);
    }

    // Lock or create wallet row and update balance (ensure we have wallet.id)
    const walletRes = await client.query(
      `SELECT id, user_id, balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [intent.user_id],
    );

    let newBalance: number;
    let walletId: string | null = null;
    if (walletRes.rowCount === 0) {
      const ins = await client.query(
        `INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING id`,
        [intent.user_id, intent.amount],
      );
      walletId = ins.rows[0].id;
      newBalance = Number(intent.amount);
    } else {
      walletId = walletRes.rows[0].id;
      const current = Number(walletRes.rows[0].balance ?? 0);
      newBalance = current + Number(intent.amount);
      await client.query(`UPDATE wallets SET balance = $1 WHERE user_id = $2`, [
        newBalance,
        intent.user_id,
      ]);
    }

    // Insert a wallet_transactions/audit row with required columns
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, status, provider, reference, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
      [
        walletId,
        intent.user_id,
        "credit",
        intent.amount,
        newBalance,
        "success",
        intent.provider ?? "manual",
        intent.reference,
      ],
    );

    // Update payment_intents status -> completed and set audit fields
    await client.query(
      `UPDATE payment_intents
       SET status = 'completed', verified_by = $2, verified_at = now()
       WHERE reference = $1`,
      [intent.reference, adminId],
    );

    // Add activity log entry for manual deposit verification
    await client.query(
      `INSERT INTO activity_logs (actor_id, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, now())`,
      [
        adminId,
        "verify_manual_deposit",
        intent.user_id,
        JSON.stringify({ reference: intent.reference, amount: intent.amount }),
      ],
    );

    await client.query("COMMIT");

    return res.json({
      status: "ok",
      reference: intent.reference,
      user_id: intent.user_id,
      amount: intent.amount,
      newBalance,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("verifyManualDeposit error:", e);
    return err(res, 500, "Internal server error");
  } finally {
    client.release();
  }
});

// ─── Admin: User management APIs ─────────────────────────────────────────────
app.get("/api/admin/users", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const q = (req.query.q as string) ?? "";
  const suspended = req.query.suspended;
  try {
    let query = supabaseAdmin!
      .from("profiles")
      .select("id,email,display_name,suspended,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) query = query.ilike("email", `%${q}%`);
    if (suspended === "true") query = query.eq("suspended", true);
    if (suspended === "false") query = query.eq("suspended", false);
    const { data, error } = await query;
    if (error) return err(res, 500, error.message);
    // Enrich with wallet balance
    const users = (data ?? []) as AdminUserRow[];
    const userIds = users.map((u) => u.id);
    const { data: wallets } = await supabaseAdmin!
      .from("wallets")
      .select("user_id,balance")
      .in("user_id", userIds);
    const walletMap = Object.fromEntries(
      (wallets ?? []).map((w: WalletRow) => [w.user_id, w.balance]),
    );
    const result = users.map((u) => ({ ...u, wallet_balance: walletMap[u.id] ?? 0 }));
    return res.json({ users: result });
  } catch (e) {
    console.error("/api/admin/users error:", e);
    return err(res, 500, "Internal server error");
  }
});

app.post("/api/admin/users/:id/suspend", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const target = req.params.id;
  const { suspended } = req.body as { suspended?: boolean };
  if (suspended === undefined) return err(res, 400, "suspended is required");
  const { error } = await supabaseAdmin!
    .from("profiles")
    .update({ suspended, updated_at: new Date().toISOString() })
    .eq("id", target);
  if (error) return err(res, 500, error.message);
  await supabaseAdmin!.from("activity_logs").insert({
    actor_id: adminId,
    action: suspended ? "suspend_user" : "unsuspend_user",
    target,
    metadata: { suspended },
  });
  return res.json({ success: true });
});

app.post("/api/admin/users/:id/debit", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const target = req.params.id;
  const { amount, description } = req.body as { amount?: number; description?: string };
  if (!amount || amount <= 0 || !description)
    return err(res, 400, "amount and description are required");
  if (!pool) return err(res, 500, "Database not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const walletRes = await client.query(
      `SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [target],
    );
    if (walletRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return err(res, 404, "wallet not found");
    }
    const wallet = walletRes.rows[0];
    const current = Number(wallet.balance ?? 0);
    if (current < amount) {
      await client.query("ROLLBACK");
      return err(res, 400, "insufficient balance");
    }
    const newBal = current - amount;
    await client.query(`UPDATE wallets SET balance = $1, updated_at = now() WHERE id = $2`, [
      newBal,
      wallet.id,
    ]);
    const txRef = `admin-debit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const txRes = await client.query(
      `INSERT INTO wallet_transactions (wallet_id,user_id,type,amount,balance_after,status,provider,reference,description,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) RETURNING id`,
      [wallet.id, target, "debit", amount, newBal, "success", "manual", txRef, description],
    );
    await client.query(
      `INSERT INTO activity_logs (actor_id, action, target, metadata, created_at) VALUES ($1,$2,$3,$4, now())`,
      [adminId, "admin_debit", target, JSON.stringify({ amount, description })],
    );
    await client.query("COMMIT");
    return res.json({ success: true, newBalance: newBal });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("admin debit error:", e);
    return err(res, 500, "Internal server error");
  } finally {
    client.release();
  }
});

// ─── Payment: admin-debit (alias for /api/admin/users/:id/debit) ──────────────
app.post("/api/payment/admin-debit", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const { targetUserId, amount, description } = req.body as {
    targetUserId?: string;
    amount?: number;
    description?: string;
  };
  if (!targetUserId || !amount || amount <= 0 || !description)
    return err(res, 400, "targetUserId, amount and description are required");
  if (!pool) return err(res, 500, "Database not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const walletRes = await client.query(
      `SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [targetUserId],
    );
    if (walletRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return err(res, 404, "wallet not found");
    }
    const wallet = walletRes.rows[0];
    const current = Number(wallet.balance ?? 0);
    if (current < amount) {
      await client.query("ROLLBACK");
      return err(res, 400, "insufficient balance");
    }
    const newBal = current - amount;
    await client.query(`UPDATE wallets SET balance = $1, updated_at = now() WHERE id = $2`, [
      newBal,
      wallet.id,
    ]);
    const txRef = `admin-debit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id,user_id,type,amount,balance_after,status,provider,reference,description,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [wallet.id, targetUserId, "debit", amount, newBal, "success", "manual", txRef, description],
    );
    await client.query(
      `INSERT INTO activity_logs (actor_id, action, target, metadata, created_at) VALUES ($1,$2,$3,$4, now())`,
      [adminId, "admin_debit_wallet", targetUserId, JSON.stringify({ amount, description })],
    );
    await client.query("COMMIT");
    return res.json({ success: true, newBalance: newBal });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("admin-debit error:", e);
    return err(res, 500, "Internal server error");
  } finally {
    client.release();
  }
});

// Admin credit already exists as /api/payment/admin-credit

// ─── Wallet ensure ────────────────────────────────────────────────────────────
app.post("/api/wallet/ensure", async (req, res) => {
  if (!requireSupabase(res)) return;
  const user = await getAuthUser(req);
  if (!user) return err(res, 401, "Unauthorized");
  const { userId } = req.body as { userId?: string };
  if (!userId || userId !== user.id) return err(res, 403, "Forbidden");
  try {
    const { data: existing } = await supabaseAdmin!
      .from("wallets")
      .select("id,balance,currency,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return res.json({ wallet: existing });
    const { data: created, error: insErr } = await supabaseAdmin!
      .from("wallets")
      .insert({ user_id: userId, balance: 0, currency: "NGN" })
      .select("id,balance,currency,updated_at")
      .single();
    if (insErr) return err(res, 500, insErr.message);
    return res.json({ wallet: created });
  } catch (e) {
    console.error("wallet/ensure error:", e);
    return err(res, 500, "Internal server error");
  }
});

// ─── Delivery routes ──────────────────────────────────────────────────────────
app.post("/api/delivery/assign-credential", async (req, res) => {
  if (!requireSupabase(res)) return;
  const user = await getAuthUser(req);
  if (!user) return err(res, 401, "Unauthorized");
  const { orderId, productId } = req.body as { orderId?: string; productId?: string };
  if (!orderId || !productId) return err(res, 400, "orderId and productId are required");

  // Verify user owns the order
  const { data: order } = await supabaseAdmin!
    .from("orders")
    .select("id,user_id")
    .eq("id", orderId)
    .single();
  if (!order) return err(res, 404, "Order not found");
  if ((order as Record<string, unknown>).user_id !== user.id) return err(res, 403, "Forbidden");

  if (!pool) return err(res, 503, "Database not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // FIFO: pick the oldest unassigned credential for this product
    const credRes = await client.query(
      `SELECT id, content, label FROM product_credentials WHERE product_id = $1 AND order_id IS NULL ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [productId],
    );
    if (credRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.json({
        assigned: false,
        content: null,
        label: null,
        message: "No available credentials — contact support",
      });
    }
    const cred = credRes.rows[0];
    await client.query(
      `UPDATE product_credentials SET order_id = $1, delivered_at = now() WHERE id = $2`,
      [orderId, cred.id],
    );
    // Also stamp delivered_payload on order_items so the user's orders page can display it
    await client.query(
      `UPDATE order_items SET delivered_payload = $1 WHERE order_id = $2 AND product_id = $3 AND delivered_payload IS NULL LIMIT 1`,
      [cred.content, orderId, productId],
    );
    await client.query("COMMIT");
    return res.json({ assigned: true, content: cred.content, label: cred.label ?? null });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("assign-credential error:", e);
    return err(res, 500, "Internal server error");
  } finally {
    client.release();
  }
});

app.post("/api/delivery/admin-redispense", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const { orderId, productId } = req.body as { orderId?: string; productId?: string };
  if (!orderId || !productId) return err(res, 400, "orderId and productId are required");

  if (!pool) return err(res, 503, "Database not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const credRes = await client.query(
      `SELECT id, content, label FROM product_credentials WHERE product_id = $1 AND order_id IS NULL ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [productId],
    );
    if (credRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.json({
        assigned: false,
        message: "No available credentials — add more in the Credentials panel",
      });
    }
    const cred = credRes.rows[0];
    await client.query(
      `UPDATE product_credentials SET order_id = $1, delivered_at = now() WHERE id = $2`,
      [orderId, cred.id],
    );
    // Stamp delivered_payload on order_items so user can see it
    await client.query(
      `UPDATE order_items SET delivered_payload = $1 WHERE order_id = $2 AND product_id = $3 AND delivered_payload IS NULL LIMIT 1`,
      [cred.content, orderId, productId],
    );
    await client.query(
      `INSERT INTO activity_logs (actor_id, action, target, metadata, created_at) VALUES ($1,'admin_redispense_credential',$2,$3,now())`,
      [adminId, orderId, JSON.stringify({ productId, credentialId: cred.id })],
    );
    await client.query("COMMIT");
    return res.json({ assigned: true, content: cred.content, label: cred.label ?? null });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("admin-redispense error:", e);
    return err(res, 500, "Internal server error");
  } finally {
    client.release();
  }
});

// ─── Products CRUD ────────────────────────────────────────────────────────────
async function requireAdmin(req: express.Request, res: express.Response): Promise<string | null> {
  const adminHeader = req.header("X-Admin-Token");
  if (adminHeader && ADMIN_API_TOKEN && adminHeader === ADMIN_API_TOKEN) {
    return "api-token";
  }

  if (!requireSupabase(res)) return null;
  const user = await getAuthUser(req);
  if (!user) {
    err(res, 401, "Unauthorized");
    return null;
  }
  const { data: roles } = await supabaseAdmin!
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);
  if (!roles || roles.length === 0) {
    err(res, 403, "Forbidden");
    return null;
  }
  return user.id;
}

app.post("/api/products/upsert", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const body = req.body as Record<string, unknown>;
  try {
    if (body.id) {
      const { id, ...rest } = body;
      const { error } = await supabaseAdmin!
        .from("products")
        .update(rest)
        .eq("id", id as string);
      if (error) return err(res, 500, error.message);
      return res.json({ success: true });
    } else {
      const { error } = await supabaseAdmin!.from("products").insert(body);
      if (error) return err(res, 500, error.message);
      return res.json({ success: true });
    }
  } catch (e) {
    console.error("products/upsert error:", e);
    return err(res, 500, "Internal server error");
  }
});

app.delete("/api/products/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const { error } = await supabaseAdmin!.from("products").delete().eq("id", req.params.id);
  if (error) return err(res, 500, error.message);
  return res.json({ success: true });
});

// ─── Categories CRUD ──────────────────────────────────────────────────────────
app.post("/api/categories/upsert", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const body = req.body as Record<string, unknown>;
  try {
    if (body.id) {
      const { id, ...rest } = body;
      const { error } = await supabaseAdmin!
        .from("product_categories")
        .update(rest)
        .eq("id", id as string);
      if (error) return err(res, 500, error.message);
    } else {
      const { error } = await supabaseAdmin!.from("product_categories").insert(body);
      if (error) return err(res, 500, error.message);
    }
    return res.json({ success: true });
  } catch (e) {
    console.error("categories/upsert error:", e);
    return err(res, 500, "Internal server error");
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const { error } = await supabaseAdmin!
    .from("product_categories")
    .delete()
    .eq("id", req.params.id);
  if (error) return err(res, 500, error.message);
  return res.json({ success: true });
});

// ─── Notifications APIs ─────────────────────────────────────────────────────
app.post("/api/admin/notifications/send", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const { title, message, userIds } = req.body as {
    title?: string;
    message?: string;
    userIds?: string[];
  };
  if (!title || !message) return err(res, 400, "title and message required");
  try {
    if (!userIds || userIds.length === 0) {
      // Broadcast
      const { error } = await supabaseAdmin!
        .from("notifications")
        .insert({ title, message, target_user_id: null, created_by: adminId });
      if (error) return err(res, 500, error.message);
      await supabaseAdmin!
        .from("activity_logs")
        .insert({ actor_id: adminId, action: "send_notification_broadcast", metadata: { title } });
      return res.json({ success: true });
    }
    // Send to selected users
    const rows = userIds.map((uid) => ({
      title,
      message,
      target_user_id: uid,
      created_by: adminId,
    }));
    const { error } = await supabaseAdmin!.from("notifications").insert(rows);
    if (error) return err(res, 500, error.message);
    await supabaseAdmin!.from("activity_logs").insert({
      actor_id: adminId,
      action: "send_notification_selected",
      metadata: { title, user_count: userIds.length },
    });
    return res.json({ success: true });
  } catch (e) {
    console.error("send notif error", e);
    return err(res, 500, "Internal server error");
  }
});

app.get("/api/notifications", async (req, res) => {
  if (!requireSupabase(res)) return;
  const user = await getAuthUser(req);
  if (!user) return err(res, 401, "Unauthorized");
  try {
    const { data } = await supabaseAdmin!
      .from("notifications")
      .select("id,title,message,target_user_id,created_at,created_by")
      .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(200);
    // Include read status
    const ids = (data ?? []).map((n: { id: string }) => n.id);
    const { data: reads } = await supabaseAdmin!
      .from("notification_reads")
      .select("notification_id,user_id,read_at")
      .in("notification_id", ids)
      .eq("user_id", user.id);
    const readSet = new Set(
      (reads ?? []).map((r: { notification_id: string }) => r.notification_id),
    );
    const out = (data ?? []).map((n: { id: string }) => ({ ...n, read: readSet.has(n.id) }));
    return res.json({ notifications: out });
  } catch (e) {
    console.error("/api/notifications error", e);
    return err(res, 500, "Internal server error");
  }
});

app.post("/api/notifications/:id/read", async (req, res) => {
  if (!requireSupabase(res)) return;
  const user = await getAuthUser(req);
  if (!user) return err(res, 401, "Unauthorized");
  const id = req.params.id;
  try {
    const { error } = await supabaseAdmin!
      .from("notification_reads")
      .insert({ notification_id: id, user_id: user.id });
    if (error) return err(res, 500, error.message);
    return res.json({ success: true });
  } catch (e) {
    console.error("mark read", e);
    return err(res, 500, "Internal server error");
  }
});

// ─── Marketplace chat APIs ──────────────────────────────────────────────────
app.post("/api/marketplace/conversations", async (req, res) => {
  // Create or return an existing conversation for this product between buyer and seller
  const adminHeader = req.header("X-Admin-Token");
  if (!requireSupabase(res) && !(adminHeader && ADMIN_API_TOKEN && adminHeader === ADMIN_API_TOKEN))
    return;

  const user = await getAuthUser(req);
  const { productId, sellerId } = req.body as { productId?: string; sellerId?: string };
  if (!productId) return err(res, 400, "productId is required");

  // If called with admin token, allow specifying buyerId in body
  const buyerIdFromBody = (req.body as { buyerId?: string }).buyerId;
  const buyerId = user?.id ?? buyerIdFromBody ?? null;
  if (!buyerId) return err(res, 401, "Unauthorized");

  try {
    const { data: existing } = await supabaseAdmin!
      .from("marketplace_conversations")
      .select("*")
      .eq("product_id", productId)
      .eq("buyer_id", buyerId)
      .limit(1);
    if (existing && existing.length > 0) return res.json({ conversation: existing[0] });

    const { data, error } = await supabaseAdmin!
      .from("marketplace_conversations")
      .insert({ product_id: productId, buyer_id: buyerId, seller_id: sellerId })
      .select("*")
      .single();
    if (error) return err(res, 500, error.message);
    return res.json({ conversation: data });
  } catch (e) {
    console.error("create conversation error", e);
    return err(res, 500, "Internal server error");
  }
});

app.get("/api/marketplace/conversations/:id/messages", async (req, res) => {
  if (!requireSupabase(res)) return;
  const user = await getAuthUser(req);
  if (!user) return err(res, 401, "Unauthorized");
  const convId = req.params.id;
  try {
    const { data: conv } = await supabaseAdmin!
      .from("marketplace_conversations")
      .select("*")
      .eq("id", convId)
      .single();
    if (!conv) return err(res, 404, "conversation not found");
    if (conv.buyer_id !== user.id && conv.seller_id !== user.id) return err(res, 403, "Forbidden");

    const { data: msgs, error } = await supabaseAdmin!
      .from("marketplace_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) return err(res, 500, error.message);
    return res.json({ messages: msgs ?? [] });
  } catch (e) {
    console.error("fetch messages error", e);
    return err(res, 500, "Internal server error");
  }
});

app.post("/api/marketplace/conversations/:id/messages", async (req, res) => {
  if (!requireSupabase(res)) return;
  const user = await getAuthUser(req);
  if (!user) return err(res, 401, "Unauthorized");
  const convId = req.params.id;
  const { message, metadata } = req.body as {
    message?: string;
    metadata?: Record<string, unknown>;
  };
  if (!message) return err(res, 400, "message is required");

  try {
    const { data: conv } = await supabaseAdmin!
      .from("marketplace_conversations")
      .select("*")
      .eq("id", convId)
      .single();
    if (!conv) return err(res, 404, "conversation not found");
    if (conv.buyer_id !== user.id && conv.seller_id !== user.id) return err(res, 403, "Forbidden");

    const { data, error } = await supabaseAdmin!
      .from("marketplace_messages")
      .insert({ conversation_id: convId, sender_id: user.id, message, metadata })
      .select("*")
      .single();
    if (error) return err(res, 500, error.message);

    // Optionally create a notification for the other party
    const target = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
    if (target) {
      await supabaseAdmin!.from("notifications").insert({
        title: "New message",
        message: message.length > 140 ? message.slice(0, 137) + "..." : message,
        target_user_id: target,
        created_by: user.id,
      });
    }

    return res.json({ message: data });
  } catch (e) {
    console.error("post message error", e);
    return err(res, 500, "Internal server error");
  }
});

// ─── Static file serving ──────────────────────────────────────────────────
app.use("/uploads", express.static(uploadsDir));

if (IS_PROD) {
  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  console.log(`[API] Serving static files from ${distPath}`);
}

// ─── Start ──────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? process.env.API_PORT ?? (IS_PROD ? "5000" : "3001"), 10);
app.use("/api", logsRouter);

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`[API] Server running on port ${PORT} (${IS_PROD ? "production" : "development"})`);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    console.warn(
      "[API] ⚠️  Supabase not configured — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Replit Secrets",
    );
  if (!NEURAPAY_SECRET_KEY) console.warn("[API] ⚠️  NEURAPAY_SECRET_KEY not set");
  if (ADMIN_EMAIL) {
    await seedAdmin();
  } else {
    console.log(
      "[API] ℹ️  ADMIN_EMAIL not set — skipping admin seed. Add it to Replit Secrets to auto-grant admin.",
    );
  }
});
