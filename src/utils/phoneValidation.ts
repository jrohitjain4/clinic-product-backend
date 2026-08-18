import prisma from "../lib/prisma";

/**
 * Backend Phone number validation helpers for 10-digit mobile numbers.
 */

/**
 * Extracts digits only from a phone string, stripping country codes like "+91" or leading "91".
 */
export function cleanPhoneDigits(phone?: string | null): string {
  if (!phone) return "";
  let str = phone.trim();

  // Handle E.164 country code prepended by PhoneInput or user
  if (str.startsWith("+")) {
    if (str.startsWith("+91")) {
      str = str.substring(3);
    } else {
      str = str.replace(/^\+\d{1,3}\s*/, "");
    }
  }

  let digits = str.replace(/\D/g, "");

  // If user typed 919876543210 (12 digits starting with country code 91)
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.substring(2);
  }
  // If user typed 09876543210 (11 digits with leading 0)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.substring(1);
  }

  return digits;
}

/**
 * Checks if a phone number is exactly 10 digits.
 */
export function isValid10DigitPhone(phone?: string | null, required: boolean = false): boolean {
  if (!phone || !phone.trim()) {
    return !required;
  }
  const digits = cleanPhoneDigits(phone);
  return digits.length === 10;
}

/**
 * Returns an error message string if invalid, or null if valid.
 */
export function getPhoneValidationError(phone?: string | null, fieldLabel: string = "Phone number", required: boolean = false): string | null {
  if (!phone || !phone.trim()) {
    if (required) return `${fieldLabel} is required.`;
    return null;
  }
  const digits = cleanPhoneDigits(phone);
  if (digits.length !== 10) {
    return `${fieldLabel} must be exactly 10 digits (entered ${digits.length} digits). Submission not allowed.`;
  }
  return null;
}

/**
 * Checks if a phone number is already registered across User, Patient, Doctor, and Staff tables.
 */
export async function checkPhoneDuplicate(phone: string): Promise<string | null> {
  const digits = cleanPhoneDigits(phone);
  if (!digits || digits.length !== 10) return null;

  const userMatch = await prisma.user.findFirst({
    where: { phone: { contains: digits } }
  });
  if (userMatch) return "user";

  const patientMatch = await prisma.patient.findFirst({
    where: { phone: { contains: digits } }
  });
  if (patientMatch) return "patient";

  const doctorMatch = await prisma.doctor.findFirst({
    where: { phone: { contains: digits } }
  });
  if (doctorMatch) return "doctor";

  const staffMatch = await prisma.staff.findFirst({
    where: { phone: { contains: digits } }
  });
  if (staffMatch) return "staff";

  return null;
}
