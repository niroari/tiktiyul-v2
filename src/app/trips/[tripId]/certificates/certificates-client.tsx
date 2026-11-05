"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File as FileIcon,
  Upload,
  Plus,
  Search,
  Printer,
  Trash2,
  ExternalLink,
  Eye,
  Pencil,
  Check,
  X,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
} from "lucide-react";
import { saveAppendix, subscribeToAppendix } from "@/lib/firestore/appendix";
import { uploadFile, deleteFileByUrl } from "@/lib/firebase-storage";
import type { CertificateGroup, CertificateItem, CertificatesData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_MB = 10;

const ACCEPTED_EXTENSIONS =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.svg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf";

export const DEFAULT_GROUPS: CertificateGroup[] = [
  { id: "vouchers", name: "וואוצ׳רים לאתרים", isDefault: true },
  { id: "guides", name: "תעודות מדריכים", isDefault: true },
  { id: "guards_medics", name: "רישיונות מאבטחים ומע״רים", isDefault: true },
  { id: "police_clearance", name: "אישורי היעדר עבירות מין", isDefault: true },
  { id: "business_licenses", name: "רישיונות עסק והסעות", isDefault: true },
  { id: "general", name: "אישורים ותעודות נוספות", isDefault: true },
];

type FileKind = "image" | "pdf" | "word" | "excel" | "other";

function getFileKind(fileName: string, fileType: string): FileKind {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();

  if (
    lowerType.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic)$/.test(lowerName)
  ) {
    return "image";
  }
  if (lowerType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    lowerType.includes("word") ||
    lowerType.includes("msword") ||
    /\.(doc|docx|rtf)$/.test(lowerName)
  ) {
    return "word";
  }
  if (
    lowerType.includes("excel") ||
    lowerType.includes("spreadsheet") ||
    /\.(xls|xlsx|csv)$/.test(lowerName)
  ) {
    return "excel";
  }
  return "other";
}

function getFileExtensionLabel(fileName: string, kind: FileKind): string {
  const parts = fileName.split(".");
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase().slice(0, 5);
  }
  if (kind === "image") return "IMG";
  if (kind === "pdf") return "PDF";
  if (kind === "word") return "DOC";
  if (kind === "excel") return "XLS";
  return "FILE";
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

