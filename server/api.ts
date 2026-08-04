import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import multer from "multer";
import { pool } from "./db";
import logsRouter from "./routes/logs";

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
const NEURAPAY_PUBLIC_KEY = readEnv("NEURAPAY_PUBLIC_KEY");
const NEURAPAY_SECRET_KEY = readEnv("NEURAPAY_SECRET_KEY");
const NEURAPAY_BASE_URL = readEnv("NEURAPAY_BASE_URL") || "https://neurapay.com.ng/api/v1";
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

function isNeuraPayTestMode(envLike: NodeJS.ProcessEnv | Record<string, unknown> = process.env) {
  const raw = [
    envLike?.NEURAPAY_SECRET_KEY ?? "",
    envLike?.NEURAPAY_PUBLIC_KEY ?? "",
    envLike?.NEURAPAY_BASE_URL ?? "",
    envLike?.NEURAPAY_TEST_MODE ?? "",
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
  return raw.includes("test") || raw.includes("demo") || raw.includes("placeholder") || raw.includes("fake");
}

function buildFallbackInitResponse(amount: number, reference: string, publicKey: string) {
  return {
    success: true,
    reference,
    amount: Number(amount),
    accountNumber: `NP${String(reference).slice(-8).toUpperCase()}`,
    bankName: "NeuraPay Test Bank",
    instructions: "Transfer the amount to the virtual account below, then verify the payment.",
    publicKey,
    testMode: true,
  };
}

function buildFallbackVerifyResponse(amount: number) {
  return { success: true, amount: Number(amount), alreadyCredited: false, testMode: true };
}

function isNeuraPaySuccess(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return false;
  if (payload.success === true) return true;
  if (payload.status === "success") return true;
  if (payload.status === "paid") return true;
  if ((payload.data as Record<string, unknown> | undefined)?.success === true) return true;
  if ((payload.data as Record<string, unknown> | undefined)?.status === "success") return true;
  return false;
}

function extractNeuraPayErrorMessage(payload: Record<string, unknown> | null | undefined, status: number) {
  const message = extractNeuraPayValue(payload, ["message", "error", "detail", "errorMessage"]);
  if (message) return String(message);
  return `NeuraPay request failed with status ${status}`;
}

function extractNeuraPayValue(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  const visit = (node: unknown, path: string[]): unknown => {
    if (!node || typeof node !== "object") return undefined;
    for (const key of path) {
      const value = (node as Record<string, unknown>)[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      const child = (node as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        const found = visit(child, path);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return visit(payload, keys);
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

app.post("/api/payment/init-neurapay", async (req, res) => {
  try {
    const testMode = isNeuraPayTestMode(process.env);
    if (!testMode && !requireSupabase(res)) return;

    const { amount, userId, reference } = req.body as {
      amount?: number;
      userId?: string;
      reference?: string;
    };
    if (!amount || !userId || !reference)
      return err(res, 400, "amount, userId and reference are required");

    let user: { id: string; email?: string | null } | null = null;
    if (testMode) {
      user = { id: userId, email: `${String(userId).split("-")[0] || "user"}@example.local` };
    } else {
      user = await getAuthUser(req);
      if (!user) return err(res, 401, "Unauthorized");
      if (userId !== user.id) return err(res, 403, "Forbidden");
    }

    if (!testMode && userId !== user.id) return err(res, 403, "Forbidden");

    const payload = {
      amount: Number(amount),
      user_id: userId,
      reference,
      provider: "neurapay",
      status: "pending",
      currency: "NGN",
      description: "Wallet funding via NeuraPay",
    };

    if (!testMode) {
      const { data: existingIntent } = await supabaseAdmin!
        .from("payment_intents")
        .select("reference,status,amount")
        .eq("reference", reference)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingIntent?.status === "success") {
        return res.json({
          success: true,
          amount: Number(existingIntent.amount ?? amount),
          reference,
          alreadyCredited: true,
        });
      }
    }

    if (testMode) {
      return res.json(buildFallbackInitResponse(Number(amount), reference, NEURAPAY_PUBLIC_KEY));
    }

    if (!NEURAPAY_SECRET_KEY || !NEURAPAY_BASE_URL) {
      return err(res, 500, "NeuraPay credentials are not configured. Add NEURAPAY_SECRET_KEY and NEURAPAY_BASE_URL.");
    }

    const siteUrl = process.env.VITE_SITE_URL ?? "https://kamzybotsmedia.store";

    let initRes: Response | null = null;
    let initBody = "";
    try {
      initRes = await fetch(`${NEURAPAY_BASE_URL}/transactions/init`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NEURAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          reference,
          currency: "NGN",
          customerName: user.email?.split("@")[0] || "Customer",
          customerEmail: user.email || "",
          description: `Wallet funding via NeuraPay (${reference})`,
          callbackUrl: `${siteUrl}/wallet?ref=${reference}&userId=${userId}&provider=neurapay`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      initBody = await initRes.text();
    } catch (e) {
      console.error("[API] NeuraPay init request failed", e);
      return err(res, 502, `NeuraPay initialization request failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    let initJson: Record<string, unknown> | null = null;
    try {
      initJson = initBody ? (JSON.parse(initBody) as Record<string, unknown>) : null;
    } catch (e) {
      console.error("[API] NeuraPay init returned invalid JSON", e, initBody);
      return err(res, 502, `NeuraPay returned invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!initRes?.ok || !isNeuraPaySuccess(initJson)) {
      const errorMessage = extractNeuraPayErrorMessage(initJson, initRes?.status ?? 0);
      return err(res, 502, errorMessage);
    }

    const { error: upsertErr } = await supabaseAdmin!.from("payment_intents").upsert(
      {
        ...payload,
        raw: initJson,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "reference" },
    );

    if (upsertErr) return err(res, 500, upsertErr.message);

    const accountNumber = extractNeuraPayValue(initJson, ["accountNumber", "account_number", "virtualAccountNumber", "virtual_account_number", "accountNo", "account_no"]) || `NP${reference.slice(-8).toUpperCase()}`;
    const bankName = extractNeuraPayValue(initJson, ["bankName", "bank_name", "bank", "accountBank"]) || "NeuraPay Virtual Account";

    return res.json({
      success: true,
      reference,
      amount: Number(amount),
      accountNumber,
      bankName,
      instructions: "Transfer the amount to the virtual account below, then verify the payment.",
      publicKey: NEURAPAY_PUBLIC_KEY,
    });
  } catch (error) {
    console.error("[API] init-neurapay crashed", error);
    return err(res, 500, error instanceof Error ? error.message : "Internal server error");
  }
});

app.post("/api/payment/verify-neurapay", async (req, res) => {
  try {
    const testMode = isNeuraPayTestMode(process.env);
    if (!testMode && !requireSupabase(res)) return;

    const { reference, userId } = req.body as { reference?: string; userId?: string };
    if (!reference || !userId) return err(res, 400, "reference and userId are required");

    let user: { id: string; email?: string | null } | null = null;
    if (testMode) {
      user = { id: userId, email: `${String(userId).split("-")[0] || "user"}@example.local` };
    } else {
      user = await getAuthUser(req);
      if (!user) return err(res, 401, "Unauthorized");
      if (userId !== user.id) return err(res, 403, "Forbidden");
    }

    if (!testMode && userId !== user.id) return err(res, 403, "Forbidden");

    if (testMode) {
      return res.json(buildFallbackVerifyResponse(0));
    }

    const { data: intent, error: intentErr } = await supabaseAdmin!
      .from("payment_intents")
      .select("*")
      .eq("reference", reference)
      .eq("user_id", userId)
      .maybeSingle();

    if (intentErr || !intent) return err(res, 400, "Invalid or expired payment reference");
    if ((intent as Record<string, unknown>).status === "success") {
      return res.json({
        success: true,
        amount: Number((intent as Record<string, unknown>).amount),
        alreadyCredited: true,
      });
    }

    if (!NEURAPAY_SECRET_KEY || !NEURAPAY_BASE_URL) {
      return err(res, 500, "NeuraPay credentials are not configured. Add NEURAPAY_SECRET_KEY and NEURAPAY_BASE_URL.");
    }

    const verifyPayload = {
      reference,
      amount: Number((intent as Record<string, unknown>).amount ?? 0),
    };
    const verifyUrl = `${NEURAPAY_BASE_URL}/transactions/verify`;
    let verifyRes: Response | null = null;
    let verifyBody: string | null = null;

    try {
      console.log("[NeuraPay] verify request", { verifyUrl, verifyPayload });
      verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NEURAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyPayload),
        signal: AbortSignal.timeout(10_000),
      });
      verifyBody = await verifyRes.text();
      console.log("[NeuraPay] verify response status", verifyRes.status);
      console.log("[NeuraPay] verify response body", verifyBody);
    } catch (verifyError) {
      console.error("[NeuraPay] verify request failed", verifyError);
      return err(res, 502, `NeuraPay verification request failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`);
    }

    let responseJson: Record<string, unknown> | null = null;
    try {
      responseJson = JSON.parse(verifyBody ?? "null");
    } catch (parseError) {
      console.error("[NeuraPay] failed to parse verify response body", parseError, verifyBody);
      return err(res, 502, `NeuraPay returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    const success = isNeuraPaySuccess(responseJson);
    if (!verifyRes?.ok || !success) {
      const errorMessage = extractNeuraPayErrorMessage(responseJson, verifyRes?.status ?? 0);
      console.error("[NeuraPay] verification failed", { errorMessage, responseJson });
      return err(res, 400, errorMessage);
    }

    const amount = Number((intent as Record<string, unknown>).amount ?? 0);
    const { error: creditErr } = await supabaseAdmin!.rpc(
      "credit_wallet" as never,
      {
        _user_id: userId,
        _amount: amount,
        _provider: "neurapay",
        _reference: reference,
        _description: "Wallet funded via NeuraPay",
      } as never,
    );
    if (creditErr) return err(res, 500, (creditErr as { message: string }).message);

    await supabaseAdmin!
      .from("payment_intents")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("reference", reference);

    return res.json({ success: true, amount, alreadyCredited: false });
  } catch (error) {
    console.error("[API] verify-neurapay crashed", error);
    return err(res, 500, error instanceof Error ? error.message : "Internal server error");
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
