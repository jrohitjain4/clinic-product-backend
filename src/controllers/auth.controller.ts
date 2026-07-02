import { Request, Response } from "express";
import { Role, ClinicStatus } from "@prisma/client";
import { sendEmail, sendAdminCongratulationsEmail, sendClinicWelcomeTrialEmail, sendClinicSubscriptionActivatedEmail } from "../utils/email";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";
import { createSuperAdminNotification } from "./notification.controller";
import { checkPhoneDuplicate } from "../utils/phoneValidation";

const JWT_SECRET = process.env.JWT_SECRET!; // Validated at startup in auth.middleware.ts

// Get all clinics (used during registration dropdown for doctors/patients/porters)
export const getClinics = async (req: Request, res: Response) => {
  try {
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        username: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    return res.json(clinics);
  } catch (error) {
    console.error("Get clinics error:", error);
    return res.status(500).json({ message: "Internal server error fetching clinics" });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.clinicId) return res.status(401).json({ message: "Unauthorized" });
    const {
      firstName, lastName, email, phone, addressLine1, addressLine2,
      country, state, city, pincode, clinicName, gstNo, clinicLogo,
      gender, dob, bloodGroup, maritalStatus, occupation
    } = req.body;

    if (phone) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user && phone !== user.phone) {
        const duplicate = await checkPhoneDuplicate(phone);
        if (duplicate) {
          return res.status(400).json({ message: "This phone number is already registered" });
        }
      }
    }

    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || undefined;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: fullName,
        email: email || undefined,
        gender: gender || undefined,
        dob: dob ? new Date(dob) : undefined
      }
    });

    let details: any = null;

    // If role is PATIENT, sync with Patient model
    if (req.user.role === "PATIENT") {
      details = await prisma.patient.findFirst({
        where: { email: req.user.email, clinicId: req.user.clinicId }
      });

      if (details) {
        details = await prisma.patient.update({
          where: { id: details.id },
          data: {
            firstName: firstName || details.firstName,
            lastName: lastName || details.lastName,
            email: email || details.email,
            phone: phone || details.phone,
            address1: addressLine1 || details.address1,
            address2: addressLine2 || details.address2,
            country: country || details.country,
            state: state || details.state,
            city: city || details.city,
            pincode: pincode || details.pincode,
            gender: gender || details.gender,
            bloodGroup: bloodGroup || details.bloodGroup,
            maritalStatus: maritalStatus || details.maritalStatus,
            occupation: occupation || details.occupation,
            dob: dob ? new Date(dob) : details.dob
          }
        });
      }
    }

    // If role is DOCTOR, sync with Doctor model
    if (req.user.role === "DOCTOR") {
      details = await prisma.doctor.findFirst({
        where: { email: req.user.email, clinicId: req.user.clinicId }
      });

      if (details) {
        details = await prisma.doctor.update({
          where: { id: details.id },
          data: {
            fullName: fullName || details.fullName,
            email: email || details.email,
            phone: phone || details.phone,
            address1: addressLine1 || details.address1,
            address2: addressLine2 || details.address2,
            country: country || details.country,
            state: state || details.state,
            city: city || details.city,
            pincode: pincode || details.pincode,
            gender: gender || details.gender,
            bloodGroup: bloodGroup || details.bloodGroup,
            dob: dob ? new Date(dob) : details.dob
          }
        });
      }
    }

    const updatedClinic = (req.user.role === "ADMIN" || req.user.role === "SUPER_ADMIN")
      ? await prisma.clinic.update({
        where: { id: req.user.clinicId },
        data: {
          name: clinicName || undefined,
          gstNumber: gstNo,
          phone,
          addressLine1,
          addressLine2,
          country,
          state,
          city,
          pincode,
          ...(clinicLogo ? {
            landingPage: {
              upsert: {
                create: { logo: clinicLogo },
                update: { logo: clinicLogo }
              }
            }
          } : {})
        },
        include: { landingPage: true }
      })
      : null;

    return res.json({
      message: "Profile updated successfully",
      user: { ...updatedUser, clinic: updatedClinic, details }
    });
  } catch (err: any) {
    console.error("Update profile error:", err);
    return res.status(500).json({ message: err.message || "Failed to update profile" });
  }
};

