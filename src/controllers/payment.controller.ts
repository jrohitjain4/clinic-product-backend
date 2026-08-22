import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { decrypt } from "../utils/encryption";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { ClinicStatus } from "@prisma/client";
import { createSuperAdminNotification } from "./notification.controller";
import { sendAdminCongratulationsEmail, sendClinicSubscriptionActivatedEmail } from "../utils/email";

const JWT_SECRET = process.env.JWT_SECRET!;

// Helper to get active Razorpay credential
const getActiveRazorpayConfig = async () => {
    const setting = await prisma.systemSetting.findUnique({
        where: { key: "RAZORPAY_CONFIG" },
    });
    if (!setting) return null;
    try {
        const parsed = JSON.parse(setting.value);
        if (!Array.isArray(parsed)) return null;
        const active = parsed.find((c: any) => c.isActive);
        if (!active) return null;
        return {
            keyId: active.keyId,
            keySecret: decrypt(active.keySecret),
        };
    } catch {
        return null;
    }
};

// POST /api/payments/create-order
export const createRazorpayOrder = async (req: Request, res: Response) => {
    try {
        const { packageId } = req.body;

        if (!packageId) {
            return res.status(400).json({ message: "Package ID is required" });
        }

        const pkg = await prisma.subscriptionPackage.findUnique({
            where: { id: packageId },
        });

        if (!pkg) {
            return res.status(404).json({ message: "Subscription package not found" });
        }

        if (pkg.price === 0) {
            return res.status(400).json({ message: "Free packages do not require payment" });
        }

        const config = await getActiveRazorpayConfig();
        if (!config) {
            return res.json({
                bypass: true,
                message: "No active payment gateway config found. Bypassing payment.",
            });
        }

        const razorpay = new Razorpay({
            key_id: config.keyId,
            key_secret: config.keySecret,
        });

        const amountInPaise = Math.round(pkg.price * 100);
        const options = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${packageId.slice(-8)}_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        res.json({
            orderId: order.id,
            razorpayKeyId: config.keyId,
            amount: order.amount,
            currency: order.currency,
            packageId: packageId,
        });
    } catch (error: any) {
        console.error("Create order error:", error);
        res.status(500).json({ message: error.message || "Failed to create payment order" });
    }
};

