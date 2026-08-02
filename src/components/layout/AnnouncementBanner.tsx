import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AdminMessage = { id: string; title: string; content: string };

export function AnnouncementBanner() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("admin_messages")
      .select("id, title, content")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data?.length) setMessages(data as AdminMessage[]);
      })
      .catch(() => {});
  }, []);

  const visible = messages.filter((m) => !dismissed.has(m.id));
  if (!visible.length) return null;

  return (
    <div className="bg-brand-orange text-white">
      {visible.map((msg) => (
        <div
          key={msg.id}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-start gap-3"
        >
          <Megaphone className="w-4 h-4 shrink-0 mt-0.5 opacity-90" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm">{msg.title}:</span>{" "}
            <span className="text-sm opacity-95 whitespace-pre-wrap">{msg.content}</span>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, msg.id]))}
            className="shrink-0 opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
