import { Request, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
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

// Register a new user and potential clinic tenant
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, role, clinicId } = req.body;

    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ message: "All basic fields (email, password, fullName, role) are required" });
    }

    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      return res.status(403).json({
        message: "Admin accounts are created by the system only. Please register as Doctor, Patient, or Porter.",
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "A user with this email address already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedClinicId = clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: "Clinic selection is required" });
    }

    const clinicExists = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinicExists) {
      return res.status(404).json({ message: "The selected clinic does not exist" });
    }

    // Create User
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        fullName,
        role: role as Role,
        clinicId: role === Role.SUPER_ADMIN ? null : assignedClinicId,
      },
      include: {
        clinic: true,
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
        clinic: user.clinic,
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

    return res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      clinic: user.clinic,
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ message: "Internal server error retrieving profile" });
  }
};
