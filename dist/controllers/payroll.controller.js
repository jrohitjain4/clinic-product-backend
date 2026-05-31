"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayroll = exports.updatePayroll = exports.createPayroll = exports.getPayrolls = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/payroll
const getPayrolls = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const payrolls = await prisma_1.default.payroll.findMany({
            where: { clinicId },
            include: { staff: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(payrolls);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getPayrolls = getPayrolls;
// POST /api/payroll
const createPayroll = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { staffId, netSalary, basicSalary, da, hra, conveyance, medicalAllowance, otherEarnings, tds, esi, pf, profTax, labourWelfare, otherDeductions, status } = req.body;
        if (!staffId || netSalary === undefined) {
            return res.status(400).json({ message: "Staff ID and Net Salary are required" });
        }
        const newPayroll = await prisma_1.default.payroll.create({
            data: {
                staffId,
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
                clinicId,
            },
            include: { staff: true }
        });
        res.status(201).json(newPayroll);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createPayroll = createPayroll;
// PUT /api/payroll/:id
const updatePayroll = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.payroll.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Payroll not found" });
        const { staffId, netSalary, basicSalary, da, hra, conveyance, medicalAllowance, otherEarnings, tds, esi, pf, profTax, labourWelfare, otherDeductions, status } = req.body;
        const updated = await prisma_1.default.payroll.update({
            where: { id },
            data: {
                staffId,
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
            },
            include: { staff: true }
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updatePayroll = updatePayroll;
// DELETE /api/payroll/:id
const deletePayroll = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.payroll.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Payroll not found" });
        await prisma_1.default.payroll.delete({ where: { id } });
        res.json({ message: "Payroll deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deletePayroll = deletePayroll;
