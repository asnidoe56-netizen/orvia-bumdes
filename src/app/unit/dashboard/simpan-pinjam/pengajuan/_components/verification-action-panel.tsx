"use client";

import { useActionState, useState } from "react";
import {
  rejectSavingsLoanApplication,
  requestCorrectionSavingsLoanApplication,
  verifySavingsLoanApplication,
  type ApplicationActionState,
} from "../actions";

type VerificationActionPanelProps = {
  applicationId: string;
  applicationNo: string;
  canVerify: boolean | null;
  canRequestCorrection: boolean | null;
  canReject: boolean | null;
};

const initialState: ApplicationActionState = {
  success: false,
  message: "",
};

function ResultMessage({ state }: { state: ApplicationActionState }) {
  if (!state.message) return null;

  return (
    <div
      className={[
        "rounded-2xl border p-3 text-xs font-semibold leading-5",
        state.success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      ].join(" ")}
    >
      {state.message}
    </div>
  );
}

export function VerificationActionPanel({
  applicationId,
  applicationNo,
  canVerify,
  canRequestCorrection,
  canReject,
}: VerificationActionPanelProps) {
  const [activeAction, setActiveAction] = useState<
    "verify" | "correction" | "reject" | null
  >(null);

  const [verifyState, verifyAction, isVerifying] = useActionState(
    verifySavingsLoanApplication,
    initialState,
  );
  const [correctionState, correctionAction, isRequestingCorrection] =
    useActionState(requestCorrectionSavingsLoanApplication, initialState);
  const [rejectState, rejectAction, isRejecting] = useActionState(
    rejectSavingsLoanApplication,
    initialState,
  );

  const hasAnyAction = canVerify || canRequestCorrection || canReject;

  if (!hasAnyAction) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
        Tidak ada aksi verifikasi yang tersedia.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Aksi Verifikasi
        </p>
        <p className="mt-1 break-words text-xs text-slate-600">
          {applicationNo}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canVerify ? (
          <button
            type="button"
            onClick={() =>
              setActiveAction(activeAction === "verify" ? null : "verify")
            }
            className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            Verifikasi
          </button>
        ) : null}

        {canRequestCorrection ? (
          <button
            type="button"
            onClick={() =>
              setActiveAction(
                activeAction === "correction" ? null : "correction",
              )
            }
            className="rounded-2xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
          >
            Minta Perbaikan
          </button>
        ) : null}

        {canReject ? (
          <button
            type="button"
            onClick={() =>
              setActiveAction(activeAction === "reject" ? null : "reject")
            }
            className="rounded-2xl bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
          >
            Tolak
          </button>
        ) : null}
      </div>

      {activeAction === "verify" ? (
        <form action={verifyAction} className="space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <label className="block">
            <span className="text-xs font-bold text-slate-600">
              Catatan Verifikasi
            </span>
            <textarea
              name="verification_notes"
              rows={3}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              placeholder="Contoh: Data pemohon dan dokumen sudah sesuai."
            />
          </label>
          <button
            type="submit"
            disabled={isVerifying}
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifying ? "Memproses..." : "Simpan Verifikasi"}
          </button>
          <ResultMessage state={verifyState} />
        </form>
      ) : null}

      {activeAction === "correction" ? (
        <form action={correctionAction} className="space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <label className="block">
            <span className="text-xs font-bold text-slate-600">
              Catatan Perbaikan
            </span>
            <textarea
              name="correction_notes"
              rows={3}
              required
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="Contoh: Dokumen pendukung perlu diperjelas."
            />
          </label>
          <button
            type="submit"
            disabled={isRequestingCorrection}
            className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRequestingCorrection ? "Memproses..." : "Kirim Permintaan Perbaikan"}
          </button>
          <ResultMessage state={correctionState} />
        </form>
      ) : null}

      {activeAction === "reject" ? (
        <form action={rejectAction} className="space-y-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <label className="block">
            <span className="text-xs font-bold text-slate-600">
              Alasan Penolakan
            </span>
            <textarea
              name="rejection_reason"
              rows={3}
              required
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              placeholder="Contoh: Kelayakan pembayaran belum memenuhi ketentuan awal."
            />
          </label>
          <button
            type="submit"
            disabled={isRejecting}
            className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRejecting ? "Memproses..." : "Tolak Pengajuan"}
          </button>
          <ResultMessage state={rejectState} />
        </form>
      ) : null}
    </div>
  );
}
