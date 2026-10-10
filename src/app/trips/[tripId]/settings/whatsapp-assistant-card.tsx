"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ExternalLink, Key, Check, Copy } from "lucide-react";

export function WhatsappAssistantCard() {
  const { tripId } = useParams<{ tripId: string }>();
  const [pin, setPin] = useState<string | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGeneratePin() {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json();
      if (data.pin) {
        setPin(data.pin);
        setWhatsappLink(data.whatsappLink || "");
      }
    } catch (e) {
      console.error("Failed to generate PIN:", e);
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
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                סוכן וואטסאפ לשטח (AI)
              </CardTitle>
              <CardDescription className="text-xs">
                מענה מבצעי מיידי בוואטסאפ: שיבוצי אוטובוסים, חדרים, אלרגיות וחוזרי מנכ״ל
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            שטח ובטיחות
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pin ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              חבר את מכשיר הוואטסאפ שלך לסוכן כדי לקבל תשובות מהירות בזמן אמת במהלך הטיול.
              הסוכן מסונכרן עם נתוני הטיול הנוכחי ו-5 חוזרי מנכ״ל רשמיים.
            </p>
            <Button
              onClick={handleGeneratePin}
              disabled={loading}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Key className="h-4 w-4" />
              {loading ? "מייצר קוד..." : "הפק קוד חיבור לוואטסאפ"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg bg-background p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground block">
                  קוד אימות לחיבור הוואטסאפ (תקף ל-48 שעות):
                </span>
                <span className="text-2xl font-mono font-bold tracking-widest text-primary">
                  {pin}
                </span>
              </div>
              <Button
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
                  {whatsappLink ? (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      לחץ כאן לפתיחת צ׳אט עם הסוכן בוואטסאפ
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "פתח שיחה בוואטסאפ עם מספר הבוט של המערכת"
                  )}
                </li>
                <li>שלח את הודעת החיבור: <span className="font-mono font-semibold text-foreground">חבר {pin}</span></li>
                <li>הסוכן יחבר אותך מיידית ותוכל לשאול שאלות על הטיול!</li>
              </ol>
            </div>

            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <MessageSquare className="h-4 w-4" />
                  פתח שיחה ישירה בוואטסאפ
                </Button>
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
