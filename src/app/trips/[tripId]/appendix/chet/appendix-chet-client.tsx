"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { uploadFile, deleteFileByUrl } from "@/lib/firebase-storage";
import { printHTML } from "@/components/appendix-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Mode = "text" | "url" | "file";

type ChetData = {
  mode:     Mode;
  text:     string;
  url:      string;
  fileUrl:  string; // Firebase Storage download URL
  fileName: string;
  fileType: string;
};

const EMPTY: ChetData = { mode: "text", text: "", url: "", fileUrl: "", fileName: "", fileType: "" };
const MAX_FILE_MB = 1.5;

export function AppendixChetClient() {
  const { tripId } = useParams<{ tripId: string }>();
  const [data, setData]         = useState<ChetData>(EMPTY);
  const [status, setStatus]     = useState<"idle" | "saving" | "saved">("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [fileError, setFileError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "chet", (raw) => {
      if (raw) {
        setData({
          mode:     (raw.mode     as Mode)   ?? "text",
          text:     (raw.text     as string) ?? "",
          url:      (raw.url      as string) ?? "",
          fileUrl:  (raw.fileUrl  as string) ?? "",
          fileName: (raw.fileName as string) ?? "",
          fileType: (raw.fileType as string) ?? "",
        });
      }
    });
    return () => unsub();
  }, [tripId]);

  function saveData(updated: ChetData) {
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAppendix(tripId, "chet", updated as unknown as Record<string, unknown>);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }, 1200);
  }

  function update(patch: Partial<ChetData>) {
    const updated = { ...data, ...patch };
    setData(updated);
    saveData(updated);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)} MB). המגבלה היא ${MAX_FILE_MB} MB.`);
      e.target.value = "";
      return;
    }

    // Delete previous file from Storage if exists
    if (data.fileUrl) {
      await deleteFileByUrl(data.fileUrl);
    }

    setUploading(true);
    setUploadPct(0);
    try {
      const url = await uploadFile(tripId, "appendix-chet", file, setUploadPct);
      update({ fileUrl: url, fileName: file.name, fileType: file.type });
    } catch (err) {
      setFileError("שגיאה בהעלאת הקובץ. נסה/י שוב.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function clearFile() {
    if (fileInput.current) fileInput.current.value = "";
    if (data.fileUrl) await deleteFileByUrl(data.fileUrl);
    update({ fileUrl: "", fileName: "", fileType: "" });
  }

  function handlePrint() {
    if (data.mode === "text") {
      if (!data.text.trim()) return;
      printHTML(`
        <div class="header">
          <div class="title">נספח ח׳ — אישור הורים על השתתפות והצהרת בריאות</div>
        </div>
        <div class="letter-body" style="white-space:pre-wrap">${data.text}</div>
      `, "נספח ח׳ — אישור הורים");
    } else if (data.mode === "url" && data.url) {
      window.open(data.url, "_blank");
    } else if (data.mode === "file" && data.fileUrl) {
      window.open(data.fileUrl, "_blank");
    }
  }

  const canPrint =
    (data.mode === "text" && data.text.trim().length > 0) ||
    (data.mode === "url"  && data.url.trim().length > 0) ||
    (data.mode === "file" && data.fileUrl.length > 0);

  const tabs: { id: Mode; label: string }[] = [
    { id: "text", label: "טקסט חופשי" },
    { id: "url",  label: "קישור חיצוני" },
    { id: "file", label: "העלאת קובץ" },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">נספח ח׳ — אישור הורים</h1>
          <p className="text-sm text-muted-foreground mt-0.5">אישור השתתפות בנם / בתם והצהרת בריאות</p>
        </div>
        <span className={`text-xs flex-shrink-0 ${status === "saved" ? "text-[var(--success)]" : "text-muted-foreground"}`}>
          {status === "saving" ? "שומר..." : status === "saved" ? "נשמר ✓" : ""}
        </span>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-[var(--radius-sm)] w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => update({ mode: t.id })}
            className={`px-4 py-1.5 text-sm rounded-[var(--radius-sm)] transition-colors ${
              data.mode === t.id
                ? "bg-white text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Text mode */}
      {data.mode === "text" && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-3">
          <Label>נוסח אישור ההורים</Label>
          <textarea
            value={data.text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder={`הורים יקרים,\n\nביה"ס מתכנן טיול לתלמידי...\n\nאנו מבקשים את אישורכם להשתתפות בנכם / בתכם בטיול.\n\nהצהרת בריאות: בנ/י בריא/ה ומסוגל/ת להשתתף בפעילות גופנית.\n\nחתימה: ___________________`}
            rows={14}
            className="w-full text-sm border border-border rounded-[var(--radius-sm)] px-3 py-2.5 resize-y focus:outline-none focus:border-primary leading-loose"
            dir="rtl"
          />
        </div>
      )}

      {/* URL mode */}
      {data.mode === "url" && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>קישור לטופס אישור הורים</Label>
            <Input
              type="url"
              value={data.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://forms.google.com/..."
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">לדוגמה: Google Forms, Typeform, או כל קישור לטופס חיצוני</p>
          </div>
          {data.url && (
            <Button variant="outline" size="sm" onClick={() => window.open(data.url, "_blank")}>
              פתח קישור
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Button>
          )}
        </div>
      )}

      {/* File mode */}
      {data.mode === "file" && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
          {!data.fileUrl && !uploading && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[var(--radius-sm)] p-10 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
              <svg className="w-8 h-8 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-muted-foreground">לחץ/י להעלאת קובץ</span>
              <span className="text-xs text-muted-foreground/70 mt-1">PDF, תמונה — עד {MAX_FILE_MB} MB</span>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2 p-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>מעלה קובץ...</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          )}

          {/* File info */}
          {data.fileUrl && !uploading && (
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-[var(--radius-sm)] border border-border">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-primary/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">{data.fileName}</p>
                  <p className="text-xs text-muted-foreground">מאוחסן ב-Firebase Storage</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open(data.fileUrl, "_blank")}>פתח</Button>
                <Button variant="outline" size="sm" onClick={clearFile} className="text-destructive hover:text-destructive">הסר</Button>
              </div>
            </div>
          )}

          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        </div>
      )}

      {/* Print / open */}
      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={!canPrint}>
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {data.mode === "text" ? "הדפס" : "פתח / הדפס"}
        </Button>
      </div>
    </div>
  );
}
