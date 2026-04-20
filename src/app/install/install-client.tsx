"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Platform = "ios-safari" | "ios-other" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isAndroid = /Android/.test(ua);
  if (isIOS && isSafari) return "ios-safari";
  if (isIOS) return "ios-other";
  if (isAndroid) return "android";
  if (!/Mobi/.test(ua)) return "desktop";
  return "unknown";
}

// ─── Step component ───────────────────────────────────────────────────────────

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-full bg-[#1b4332] text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </div>
      <div className="text-sm text-foreground leading-relaxed pt-1">{children}</div>
    </div>
  );
}

// ─── Icon chip ────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 bg-muted border border-border rounded px-2 py-0.5 text-xs font-medium mx-0.5">
      {children}
    </span>
  );
}

// ─── Platform instructions ────────────────────────────────────────────────────

function IosSafariInstructions() {
  return (
    <div className="space-y-5">
      <Step n={1}>
        גלול/י למטה לסוף הדף הזה ולחץ/י על כפתור השיתוף —
        <Chip>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          שתף
        </Chip>
      </Step>
      <Step n={2}>
        גלול/י ברשימה שנפתחת עד שתמצא/י
        <Chip>הוסף למסך הבית</Chip>
      </Step>
      <Step n={3}>
        לחץ/י על
        <Chip>הוסף</Chip>
        בפינה הימנית העליונה
      </Step>
      <p className="text-xs text-muted-foreground text-center pt-2">
        האפליקציה תופיע על מסך הבית שלך כמו כל אפליקציה רגילה ✓
      </p>
    </div>
  );
}

function IosOtherInstructions() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
      <p className="font-semibold text-amber-800">פתח/י ב-Safari</p>
      <p className="text-sm text-amber-700">
        הדפדפן הנוכחי שלך לא תומך בהתקנה. כדי להוסיף לנייד, יש לפתוח את הקישור הזה דווקא ב-<strong>Safari</strong>.
      </p>
      <button
        onClick={() => navigator.clipboard.writeText(window.location.href).then(() => alert("הקישור הועתק — הדבק אותו ב-Safari"))}
        className="w-full py-2.5 text-sm font-medium bg-amber-800 text-white rounded-lg hover:bg-amber-900 transition-colors"
      >
        העתק קישור
      </button>
    </div>
  );
}

function AndroidInstructions({ installed }: { installed: boolean }) {
  const [prompted, setPrompted] = useState(false);

  // The beforeinstallprompt event is stored on window by sw-register
  function triggerInstall() {
    const deferredPrompt = (window as any).__pwaInstallPrompt;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        (window as any).__pwaInstallPrompt = null;
        setPrompted(true);
      });
    } else {
      setPrompted(true);
    }
  }

  if (installed) {
    return (
      <p className="text-sm text-green-700 text-center font-medium">
        ✓ האפליקציה כבר מותקנת על המכשיר שלך
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {!prompted ? (
        <>
          <Step n={1}>לחץ/י על הכפתור הירוק למטה</Step>
          <Step n={2}>בחלון שנפתח, לחץ/י <Chip>התקן</Chip></Step>
          <button
            onClick={triggerInstall}
            className="w-full py-3.5 text-sm font-semibold bg-[#1b4332] text-white rounded-xl hover:bg-[#1b4332]/90 transition-colors"
          >
            התקן עכשיו
          </button>
          <p className="text-xs text-muted-foreground text-center">
            אם הכפתור לא עובד — פתח/י את תפריט Chrome (⋮) ובחר/י <Chip>הוסף למסך הבית</Chip>
          </p>
        </>
      ) : (
        <p className="text-sm text-green-700 text-center font-medium">
          ✓ בדוק/י את מסך הבית שלך
        </p>
      )}
    </div>
  );
}

function DesktopInstructions() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground text-center">
      <p>הדף הזה מיועד להתקנה על נייד.</p>
      <p>
        שלח/י את הקישור לטלפון שלך ופתח/י אותו שם:
      </p>
      <button
        onClick={() => navigator.clipboard.writeText(window.location.origin + "/install")}
        className="mx-auto flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-foreground text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        העתק קישור
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function InstallClient() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);

    // Capture Android install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const titles: Record<Platform, string> = {
    "ios-safari": "הוסף למסך הבית",
    "ios-other":  "פתח ב-Safari",
    "android":    "התקן את האפליקציה",
    "desktop":    "התקנה על נייד",
    "unknown":    "התקן את האפליקציה",
  };

  return (
    <div className="min-h-screen bg-[#f6faf8] flex flex-col items-center justify-center px-5 py-12" dir="rtl">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo + title */}
        <div className="text-center space-y-3">
          <Image
            src="/icon-192.png"
            alt="תיק טיול"
            width={80}
            height={80}
            className="mx-auto rounded-2xl shadow-md"
          />
          <div>
            <h1 className="text-xl font-bold text-[#1b4332]">תיק טיול</h1>
            <p className="text-sm text-muted-foreground">ניהול תיק טיול לבתי ספר</p>
          </div>
        </div>

        {/* Instruction card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground text-base">
            {titles[platform]}
          </h2>

          {platform === "ios-safari"  && <IosSafariInstructions />}
          {platform === "ios-other"   && <IosOtherInstructions />}
          {platform === "android"     && <AndroidInstructions installed={isInstalled} />}
          {platform === "desktop"     && <DesktopInstructions />}
          {platform === "unknown"     && <DesktopInstructions />}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          tiktiyul.vercel.app
        </p>
      </div>
    </div>
  );
}
