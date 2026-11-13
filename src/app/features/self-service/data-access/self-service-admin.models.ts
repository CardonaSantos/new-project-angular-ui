// Mirrors self-service/application/contracts/self-service.types.ts's
// TableQrIssued/TableQrSummary — the staff-facing side of the QR flow
// (provisioning), as opposed to self-service.models.ts (the customer side).

/** Returned only once, at the moment a QR code is issued: `token` is the
 * plaintext secret (only its hash is persisted) and must be shown/printed
 * now — it cannot be recovered afterwards. */
export interface TableQrIssued {
  id: string;
  mesaId: string;
  token: string;
  url: string;
  expiraEn: string | null;
}

export interface TableQrSummary {
  id: string;
  mesaId: string;
  activo: boolean;
  expiraEn: string | null;
  creadoEn: string;
}
