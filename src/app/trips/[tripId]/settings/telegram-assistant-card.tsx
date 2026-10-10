"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, ExternalLink, Key, Check, Copy } from "lucide-react";
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
    <Card className="border-sky-500/30 bg-gradient-to-br from-sky-500/5 via-background to-sky-500/10 shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/20">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                סוכן טלגרם לשטח (AI) — חיליק 🎒
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                עוזר שטח מבצעי 360° המסונכרן בזמן אמת עם כל נתוני הטיול, טבלת השליטה וחוזרי מנכ״ל
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit bg-sky-50 text-sky-700 border-sky-300">
            פעיל ומסונכרן בזמן אמת
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* ── Updated Capabilities Grid ── */}
        <div className="rounded-lg border bg-card p-3.5 space-y-2.5">
          <span className="text-xs font-semibold text-foreground block">
            מה חיליק יודע לעשות עבורך בשטח?
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">🚌</span>
              <div>
                <strong className="text-foreground">טבלת שליטה ואוטובוסים:</strong> נהגים, מורים מלווים, חובשים ומספרי טלפון ישירים (נספח ו׳).
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">🛡️</span>
              <div>
                <strong className="text-foreground">פענוח אישור ביטחוני (PDF):</strong> כמות מאבטחים, דרישות נשק ביום ובלינה והנחיות חדר מצב.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">🚨</span>
              <div>
                <strong className="text-foreground">מגבלות רפואיות (נספח י׳):</strong> איתור מיידי של נשאי מזרק אפיפן, אלרגיות ומחלות כרוניות.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">🥗</span>
              <div>
                <strong className="text-foreground">העדפות מזון והסעדה:</strong> סיכומי מנות צמחוניות, טבעוניות וללא גלוטן (צליאק) למטבח.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">⛅</span>
              <div>
                <strong className="text-foreground">מזג אוויר ועומס חום:</strong> תחזית חיה ליעד וכללי חוזרי מנכ״ל לעומס חום והליכה בטוחה.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">🌲</span>
              <div>
                <strong className="text-foreground">מסלולים וידיעת הארץ:</strong> מסלולים חלופיים מוצלים, שעות פתיחה, ופרטי קשר לאכסניה ולספקים.
              </div>
            </div>
          </div>
        </div>

        {/* ── How to find the bot in Telegram ── */}
        <div className="rounded-lg border border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 p-3.5 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>איך מוצאים את חיליק בטלגרם?</span>
            </span>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline inline-flex items-center gap-1"
            >
              <span>@{botUsername}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
            <li>
              פתחו את טלגרם וחפשו{" "}
              <strong className="text-foreground">@{botUsername}</strong> (או לחצו על הקישור הישיר:{" "}
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:underline font-mono"
              >
                t.me/{botUsername}
              </a>
              ).
            </li>
            <li>
              הפיקו קוד חיבור למטה והדביקו אותו בצ׳אט (או התחברו בלחיצה אחת).
            </li>
            <li>
              <span className="text-foreground font-medium">שיתוף עם הצוות:</span> הקוד תקף ל-48 שעות וניתן לשתף אותו עם כל המורים המלווים בקבוצת הוואטסאפ של הטיול!
            </li>
          </ol>
        </div>

        {/* ── PIN Generation & 1-Click Action ── */}
        {!pin ? (
          <div className="pt-1">
            <Button
              type="button"
              onClick={handleGeneratePin}
              disabled={loading}
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
            >
              <Key className="h-4 w-4" />
              {loading ? "מייצר קוד חיבור..." : "הפק קוד חיבור לטלגרם"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg bg-background p-4 border border-sky-500/30 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">
                  קוד חיבור לטיול זה (תקף ל-48 שעות לכל צוות המורים):
                </span>
                <span className="text-3xl font-mono font-bold tracking-widest text-primary">
                  {pin}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span>הועתק</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>העתק קוד</span>
                  </>
                )}
              </Button>
            </div>

            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block pt-1"
              >
                <Button
                  type="button"
                  className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white shadow-sm text-sm"
                >
                  <Send className="h-4 w-4" />
                  פתח שיחה בטלגרם והתחבר בלחיצה אחת
                </Button>
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
