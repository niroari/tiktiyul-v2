"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Platform =
  | "ios-safari"
  | "ios-other"
  | "android"
  | "desktop-chrome"   // Chrome or Edge on Mac/Windows — supports beforeinstallprompt
  | "desktop-safari"   // Safari on macOS — File → Add to Dock (Sonoma+)
  | "desktop-other"    // Firefox etc. on desktop — no install support
  | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS     = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile  = /Mobi/.test(ua);
  const isSafari  = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg/.test(ua);
  const isChrome  = /Chrome/.test(ua) || /Edg/.test(ua);

  if (isIOS && isSafari)  return "ios-safari";
  if (isIOS)              return "ios-other";
  if (isAndroid)          return "android";
  if (!isMobile && isChrome) return "desktop-chrome";
  if (!isMobile && isSafari) return "desktop-safari";
  if (!isMobile)          return "desktop-other";
  return "unknown";
}

// ─── Step ─────────────────────────────────────────────────────────────────────

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
        לחץ/י על כפתור השיתוף —
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
        לחץ/י על <Chip>הוסף</Chip> בפינה הימנית העליונה
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
        הדפדפן הנוכחי לא תומך בהתקנה. פתח/י את הקישור דווקא ב-<strong>Safari</strong>.
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

  if (installed) return (
    <p className="text-sm text-green-700 text-center font-medium">✓ האפליקציה כבר מותקנת</p>
  );

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
        <p className="text-sm text-green-700 text-center font-medium">✓ בדוק/י את מסך הבית שלך</p>
      )}
    </div>
  );
}

function DesktopChromeInstructions({ installed }: { installed: boolean }) {
  const [prompted, setPrompted] = useState(false);

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

  if (installed) return (
    <p className="text-sm text-green-700 text-center font-medium">✓ האפליקציה כבר מותקנת</p>
  );

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
            לחלופין — חפש/י את סמל ההתקנה
            <Chip>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Chip>
            בסרגל הכתובות
          </p>
        </>
      ) : (
        <p className="text-sm text-green-700 text-center font-medium">✓ האפליקציה הותקנה</p>
      )}
    </div>
  );
}

function DesktopSafariInstructions() {
  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        דורש macOS Sonoma (2023) ומעלה
      </div>
      <Step n={1}>
        בסרגל התפריטים למעלה, לחץ/י על <Chip>קובץ</Chip>
      </Step>
      <Step n={2}>
        בחר/י <Chip>הוסף ל-Dock</Chip>
      </Step>
      <Step n={3}>
        לחץ/י <Chip>הוסף</Chip> בחלון האישור
      </Step>
      <p className="text-xs text-muted-foreground text-center pt-1">
        האפליקציה תופיע ב-Dock ובתיקיית היישומים ✓
      </p>
    </div>
  );
}

function DesktopOtherInstructions() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        הדפדפן הנוכחי לא תומך בהתקנה. נסה/י להתקין דרך:
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <strong>Chrome</strong> — תומך בהתקנה כאפליקציה
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <strong>Edge</strong> — תומך בהתקנה כאפליקציה
        </li>
        <li className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <strong>Safari (Mac)</strong> — דורש macOS Sonoma
        </li>
      </ul>
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

    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const titles: Record<Platform, string> = {
    "ios-safari":     "הוסף למסך הבית",
    "ios-other":      "פתח ב-Safari",
    "android":        "התקן את האפליקציה",
    "desktop-chrome": "התקן כאפליקציה",
    "desktop-safari": "הוסף ל-Dock",
    "desktop-other":  "התקנה כאפליקציה",
    "unknown":        "התקן את האפליקציה",
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
          <h2 className="font-semibold text-foreground text-base">{titles[platform]}</h2>

          {platform === "ios-safari"     && <IosSafariInstructions />}
          {platform === "ios-other"      && <IosOtherInstructions />}
          {platform === "android"        && <AndroidInstructions installed={isInstalled} />}
          {platform === "desktop-chrome" && <DesktopChromeInstructions installed={isInstalled} />}
          {platform === "desktop-safari" && <DesktopSafariInstructions />}
          {platform === "desktop-other"  && <DesktopOtherInstructions />}
          {platform === "unknown"        && <DesktopOtherInstructions />}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          tiktiyul.vercel.app
        </p>
      </div>
    </div>
  );
}
