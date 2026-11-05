"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Printer, ExternalLink, Trash2, FileText, Pencil, Check, X } from "lucide-react";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { uploadFile, deleteFileByUrl } from "@/lib/firebase-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_MB = 10;

export type SecurityFileItem = {
  id: string;
  fileUrl: string;
  fileName: string;
  title?: string;
  uploadedAt?: string;
};

function parseSecurityFiles(raw: Record<string, unknown> | null): SecurityFileItem[] {
  if (!raw) return [];
  if (Array.isArray(raw.files)) {
    return (raw.files as SecurityFileItem[]).filter((f) => f && f.fileUrl);
  }
  const legacyUrl = (raw.fileUrl as string) ?? "";
  const legacyName = (raw.fileName as string) ?? "";
  if (legacyUrl) {
    return [
      {
        id: "legacy_0",
        fileUrl: legacyUrl,
        fileName: legacyName || "אישור ביטחוני.pdf",
        title: legacyName ? legacyName.replace(/\.pdf$/i, "") : "אישור ביטחוני",
      },
    ];
  }
  return [];
}

export function SecurityClient() {
  const { tripId } = useParams<{ tripId: string }>();

  const [files, setFiles] = useState<SecurityFileItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "saved" | "error">("idle");
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Inline title editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPending = useRef(false);

  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "security", (raw) => {
      if (isPending.current) return;
      const parsed = parseSecurityFiles(raw);
      setFiles(parsed);
      setSelectedId((prev) => {
        if (prev && parsed.some((f) => f.id === prev)) return prev;
        return parsed[0]?.id ?? null;
      });
    });
    return () => unsub();
  }, [tripId]);

  async function saveFilesToFirestore(nextFiles: SecurityFileItem[]) {
    const primary = nextFiles[0];
    await saveAppendix(tripId, "security", {
      files: nextFiles,
      // Keep top-level fileUrl & fileName synced for dashboard/reminders/backward compatibility
      fileUrl: primary?.fileUrl ?? "",
      fileName: primary?.fileName ?? "",
    });
  }

  async function handleFilesSelected(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    setFileError("");

    for (const file of incoming) {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setFileError(`הקובץ "${file.name}" אינו PDF. יש להעלות קובצי PDF בלבד.`);
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setFileError(
          `הקובץ "${file.name}" גדול מדי (${(file.size / 1024 / 1024).toFixed(1)} MB). המגבלה היא ${MAX_MB} MB.`
        );
        return;
      }
    }

    isPending.current = true;
    setStatus("uploading");
    const uploadedItems: SecurityFileItem[] = [];

    try {
      for (let i = 0; i < incoming.length; i++) {
        const file = incoming[i];
        setUploadProgressText(
          incoming.length > 1
            ? `מעלה קובץ ${i + 1} מתוך ${incoming.length} (0%)...`
            : `מעלה... 0%`
        );
        const url = await uploadFile(tripId, "security-approval", file, (pct) => {
          setUploadProgressText(
            incoming.length > 1
              ? `מעלה קובץ ${i + 1} מתוך ${incoming.length} (${pct}%)...`
              : `מעלה... ${pct}%`
          );
        });
        uploadedItems.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileUrl: url,
          fileName: file.name,
          title: file.name.replace(/\.pdf$/i, ""),
          uploadedAt: new Date().toISOString(),
        });
      }

      const nextFiles = [...files, ...uploadedItems];
      setFiles(nextFiles);
      if (uploadedItems[0]) {
        setSelectedId(uploadedItems[0].id);
      }

      await saveFilesToFirestore(nextFiles);
      setStatus("saved");
      setUploadProgressText("");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setUploadProgressText("");
      setFileError("שגיאה בהעלאת הקובץ. נסה/י שוב.");
    } finally {
      isPending.current = false;
    }
  }

  async function handleRemoveFile(target: SecurityFileItem) {
    if (!confirm(`להסיר את האישור "${target.title || target.fileName}"?`)) return;
    isPending.current = true;
    try {
      if (target.fileUrl) await deleteFileByUrl(target.fileUrl);
      const nextFiles = files.filter((f) => f.id !== target.id);
      setFiles(nextFiles);
      if (selectedId === target.id) {
        setSelectedId(nextFiles[0]?.id ?? null);
      }
      await saveFilesToFirestore(nextFiles);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      isPending.current = false;
    }
  }

  async function handleSaveTitle(itemId: string) {
    const trimmed = editTitleValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    isPending.current = true;
    try {
      const nextFiles = files.map((f) =>
        f.id === itemId ? { ...f, title: trimmed } : f
      );
      setFiles(nextFiles);
      setEditingId(null);
      await saveFilesToFirestore(nextFiles);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      isPending.current = false;
    }
  }

  function handlePrint(item: SecurityFileItem) {
    if (!item.fileUrl) return;
    if (!item.fileUrl.startsWith("https://firebasestorage.googleapis.com/")) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>${item.title || item.fileName || "אישור ביטחוני"}</title>
      <style>body{margin:0}iframe{width:100vw;height:100vh;border:none}</style></head>
      <body><iframe src="${item.fileUrl}"></iframe></body></html>`);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  }

  const activeFile = files.find((f) => f.id === selectedId) ?? files[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Hidden multi-file PDF input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFilesSelected(e.target.files);
            e.target.value = "";
          }
        }}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">אישור ביטחוני</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            העלה/י את האישורים הביטחוניים מהלשכה לתיאום טיולים (ניתן להעלות מספר קובצי PDF)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {status !== "idle" && (
            <span
              className={`text-xs flex-shrink-0 ${
                status === "saved"
                  ? "text-[var(--success)]"
                  : status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {status === "uploading"
                ? uploadProgressText || "מעלה..."
                : status === "saved"
                ? "נשמר ✓"
                : status === "error"
                ? "שגיאה"
                : ""}
            </span>
          )}

          {files.length > 0 && (
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === "uploading"}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              <span>הוסף קובץ PDF</span>
            </Button>
          )}
        </div>
      </div>

      {/* Upload / files list card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) {
            handleFilesSelected(e.dataTransfer.files);
          }
        }}
        className={`bg-card rounded-[var(--radius)] border shadow-[var(--shadow-card)] p-5 space-y-4 transition-colors ${
          isDragging ? "border-primary bg-[var(--brand-light)]/20" : "border-border"
        }`}
      >
        {files.length === 0 ? (
          /* Upload zone when empty */
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[var(--radius-sm)] p-12 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              <FileText className="w-10 h-10 text-muted-foreground mb-3 stroke-[1.5]" />
              <span className="text-sm font-medium text-foreground">
                לחץ/י להעלאת קובצי PDF או גרור/י לכאן (ניתן לבחור מספר קבצים)
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                קובצי PDF — עד {MAX_MB} MB לקובץ
              </span>
            </button>

            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </>
        ) : (
          /* Uploaded files list */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                קבצים שהועלו ({files.length}) — לחץ/י על קובץ להצגתו בתצוגה המקדימה למטה:
              </span>
            </div>

            <div className="space-y-2">
              {files.map((item, idx) => {
                const isSelected = activeFile?.id === item.id;
                const isEditing = editingId === item.id;
                const displayTitle = item.title || item.fileName;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isEditing) setSelectedId(item.id);
                    }}
                    className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius-sm)] border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--brand-light)]/60 border-primary/40"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-7 h-7 text-destructive shrink-0 stroke-[1.5]" />

                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 flex-1 max-w-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={editTitleValue}
                            onChange={(e) => setEditTitleValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveTitle(item.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-8 text-sm bg-background"
                            autoFocus
                          />
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => handleSaveTitle(item.id)}
                            className="text-[var(--success)]"
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {displayTitle}
                            </p>
                            {files.length > 1 && isSelected && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                                מוצג כעת
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            אישור ביטחוני {files.length > 1 ? `#${idx + 1}` : ""} · {item.fileName}
                          </p>
                        </div>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditTitleValue(item.title || item.fileName.replace(/\.pdf$/i, ""));
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-[var(--radius-sm)] bg-background hover:bg-muted/50 transition-colors"
                        title="שנה כותרת"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>שנה שם</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrint(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-[var(--radius-sm)] bg-background hover:bg-muted/50 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>הדפס</span>
                      </button>

                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-[var(--radius-sm)] bg-background hover:bg-muted/50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>פתח</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-destructive/30 text-destructive rounded-[var(--radius-sm)] bg-background hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>הסר</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {fileError && <p className="text-sm text-destructive mt-2">{fileError}</p>}
          </div>
        )}
      </div>

      {/* PDF Preview for Active File */}
      {activeFile && (
        <div className="bg-card rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] overflow-hidden">
          {files.length > 1 && (
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                תצוגה מקדימה: {activeFile.title || activeFile.fileName}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {files.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      f.id === activeFile.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.title || `קובץ ${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <iframe
            src={activeFile.fileUrl}
            className="w-full h-[800px] border-0"
            title={activeFile.title || "אישור ביטחוני"}
          />
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && status !== "uploading" && (
        <div className="text-center py-6 text-sm text-muted-foreground/60">
          עדיין לא הועלה אישור ביטחוני
        </div>
      )}
    </div>
  );
}
