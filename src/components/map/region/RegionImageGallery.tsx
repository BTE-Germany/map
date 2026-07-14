"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, PlusIcon, Trash2Icon, UploadCloudIcon, XIcon, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    createRegionImageUpload,
    deleteRegionImage,
    finalizeRegionImageUpload,
    type RegionImageDTO,
} from "@/actions/region/RegionImages";
import { useRegionImages } from "@/dataHooks/regions/useRegionImages";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(n: number): string {
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${n} B`;
}

function validateFile(file: File): string | null {
    if (!ALLOWED.includes(file.type)) {
        return `Dateityp "${file.type || "unbekannt"}" nicht erlaubt. Nutze JPG, PNG, WebP oder GIF.`;
    }
    if (file.size > MAX_BYTES) {
        return `Datei ist ${formatBytes(file.size)} groß — Maximum 10 MB.`;
    }
    if (file.size === 0) return "Datei ist leer.";
    return null;
}

export default function RegionImageGallery({
    regionId,
    canUpload,
}: {
    regionId: string;
    canUpload: boolean;
}) {
    const { data: images, isLoading } = useRegionImages(regionId);
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["regionImages", regionId] });

    async function uploadOne(file: File) {
        const err = validateFile(file);
        if (err) {
            toast.error(err);
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        try {
            const { uploadUrl, key } = await createRegionImageUpload({
                regionId,
                mimeType: file.type,
                sizeBytes: file.size,
                originalName: file.name,
            });

            // PUT über XHR, damit wir Fortschritt anzeigen können
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        setUploadProgress(Math.round((e.loaded / e.total) * 100));
                    }
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
                };
                xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
                xhr.send(file);
            });

            await finalizeRegionImageUpload({ regionId, key, originalName: file.name });
            toast.success(`"${file.name}" hochgeladen`);
            await refresh();
        } catch (e: any) {
            toast.error(e?.message ?? "Upload fehlgeschlagen");
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    }

    async function handleFiles(files: FileList | File[]) {
        const arr = Array.from(files);
        for (const f of arr) {
            // sequentiell, damit der Server-Cap sauber greift
            await uploadOne(f);
        }
    }

    async function performDelete(imageId: string) {
        setDeletingId(imageId);
        try {
            await deleteRegionImage(imageId);
            toast.success("Bild gelöscht");
            if (lightboxIdx !== null) setLightboxIdx(null);
            await refresh();
        } catch (e: any) {
            toast.error(e?.message ?? "Löschen fehlgeschlagen");
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    }

    const confirmImage = confirmDeleteId
        ? images?.find((i) => i.id === confirmDeleteId) ?? null
        : null;

    const hasImages = !!images && images.length > 0;

    return (
        <div
            className={`rounded-2xl bg-white/[0.03] border border-white/[0.06] px-5 py-4 ${isDragging ? "ring-2 ring-sky-500/50" : ""
                }`}
            onDragOver={(e) => {
                if (!canUpload) return;
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                if (!canUpload) return;
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ImageIcon size={12} className="text-neutral-500" />
                    <p className="uppercase text-neutral-500 text-[10px] font-semibold tracking-widest">
                        Bilder {hasImages && <span className="text-neutral-600">· {images!.length}</span>}
                    </p>
                </div>
                {canUpload && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-sky-300 hover:text-sky-200 transition-colors disabled:opacity-50"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                {uploadProgress !== null ? `${uploadProgress}%` : "Lade…"}
                            </>
                        ) : (
                            <>
                                <PlusIcon size={12} />
                                Hochladen
                            </>
                        )}
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="grid grid-cols-3 gap-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-lg bg-white/[0.04] animate-pulse" />
                    ))}
                </div>
            ) : !hasImages ? (
                canUpload ? (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full py-8 rounded-xl border border-dashed border-white/10 hover:border-sky-500/40 hover:bg-sky-500/[0.04] transition-colors flex flex-col items-center gap-2 text-xs text-neutral-500 hover:text-sky-300 disabled:opacity-50"
                    >
                        <UploadCloudIcon size={22} />
                        <span>Bild hierher ziehen oder klicken</span>
                        <span className="text-[10px] text-neutral-600">JPG, PNG, WebP, GIF · max. 10 MB</span>
                    </button>
                ) : (
                    <p className="text-xs text-neutral-500 py-4 text-center">Keine Bilder vorhanden</p>
                )
            ) : (
                <div className="grid grid-cols-3 gap-1.5">
                    {images!.map((img, idx) => (
                        <button
                            key={img.id}
                            onClick={() => setLightboxIdx(idx)}
                            className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04] group"
                        >
                            <img
                                src={img.url}
                                alt={img.originalName ?? "Region Bild"}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                        </button>
                    ))}
                </div>
            )}

            {canUpload && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED.join(",")}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) handleFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            )}

            <AnimatePresence>
                {lightboxIdx !== null && images && images[lightboxIdx] && (
                    <Lightbox
                        image={images[lightboxIdx]}
                        total={images.length}
                        index={lightboxIdx}
                        onClose={() => setLightboxIdx(null)}
                        onPrev={() => setLightboxIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length))}
                        onNext={() => setLightboxIdx((i) => (i === null ? null : (i + 1) % images.length))}
                        canDelete={canUpload}
                        onDelete={() => setConfirmDeleteId(images[lightboxIdx].id)}
                        isDeleting={deletingId === images[lightboxIdx].id}
                    />
                )}
            </AnimatePresence>

            <AlertDialog
                open={confirmDeleteId !== null}
                onOpenChange={(open) => {
                    if (!open && deletingId === null) setConfirmDeleteId(null);
                }}
            >
                <AlertDialogContent className="z-[110]" overlayClassName="z-[110]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmImage?.originalName
                                ? `"${confirmImage.originalName}" wird unwiderruflich gelöscht.`
                                : "Das Bild wird unwiderruflich gelöscht."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingId !== null}>
                            Abbrechen
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deletingId !== null}
                            onClick={(e) => {
                                e.preventDefault();
                                if (confirmDeleteId) performDelete(confirmDeleteId);
                            }}
                            className="bg-red-500 hover:bg-red-600 focus-visible:ring-red-500/40"
                        >
                            {deletingId !== null ? (
                                <>
                                    <Loader2 size={14} className="animate-spin mr-2" />
                                    Löschen…
                                </>
                            ) : (
                                "Löschen"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function Lightbox({
    image,
    total,
    index,
    onClose,
    onPrev,
    onNext,
    canDelete,
    onDelete,
    isDeleting,
}: {
    image: RegionImageDTO;
    total: number;
    index: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    canDelete: boolean;
    onDelete: () => void;
    isDeleting: boolean;
}) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (total <= 1) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                onPrev();
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                onNext();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onNext, onPrev, total]);

    if (!mounted) return null;

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center"
            onClick={onClose}
        >
            <button
                aria-label="Bildergalerie schließen"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                className="absolute top-4 right-4 z-10 bg-white/[0.08] hover:bg-white/[0.15] rounded-xl p-2 transition-colors"
            >
                <XIcon size={18} className="text-white" />
            </button>

            {canDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    disabled={isDeleting}
                    className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2Icon size={14} />}
                    Löschen
                </button>
            )}

            <motion.img
                key={image.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                src={image.url}
                alt={image.originalName ?? ""}
                className="max-w-[92vw] max-h-[78vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
            />

            <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/[0.08] backdrop-blur rounded-full px-4 py-2 text-xs text-neutral-300"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    aria-label="Vorheriges Bild"
                    onClick={onPrev}
                    disabled={total <= 1}
                    className="hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    ←
                </button>
                <span className="tabular-nums">
                    {index + 1} / {total}
                </span>
                <button
                    aria-label="Nächstes Bild"
                    onClick={onNext}
                    disabled={total <= 1}
                    className="hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    →
                </button>
            </div>
        </motion.div>,
        document.body
    );
}