// Get all active subscription packages
export const getPackages = async (req: Request, res: Response) => {
  try {
    const packages = await prisma.subscriptionPackage.findMany({
      where: { isActive: true },
    });
    return res.json(packages);
  } catch (error) {
    console.error("Get packages error:", error);
    return res.status(500).json({ message: "Internal server error fetching packages" });
  }
};

// Upgrade / activate a plan for an existing clinic (post-trial)
export const upgradePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { packageId } = req.body;
    if (!packageId) return res.status(400).json({ message: "packageId is required" });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { clinic: { include: { landingPage: true } } },
    });

    if (!user || !user.clinicId) {
      return res.status(404).json({ message: "Clinic not found for this user" });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    const now = new Date();
    const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
    const status = pkg.price === 0 ? "TRIAL" : "UPGRADED";

    const updatedClinic = await prisma.clinic.update({
      where: { id: user.clinicId },
      data: {
        packageId,
        packageStartsAt: now,
        packageExpiresAt,
        status: status as any,
      },
    });

    // 🔔 Notify super admin
    try {
      await createSuperAdminNotification({
        type: "CLINIC_REGISTERED",
        title: "Clinic Plan Upgraded",
        message: `${user.clinic?.name || "A clinic"} has upgraded to ${pkg.name} (₹${pkg.price.toLocaleString("en-IN")}).`,
        link: "/super-admin/tenants",
      });
    } catch (_) { /* non-blocking */ }

    // Send subscription activated/renewed email to clinic owner
    if (user.email) {
      try {
        await sendClinicSubscriptionActivatedEmail(
          user.email,
          user.fullName,
          pkg.name,
          pkg.price,
          pkg.durationInDays,
          packageExpiresAt,
          true // Mark as renewal/upgrade
        );
      } catch (emailErr) {
        console.error("Failed to send subscription renewal email:", emailErr);
      }
    }

    return res.json({
      message: "Plan activated successfully!",
      clinic: updatedClinic,
    });
  } catch (error) {
    console.error("Upgrade plan error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Check Username Availability
export const checkUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: "Username is required" });

    const userExists = await prisma.user.findFirst({ where: { username: String(username) } });
    const clinicExists = await prisma.clinic.findUnique({ where: { username: String(username) } });

    if (userExists || clinicExists) {
      return res.json({ available: false, message: "Username is already taken" });
    }

    return res.json({ available: true, message: "Username is available" });
  } catch (error) {
    console.error("Check username error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Register Draft — now only validates, does NOT save to DB
export const registerDraft = async (req: Request, res: Response) => {
  try {
    const { email, phone, username } = req.body;

    if (!email || !phone || !username) {
      return res.status(400).json({ message: "Email, Phone and Username are required for validation" });
    }

    // Check each field individually for specific error messages
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) return res.status(400).json({ message: "This email address is already registered" });

    const phoneExists = await checkPhoneDuplicate(phone);
    if (phoneExists) return res.status(400).json({ message: "This phone number is already registered" });

    const usernameExists = await prisma.user.findFirst({ where: { username } });
    const clinicExists = await prisma.clinic.findUnique({ where: { username } });
    if (usernameExists || clinicExists) {
      return res.status(400).json({ message: "This clinic username is already taken" });
    }

    return res.status(200).json({ message: "Validation passed", valid: true });
  } catch (error: any) {
    console.error("Register draft validation error:", error);
    return res.status(400).json({ message: error.message || "Validation failed" });
  }
};

// Full Registration — creates user + clinic + assigns package in one atomic transaction
export const registerFull = async (req: Request, res: Response) => {
  try {
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
      packageId
    } = req.body;

    const doctorCount = doctorCountRaw ? parseInt(doctorCountRaw.toString(), 10) : undefined;

    if (!email || !password || !ownerName || !phone || !clinicName || !username || !packageId) {
      return res.status(400).json({ message: "All fields including package selection are required" });
    }

    // Check each field individually for specific error messages
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) return res.status(400).json({ message: "This email address is already registered" });

    const phoneExists = await checkPhoneDuplicate(phone);
    if (phoneExists) return res.status(400).json({ message: "This phone number is already registered" });

    const usernameExists = await prisma.user.findFirst({ where: { username } });
    const clinicExists = await prisma.clinic.findUnique({ where: { username } });
    if (usernameExists || clinicExists) {
      return res.status(400).json({ message: "This clinic username is already taken" });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return res.status(404).json({ message: "Package not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
    const clinicStatus = pkg.price === 0 ? "TRIAL" : "UPGRADED";

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
          isTrialUsed: pkg.price === 0,
        }
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
        }
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
        title: "New Clinic Registered",
        message: `${clinicName} has registered with the "${pkg.name}" plan (${clinicStatus}).`,
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

      if (pkg.price === 0) {
        await sendClinicWelcomeTrialEmail(
          email,
          ownerName,
          username,
          password,
          pkg.name,
          pkg.durationInDays,
          packageExpiresAt
        );
      } else {
        await sendClinicSubscriptionActivatedEmail(
          email,
          ownerName,
          pkg.name,
          pkg.price,
          pkg.durationInDays,
          packageExpiresAt,
          false
        );
      }
    } catch (_) { /* non-blocking */ }

    return res.status(201).json({
      message: "Registration completed successfully!",
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
    console.error("Register full error:", error);
    return res.status(400).json({
      message: error.message || "Failed to complete registration",
      detail: error.code === 'P2002' ? "A clinic or user with these details already exists." : undefined
    });
  }
};

// Step 3: Complete Registration (Select Plan)
export const completeRegistration = async (req: Request, res: Response) => {
  try {
    const { userId, packageId } = req.body;

    if (!userId || !packageId) {
      return res.status(400).json({ message: "UserId and PackageId are required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: { include: { landingPage: true } } }
    });

    if (!user || !user.clinicId) {
      return res.status(404).json({ message: "Draft user or clinic not found" });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!pkg) {
      return res.status(404).json({ message: "Package not found" });
    }

    const now = new Date();
    const packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
    const status = pkg.price === 0 ? "TRIAL" : "UPGRADED";

    await prisma.clinic.update({
      where: { id: user.clinicId },
      data: {
        packageId,
        packageStartsAt: now,
        packageExpiresAt,
        status: status as ClinicStatus,
        isTrialUsed: pkg.price === 0 ? true : (user.clinic?.isTrialUsed || false)
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 🔔 Notify super admin about new clinic
    try {
      await createSuperAdminNotification({
        type: "CLINIC_REGISTERED",
        title: "New Clinic Registered",
        message: `${user.clinic?.name ?? "A new clinic"} has registered with the "${pkg?.name ?? "Free Trial"}" plan (${status}).`,
        link: "/super-admin/tenants",
      });
    } catch (_) { /* non-blocking */ }

    return res.json({
      message: "Registration completed!",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        clinic: { ...user.clinic, status, packageId }
      },
    });
  } catch (error) {
    console.error("Complete registration error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};



// Register a new user and potential clinic tenant
export const register = async (req: Request, res: Response) => {
  try {
    const { email, username: userLevelUsername, password, fullName, role, clinicId, clinicInfo, packageId, dob, age, gender } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ message: "All basic fields (email, password, fullName, role) are required" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "A user with this email address already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let assignedClinicId = clinicId;

    // Handle new Clinic creation for ADMIN/DOCTOR (3-step flow)
    if ((role === Role.ADMIN || role === Role.DOCTOR) && clinicInfo) {
      const { name, address, gstNo } = clinicInfo;

      if (!name) {
        return res.status(400).json({ message: "Clinic name is required for registration" });
      }

      // Determine initial status
      let status = "IN_PROGRESS";
      let packageExpiresAt = null;

      if (packageId) {
        const pkg = await prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
        if (pkg) {
          const now = new Date();
          packageExpiresAt = new Date(now.getTime() + pkg.durationInDays * 24 * 60 * 60 * 1000);
          status = pkg.price === 0 ? "TRIAL" : "UPGRADED";
        }
      }

      const username = clinicInfo.username || userLevelUsername || `${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
      const newClinic = await prisma.clinic.create({
        data: {
          name,
          username,
          addressLine1: address,
          status: (status || "IN_PROGRESS") as ClinicStatus,
          packageId,
          packageStartsAt: packageId ? new Date() : null,
          packageExpiresAt,
        }
      });
      assignedClinicId = newClinic.id;
    } else if (role !== Role.SUPER_ADMIN) {
      // Joining existing clinic
      if (!clinicId) {
        return res.status(400).json({ message: "Clinic selection is required" });
      }
      const clinicExists = await prisma.clinic.findUnique({ where: { id: clinicId } });
      if (!clinicExists) {
        return res.status(404).json({ message: "The selected clinic does not exist" });
      }
    }

    // Create User
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        dob: dob ? new Date(dob) : null,
        age: age ? parseInt(age.toString()) : null,
        gender,
        role: role as Role,
        clinicId: role === Role.SUPER_ADMIN ? null : assignedClinicId,
      },
      include: {
        clinic: {
          include: { package: true, landingPage: true }
        },
      },
    });

    // Generate Token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, clinicId: newUser.clinicId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Send congratulations email if admin is registering a new clinic with a package
    if (newUser.role === "ADMIN" && newUser.clinic && newUser.clinic.package) {
      try {
        const clinicUsername = newUser.clinic.username || userLevelUsername || newUser.username || "";
        await sendAdminCongratulationsEmail(
          email,
          fullName,
          clinicUsername,
          password,
          newUser.clinic.package
        );
      } catch (_) { /* non-blocking */ }
    }

    return res.status(201).json({
      message: "Registration successful!",
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        clinic: newUser.clinic,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Internal server error during registration" });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body; // identifier can be email, phone, or username

    if (!identifier || !password) {
      return res.status(400).json({ message: "Identifier and password are required" });
    }

    const cleanIdentifier = identifier.trim();
    const normalizedIdentifier = cleanIdentifier.toLowerCase();

    // Find user by email, phone, or username case-insensitively for email/username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedIdentifier, mode: "insensitive" } },
          { phone: cleanIdentifier },
          { username: { equals: normalizedIdentifier, mode: "insensitive" } }
        ]
      },
      include: { clinic: { include: { landingPage: true } } },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Validate password
    console.log(`Login attempt for: ${identifier}`);
    console.log(`Password provided: ${password}`);
    console.log(`Hash in DB: ${user.passwordHash}`);
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    console.log(`Is valid: ${isPasswordValid}`);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password credentials" });
    }

    let permissions: any = null;
    if ((user.role as any) === "STAFF") {
      const staff = await prisma.staff.findFirst({
        where: { email: user.email, clinicId: user.clinicId || undefined }
      });
      if (staff?.role) {
        const clinicRole = await prisma.clinicRole.findFirst({
          where: { name: staff.role, clinicId: user.clinicId || undefined }
        });
        if (clinicRole) {
          permissions = clinicRole.permissions;
        }
      }
    }

    // Resolve doctorId / patientId for role-scoped filtering
    let doctorId: string | null = null;
    let patientId: string | null = null;
    if (user.role === "DOCTOR" && user.clinicId) {
      const doc = await prisma.doctor.findFirst({
        where: { email: user.email, clinicId: user.clinicId },
        select: { id: true }
      });
      doctorId = doc?.id ?? null;
    }
    if (user.role === "PATIENT" && user.clinicId) {
      const pat = await prisma.patient.findFirst({
        where: { email: user.email, clinicId: user.clinicId },
        select: { id: true }
      });
      patientId = pat?.id ?? null;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, doctorId, patientId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        clinicId: user.clinicId,
        clinic: user.clinic,
        permissions,
        doctorId,
        patientId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error during login" });
  }
};

// Get current user profile
export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { clinic: { include: { landingPage: true } } },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let details: any = null;
    if (user.role === "PATIENT") {
      details = await prisma.patient.findFirst({
        where: { email: user.email, clinicId: user.clinicId || undefined },
      });
    } else if (user.role === "DOCTOR") {
      details = await prisma.doctor.findFirst({
        where: { email: user.email, clinicId: user.clinicId || undefined },
      });
    }

    let permissions: any = null;
    if ((user.role as any) === "STAFF") {
      const staff = await prisma.staff.findFirst({
        where: { email: user.email, clinicId: user.clinicId || undefined }
      });
      if (staff?.role) {
        const clinicRole = await prisma.clinicRole.findFirst({
          where: { name: staff.role, clinicId: user.clinicId || undefined }
        });
        if (clinicRole) {
          permissions = clinicRole.permissions;
        }
      }
    }

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clinic: user.clinic,
      permissions,
      details
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ message: "Internal server error retrieving profile" });
  }
};

// --- In-Memory OTP Store for MVP ---
const otpStore = new Map<string, { otp: string; expires: number }>();

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Email or Phone is required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(user.id, { otp, expires });

    // Send via email if available
    if (user.email) {
      const msg = `<h3>Password Reset Requested</h3>
      <p>Your OTP is: <b>${otp}</b></p>
      <p>This OTP will expire in 10 minutes. Do not share it with anyone.</p>`;
      await sendEmail(user.email, "Docyori - Password Reset OTP", msg);
    }

    // In a real app we would integrate SMS API for phone here

    return res.json({ message: "OTP sent to your registered email/phone" });
  } catch (error) {
    console.error("Request reset error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({ message: "Identifier, OTP, and new password are required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phone: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const record = otpStore.get(user.id);
    if (!record) {
      return res.status(400).json({ message: "OTP not requested or expired." });
    }

    if (Date.now() > record.expires) {
      otpStore.delete(user.id);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    if (record.otp !== otp && otp !== "123456") { // Backup universal OTP for testing/MVP
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Success! Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword }
    });

    otpStore.delete(user.id);
    return res.json({ message: "Password updated successfully! You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "New password is required" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: hashedPassword }
    });

    return res.json({ message: "Password updated successfully" });
  } catch (err: any) {
    console.error("Change password error:", err);
    return res.status(500).json({ message: "Failed to update password" });
  }
};

export const updateOnboardingStep = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user || !req.user.clinicId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { onboardingStep } = req.body;
    if (typeof onboardingStep !== "number") {
      return res.status(400).json({ message: "onboardingStep must be a number" });
    }

    const updatedClinic = await prisma.clinic.update({
      where: { id: req.user.clinicId },
      data: { onboardingStep }
    });

    return res.json({
      message: "Onboarding step updated successfully",
      onboardingStep: updatedClinic.onboardingStep
    });
  } catch (err: any) {
    console.error("Update onboarding step error:", err);
    return res.status(500).json({ message: err.message || "Failed to update onboarding step" });
  }
};

// POST /api/auth/send-otp
export const sendLoginOTP = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ message: "Please enter a valid 10-digit mobile number" });
    }

    // Check cascade lookup for user
    let user = await prisma.user.findFirst({
      where: { phone: { endsWith: cleanPhone } },
    });

    if (!user) {
      // 1. Search Staff
      const staff = await prisma.staff.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (staff && staff.email) {
        user = await prisma.user.findFirst({
          where: { email: { equals: staff.email.trim().toLowerCase(), mode: "insensitive" } }
        });
      }
    }

    if (!user) {
      // 2. Search Doctor
      const doctor = await prisma.doctor.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (doctor && doctor.email) {
        user = await prisma.user.findFirst({
          where: { email: { equals: doctor.email.trim().toLowerCase(), mode: "insensitive" } }
        });
      }
    }

    if (!user) {
      // 3. Search Patient
      const patient = await prisma.patient.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (patient && patient.email) {
        user = await prisma.user.findFirst({
          where: { email: { equals: patient.email.trim().toLowerCase(), mode: "insensitive" } }
        });
      }
    }

    if (!user) {
      // 4. Search Clinic (Admin/Owner)
      const clinic = await prisma.clinic.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (clinic && clinic.ownerEmail) {
        user = await prisma.user.findFirst({
          where: { email: { equals: clinic.ownerEmail.trim().toLowerCase(), mode: "insensitive" } }
        });
      }
    }

    if (!user) {
      return res.status(404).json({ message: "Mobile number not registered. Please register first." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    otpStore.set(user.id, { otp, expires });

    // Send real OTP via TrueBulkSMS API
    const smsUsername = process.env.SMS_USERNAME || "SoftFYR";
    const smsPassword = process.env.SMS_PASSWORD || "971236";
    const smsSender = process.env.SMS_SENDER || "SSWAIT";
    const smsPEID = process.env.SMS_PEID || "1701167637074678841";
    const smsTemplateId = process.env.SMS_TEMPLATE_ID || "1707168794065317157";

    const message = `${otp} is your One Time Passcode for registration. ${smsSender}`;
    const smsUrl = `http://truebulksms.biz/api.php?username=${smsUsername}&password=${smsPassword}&sender=${smsSender}&sendto=91${cleanPhone}&message=${encodeURIComponent(message)}&PEID=${smsPEID}&templateid=${smsTemplateId}`;

    console.log(`Sending OTP to 91${cleanPhone}. URL: ${smsUrl}`);

    // Call the external SMS gateway API
    try {
      const smsRes = await fetch(smsUrl);
      const textResponse = await smsRes.text();
      console.log(`SMS Gateway Response for 91${cleanPhone}: ${textResponse}`);
    } catch (smsErr) {
      console.error("Failed to send OTP SMS:", smsErr);
      return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }

    return res.json({ message: "OTP sent successfully to your mobile number." });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/auth/verify-otp-login
export const verifyOTPLogin = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ message: "Mobile number and OTP are required" });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    // Check cascade lookup for user
    let user = await prisma.user.findFirst({
      where: { phone: { endsWith: cleanPhone } },
      include: { clinic: { include: { landingPage: true } } },
    });

    if (!user) {
      // 1. Search Staff
      const staff = await prisma.staff.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (staff && staff.email) {
        user = await prisma.user.findFirst({
          where: { email: { equals: staff.email.trim().toLowerCase(), mode: "insensitive" } },
          include: { clinic: { include: { landingPage: true } } },
        });
      }
    }

    if (!user) {
      // 2. Search Doctor
      const doctor = await prisma.doctor.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (doctor && doctor.email) {
        user = await prisma.user.findFirst({
          where: { email: { equals: doctor.email.trim().toLowerCase(), mode: "insensitive" } },
          include: { clinic: { include: { landingPage: true } } },
        });
      }
    }

    if (!user) {
      // 3. Search Patient
      const patient = await prisma.patient.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (patient && patient.email) {
        user = await prisma.user.findFirst({
          where: { email: { equals: patient.email.trim().toLowerCase(), mode: "insensitive" } },
          include: { clinic: { include: { landingPage: true } } },
        });
      }
    }

    if (!user) {
      // 4. Search Clinic (Admin/Owner)
      const clinic = await prisma.clinic.findFirst({
        where: { phone: { endsWith: cleanPhone } }
      });
      if (clinic && clinic.ownerEmail) {
        user = await prisma.user.findFirst({
          where: { email: { equals: clinic.ownerEmail.trim().toLowerCase(), mode: "insensitive" } },
          include: { clinic: { include: { landingPage: true } } },
        });
      }
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const record = otpStore.get(user.id);
    if (!record) {
      return res.status(400).json({ message: "OTP not requested or expired." });
    }

    if (Date.now() > record.expires) {
      otpStore.delete(user.id);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    if (record.otp !== otp && otp !== "123456") { // Universal testing OTP
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // OTP Verified! Get staff permissions if applicable
    let permissions: any = null;
    if ((user.role as any) === "STAFF") {
      const staff = await prisma.staff.findFirst({
        where: { email: user.email, clinicId: user.clinicId || undefined }
      });
      if (staff?.role) {
        const clinicRole = await prisma.clinicRole.findFirst({
          where: { name: staff.role, clinicId: user.clinicId || undefined }
        });
        if (clinicRole) {
          permissions = clinicRole.permissions;
        }
      }
    }

    // Resolve doctorId / patientId for role-scoped filtering
    let doctorId: string | null = null;
    let patientId: string | null = null;
    if (user.role === "DOCTOR" && user.clinicId) {
      const doc = await prisma.doctor.findFirst({
        where: { email: user.email, clinicId: user.clinicId },
        select: { id: true }
      });
      doctorId = doc?.id ?? null;
    }
    if (user.role === "PATIENT" && user.clinicId) {
      const pat = await prisma.patient.findFirst({
        where: { email: user.email, clinicId: user.clinicId },
        select: { id: true }
      });
      patientId = pat?.id ?? null;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId, doctorId, patientId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Delete verified OTP
    otpStore.delete(user.id);

    return res.json({
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        clinicId: user.clinicId,
        clinic: user.clinic,
        permissions,
        doctorId,
        patientId,
      },
    });
  } catch (error) {
    console.error("Verify OTP login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


