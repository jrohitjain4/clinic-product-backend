import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";


export const getPayrolls = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const payrolls = await prisma.payroll.findMany({
            where: { clinicId },
            include: {
                staff: true,
                doctor: true
            },
            orderBy: { salaryDate: "desc" },
        });

        const currentDate = new Date();
        const enriched = payrolls.map((p) => {
            let displayStatus = p.status;
            if (displayStatus !== "Salary_Paid" && displayStatus !== "Paid") {
                const sDate = new Date(p.salaryDate);
                // If current date is past the salary date, mark as Due
                if (currentDate.getTime() > sDate.getTime()) {
                    displayStatus = "Due";
                }
            }
            return { ...p, displayStatus };
        });

        res.json(enriched);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const createPayroll = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const {
            staffId, doctorId, netSalary, basicSalary, da, hra, conveyance, medicalAllowance, otherEarnings,
            tds, esi, pf, profTax, labourWelfare, otherDeductions, status, salaryDate
        } = req.body;

        if ((!staffId && !doctorId) || netSalary === undefined) {
            return res.status(400).json({ message: "Staff ID or Doctor ID and Net Salary are required" });
        }

        const sDate = salaryDate ? new Date(salaryDate) : new Date();
        sDate.setHours(0, 0, 0, 0); // Normalize to start of day

        const newPayroll = await prisma.payroll.create({
            data: {
                staffId: staffId || null,
                doctorId: doctorId || null,
                netSalary: Number(netSalary),
                basicSalary: basicSalary ? Number(basicSalary) : 0,
                da: da ? Number(da) : 0,
                hra: hra ? Number(hra) : 0,
                conveyance: conveyance ? Number(conveyance) : 0,
                medicalAllowance: medicalAllowance ? Number(medicalAllowance) : 0,
                otherEarnings: otherEarnings ? Number(otherEarnings) : 0,
                tds: tds ? Number(tds) : 0,
                esi: esi ? Number(esi) : 0,
                pf: pf ? Number(pf) : 0,
                profTax: profTax ? Number(profTax) : 0,
                labourWelfare: labourWelfare ? Number(labourWelfare) : 0,
                otherDeductions: otherDeductions ? Number(otherDeductions) : 0,
                status: status || "Paid",
                salaryDate: sDate,
                clinicId,
            },
            include: {
                staff: true,
                doctor: true
            }
        });

        // Automatically create payroll for the next month if it doesn't exist
        const nextMonthDate = new Date(sDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

        const nextDayStart = new Date(nextMonthDate);
        nextDayStart.setHours(0, 0, 0, 0);
        const nextDayEnd = new Date(nextMonthDate);
        nextDayEnd.setHours(23, 59, 59, 999);

        const existingNext = await prisma.payroll.findFirst({
            where: {
                clinicId,
                staffId: staffId || null,
                doctorId: doctorId || null,
                salaryDate: {
                    gte: nextDayStart,
                    lte: nextDayEnd,
                }
            }
        });

        if (!existingNext) {
            await prisma.payroll.create({
                data: {
                    staffId: staffId || null,
                    doctorId: doctorId || null,
                    netSalary: Number(netSalary),
                    basicSalary: basicSalary ? Number(basicSalary) : 0,
                    da: da ? Number(da) : 0,
                    hra: hra ? Number(hra) : 0,
                    conveyance: conveyance ? Number(conveyance) : 0,
                    medicalAllowance: medicalAllowance ? Number(medicalAllowance) : 0,
                    otherEarnings: otherEarnings ? Number(otherEarnings) : 0,
                    tds: tds ? Number(tds) : 0,
                    esi: esi ? Number(esi) : 0,
                    pf: pf ? Number(pf) : 0,
                    profTax: profTax ? Number(profTax) : 0,
                    labourWelfare: labourWelfare ? Number(labourWelfare) : 0,
                    otherDeductions: otherDeductions ? Number(otherDeductions) : 0,
                    status: "Unpaid",
                    salaryDate: nextMonthDate,
                    clinicId,
                }
            });
        }

        res.status(201).json(newPayroll);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/payroll/:id
export const updatePayroll = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.payroll.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Payroll not found" });

        const {
            staffId, doctorId, netSalary, basicSalary, da, hra, conveyance, medicalAllowance, otherEarnings,
            tds, esi, pf, profTax, labourWelfare, otherDeductions, status, salaryDate
        } = req.body;

        const updated = await prisma.payroll.update({
            where: { id },
            data: {
                staffId: staffId !== undefined ? (staffId || null) : undefined,
                doctorId: doctorId !== undefined ? (doctorId || null) : undefined,
                netSalary: netSalary !== undefined ? Number(netSalary) : undefined,
                basicSalary: basicSalary !== undefined ? Number(basicSalary) : undefined,
                da: da !== undefined ? Number(da) : undefined,
                hra: hra !== undefined ? Number(hra) : undefined,
                conveyance: conveyance !== undefined ? Number(conveyance) : undefined,
                medicalAllowance: medicalAllowance !== undefined ? Number(medicalAllowance) : undefined,
                otherEarnings: otherEarnings !== undefined ? Number(otherEarnings) : undefined,
                tds: tds !== undefined ? Number(tds) : undefined,
                esi: esi !== undefined ? Number(esi) : undefined,
                pf: pf !== undefined ? Number(pf) : undefined,
                profTax: profTax !== undefined ? Number(profTax) : undefined,
                labourWelfare: labourWelfare !== undefined ? Number(labourWelfare) : undefined,
                otherDeductions: otherDeductions !== undefined ? Number(otherDeductions) : undefined,
                status,
                salaryDate: salaryDate ? new Date(salaryDate) : undefined,
            },
            include: {
                staff: true,
                doctor: true
            }
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/payroll/:id
export const deletePayroll = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.payroll.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Payroll not found" });

        await prisma.payroll.delete({ where: { id } });
        res.json({ message: "Payroll deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
