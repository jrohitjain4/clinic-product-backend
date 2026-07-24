import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

const DEFAULT_CHARGE_TYPES = [
  {
    name: "Doctor Visit / Round Fee",
    description: "Daily physician rounds and specialist consultant charges",
    items: [
      { itemName: "General Physician Daily Round", standardFee: 500 },
      { itemName: "Specialist Consultant Visit", standardFee: 1000 },
      { itemName: "Emergency Doctor Round", standardFee: 1500 },
    ],
  },
  {
    name: "Nursing Care & Vitals",
    description: "Daily nursing care, monitoring, and vitals checks",
    items: [
      { itemName: "General Nursing Care (Daily)", standardFee: 300 },
      { itemName: "ICU / CCU Dedicated Nursing Care", standardFee: 800 },
      { itemName: "Dressing / Bandage Change", standardFee: 250 },
    ],
  },
  {
    name: "Oxygen & Medical Equipment",
    description: "Oxygen cylinders, ventilator, monitors, and equipment charges",
    items: [
      { itemName: "Oxygen Concentrator (Per Day)", standardFee: 600 },
      { itemName: "Oxygen Cylinder Flow (Per Hour)", standardFee: 150 },
      { itemName: "Multipara Patient Monitor (Per Day)", standardFee: 500 },
      { itemName: "Ventilator Support Charge (Per Day)", standardFee: 2500 },
    ],
  },
  {
    name: "Medicines & Consumables",
    description: "Prescribed inpatient medicines, IV fluids, syringes, and gloves",
    items: [
      { itemName: "IV Fluid Set & Cannula Charge", standardFee: 350 },
      { itemName: "Injection Administration Charge", standardFee: 100 },
      { itemName: "IPD Pharmacy Kit", standardFee: 1200 },
    ],
  },
  {
    name: "OT & Surgery Charges",
    description: "Operation theatre, anesthesia, and surgeon charges",
    items: [
      { itemName: "Minor OT Setup Charge", standardFee: 2000 },
      { itemName: "Major OT Suite Charge", standardFee: 5000 },
      { itemName: "Anesthesia Standby Charge", standardFee: 3000 },
    ],
  },
  {
    name: "Ward & Accommodation",
    description: "Extra bed, attendant charges, and room maintenance",
    items: [
      { itemName: "Attendant Extra Bed Charge", standardFee: 300 },
      { itemName: "VIP Room Extra Amenities Fee", standardFee: 800 },
    ],
  },
];

// GET /api/ipd/charge-types
export const getIPDChargeTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    let types = await prisma.iPDChargeType.findMany({
      where: { clinicId },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed default charge types if clinic has none yet
    if (types.length === 0) {
      for (const dt of DEFAULT_CHARGE_TYPES) {
        await prisma.iPDChargeType.create({
          data: {
            name: dt.name,
            description: dt.description,
            clinicId,
            items: {
              create: dt.items.map((it) => ({
                itemName: it.itemName,
                standardFee: it.standardFee,
                clinicId,
              })),
            },
          },
        });
      }

      types = await prisma.iPDChargeType.findMany({
        where: { clinicId },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      });
    }

    res.json(types);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/charge-types (Add New Charge Type Category)
export const createIPDChargeType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Charge type name is required" });
    }

    const created = await prisma.iPDChargeType.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        clinicId,
      },
      include: { items: true },
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/charge-types/:id
export const updateIPDChargeType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;
    const { name, description, status } = req.body;

    const existing = await prisma.iPDChargeType.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Charge type not found" });

    const updated = await prisma.iPDChargeType.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description : existing.description,
        status: status || existing.status,
      },
      include: { items: true },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/charge-types/:id
export const deleteIPDChargeType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDChargeType.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Charge type not found" });

    await prisma.iPDChargeType.delete({ where: { id } });
    res.json({ message: "Charge type deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/charge-types/:id/items (Add Charge Item Master)
export const createIPDChargeItemMaster = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id: chargeTypeId } = req.params;
    const { itemName, standardFee, description } = req.body;

    if (!itemName || !itemName.trim()) {
      return res.status(400).json({ message: "Item name is required" });
    }

    const item = await prisma.iPDChargeItemMaster.create({
      data: {
        chargeTypeId,
        itemName: itemName.trim(),
        standardFee: parseFloat(standardFee) || 0,
        description: description ? description.trim() : null,
        clinicId: clinicId!,
      },
    });

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/charge-items/:itemId
export const deleteIPDChargeItemMaster = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { itemId } = req.params;

    await prisma.iPDChargeItemMaster.deleteMany({
      where: { id: itemId, clinicId: clinicId! },
    });

    res.json({ message: "Item deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
