"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPhoneDuplicate = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * Checks if a phone number is already registered in the system
 * in either the User, Doctor, Patient, or Staff tables.
 * Returns the name of the entity if found, or null if not found.
 */
async function checkPhoneDuplicate(phone) {
    if (!phone)
        return null;
    const trimmed = phone.trim();
    if (!trimmed)
        return null;
    // 1. Check User table
    const user = await prisma_1.default.user.findFirst({
        where: { phone: trimmed },
    });
    if (user)
        return "User";
    // 2. Check Doctor table
    const doctor = await prisma_1.default.doctor.findFirst({
        where: { phone: trimmed },
    });
    if (doctor)
        return "Doctor";
    // 3. Check Patient table
    const patient = await prisma_1.default.patient.findFirst({
        where: { phone: trimmed },
    });
    if (patient)
        return "Patient";
    // 4. Check Staff table
    const staff = await prisma_1.default.staff.findFirst({
        where: { phone: trimmed },
    });
    if (staff)
        return "Staff";
    return null;
}
exports.checkPhoneDuplicate = checkPhoneDuplicate;
