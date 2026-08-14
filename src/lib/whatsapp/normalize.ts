// Phone-number normalisation for the WhatsApp gateway (EPIC-015).
// Pure + unit-tested: WhatsApp addresses users as <country><number>@s.whatsapp.net
// with NO plus sign and no leading zero, and Indonesian numbers are almost
// always written locally as 08xx — the single most common cause of "message
// silently went nowhere".

/** Default country calling code used when a number has no international form. */
export const DEFAULT_COUNTRY_CODE = "62";

/**
 * Returns the msisdn (digits only, country code included) or null when the
 * input cannot be a phone number. Accepts +62…, 62…, 08…, and separators.
 */
export function normalizeMsisdn(
  raw: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (typeof raw !== "string") return null;
  // strip everything that isn't a digit or a leading plus
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  if (!hadPlus) {
    // NOTE: "00" must be tested BEFORE "0" — a single-zero check would
    // otherwise swallow the international prefix and double the country code
    if (digits.startsWith("00")) {
      // international prefix: 0062… -> 62…
      digits = digits.replace(/^00+/, "");
    } else if (digits.startsWith("0")) {
      // local form: 0812… -> 62812…
      digits = countryCode + digits.replace(/^0+/, "");
    }
  }

  // a bare local number with no country code and no leading zero (e.g. 812…)
  if (!digits.startsWith(countryCode) && digits.length <= 12 && !hadPlus) {
    digits = countryCode + digits;
  }

  // WhatsApp msisdns are 8–15 digits including the country code (E.164 max)
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** WhatsApp JID for a personal chat, or null when the number is unusable. */
export function toWhatsAppJid(
  raw: string,
  countryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  const msisdn = normalizeMsisdn(raw, countryCode);
  return msisdn ? `${msisdn}@s.whatsapp.net` : null;
}
