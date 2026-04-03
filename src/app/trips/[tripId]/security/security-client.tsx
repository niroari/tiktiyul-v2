"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { uploadFile, deleteFileByUrl } from "@/lib/firebase-storage";

const MAX_MB = 1.5;

export function SecurityClient() {
  const { tripId } = useParams<{ tripId: string }>();

  const [fileUrl, setFileUrl]   = useState("");
  const [fileName, setFileName] = useState("");
  const [status, setStatus]     = useState<"idle" | "uploading" | "saved" | "error">("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [fileError, setFileError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPending    = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "security", (raw) => {
      if (isPending.current) return;
      setFileUrl((raw?.fileUrl  as string) ?? "");
      setFileName((raw?.fileName as string) ?? "");
    });
    return () => unsub();
  }, [tripId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setFileError("");

    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)} MB). המגבלה היא ${MAX_MB} MB.`);
      return;
    }

    // Delete old file if exists
    if (fileUrl) await deleteFileByUrl(fileUrl);

    isPending.current = true;
    setStatus("uploading");
    setUploadPct(0);
    try {
      const url = await uploadFile(tripId, "security-approval", file, setUploadPct);
      await saveAppendix(tripId, "security", { fileUrl: url, fileName: file.name });
      setFileUrl(url);
      setFileName(file.name);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setFileError("שגיאה בהעלאת הקובץ. נסה/י שוב.");
    } finally {
      isPending.current = false;
    }
  }

  async function handleRemove() {
    if (!confirm("להסיר את האישור הביטחוני?")) return;
    if (fileUrl) await deleteFileByUrl(fileUrl);
    await saveAppendix(tripId, "security", { fileUrl: "", fileName: "" });
    setFileUrl("");
    setFileName("");
    setStatus("idle");
  }

  function handlePrint() {
    if (!fileUrl) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>אישור ביטחוני</title>
      <style>body{margin:0}iframe{width:100vw;height:100vh;border:none}</style></head>
      <body><iframe src="${fileUrl}"></iframe></body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">אישור ביטחוני</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            העלה/י את האישור הביטחוני מהלשכה לתיאום טיולים
          </p>
        </div>
        <span className={`text-xs flex-shrink-0 ${
          status === "saved" ? "text-[var(--success)]" :
          status === "error" ? "text-destructive" :
          "text-muted-foreground"
        }`}>
          {status === "uploading" ? `מעלה... ${uploadPct}%` :
           status === "saved"    ? "נשמר ✓" :
           status === "error"    ? "שגיאה" : ""}
        </span>
      </div>

      {/* Upload / file info card */}
      <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-5 space-y-4">
        {!fileUrl ? (
          /* Upload zone */
          <>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[var(--radius-sm)] p-12 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors">
              <svg className="w-10 h-10 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-foreground">לחץ/י להעלאת קובץ PDF</span>
              <span className="text-xs text-muted-foreground mt-1">קובץ PDF — עד {MAX_MB} MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
              />
            </label>

            {/* Upload progress */}
            {status === "uploading" && (
              <div className="space-y-1.5">
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

            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </>
        ) : (
          /* File info + actions */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-[var(--radius-sm)] border border-border">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">אישור ביטחוני</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  הדפס
                </button>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-sm border border-border rounded-[var(--radius-sm)] hover:bg-muted/50 transition-colors"
                >
                  פתח
                </a>
                <button
                  onClick={handleRemove}
                  className="px-3 py-1.5 text-sm border border-destructive/30 text-destructive rounded-[var(--radius-sm)] hover:bg-destructive/5 transition-colors"
                >
                  הסר
                </button>
              </div>
            </div>

            {/* Replace file */}
            <div>
              <label className="cursor-pointer text-xs text-primary/70 border border-primary/30 rounded px-3 py-1.5 hover:bg-primary/5 transition-colors inline-block">
                החלף קובץ
                <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
              </label>
              {fileError && <p className="text-sm text-destructive mt-2">{fileError}</p>}
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview */}
      {fileUrl && (
        <div className="bg-white rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
          <iframe
            src={fileUrl}
            className="w-full"
            style={{ height: "800px", border: "none" }}
            title="אישור ביטחוני"
          />
        </div>
      )}

      {/* Empty state */}
      {!fileUrl && status !== "uploading" && (
        <div className="text-center py-6 text-sm text-muted-foreground/60">
          עדיין לא הועלה אישור ביטחוני
        </div>
      )}
    </div>
  );
}
