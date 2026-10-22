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
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: "RAZORPAY_CONFIG" },
        });
        if (setting) {
            const parsed = JSON.parse(setting.value);
            if (Array.isArray(parsed)) {
                const active = parsed.find((c: any) => c.isActive);
                if (active && active.keyId && active.keySecret) {
                    return {
                        keyId: active.keyId,
                        keySecret: decrypt(active.keySecret),
                    };
                }
            }
        }
    } catch (error) {
        console.warn("Could not retrieve Razorpay config from database:", error);
    }

    // Fallback to environment variables (.env)
    const envKeyId = process.env.RAZORPAY_KEY_ID?.trim();
    const envKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (envKeyId && envKeySecret) {
        return {
            keyId: envKeyId,
            keySecret: envKeySecret,
        };
    }

    return null;
};

// Helper to get or create a Razorpay Plan for a SubscriptionPackage
const getOrCreateRazorpayPlan = async (razorpay: any, pkg: any) => {
    // 1. Check if package already has a valid plan cached
    if (pkg.razorpayPlanId) {
        try {
            const existingPlan = await razorpay.plans.fetch(pkg.razorpayPlanId);
            if (existingPlan && existingPlan.id) {
                return existingPlan.id;
            }
        } catch (_) {
            // Plan might belong to a previous key, create a new one below
        }
    }

    // 2. Map package duration to Razorpay period & interval
    let period: "weekly" | "monthly" | "yearly" | "daily" = "monthly";
    let interval = 1;

    const days = pkg.durationInDays;
    if (days <= 7) {
        period = "weekly";
        interval = 1;
    } else if (days >= 28 && days <= 35) {
        period = "monthly";
        interval = 1;
    } else if (days >= 80 && days <= 105) {
        period = "monthly";
        interval = 3; // Quarterly = 3 months
    } else if (days >= 165 && days <= 200) {
        period = "monthly";
        interval = 6; // Half-Yearly = 6 months
    } else if (days >= 350) {
        period = "yearly";
        interval = 1;
    } else {
        period = "daily";
        interval = Math.max(1, days);
    }

    const amountInPaise = Math.round(Number(pkg.price) * 100);

    const plan = await razorpay.plans.create({
        period,
        interval,
        item: {
            name: `${pkg.name} (${pkg.durationInDays} Days)`,
            amount: amountInPaise,
            currency: "INR",
            description: `AutoPay recurring subscription plan for ${pkg.name}`,
        },
    });

    try {
        await prisma.subscriptionPackage.update({
            where: { id: pkg.id },
            data: { razorpayPlanId: plan.id } as any,
        });
    } catch (_) { /* non-blocking */ }

    return plan.id;
};