function normalizePastedFile(file: File | Blob, index = 0): File {
  const mime = file.type || "image/png";
  const extFromMime = mime.split("/")[1]?.replace("jpeg", "jpg") || "png";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const suffix = index > 0 ? ` (${index + 1})` : "";

  if (file instanceof File && file.name && !/^(image|blob|clipboard)\.[a-z0-9]+$/i.test(file.name)) {
    return file;
  }

  const generatedName = `תמונה מהלוח ${timeStr}${suffix}.${extFromMime}`;
  return new File([file], generatedName, { type: mime });
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeGroups(savedGroups?: CertificateGroup[]): CertificateGroup[] {
  if (!savedGroups || savedGroups.length === 0) {
    return DEFAULT_GROUPS;
  }
  const existingIds = new Set(savedGroups.map((g) => g.id));
  const missingDefaults = DEFAULT_GROUPS.filter((d) => !existingIds.has(d.id));
  return [...savedGroups, ...missingDefaults];
}

export function CertificatesClient() {
  const { tripId } = useParams<{ tripId: string }>();

  const [groups, setGroups] = useState<CertificateGroup[]>(DEFAULT_GROUPS);
  const [items, setItems] = useState<CertificateItem[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "saving" | "saved" | "error">("idle");
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [fileError, setFileError] = useState("");

  // Filters & UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [uploadTargetGroupId, setUploadTargetGroupId] = useState<string>(DEFAULT_GROUPS[0].id);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Inline editing state for document item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editGroupId, setEditGroupId] = useState("");

  // Group management dialogs
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState("");

  // Preview dialog state
  const [previewItem, setPreviewItem] = useState<CertificateItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupFileInputRef = useRef<HTMLInputElement>(null);
  const directUploadGroupIdRef = useRef<string>(DEFAULT_GROUPS[0].id);
  const isPendingRef = useRef(false);

  // Subscribe to Firestore
  useEffect(() => {
    const unsub = subscribeToAppendix(tripId, "certificates", (raw) => {
      if (isPendingRef.current) return;
      const rawData = raw as Partial<CertificatesData> | null;
      setGroups(mergeGroups(rawData?.groups));
      setItems(Array.isArray(rawData?.items) ? rawData.items : []);
    });
    return () => unsub();
  }, [tripId]);

  // Keep uploadTargetGroupId synced when user selects a specific filter tab
  useEffect(() => {
    if (selectedGroupFilter !== "all") {
      setUploadTargetGroupId(selectedGroupFilter);
      setExpandedGroups((prev) => ({ ...prev, [selectedGroupFilter]: true }));
    }
  }, [selectedGroupFilter]);

  async function persistChanges(nextGroups: CertificateGroup[], nextItems: CertificateItem[]) {
    isPendingRef.current = true;
    setStatus("saving");
    try {
      await saveAppendix(tripId, "certificates", {
        groups: nextGroups,
        items: nextItems,
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      isPendingRef.current = false;
    }
  }

  async function handleFilesUpload(fileList: FileList | File[], targetGroupId: string) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setFileError("");

    // Validate sizes first
    const oversized = files.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (oversized) {
      setFileError(
        `הקובץ "${oversized.name}" גדול מדי (${formatFileSize(oversized.size)}). המגבלה היא ${MAX_MB} MB לקובץ.`
      );
      return;
    }

    isPendingRef.current = true;
    setStatus("uploading");

    const newlyUploaded: CertificateItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgressText(
          files.length > 1
            ? `מעלה קובץ ${i + 1} מתוך ${files.length} (0%)...`
            : `מעלה קובץ (0%)...`
        );

        const url = await uploadFile(tripId, "certificates", file, (pct) => {
          setUploadProgressText(
            files.length > 1
              ? `מעלה קובץ ${i + 1} מתוך ${files.length} (${pct}%)...`
              : `מעלה קובץ (${pct}%)...`
          );
        });

        newlyUploaded.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: stripExtension(file.name),
          notes: "",
          groupId: targetGroupId,
          fileUrl: url,
          fileName: file.name,
          fileType: file.type || "",
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        });
      }

      const nextItems = [...newlyUploaded, ...items];
      setItems(nextItems);

      // Expand target group when files are uploaded to it
      setExpandedGroups((prev) => ({ ...prev, [targetGroupId]: true }));

      await saveAppendix(tripId, "certificates", {
        groups,
        items: nextItems,
      });

      setStatus("saved");
      setUploadProgressText("");
      setTimeout(() => setStatus("idle"), 2000);

      // If a single file was uploaded, open inline title editor right away for convenience
      if (newlyUploaded.length === 1) {
        startEditingItem(newlyUploaded[0]);
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setUploadProgressText("");
      setFileError("שגיאה בהעלאת הקבצים. נסה/י שוב.");
    } finally {
      isPendingRef.current = false;
    }
  }

  async function handlePasteFromButton(targetGroupId: string) {
    setFileError("");
    if (!navigator.clipboard?.read) {
      setFileError("הדפדפן אינו תומך בהדבקה מכפתור. השתמש/י בקיצור המקלדת Ctrl+V (או ⌘V).");
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const pastedFiles: File[] = [];

      for (const item of clipboardItems) {
        const supportedType = item.types.find(
          (t) => t.startsWith("image/") || t === "application/pdf"
        );
        if (supportedType) {
          const blob = await item.getType(supportedType);
          pastedFiles.push(normalizePastedFile(blob, pastedFiles.length));
        }
      }

      if (pastedFiles.length === 0) {
        setFileError("לא נמצאה תמונה בלוח העריכה (Clipboard). העתק/י תמונה ונסה/י שוב.");
        return;
      }

      await handleFilesUpload(pastedFiles, targetGroupId);
    } catch (err) {
      console.error(err);
      setFileError("לא ניתן לקרוא מהלוח. אשר/י הרשאת הדבקה בדפדפן או לחץ/י Ctrl+V (או ⌘V) בעמוד.");
    }
  }

  // Global Ctrl+V / Cmd+V paste listener for images/files
  const handleFilesUploadRef = useRef(handleFilesUpload);
  handleFilesUploadRef.current = handleFilesUpload;

  useEffect(() => {
    function onWindowPaste(e: ClipboardEvent) {
      if (isPendingRef.current) return;
      const itemsList = e.clipboardData?.items;
      if (!itemsList) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < itemsList.length; i++) {
        const item = itemsList[i];
        if (item.kind === "file") {
          const rawFile = item.getAsFile();
          if (rawFile) {
            pastedFiles.push(normalizePastedFile(rawFile, pastedFiles.length));
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        handleFilesUploadRef.current(pastedFiles, uploadTargetGroupId);
      }
    }

    window.addEventListener("paste", onWindowPaste);
    return () => window.removeEventListener("paste", onWindowPaste);
  }, [uploadTargetGroupId]);

  function startEditingItem(item: CertificateItem) {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditNotes(item.notes ?? "");
    setEditGroupId(item.groupId);
  }

  async function saveEditingItem(itemId: string) {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    const nextItems = items.map((it) =>
      it.id === itemId
        ? {
            ...it,
            title: trimmedTitle,
            notes: editNotes.trim(),
            groupId: editGroupId,
          }
        : it
    );
    setItems(nextItems);
    setEditingItemId(null);
    await persistChanges(groups, nextItems);
  }

  async function handleMoveItemGroup(itemId: string, newGroupId: string) {
    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, groupId: newGroupId } : it
    );
    setItems(nextItems);
    await persistChanges(groups, nextItems);
  }

  async function handleDeleteItem(item: CertificateItem) {
    if (!confirm(`להסיר את המסמך "${item.title}"?`)) return;
    if (item.fileUrl) {
      await deleteFileByUrl(item.fileUrl);
    }
    const nextItems = items.filter((it) => it.id !== item.id);
    setItems(nextItems);
    if (previewItem?.id === item.id) {
      setPreviewItem(null);
    }
    await persistChanges(groups, nextItems);
  }

  // Group actions
  async function handleCreateGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const newGroup: CertificateGroup = {
      id: `custom_${Date.now()}`,
      name: trimmed,
      isDefault: false,
    };
    const nextGroups = [...groups, newGroup];
    setGroups(nextGroups);
    setUploadTargetGroupId(newGroup.id);
    setNewGroupName("");
    setNewGroupDialogOpen(false);
    await persistChanges(nextGroups, items);
  }

  async function handleRenameGroup(groupId: string) {
    const trimmed = renameGroupValue.trim();
    if (!trimmed) {
      setRenamingGroupId(null);
      return;
    }
    const nextGroups = groups.map((g) =>
      g.id === groupId ? { ...g, name: trimmed } : g
    );
    setGroups(nextGroups);
    setRenamingGroupId(null);
    await persistChanges(nextGroups, items);
  }

  async function handleDeleteGroup(group: CertificateGroup) {
    const groupItems = items.filter((i) => i.groupId === group.id);
    if (groupItems.length > 0) {
      if (
        !confirm(
          `בקבוצה "${group.name}" יש ${groupItems.length} מסמכים. מחיקת הקבוצה תעביר אותם לקבוצת "אישורים ותעודות נוספות". להמשיך?`
        )
      ) {
        return;
      }
    } else if (!confirm(`למחוק את הקבוצה "${group.name}"?`)) {
      return;
    }

    const fallbackGroupId =
      groups.find((g) => g.id === "general" && g.id !== group.id)?.id ??
      groups.find((g) => g.id !== group.id)?.id ??
      "general";

    const nextGroups = groups.filter((g) => g.id !== group.id);
    const nextItems = items.map((it) =>
      it.groupId === group.id ? { ...it, groupId: fallbackGroupId } : it
    );

    setGroups(nextGroups);
    setItems(nextItems);
    if (selectedGroupFilter === group.id) {
      setSelectedGroupFilter("all");
    }
    if (uploadTargetGroupId === group.id) {
      setUploadTargetGroupId(fallbackGroupId);
    }
    await persistChanges(nextGroups, nextItems);
  }

  // Print helpers
  function handlePrintSingle(item: CertificateItem) {
    const kind = getFileKind(item.fileName, item.fileType);
    const win = window.open("", "_blank");
    if (!win) return;

    if (kind === "image") {
      win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <title>${item.title}</title>
  <style>
    body { font-family: sans-serif; margin: 24px; text-align: center; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0 0 16px; color: #555; font-size: 13px; }
    img { max-width: 100%; max-height: 88vh; object-fit: contain; }
  </style>
</head>
<body>
  <h2>${item.title}</h2>
  ${item.notes ? `<p>${item.notes}</p>` : ""}
  <img src="${item.fileUrl}" onload="window.focus(); window.print();" />
</body>
</html>`);
      win.document.close();
    } else if (kind === "pdf") {
      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${item.title}</title>
  <style>body{margin:0}iframe{width:100vw;height:100vh;border:none}</style>
</head>
<body>
  <iframe src="${item.fileUrl}"></iframe>
</body>
</html>`);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };
    } else {
      win.location.href = item.fileUrl;
    }
  }

  function handlePrintAllImages(filterGroupId?: string) {
    const targetItems = items.filter((it) => {
      if (filterGroupId && filterGroupId !== "all" && it.groupId !== filterGroupId) {
        return false;
      }
      return getFileKind(it.fileName, it.fileType) === "image";
    });

    if (targetItems.length === 0) {
      alert("אין תעודות בפורמט תמונה להדפסה מרוכזת. ניתן להדפיס קובצי PDF ישירות מכפתור ההדפסה של כל מסמך.");
      return;
    }

    const groupMap = new Map(groups.map((g) => [g.id, g.name]));
    const pagesHtml = targetItems
      .map(
        (it) => `
      <div class="page">
        <div class="meta">
          <span class="group">${groupMap.get(it.groupId) ?? ""}</span>
          <h2>${it.title}</h2>
          ${it.notes ? `<p>${it.notes}</p>` : ""}
        </div>
        <div class="img-wrap">
          <img src="${it.fileUrl}" alt="${it.title}" />
        </div>
      </div>`
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8" />
  <title>הדפסת תעודות וואוצ׳רים</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 0; background: #fff; color: #111; }
    .page { page-break-after: always; padding: 20px 28px; box-sizing: border-box; height: 98vh; display: flex; flex-direction: column; }
    .page:last-child { page-break-after: auto; }
    .meta { border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 14px; }
    .group { font-size: 12px; color: #2563eb; font-weight: bold; }
    h2 { margin: 4px 0 2px; font-size: 18px; }
    p { margin: 2px 0 0; font-size: 13px; color: #555; }
    .img-wrap { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 400);
    };
  </script>
</body>
</html>`);
    win.document.close();
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedGroupFilter !== "all" && item.groupId !== selectedGroupFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.notes ?? "").toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, selectedGroupFilter]);

  // Count per group (unfiltered by search for filter badges)
  const countByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      map[it.groupId] = (map[it.groupId] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const visibleGroups = useMemo(() => {
    if (selectedGroupFilter !== "all") {
      return groups.filter((g) => g.id === selectedGroupFilter);
    }
    return groups;
  }, [groups, selectedGroupFilter]);

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFilesUpload(e.target.files, uploadTargetGroupId);
            e.target.value = "";
          }
        }}
        className="hidden"
      />
      <input
        ref={groupFileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFilesUpload(e.target.files, directUploadGroupIdRef.current);
            e.target.value = "";
          }
        }}
        className="hidden"
      />

      {/* Page Header + Minimalist Upload & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">תעודות וואוצ׳רים</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            ניהול וואוצ׳רים לאתרים, תעודות מדריך, רישיונות מאבטחים, היעדר עבירות מין ורישיונות עסק · ניתן לגרור קבצים או להדביק מהלוח (Ctrl+V)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status !== "idle" && (
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-[var(--radius-sm)] ${
                status === "saved"
                  ? "bg-[var(--success-light)] text-[var(--success)]"
                  : status === "error"
                  ? "bg-[var(--danger-light)] text-destructive"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {status === "uploading"
                ? uploadProgressText || "מעלה קבצים..."
                : status === "saving"
                ? "שומר..."
                : status === "saved"
                ? "נשמר ✓"
                : "שגיאה בשמירה"}
            </span>
          )}

          {/* Compact Upload + Paste Group Selector */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-[var(--radius-sm)] p-1 shadow-[var(--shadow-card)]">
            <select
              id="target-group-select"
              value={uploadTargetGroupId}
              onChange={(e) => setUploadTargetGroupId(e.target.value)}
              className="h-7 rounded px-2 text-xs font-medium text-foreground bg-muted/50 border-0 focus:outline-none focus:ring-1 focus:ring-ring/40"
              title="קבוצת יעד להעלאה או הדבקה (Ctrl+V)"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="xs"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1"
            >
              <Upload className="size-3.5" />
              <span>העלאת קבצים</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => handlePasteFromButton(uploadTargetGroupId)}
              className="gap-1 text-primary hover:bg-[var(--brand-light)]"
              title="הדבק תמונה מהלוח (Ctrl+V / ⌘V)"
            >
              <ClipboardPaste className="size-3.5" />
              <span>הדבק</span>
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewGroupDialogOpen(true)}
            className="gap-1.5 h-9"
          >
            <FolderPlus className="size-4" />
            <span>קבוצה חדשה</span>
          </Button>

          {items.some((it) => getFileKind(it.fileName, it.fileType) === "image") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintAllImages(selectedGroupFilter)}
              className="gap-1.5 h-9"
            >
              <Printer className="size-4" />
              <span>הדפס תמונות</span>
            </Button>
          )}
        </div>
      </div>

      {fileError && (
        <div className="text-xs bg-[var(--danger-light)] text-destructive border border-destructive/20 rounded-[var(--radius-sm)] px-3 py-2 flex items-center justify-between gap-2">
          <span>{fileError}</span>
          <button
            type="button"
            onClick={() => setFileError("")}
            className="text-destructive/70 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Filter Pills & Search Bar */}
      <div className="bg-card rounded-[var(--radius)] border border-border shadow-[var(--shadow-card)] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי כותרת מסמך, הערה או שם קובץ..."
              className="pr-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            סה״כ <span className="font-semibold text-foreground">{items.length}</span> מסמכים ב-
            <span className="font-semibold text-foreground">{groups.length}</span> קבוצות
          </div>
        </div>

        {/* Group Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedGroupFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedGroupFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>הכל</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedGroupFilter === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-foreground"
              }`}
            >
              {items.length}
            </span>
          </button>

          {groups.map((g) => {
            const count = countByGroup[g.id] ?? 0;
            const active = selectedGroupFilter === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupFilter(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{g.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : count > 0
                      ? "bg-[var(--brand-light)] text-primary font-semibold"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Groups & Document Cards */}
      <div className="space-y-3">
        {visibleGroups.map((group) => {
          const groupItems = filteredItems.filter((it) => it.groupId === group.id);
          const isExpanded =
            !!expandedGroups[group.id] ||
            selectedGroupFilter === group.id ||
            (!!searchQuery.trim() && groupItems.length > 0);
          const isCollapsed = !isExpanded;
          const isRenaming = renamingGroupId === group.id;

          // If user is searching and this group has no matches, hide empty groups during search
          if (searchQuery.trim() && groupItems.length === 0) {
            return null;
          }

          return (
            <div
              key={group.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverGroupId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverGroupId(null);
                if (e.dataTransfer.files?.length) {
                  handleFilesUpload(e.dataTransfer.files, group.id);
                }
              }}
              className={`bg-card rounded-[var(--radius)] border shadow-[var(--shadow-card)] overflow-hidden transition-colors ${
                dragOverGroupId === group.id
                  ? "border-primary ring-2 ring-primary/20 bg-[var(--brand-light)]/20"
                  : "border-border"
              }`}
            >
              {/* Group Header */}
              <div
                onClick={() => {
                  if (!isRenaming) {
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.id]: !isExpanded,
                    }));
                  }
                }}
                className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors ${
                  !isCollapsed ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.id]: !isExpanded,
                      }));
                    }}
                    className="p-1 rounded-[var(--radius-sm)] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={isCollapsed ? "הרחב קבוצה" : "כווץ קבוצה"}
                  >
                    {isCollapsed ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronUp className="size-4" />
                    )}
                  </button>

                  {isRenaming ? (
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={renameGroupValue}
                        onChange={(e) => setRenameGroupValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameGroup(group.id);
                          if (e.key === "Escape") setRenamingGroupId(null);
                        }}
                        className="h-7 text-sm w-48 bg-background"
                        autoFocus
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleRenameGroup(group.id)}
                        className="text-[var(--success)]"
                      >
                        <Check className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => setRenamingGroupId(null)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {group.name}
                      </h3>
                      <Badge variant={groupItems.length > 0 ? "default" : "secondary"}>
                        {groupItems.length}
                      </Badge>
                    </>
                  )}
                </div>

                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handlePasteFromButton(group.id)}
                    className="gap-1 text-primary border-primary/30 hover:bg-[var(--brand-light)]"
                    title="הדבק תמונה מהלוח לקבוצה זו"
                  >
                    <ClipboardPaste className="size-3.5" />
                    <span>הדבק לכאן</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      directUploadGroupIdRef.current = group.id;
                      groupFileInputRef.current?.click();
                    }}
                    className="gap-1 text-primary border-primary/30 hover:bg-[var(--brand-light)]"
                  >
                    <Plus className="size-3.5" />
                    <span>העלה לכאן</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      setRenamingGroupId(group.id);
                      setRenameGroupValue(group.name);
                    }}
                    title="שינוי שם קבוצה"
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </Button>

                  {!group.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDeleteGroup(group)}
                      title="מחיקת קבוצה"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Group Content */}
              {!isCollapsed && (
                <div className="p-3.5">
                  {groupItems.length === 0 ? (
                    <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/15 text-xs text-muted-foreground">
                      <span>אין עדיין מסמכים בקבוצה זו — ניתן לגרור קבצים לכאן</span>
                      <button
                        type="button"
                        onClick={() => {
                          directUploadGroupIdRef.current = group.id;
                          groupFileInputRef.current?.click();
                        }}
                        className="font-medium text-primary hover:underline shrink-0"
                      >
                        + העלה קובץ
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupItems.map((item) => {
                        const kind = getFileKind(item.fileName, item.fileType);
                        const extLabel = getFileExtensionLabel(item.fileName, kind);
                        const isEditing = editingItemId === item.id;

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col justify-between gap-3 p-3.5 rounded-[var(--radius-sm)] border border-border bg-background hover:border-primary/30 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              {/* Thumbnail or File Type Badge */}
                              {kind === "image" ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewItem(item)}
                                  className="w-14 h-14 rounded-[var(--radius-sm)] border border-border overflow-hidden shrink-0 bg-muted group relative"
                                  title="לחץ לתצוגה מוגדלת"
                                >
                                  <img
                                    src={item.fileUrl}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    kind === "pdf"
                                      ? setPreviewItem(item)
                                      : window.open(item.fileUrl, "_blank")
                                  }
                                  className={`w-14 h-14 rounded-[var(--radius-sm)] border shrink-0 flex flex-col items-center justify-center gap-0.5 transition-opacity hover:opacity-80 ${
                                    kind === "pdf"
                                      ? "bg-[var(--danger-light)] border-destructive/20 text-destructive"
                                      : kind === "word"
                                      ? "bg-[var(--brand-light)] border-primary/20 text-primary"
                                      : kind === "excel"
                                      ? "bg-[var(--success-light)] border-border text-[var(--success)]"
                                      : "bg-muted border-border text-muted-foreground"
                                  }`}
                                  title="פתח מסמך"
                                >
                                  {kind === "pdf" ? (
                                    <FileText className="size-5" />
                                  ) : kind === "excel" ? (
                                    <FileSpreadsheet className="size-5" />
                                  ) : kind === "word" ? (
                                    <FileText className="size-5" />
                                  ) : (
                                    <FileIcon className="size-5" />
                                  )}
                                  <span className="text-[10px] font-bold tracking-tight">
                                    {extLabel}
                                  </span>
                                </button>
                              )}

                              {/* Title, Notes & Edit Form */}
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div>
                                      <label className="text-[11px] text-muted-foreground block mb-0.5">
                                        כותרת המסמך
                                      </label>
                                      <Input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        placeholder="למשל: תעודת מדריך — יוסי כהן"
                                        className="h-8 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditingItem(item.id);
                                          if (e.key === "Escape") setEditingItemId(null);
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[11px] text-muted-foreground block mb-0.5">
                                        הערה / פרטים נוספים (אופציונלי)
                                      </label>
                                      <Input
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        placeholder="מס׳ הזמנה, תוקף תעודה, טלפון..."
                                        className="h-7 text-xs"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEditingItem(item.id);
                                          if (e.key === "Escape") setEditingItemId(null);
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[11px] text-muted-foreground block mb-0.5">
                                        קבוצה
                                      </label>
                                      <select
                                        value={editGroupId}
                                        onChange={(e) => setEditGroupId(e.target.value)}
                                        className="w-full h-7 rounded-[var(--radius-sm)] border border-input bg-background px-2 text-xs text-foreground"
                                      >
                                        {groups.map((g) => (
                                          <option key={g.id} value={g.id}>
                                            {g.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <Button
                                        size="xs"
                                        onClick={() => saveEditingItem(item.id)}
                                        className="gap-1"
                                      >
                                        <Check className="size-3" />
                                        <span>שמור</span>
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => setEditingItemId(null)}
                                      >
                                        ביטול
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditingItem(item)}
                                        className="text-right group/title inline-flex items-center gap-1.5 max-w-full"
                                        title="לחץ לעריכת כותרת המסמך"
                                      >
                                        <span className="text-sm font-semibold text-foreground group-hover/title:text-primary transition-colors truncate">
                                          {item.title}
                                        </span>
                                        <Pencil className="size-3 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                                      </button>
                                    </div>

                                    {item.notes ? (
                                      <p className="text-xs text-foreground/80 mt-0.5 line-clamp-2">
                                        {item.notes}
                                      </p>
                                    ) : null}

                                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                                      <span className="truncate max-w-[160px]" title={item.fileName}>
                                        {item.fileName}
                                      </span>
                                      {item.fileSize > 0 && (
                                        <span>· {formatFileSize(item.fileSize)}</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Action Footer */}
                            {!isEditing && (
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                                {/* Quick group switcher */}
                                <select
                                  value={item.groupId}
                                  onChange={(e) => handleMoveItemGroup(item.id, e.target.value)}
                                  className="h-6 max-w-[145px] truncate rounded border border-border bg-muted/40 px-1.5 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none"
                                  title="העבר לקבוצה אחרת"
                                >
                                  {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => startEditingItem(item)}
                                    title="ערוך כותרת והערות"
                                    className="gap-1 text-muted-foreground hover:text-foreground"
                                  >
                                    <Pencil className="size-3" />
                                    <span>ערוך</span>
                                  </Button>

                                  {(kind === "image" || kind === "pdf") && (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => setPreviewItem(item)}
                                      title="תצוגה מקדימה"
                                      className="gap-1 text-muted-foreground hover:text-foreground"
                                    >
                                      <Eye className="size-3" />
                                      <span>תצוגה</span>
                                    </Button>
                                  )}

                                  {(kind === "image" || kind === "pdf") && (
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handlePrintSingle(item)}
                                      title="הדפס מסמך"
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <Printer className="size-3.5" />
                                    </Button>
                                  )}

                                  <a
                                    href={item.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="פתח / הורד קובץ"
                                    className="inline-flex items-center justify-center size-6 rounded-[var(--radius-sm)] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </a>

                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => handleDeleteItem(item)}
                                    title="הסר מסמך"
                                    className="text-destructive hover:bg-[var(--danger-light)]"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Custom Group Dialog */}
      <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>יצירת קבוצת מסמכים חדשה</DialogTitle>
            <DialogDescription>
              הגדר/י שם לקבוצה חדשה (למשל: &quot;אישורי כשרות&quot;, &quot;ביטוחים&quot;, &quot;וואוצ׳רים יום ב׳&quot;)
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="שם הקבוצה..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateGroup();
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="sm:justify-start gap-2">
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              צור קבוצה
            </Button>
            <Button variant="outline" onClick={() => setNewGroupDialogOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-App Preview Dialog for Images & PDFs */}
      <Dialog
        open={!!previewItem}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col" dir="rtl">
          {previewItem && (
            <>
              <DialogHeader className="pr-2">
                <DialogTitle className="flex items-center gap-2">
                  {getFileKind(previewItem.fileName, previewItem.fileType) === "image" ? (
                    <ImageIcon className="size-4 text-primary shrink-0" />
                  ) : (
                    <FileText className="size-4 text-primary shrink-0" />
                  )}
                  <span className="truncate">{previewItem.title}</span>
                </DialogTitle>
                {previewItem.notes && (
                  <DialogDescription>{previewItem.notes}</DialogDescription>
                )}
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-auto rounded-[var(--radius-sm)] border border-border bg-muted/30 flex items-center justify-center p-2">
                {getFileKind(previewItem.fileName, previewItem.fileType) === "image" ? (
                  <img
                    src={previewItem.fileUrl}
                    alt={previewItem.title}
                    className="max-w-full max-h-[68vh] object-contain rounded"
                  />
                ) : (
                  <iframe
                    src={previewItem.fileUrl}
                    title={previewItem.title}
                    className="w-full h-[68vh] border-0 rounded"
                  />
                )}
              </div>

              <DialogFooter className="sm:justify-between items-center gap-2">
                <span className="text-xs text-muted-foreground truncate">
                  {previewItem.fileName}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintSingle(previewItem)}
                    className="gap-1.5"
                  >
                    <Printer className="size-3.5" />
                    <span>הדפס</span>
                  </Button>
                  <a
                    href={previewItem.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>פתח בחלון חדש</span>
                  </a>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
