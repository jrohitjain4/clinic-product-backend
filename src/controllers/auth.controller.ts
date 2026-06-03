import { Request, Response } from "express";
import { Role, ClinicStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";
import { createSuperAdminNotification } from "./notification.controller";

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
      include: { clinic: true },
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

    return res.json({
      message: "Plan activated successfully!",
      clinic: updatedClinic,
    });
  } catch (error) {
    console.error("Upgrade plan error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Step 2: Register Draft (Personal + Business info)
export const registerDraft = async (req: Request, res: Response) => {
  console.log("REGISTER DRAFT BODY:", req.body);
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
      username // Clinic username
    } = req.body;

    const doctorCount = doctorCountRaw ? parseInt(doctorCountRaw.toString(), 10) : undefined;

    if (!email || !password || !ownerName || !phone || !clinicName || !username) {
      return res.status(400).json({ message: "Essential fields (Email, Password, Name, Phone, Clinic Name, Username) are missing" });
    }

    // Check if user or clinic with this info already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: "A user with this Email, Phone, or Username already exists" });
    }

    const existingClinic = await prisma.clinic.findUnique({
      where: { username }
    });

    if (existingClinic) {
      return res.status(400).json({ message: "This Clinic Username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
          status: "IN_PROGRESS",
        }
      });

      const user = await tx.user.create({
        data: {
          email,
          phone,
          username, // Matching clinic username for administrative login
          passwordHash: hashedPassword,
          fullName: ownerName,
          role: "ADMIN",
          clinicId: clinic.id,
        }
      });

      return { user, clinic };
    });

    return res.status(201).json({
      message: "Draft created successfully",
      userId: result.user.id
    });
  } catch (error: any) {
    console.error("Register draft error detail:", error);
    return res.status(400).json({
      message: error.message || "Failed to create registration draft",
      error: error.message,
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
      include: { clinic: true }
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
          include: { package: true }
        },
      },
    });

    // Generate Token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, clinicId: newUser.clinicId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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

    // Find user by email, phone, or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
          { username: identifier }
        ]
      },
      include: { clinic: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
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

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId },
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
        permissions
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
      include: { clinic: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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
      permissions
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ message: "Internal server error retrieving profile" });
  }
};
