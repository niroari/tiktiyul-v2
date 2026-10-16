"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, ExternalLink, Key, Check, Copy, ShieldCheck } from "lucide-react";
import { createClientTripPin } from "@/lib/firestore/trip-pins";

export function TelegramAssistantCard() {
  const { tripId } = useParams<{ tripId: string }>();
  const [pin, setPin] = useState<string | null>(null);
  const [telegramLink, setTelegramLink] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name of the bot in Telegram (configured in NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)
  const botUsername =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "hilik_tiktiyul_bot";

  async function handleGeneratePin() {
    setLoading(true);
    setError(null);
    try {
      const generatedPin = await createClientTripPin(tripId);
      setPin(generatedPin);
      setTelegramLink(`https://t.me/${botUsername}?start=${generatedPin}`);
    } catch (e: unknown) {
      console.warn("Client PIN creation failed, trying server API route:", e);
      try {
        const res = await fetch("/api/telegram/pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId }),
        });
        const data = await res.json();
        if (data.pin) {
          setPin(data.pin);
          setTelegramLink(`https://t.me/${botUsername}?start=${data.pin}`);
        } else {
          setError(data.error || "שגיאה ביצירת קוד אימות");
        }
      } catch (serverErr: unknown) {
        console.error("Server PIN fallback failed:", serverErr);
        setError("שגיאה ביצירת קוד אימות. נסה שוב.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-sky-500/20 bg-sky-500/5 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                סוכן טלגרם לשטח (AI) — חיליק 🎒
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                מענה מבצעי מיידי: טבלת שליטה, אישור ביטחוני, אלרגיות, מזג אוויר וחוזרי מנכ״ל
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px]">
            שטח ובטיחות
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5 pt-0">
        {error && (
          <div className="rounded-md bg-destructive/15 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* ── Compact Capabilities ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground rounded-lg border bg-background/80 p-2.5">
          <div className="flex items-center gap-1.5">
            <span>🚌</span>
            <span><strong className="text-foreground">טבלת שליטה:</strong> נהגים, מורים וטלפונים ישירים</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🛡️</span>
            <span><strong className="text-foreground">אישור ביטחוני:</strong> פענוח דרישות נשק ואבטחה (PDF)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🚨</span>
            <span><strong className="text-foreground">בריאות ומזון:</strong> מזרקי אפיפן (נספח י׳) והסעדה</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>⛅</span>
            <span><strong className="text-foreground">שטח ומסלולים:</strong> עומס חום, מסלולים חלופיים ואכסניה</span>
          </div>
        </div>

        {/* ── Privacy & Security Guarantee ── */}
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              פרטיות ואבטחת מידע מובטחת (Zero-PII):
            </span>{" "}
            <span>
              לסוכן ה-AI אין גישה לשמות תלמידים, תעודות זהות או טלפונים של תלמידים. כל הנתונים על כמויות משתתפים, מנות מיוחדות ומגבלות רפואיות מסופקים באופן כמותי ומצרפי בלבד.
            </span>
          </div>
        </div>

        {/* ── Compact How-to & Link ── */}
        <div className="flex items-center justify-between text-xs bg-sky-100/50 dark:bg-sky-950/30 border border-sky-500/20 rounded-md px-3 py-2">
          <span className="text-muted-foreground">
            חיפוש בטלגרם:{" "}
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
            >
              @{botUsername}
              <ExternalLink className="h-3 w-3" />
            </a>
          </span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            (קוד החיבור משמש את כל המורים המלווים)
          </span>
        </div>

        {/* ── PIN Action ── */}
        {!pin ? (
          <div>
            <Button
              type="button"
              onClick={handleGeneratePin}
              disabled={loading}
              size="sm"
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
            >
              <Key className="h-3.5 w-3.5" />
              {loading ? "מייצר קוד..." : "הפק קוד חיבור לטלגרם"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg bg-background p-3.5 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted-foreground block">
                  קוד חיבור (תקף ל-48 שעות לכל הצוות):
                </span>
                <span className="text-2xl font-mono font-bold tracking-widest text-primary">
                  {pin}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 h-8 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>הועתק</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>העתק</span>
                  </>
                )}
              </Button>
            </div>

            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  פתח בטלגרם והתחבר בלחיצה אחת
                </Button>
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
