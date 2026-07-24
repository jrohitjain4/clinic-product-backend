import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/ipd/nurses
export const getIPDNurses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const nurses = await prisma.iPDNurse.findMany({
      where: { clinicId },
      include: {
        assignedWard: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(nurses);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/nurses
export const createIPDNurse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const {
      fullName,
      phone,
      email,
      qualification,
      role, // Nurse, Head Nurse, Senior Nurse
      assignedWardId,
      shiftTiming, // Morning Shift (8 AM - 4 PM), Evening Shift (4 PM - 12 AM), Night Shift (12 AM - 8 AM), General Shift
      status, // Active, On Duty, On Leave
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ message: "Nurse full name is required." });
    }

    const count = await prisma.iPDNurse.count({ where: { clinicId } });
    const nurseCode = `NRS-${String(count + 1).padStart(3, "0")}`;

    const nurse = await prisma.iPDNurse.create({
      data: {
        nurseCode,
        fullName: fullName.trim(),
        phone: phone ? phone.trim() : null,
        email: email ? email.trim() : null,
        qualification: qualification ? qualification.trim() : "GNM / B.Sc Nursing",
        role: role || "Nurse",
        department: "IPD",
        assignedWardId: assignedWardId || null,
        shiftTiming: shiftTiming || "Morning Shift (8 AM - 4 PM)",
        status: status || "Active",
        clinicId,
      },
      include: {
        assignedWard: true,
      },
    });

    res.status(201).json(nurse);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/nurses/:id
export const updateIPDNurse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDNurse.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Nurse record not found" });

    const {
      fullName,
      phone,
      email,
      qualification,
      role,
      assignedWardId,
      shiftTiming,
      status,
    } = req.body;

    const updated = await prisma.iPDNurse.update({
      where: { id },
      data: {
        fullName: fullName !== undefined ? fullName.trim() : existing.fullName,
        phone: phone !== undefined ? phone.trim() : existing.phone,
        email: email !== undefined ? email.trim() : existing.email,
        qualification: qualification !== undefined ? qualification.trim() : existing.qualification,
        role: role !== undefined ? role : existing.role,
        assignedWardId: assignedWardId !== undefined ? assignedWardId : existing.assignedWardId,
        shiftTiming: shiftTiming !== undefined ? shiftTiming : existing.shiftTiming,
        status: status !== undefined ? status : existing.status,
      },
      include: {
        assignedWard: true,
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/nurses/:id
export const deleteIPDNurse = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDNurse.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Nurse record not found" });

    await prisma.iPDNurse.delete({ where: { id } });
    res.json({ message: "Nurse record deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
