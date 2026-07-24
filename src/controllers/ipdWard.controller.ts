import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/ipd/wards
export const getIPDWards = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const wards = await prisma.iPDWard.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
    });

    res.json(wards);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/ipd/wards/:id
export const getIPDWardById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const ward = await prisma.iPDWard.findFirst({
      where: { id, clinicId: clinicId! },
    });

    if (!ward) return res.status(404).json({ message: "Ward / Room not found" });
    res.json(ward);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/wards
export const createIPDWard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      wardName,
      wardCode,
      wardType,
      totalBeds,
      occupiedBeds,
      chargePerNight,
      nursingChargePerNight,
      amenities,
      floorNumber,
      description,
    } = req.body;

    if (!wardName || !wardName.trim()) {
      return res.status(400).json({ message: "Ward / Room name is required" });
    }

    const tBeds = totalBeds ? parseInt(totalBeds, 10) : 1;
    const oBeds = occupiedBeds ? parseInt(occupiedBeds, 10) : 0;
    const nightCharge = chargePerNight !== undefined && chargePerNight !== "" ? parseFloat(chargePerNight) : 0;
    const nursingCharge = nursingChargePerNight !== undefined && nursingChargePerNight !== "" ? parseFloat(nursingChargePerNight) : 0;

    // Auto-generate wardCode if omitted: e.g. WRD-001
    let finalCode = wardCode;
    if (!finalCode) {
      const count = await prisma.iPDWard.count({ where: { clinicId } });
      finalCode = `WRD-${String(count + 1).padStart(3, "0")}`;
    }

    const ward = await prisma.iPDWard.create({
      data: {
        wardName: wardName.trim(),
        wardCode: finalCode,
        wardType: wardType || "General Ward",
        totalBeds: tBeds < 1 ? 1 : tBeds,
        occupiedBeds: oBeds,
        chargePerNight: nightCharge,
        nursingChargePerNight: nursingCharge,
        amenities: Array.isArray(amenities) ? amenities : [],
        floorNumber: floorNumber || null,
        description: description || null,
        clinicId,
      },
    });

    res.status(201).json(ward);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/wards/:id
export const updateIPDWard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDWard.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Ward / Room not found" });

    const {
      wardName,
      wardCode,
      wardType,
      totalBeds,
      occupiedBeds,
      chargePerNight,
      nursingChargePerNight,
      amenities,
      floorNumber,
      description,
      status,
    } = req.body;

    const tBeds = totalBeds !== undefined && totalBeds !== "" ? parseInt(totalBeds, 10) : existing.totalBeds;
    const oBeds = occupiedBeds !== undefined && occupiedBeds !== "" ? parseInt(occupiedBeds, 10) : existing.occupiedBeds;
    const nightCharge = chargePerNight !== undefined && chargePerNight !== "" ? parseFloat(chargePerNight) : existing.chargePerNight;
    const nursingCharge = nursingChargePerNight !== undefined && nursingChargePerNight !== "" ? parseFloat(nursingChargePerNight) : existing.nursingChargePerNight;

    const updated = await prisma.iPDWard.update({
      where: { id },
      data: {
        wardName: wardName !== undefined ? wardName.trim() : existing.wardName,
        wardCode: wardCode !== undefined ? wardCode : existing.wardCode,
        wardType: wardType || existing.wardType,
        totalBeds: tBeds < 1 ? 1 : tBeds,
        occupiedBeds: oBeds,
        chargePerNight: nightCharge,
        nursingChargePerNight: nursingCharge,
        amenities: Array.isArray(amenities) ? amenities : (existing.amenities ?? []),
        floorNumber: floorNumber !== undefined ? floorNumber : existing.floorNumber,
        description: description !== undefined ? description : existing.description,
        status: status || existing.status,
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/wards/:id
export const deleteIPDWard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDWard.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Ward / Room not found" });

    await prisma.iPDWard.delete({ where: { id } });
    res.json({ message: "Ward / Room deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
