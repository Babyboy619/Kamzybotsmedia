import { Router, type Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../db";

const router = Router();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LOGS_API_KEY = process.env.LOGS_API_PUBLIC_KEY ?? "";
const LOGS_API_SECRET = process.env.LOGS_API_SECRET_KEY ?? "";
const LOGS_API_BASE_URL = process.env.LOGS_API_BASE_URL ?? "https://api.logs.example.com";

const admin =
  SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

type LogProviderItem = {
  id?: string;
  slug?: string;
  title?: string;
  name?: string;
  price?: number | string;
  amount?: number | string;
  stock?: number | string;
  available?: number | string;
  description?: string;
  summary?: string;
  image_url?: string;
  image?: string;
  currency?: string;
};

type PurchasePayload = {
  delivery?: unknown;
  data?: unknown;
  orderId?: string;
  id?: string;
  [key: string]: unknown;
};

function jsonError(
  res: { status: (code: number) => { json: (body: { error: string }) => unknown } },
  status: number,
  message: string,
) {
  return res.status(status).json({ error: message });
}

async function getAuthUser(req: Request) {
  if (!admin) return null;
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function ensureWallet(userId: string) {
  if (!admin) throw new Error("Supabase not configured");
  const { data, error } = await admin
    .from("wallets")
    .select("id,balance,currency")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: insertErr } = await admin
    .from("wallets")
    .insert({ user_id: userId, balance: 0, currency: "NGN" })
    .select("id,balance,currency")
    .maybeSingle();
  if (insertErr) throw insertErr;
  return created;
}

async function debitWallet(
  userId: string,
  amount: number,
  provider: string,
  reference: string,
  description: string,
) {
  if (!pool) throw new Error("Database not configured");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const walletRes = await client.query(
      "SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE",
      [userId],
    );
    if (walletRes.rowCount === 0) {
      await client.query("INSERT INTO wallets (user_id, balance, currency) VALUES ($1, $2, $3)", [
        userId,
        0,
        "NGN",
      ]);
    }
    const currentWallet = walletRes.rowCount
      ? walletRes.rows[0]
      : (await client.query("SELECT id, balance FROM wallets WHERE user_id = $1", [userId]))
          .rows[0];
    const currentBalance = Number(currentWallet?.balance ?? 0);
    if (currentBalance < amount) {
      await client.query("ROLLBACK");
      throw new Error("Insufficient wallet balance");
    }
    const newBalance = currentBalance - amount;
    await client.query("UPDATE wallets SET balance = $1, updated_at = now() WHERE id = $2", [
      newBalance,
      currentWallet?.id ??
        (await client.query("SELECT id FROM wallets WHERE user_id = $1", [userId])).rows[0].id,
    ]);
    await client.query(
      "INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, status, provider, reference, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())",
      [
        currentWallet?.id ??
          (await client.query("SELECT id FROM wallets WHERE user_id = $1", [userId])).rows[0].id,
        userId,
        "debit",
        amount,
        newBalance,
        "success",
        provider,
        reference,
        description,
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

router.get("/logs", async (_req, res) => {
  try {
    if (!LOGS_API_KEY || !LOGS_API_SECRET) {
      return res.json({ logs: [] });
    }

    const response = await fetch(`${LOGS_API_BASE_URL}/products`, {
      headers: {
        Authorization: `Bearer ${LOGS_API_SECRET}`,
        "X-Api-Key": LOGS_API_KEY,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return res.status(502).json({ error: "Unable to fetch logs from provider" });
    const payload = (await response.json().catch(() => ({ items: [] }))) as {
      items?: LogProviderItem[];
    };
    const logs = (payload.items ?? []).map((item: LogProviderItem) => ({
      id: item.id ?? item.slug ?? `${Date.now()}-${Math.random()}`,
      slug: item.slug ?? item.id ?? `${Date.now()}-${Math.random()}`,
      title: item.title ?? item.name ?? "Log package",
      price: Number(item.price ?? item.amount ?? 0),
      stock: Number(item.stock ?? item.available ?? 0),
      description: item.description ?? item.summary ?? null,
      image_url: item.image_url ?? item.image ?? null,
      currency: item.currency ?? "NGN",
      source: "external-logs",
    }));

    return res.json({ logs });
  } catch (error) {
    return res
      .status(504)
      .json({ error: error instanceof Error ? error.message : "Timeout fetching logs" });
  }
});

router.get("/logs/:slug", async (req, res) => {
  try {
    if (!LOGS_API_KEY || !LOGS_API_SECRET) {
      return jsonError(res, 404, "External logs API not configured");
    }
    const response = await fetch(
      `${LOGS_API_BASE_URL}/products/${encodeURIComponent(req.params.slug)}`,
      {
        headers: {
          Authorization: `Bearer ${LOGS_API_SECRET}`,
          "X-Api-Key": LOGS_API_KEY,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return jsonError(res, 404, "Log not found");
    const payload = (await response.json().catch(() => null)) as LogProviderItem | null;
    if (!payload) return jsonError(res, 404, "Log not found");
    return res.json({
      log: {
        id: payload.id ?? payload.slug ?? req.params.slug,
        slug: payload.slug ?? req.params.slug,
        title: payload.title ?? payload.name ?? "Log package",
        price: Number(payload.price ?? payload.amount ?? 0),
        stock: Number(payload.stock ?? payload.available ?? 0),
        description: payload.description ?? payload.summary ?? null,
        image_url: payload.image_url ?? payload.image ?? null,
        currency: payload.currency ?? "NGN",
        source: "external-logs",
      },
    });
  } catch (error) {
    return res
      .status(504)
      .json({ error: error instanceof Error ? error.message : "Timeout fetching logs" });
  }
});

router.post("/logs/:slug/purchase", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return jsonError(res, 401, "Unauthorized");
    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity < 1) return jsonError(res, 400, "Invalid quantity");

    const logResponse = await fetch(
      `${LOGS_API_BASE_URL}/products/${encodeURIComponent(req.params.slug)}`,
      {
        headers: {
          Authorization: `Bearer ${LOGS_API_SECRET}`,
          "X-Api-Key": LOGS_API_KEY,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!logResponse.ok) return jsonError(res, 404, "Log not found");
    const logPayload = (await logResponse.json().catch(() => null)) as LogProviderItem | null;
    if (!logPayload) return jsonError(res, 404, "Log not found");

    const unitPrice = Number(logPayload.price ?? logPayload.amount ?? 0);
    const total = unitPrice * quantity;
    if (Number(logPayload.stock ?? logPayload.available ?? 0) < quantity)
      return jsonError(res, 409, "Out of stock");

    const wallet = await ensureWallet(user.id);
    if (Number(wallet.balance ?? 0) < total)
      return jsonError(res, 402, "Insufficient wallet balance");

    const purchaseResponse = await fetch(
      `${LOGS_API_BASE_URL}/products/${encodeURIComponent(req.params.slug)}/purchase`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOGS_API_SECRET}`,
          "X-Api-Key": LOGS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id, quantity, amount: total }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!purchaseResponse.ok) return jsonError(res, 502, "Purchase failed with external provider");
    const purchasePayload = (await purchaseResponse
      .json()
      .catch(() => null)) as PurchasePayload | null;

    await debitWallet(
      user.id,
      total,
      "manual",
      `logs-${req.params.slug}-${Date.now()}`,
      `Purchased external log ${req.params.slug}`,
    );

    const delivery = purchasePayload?.delivery ?? purchasePayload?.data ?? purchasePayload ?? {};
    const orderRef = purchasePayload?.orderId ?? purchasePayload?.id ?? `log-order-${Date.now()}`;
    if (admin) {
      await admin.from("orders").insert({
        user_id: user.id,
        total,
        currency: "NGN",
        status: "completed",
        metadata: { source: "external-logs", providerOrderId: orderRef, delivery },
      } as never);
    }

    return res.json({ success: true, order: { id: orderRef }, delivery });
  } catch (error) {
    return res
      .status(504)
      .json({ error: error instanceof Error ? error.message : "Purchase failed" });
  }
});

export default router;
