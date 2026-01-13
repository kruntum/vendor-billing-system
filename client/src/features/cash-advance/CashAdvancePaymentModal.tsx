import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CreateCashAdvancePaymentInput } from "@/lib/api";
import { createPortal } from "react-dom";

// Icons
const CloseIcon = () => (
    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface CashAdvancePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateCashAdvancePaymentInput) => void;
    isLoading: boolean;
    totalAmount: number;
}

interface FormInputs extends CreateCashAdvancePaymentInput {
    amount: number;
}

export function CashAdvancePaymentModal({
    isOpen,
    onClose,
    onSubmit,
    isLoading,
    totalAmount,
}: CashAdvancePaymentModalProps) {
    if (!isOpen) return null;

    const { register, handleSubmit, formState: { errors }, watch } = useForm<FormInputs>({
        defaultValues: {
            paymentDate: format(new Date(), "yyyy-MM-dd"), // Default to today
            paymentMethod: "TRANSFER",
            amount: totalAmount,
        }
    });

    const paymentMethod = watch("paymentMethod");

    const onFormSubmit = (data: FormInputs) => {
        // Exclude 'amount' from the data sent to the API
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { amount, ...apiData } = data;
        onSubmit(apiData);
    };

    return createPortal(
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-xl font-bold text-gray-900">บันทึกการจ่ายเงิน (Payment)</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                        >
                            <CloseIcon />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
                        {/* Payment Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                วันที่จ่ายเงิน (Payment Date)
                            </label>
                            <input
                                type="date"
                                {...register("paymentDate", { required: "กรุณาระบุวันที่" })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                            {errors.paymentDate && (
                                <p className="text-red-500 text-xs mt-1">{errors.paymentDate.message}</p>
                            )}
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ยอดเงิน (Amount)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                {...register("amount", {
                                    required: "กรุณาระบุยอดเงิน",
                                    valueAsNumber: true
                                })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-100"
                                readOnly
                            />
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                วิธีการจ่ายเงิน (Payment Method)
                            </label>
                            <select
                                {...register("paymentMethod")}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                <option value="CASH">เงินสด (Cash)</option>
                                <option value="TRANSFER">โอนเงิน (Transfer)</option>
                                <option value="CHEQUE">เช็ค (Cheque)</option>
                            </select>
                        </div>

                        {/* Conditional Fields based on Payment Method */}
                        {paymentMethod === "CHEQUE" && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    เลขที่เช็ค (Cheque No)
                                </label>
                                <input
                                    type="text"
                                    {...register("chequeNo", { required: "กรุณาระบุเลขที่เช็ค" })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                                {errors.chequeNo && (
                                    <p className="text-red-500 text-xs mt-1">{errors.chequeNo.message}</p>
                                )}
                            </div>
                        )}

                        {(paymentMethod === "TRANSFER" || paymentMethod === "CHEQUE") && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ธนาคาร / สาขา / เลขบัญชี
                                </label>
                                <input
                                    type="text"
                                    {...register("bankInfo")}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    placeholder="เช่น KBANK / สาขาสยาม / 123-4-56789-0"
                                />
                            </div>
                        )}

                        {/* Remark */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                หมายเหตุ (Remark)
                            </label>
                            <textarea
                                {...register("remark")}
                                rows={3}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? "กำลังบันทึก..." : "ยืนยันการจ่ายเงิน"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
