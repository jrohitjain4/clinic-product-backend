import prisma from "../lib/prisma";

/**
 * Checks if a phone number is already registered in the system
 * in either the User, Doctor, Patient, or Staff tables.
 * Returns the name of the entity if found, or null if not found.
 */
export async function checkPhoneDuplicate(phone: string): Promise<string | null> {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // 1. Check User table
  const user = await prisma.user.findFirst({
    where: { phone: trimmed },
  });
  if (user) return "User";

  // 2. Check Doctor table
  const doctor = await prisma.doctor.findFirst({
    where: { phone: trimmed },
  });
  if (doctor) return "Doctor";

  // 3. Check Patient table
  const patient = await prisma.patient.findFirst({
    where: { phone: trimmed },
  });
  if (patient) return "Patient";

  // 4. Check Staff table
  const staff = await prisma.staff.findFirst({
    where: { phone: trimmed },
  });
  if (staff) return "Staff";

  return null;
}
