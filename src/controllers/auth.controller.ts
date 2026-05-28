import { Request, Response } from "express";
import { PrismaClient, Role, ClinicStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "clinic_management_saas_jwt_secret_key_987654321!";

// Get all clinics (used during registration dropdown for doctors/patients/porters)
export const getClinics = async (req: Request, res: Response) => {
  try {
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
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

// Step 2: Register Draft (Personal + Business info)
export const registerDraft = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, role, clinicInfo, dob, age, gender } = req.body;

    if (!email || !password || !fullName || !role || !clinicInfo) {
      return res.status(400).json({ message: "Essential fields are missing" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { name, address, gstNo } = clinicInfo;
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

    const newClinic = await prisma.clinic.create({
      data: {
        name,
        subdomain,
        gstNo,
        address,
        status: "IN_PROGRESS",
      }
    });

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        dob: dob ? new Date(dob) : null,
        age: age ? parseInt(age.toString()) : null,
        gender,
        role: role as Role,
        clinicId: newClinic.id,
      }
    });

    return res.status(201).json({
      message: "Draft created",
      userId: newUser.id
    });
  } catch (error) {
    console.error("Draft registration error:", error);
    return res.status(500).json({ message: "Internal server error" });
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
        status: status as ClinicStatus
      }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

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
    const { email, password, fullName, role, clinicId, clinicInfo, packageId, dob, age, gender } = req.body;

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

      // Auto-generate subdomain from name
      const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 1000);

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

      const newClinic = await prisma.clinic.create({
        data: {
          name,
          subdomain,
          gstNo,
          address,
          status: status as any,
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { clinic: true },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email credentials" });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password credentials" });
    }

    let permissions: any = null;
    if ((user.role as any) === "STAFF") {
      const staff = await prisma.staff.findFirst({
        where: { email, clinicId: user.clinicId || undefined }
      });
      if (staff?.role) {
        const clinicRole = await (prisma as any).clinicRole.findFirst({
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
        const clinicRole = await (prisma as any).clinicRole.findFirst({
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