// POST /api/payments/create-subscription (Razorpay AutoPay)
export const createRazorpaySubscription = async (req: Request, res: Response) => {
    try {
        const { packageId, customerName, customerEmail, customerPhone } = req.body;

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

        // Get or dynamically create the recurring plan
        const planId = await getOrCreateRazorpayPlan(razorpay, pkg);

        // Create subscription (60 recurring cycles = 5 years, cancelable anytime)
        const subscription = await razorpay.subscriptions.create({
            plan_id: planId,
            total_count: 60,
            quantity: 1,
            customer_notify: 1,
            notes: {
                packageId: pkg.id,
                packageName: pkg.name,
                customerName: customerName || "",
                customerEmail: customerEmail || "",
                customerPhone: customerPhone || "",
            },
        });

        return res.json({
            subscriptionId: subscription.id,
            razorpayKeyId: config.keyId,
            amount: Math.round(pkg.price * 100),
            currency: "INR",
            packageId: packageId,
            planId: planId,
            isAutoPay: true,
        });
    } catch (error: any) {
        console.error("Create subscription error:", error);
        return res.status(500).json({
            message: error.error?.description || error.message || "Failed to create AutoPay subscription",
        });
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
            razorpay_subscription_id,
            packageId,
            clinicData,
            clinicId,
            userId,
            isAutoPay,
        } = req.body;

        if (!razorpay_payment_id || !razorpay_signature || !packageId) {
            return res.status(400).json({ message: "Missing required payment parameters" });
        }

        if (!razorpay_order_id && !razorpay_subscription_id) {
            return res.status(400).json({ message: "Either order_id or subscription_id is required" });
        }

        if (!clinicData && !clinicId && !userId) {
            return res.status(400).json({ message: "Clinic or user identification is required for payment verification" });
        }

        // 1. Verify Razorpay Signature (Handles both AutoPay Subscriptions and One-time Orders)
        const config = await getActiveRazorpayConfig();
        if (!config) {
            return res.status(400).json({ message: "Payment verification failed. Configuration not found." });
        }

        const hmac = crypto.createHmac("sha256", config.keySecret);
        if (razorpay_subscription_id) {
            // Subscription signature: payment_id + '|' + subscription_id
            hmac.update(`${razorpay_payment_id}|${razorpay_subscription_id}`);
        } else {
            // Standard order signature: order_id + '|' + payment_id
            hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        }
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
        }

        const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (!pkg) {
            return res.status(404).json({ message: "Subscription package not found" });
        }

        const now = new Date();
        const autoPayEnabled = Boolean(razorpay_subscription_id || isAutoPay);

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
                    isAutoPayEnabled: autoPayEnabled,
                    razorpaySubscriptionId: razorpay_subscription_id || existingClinic.razorpaySubscriptionId,
                } as any,
                include: { package: true, landingPage: true },
            });

            // Super admin notification
            try {
                await createSuperAdminNotification({
                    type: "CLINIC_REGISTERED",
                    title: autoPayEnabled ? "Clinic AutoPay Activated" : "Clinic Plan Upgraded",
                    message: `${existingClinic.name} has ${autoPayEnabled ? "enabled AutoPay for" : "upgraded to"} "${pkg.name}" (₹${pkg.price.toLocaleString("en-IN")}).`,
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
                message: autoPayEnabled ? "AutoPay activated & plan upgraded successfully!" : "Plan upgraded successfully!",
                clinic: updatedClinic,
                isAutoPay: autoPayEnabled,
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
                    isAutoPayEnabled: autoPayEnabled,
                    razorpaySubscriptionId: razorpay_subscription_id || null,
                } as any,
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
                title: autoPayEnabled ? "New Clinic Registered with AutoPay" : "New Clinic Registered & Paid",
                message: `${clinicName} has registered & completed ${autoPayEnabled ? "AutoPay setup" : "payment"} for the "${pkg.name}" plan.`,
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
            message: autoPayEnabled
                ? "AutoPay mandate verified & registration completed successfully!"
                : "Payment verified & registration completed successfully!",
            token,
            isAutoPay: autoPayEnabled,
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

// POST /api/payments/webhook
// Listens for recurring debit events (subscription.charged, etc.) from Razorpay
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"] as string;

        if (webhookSecret && signature) {
            const expectedSignature = crypto
                .createHmac("sha256", webhookSecret)
                .update(JSON.stringify(req.body))
                .digest("hex");

            if (signature !== expectedSignature) {
                console.warn("[Razorpay Webhook] Invalid webhook signature received");
                return res.status(400).json({ message: "Invalid signature" });
            }
        }

        const event = req.body?.event;
        const payload = req.body?.payload;

        console.log(`[Razorpay Webhook] Event received: ${event}`);

        if (event === "subscription.charged" || event === "payment.captured") {
            const subscriptionId = payload?.subscription?.entity?.id;

            if (subscriptionId) {
                const clinic = await prisma.clinic.findFirst({
                    where: { razorpaySubscriptionId: subscriptionId } as any,
                    include: { package: true },
                });

                if (clinic && clinic.package) {
                    const now = new Date();
                    const currentExpiry = clinic.packageExpiresAt && new Date(clinic.packageExpiresAt) > now
                        ? new Date(clinic.packageExpiresAt)
                        : now;

                    const newExpiry = new Date(currentExpiry.getTime() + clinic.package.durationInDays * 24 * 60 * 60 * 1000);

                    await prisma.clinic.update({
                        where: { id: clinic.id },
                        data: {
                            packageExpiresAt: newExpiry,
                            isAutoPayEnabled: true,
                            status: "UPGRADED" as ClinicStatus,
                        } as any,
                    });

                    console.log(`[Razorpay Webhook] Extended subscription for ${clinic.name} until ${newExpiry.toISOString()}`);

                    // Send email notification of recurring debit
                    if (clinic.ownerEmail) {
                        try {
                            await sendClinicSubscriptionActivatedEmail(
                                clinic.ownerEmail,
                                clinic.ownerName || clinic.name,
                                clinic.package.name,
                                clinic.package.price,
                                clinic.package.durationInDays,
                                newExpiry,
                                true
                            );
                        } catch (_) { /* non-blocking */ }
                    }
                }
            }
        } else if (event === "subscription.cancelled" || event === "subscription.halted") {
            const subscriptionId = payload?.subscription?.entity?.id;
            if (subscriptionId) {
                await prisma.clinic.updateMany({
                    where: { razorpaySubscriptionId: subscriptionId } as any,
                    data: { isAutoPayEnabled: false } as any,
                });
                console.log(`[Razorpay Webhook] Subscription marked inactive: ${subscriptionId}`);
            }
        }

        return res.json({ status: "ok" });
    } catch (error: any) {
        console.error("Razorpay webhook handler error:", error);
        return res.status(500).json({ message: "Internal webhook error" });
    }
};

// POST /api/payments/cancel-autopay
export const cancelAutoPay = async (req: Request, res: Response) => {
    try {
        const { clinicId } = req.body;
        if (!clinicId) return res.status(400).json({ message: "clinicId is required" });

        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
        if (!clinic) return res.status(404).json({ message: "Clinic not found" });

        if ((clinic as any).razorpaySubscriptionId) {
            const config = await getActiveRazorpayConfig();
            if (config) {
                const razorpay = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
                try {
                    await (razorpay as any).subscriptions.cancel((clinic as any).razorpaySubscriptionId);
                } catch (e: any) {
                    console.warn("Could not cancel on Razorpay (might already be cancelled):", e.message);
                }
            }
        }

        await prisma.clinic.update({
            where: { id: clinicId },
            data: { isAutoPayEnabled: false } as any,
        });

        return res.json({ message: "AutoPay cancelled successfully. Your plan will remain active until its expiration date." });
    } catch (error: any) {
        return res.status(500).json({ message: error.message || "Failed to cancel AutoPay" });
    }
};
