import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Message = { id: string; sender_id: string; message: string; created_at: string };

export default function MarketplaceChat({
  productId,
  sellerId,
}: {
  productId: string;
  sellerId?: string | null;
}) {
  const { user } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session?.data?.session?.access_token;
        const res = await fetch("/api/marketplace/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ productId, sellerId }),
        });
        if (!res.ok) return;
        const json = await res.json();
        setConvId(json.conversation?.id ?? null);
      } catch (e) {
        console.warn("init conv", e);
      }
    })();
  }, [productId, sellerId]);

  useEffect(() => {
    if (!convId) return;
    let mounted = true;
    const fetchMsgs = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session?.data?.session?.access_token;
        const res = await fetch(`/api/marketplace/conversations/${convId}/messages`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!mounted) return;
        setMessages(json.messages ?? []);
      } catch (e) {
        /* ignore */
      }
    };
    fetchMsgs();
    pollingRef.current = window.setInterval(fetchMsgs, 3000);
    return () => {
      mounted = false;
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [convId]);

  const send = async () => {
    if (!convId || !text.trim()) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const res = await fetch(`/api/marketplace/conversations/${convId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text.trim() }),
      });
      if (!res.ok) {
        console.warn("send failed", await res.text());
        return;
      }
      setText("");
      // optimistic append will be corrected by polling
      const json = await res.json();
      setMessages((m) => [...m, json.message]);
    } catch (e) {
      console.warn("send error", e);
    }
  };

  return (
    <div className="mt-8 border border-border rounded-lg p-4 max-w-2xl">
      <h3 className="font-semibold mb-3">Questions about this product?</h3>
      <div className="h-48 overflow-auto border border-border rounded p-2 mb-3 bg-white">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No messages yet — start the conversation
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`mb-2 ${m.sender_id === user?.id ? "text-right" : "text-left"}`}
            >
              <div className="inline-block rounded px-3 py-2 bg-slate-100">{m.message}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
        />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
