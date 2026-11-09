/**
 * In-memory per-instance rate limiter for sensitive backend operations.
 *
 * Prevents: accidental repeated submissions, double payments, repeated
 * restore requests, abuse of expensive report/export queries, and
 * excessive import/export operations.
 *
 * LIMITATION: This is per-isolate, in-memory state. Cloudflare may route
 * requests across isolates, so these counters are not a distributed abuse
 * control. Configure a Durable Object or another atomic shared limiter before
 * relying on these thresholds as a production security boundary.
 */

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check a rate limit for a given key. Returns { allowed, remaining, retryAfterMs }.
 * If allowed, the counter is incremented.
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}

/**
 * Pre-configured rate limits per operation.
 * Limits are generous enough for normal daily clinic operations while
 * preventing abuse and accidental repeated submissions.
 */
export const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  // Financial operations — prevent double payments, rapid re-submission
  savePayment: { max: 30, windowMs: 60_000 },
  saveDoctorCompensation: { max: 20, windowMs: 60_000 },

  // Backup/restore — expensive and destructive; very restrictive
  createClinicBackup: { max: 10, windowMs: 3_600_000 },     // 10 per hour
  restoreClinicBackup: { max: 2, windowMs: 600_000 },       // 2 per 10 minutes
  runAutomaticBackups: { max: 5, windowMs: 3_600_000 },
  getBackupHistory: { max: 30, windowMs: 60_000 },           // 30 per minute
  createNewClinic: { max: 5, windowMs: 3_600_000 },         // 5 per hour (super admin)

  // Registration/security — prevent rapid privilege changes
  approveRegistration: { max: 15, windowMs: 60_000 },
  rejectRegistration: { max: 15, windowMs: 60_000 },
  assignUserToClinic: { max: 15, windowMs: 60_000 },
  saveClinicSettings: { max: 10, windowMs: 60_000 },
  enforceUserIntegrity: { max: 30, windowMs: 60_000 },
  reconcileAllUsers: { max: 5, windowMs: 60_000 },

  // Expensive reporting queries — prevent report spam
  getReportsStats: { max: 15, windowMs: 60_000 },
  getMonthlyExpenses: { max: 20, windowMs: 60_000 },
  getDashboardStats: { max: 30, windowMs: 60_000 },
  getDoctorDashboard: { max: 30, windowMs: 60_000 },
  getDoctorCommissionSummary: { max: 20, windowMs: 60_000 },
  getSuperAdminStats: { max: 15, windowMs: 60_000 },

  // Search/pagination — higher limits for normal use
  searchPatients: { max: 60, windowMs: 60_000 },
  // Shared by every clinicScopedCrud call, and a single clinic screen fans out
  // 6-10 reads (plan, patient, payments, treatments, doctors, files). At 60/min a
  // normal browsing session tripped the limit and every later screen failed with
  // "too many requests" — which the treatment plan surface as a load error.
  getPaginatedRecords: { max: 180, windowMs: 60_000 },

  // Credit-consuming AI extraction — tightly limited (per user, per hour)
  secureExtractData: { max: 10, windowMs: 3_600_000 },

  // Additional read/report operations that previously had no limit configured
  getPatientTimeline: { max: 60, windowMs: 60_000 },
  getPatientRecall: { max: 30, windowMs: 60_000 },
  getClinicExportData: { max: 10, windowMs: 3_600_000 },      // heavy clinic export
  finalizeLabCase: { max: 20, windowMs: 60_000 },
  linkExistingReceptionist: { max: 20, windowMs: 60_000 },
  processPatientFileBatch: { max: 1000, windowMs: 60_000 },    // invoked in the backup batch loop

  // Doctor profile linking — clinic admin operation
  linkExistingDoctor: { max: 20, windowMs: 60_000 },

  // File operations
  migrateLegacyFiles: { max: 3, windowMs: 3_600_000 },
  getPatientFileSignedUrl: { max: 60, windowMs: 60_000 },

  // Clinic deletion — destructive; restrictive
  scheduleClinicDeletion: { max: 10, windowMs: 60_000 },
  cancelClinicDeletion: { max: 20, windowMs: 60_000 },
  checkPendingClinicDeletion: { max: 60, windowMs: 60_000 },

  // Permanent deletion — extremely destructive; very restrictive
  schedulePermanentDeletion: { max: 10, windowMs: 60_000 },
  cancelPermanentDeletion: { max: 20, windowMs: 60_000 },
  checkPendingPermanentDeletion: { max: 60, windowMs: 60_000 },

  // Clinic restore
  restoreClinic: { max: 10, windowMs: 60_000 },
};

/**
 * Check the rate limit for a specific user + operation.
 * Returns null if allowed, or a Response (429) if rate-limited.
 */
export function enforceRateLimit(userId: string, operation: string): Response | null {
  const config = RATE_LIMITS[operation];
  if (!config) return null; // No limit configured = unlimited

  const result = checkRateLimit(`${userId}:${operation}`, config.max, config.windowMs);
  if (result.allowed) return null;

  const retrySec = Math.ceil(result.retryAfterMs / 1000);
  return Response.json(
    {
      error: `Rate limit exceeded for "${operation}". Try again in ${retrySec} seconds.`,
      retry_after_seconds: retrySec,
    },
    { status: 429 }
  );
}