// POST /api/payments/verify
export const verifyRazorpayPayment = async (req: Request, res: Response) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            packageId,
            clinicData,
            clinicId,
            userId,
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packageId) {
            return res.status(400).json({ message: "Missing required payment parameters" });
        }

        if (!clinicData && !clinicId && !userId) {
            return res.status(400).json({ message: "Clinic or user identification is required for payment verification" });
        }

        // 1. Verify Razorpay Signature
        const config = await getActiveRazorpayConfig();
        if (!config) {
            return res.status(400).json({ message: "Payment verification failed. Configuration not found." });
        }

        const hmac = crypto.createHmac("sha256", config.keySecret);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
        }

        const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (!pkg) {
            return res.status(404).json({ message: "Subscription package not found" });
        }

        const now = new Date();

        // ── CASE A: Existing Clinic Upgrade / Renewal ──
        if (clinicId || userId) {
            let targetClinicId = clinicId;
            let targetUser: any = null;

            if (!targetClinicId && userId) {
                targetUser = await prisma.user.findUnique({ where: { id: userId }, include: { clinic: true } });
                targetClinicId = targetUser?.clinicId;
            }

            if (!targetClinicId) {
                return res.status(404).json({ message: "Clinic not found" });
            }

            const existingClinic = await prisma.clinic.findUnique({ where: { id: targetClinicId } });
            if (!existingClinic) {
                return res.status(404).json({ message: "Clinic not found" });
            }

            // Calculate precise expiration date
            let packageStartsAt = now;
            let packageExpiresAt: Date;

            if (existingClinic.packageExpiresAt && new Date(existingClinic.packageExpiresAt) > now && existingClinic.packageId === packageId) {
                // Extend from existing active expiry date
                packageStartsAt = existingClinic.packageStartsAt || now;
                packageExpiresAt = new Date(new Date(existingClinic.packageExpiresAt).getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
            } else {
                // Fresh start from today
                packageStartsAt = now;
                packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
            }

            const updatedClinic = await prisma.clinic.update({
                where: { id: targetClinicId },
                data: {
                    packageId,
                    packageStartsAt,
                    packageExpiresAt,
                    status: "UPGRADED" as ClinicStatus,
                    isTrialUsed: true,
                },
                include: { package: true, landingPage: true },
            });

            // Super admin notification
            try {
                await createSuperAdminNotification({
                    type: "CLINIC_REGISTERED",
                    title: "Clinic Plan Upgraded",
                    message: `${existingClinic.name} has upgraded to the "${pkg.name}" plan (₹${pkg.price.toLocaleString("en-IN")}).`,
                    link: "/super-admin/tenants",
                });
            } catch (_) { /* non-blocking */ }

            // Email confirmation to owner
            const ownerEmail = existingClinic.ownerEmail || targetUser?.email;
            const ownerName = existingClinic.ownerName || targetUser?.fullName || existingClinic.name;
            if (ownerEmail) {
                try {
                    await sendClinicSubscriptionActivatedEmail(
                        ownerEmail,
                        ownerName,
                        pkg.name,
                        pkg.price,
                        pkg.durationInDays,
                        packageExpiresAt,
                        true // renewal/upgrade
                    );
                } catch (_) { /* non-blocking */ }
            }

            return res.json({
                message: "Plan upgraded successfully!",
                clinic: updatedClinic,
            });
        }

        // ── CASE B: New Clinic + User Registration ──
        const {
            ownerName,
            email,
            phone,
            whatsappNumber,
            password,
            clinicName,
            addressLine1,
            addressLine2,
            district,
            city,
            state,
            country,
            pincode,
            doctorCount: doctorCountRaw,
            username,
        } = clinicData;

        const doctorCount = doctorCountRaw ? parseInt(doctorCountRaw.toString(), 10) : undefined;

        if (!email || !password || !ownerName || !phone || !clinicName || !username) {
            return res.status(400).json({ message: "All registration fields are required" });
        }

        // Prevent conflicts
        const emailExists = await prisma.user.findUnique({ where: { email } });
        if (emailExists) return res.status(400).json({ message: "This email address is already registered" });

        const phoneExists = await prisma.user.findFirst({ where: { phone } });
        if (phoneExists) return res.status(400).json({ message: "This phone number is already registered" });

        const usernameExists = await prisma.user.findFirst({ where: { username } });
        const clinicExists = await prisma.clinic.findUnique({ where: { username } });
        if (usernameExists || clinicExists) {
            return res.status(400).json({ message: "This clinic username is already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
        const clinicStatus = "UPGRADED";

        const result = await prisma.$transaction(async (tx) => {
            const clinic = await tx.clinic.create({
                data: {
                    name: clinicName,
                    username,
                    ownerName,
                    ownerEmail: email,
                    phone,
                    whatsappNumber,
                    addressLine1,
                    addressLine2,
                    district,
                    city,
                    state,
                    country,
                    pincode,
                    doctorCount: doctorCount || null,
                    status: clinicStatus as ClinicStatus,
                    packageId,
                    packageStartsAt: now,
                    packageExpiresAt,
                    isTrialUsed: false,
                },
            });

            const user = await tx.user.create({
                data: {
                    email,
                    phone,
                    username,
                    passwordHash: hashedPassword,
                    fullName: ownerName,
                    role: "ADMIN",
                    clinicId: clinic.id,
                },
            });

            return { user, clinic };
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: result.user.id, email: result.user.email, role: result.user.role, clinicId: result.user.clinicId },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Notify super admin
        try {
            await createSuperAdminNotification({
                type: "CLINIC_REGISTERED",
                title: "New Clinic Registered & Paid",
                message: `${clinicName} has registered & completed payment for the "${pkg.name}" plan.`,
                link: "/super-admin/tenants",
            });
        } catch (_) { /* non-blocking */ }

        // Send congratulations email to admin with credentials & plan details
        try {
            await sendAdminCongratulationsEmail(
                email,
                ownerName,
                username,
                password,
                pkg
            );
            await sendClinicSubscriptionActivatedEmail(
                email,
                ownerName,
                pkg.name,
                pkg.price,
                pkg.durationInDays,
                packageExpiresAt,
                false
            );
        } catch (_) { /* non-blocking */ }

        return res.status(201).json({
            message: "Payment verified & registration completed successfully!",
            token,
            user: {
                id: result.user.id,
                email: result.user.email,
                fullName: result.user.fullName,
                role: result.user.role,
                clinicId: result.user.clinicId,
                clinic: result.clinic,
            },
        });
    } catch (error: any) {
        console.error("Payment verification and registration error:", error);
        return res.status(500).json({
            message: error.message || "Failed to verify payment and complete registration",
        });
    }
};
