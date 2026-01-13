import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { pdfApi, BillingNote } from "@/lib/api";
import { toast } from "sonner";

interface BillingNotePreviewDialogProps {
    billing: BillingNote | null;
    onClose: () => void;
}

export function BillingNotePreviewDialog({ billing, onClose }: BillingNotePreviewDialogProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!billing?.id) {
            setPdfUrl(null);
            return;
        }

        let active = true;
        setIsLoading(true);

        pdfApi.getBillingPreview(billing.id)
            .then(response => {
                if (active) {
                    const blob = new Blob([response.data], { type: "application/pdf" });
                    const url = URL.createObjectURL(blob);
                    setPdfUrl(url);
                }
            })
            .catch(error => {
                console.error("Failed to load PDF preview:", error);
                toast.error("ไม่สามารถโหลดตัวอย่าง PDF ได้");
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [billing?.id]);

    // Cleanup URL
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
            }
        }
    }, [pdfUrl]);

    if (!billing) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-lg w-[95vw] h-[95vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold">ตัวอย่าง PDF: {billing.billingRef}</h2>
                        <p className="text-sm text-gray-500">{billing.vendor?.companyName}</p>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden bg-gray-100 relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : (
                        pdfUrl && (
                            <iframe
                                src={`${pdfUrl}#view=Fit`}
                                className="w-full h-full"
                                title="PDF Preview"
                            />
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
