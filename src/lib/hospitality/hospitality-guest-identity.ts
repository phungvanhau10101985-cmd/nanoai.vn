/**
 * Hospitality-facing guest identity / session helpers.
 *
 * Re-exports (and re-names) the pieces of `@/lib/messaging/guest-auth-session`
 * and `@/lib/messaging/guest-widget-identity` that hospitality code legitimately
 * needs. Hospitality modules MUST import from here instead of the messaging
 * modules directly, so the hotel flow can diverge (e.g. different cookie names,
 * separate session tables) without touching fashion code.
 */
export {
  resolveGuestIdentity as resolveHospitalityGuestIdentity,
  upsertGuestAccountForGoogleIdentity as upsertHospitalityGuestAccountForGoogleIdentity,
} from '@/lib/messaging/guest-widget-identity'
export {
  applyGuestIdentityToResponse as applyHospitalityGuestIdentityToResponse,
  readGuestSessionIdFromRequest as readHospitalityGuestSessionIdFromRequest,
} from '@/lib/messaging/guest-auth-session'
