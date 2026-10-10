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
      console.error("Client PIN creation failed:", e);
      setError("שגיאה ביצירת קוד אימות. נסה שוב.");
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
    <Card className="border-sky-500/20 bg-sky-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white shadow-sm">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                סוכן טלגרם לשטח (AI) — חיליק 🎒
              </CardTitle>
              <CardDescription className="text-xs">
                מענה מבצעי מיידי לרכזים ומורים: רשימות, אוטובוסים, חדרים, אלרגיות וחוזרי מנכ״ל
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
            שטח ובטיחות
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {!pin ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              חבר את מכשיר הטלגרם שלך לחיליק כדי לקבל תשובות מיידיות בשטח.
              הסוכן מסונכרן בזמן אמת עם נתוני הטיול הנוכחי ו-5 חוזרי מנכ״ל רשמיים.
            </p>
            <Button
              type="button"
              onClick={handleGeneratePin}
              disabled={loading}
              className="gap-2 bg-sky-600 hover:bg-sky-700 text-white"
            >
              <Key className="h-4 w-4" />
              {loading ? "מייצר קוד..." : "הפק קוד חיבור לטלגרם"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg bg-background p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">
                  קוד אימות לחיבור הטלגרם (תקף ל-48 שעות):
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
                    <span>העתק</span>
                  </>
                )}
              </Button>
            </div>

            <div className="border-t pt-3 space-y-2">
              <span className="text-xs font-medium text-foreground block">
                הוראות חיבור:
              </span>
              <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                <li>
                  {telegramLink ? (
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      לחץ כאן לפתיחת השיחה בטלגרם (הקוד יוזן אוטומטית)
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "פתח שיחה בטלגרם עם הבוט של המערכת"
                  )}
                </li>
                <li>לחץ על כפתור ״Start״ בטלגרם והחיבור יתבצע מיידית!</li>
                <li>תוכל לשאול כל שאלה על תלמידים, נהגים, עומס חום ונהלים.</li>
              </ol>
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
                  className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white"
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
