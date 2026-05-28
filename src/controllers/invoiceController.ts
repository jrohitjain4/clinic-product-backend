import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const createInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: 'Unauthorized: No clinic ID found' });
            return;
        }

        const {
            patientId,
            invoiceDate,
            dueDate,
            tax,
            discount,
            subTotal,
            totalAmount,
            paymentMethod,
            paymentStatus,
            otherInfo,
            items
        } = req.body;

        const invoice = await prisma.invoice.create({
            data: {
                clinicId,
                patientId,
                invoiceDate: new Date(invoiceDate),
                dueDate: new Date(dueDate),
                tax: Number(tax) || 0,
                discount: Number(discount) || 0,
                subTotal: Number(subTotal) || 0,
                totalAmount: Number(totalAmount) || 0,
                paymentMethod,
                paymentStatus: paymentStatus || 'Pending',
                otherInfo,
                invoiceCode: `INV-${Date.now()}`,
                items: {
                    create: (items || []).map((item: any) => ({
                        clinicId,
                        serviceId: item.serviceId || null,
                        description: item.description || '',
                        quantity: Number(item.quantity) || 1,
                        unitCost: Number(item.price) || 0,
                        amount: Number(item.amount) || 0
                    }))
                }
            },
            include: {
                items: true,
                patient: true
            }
        });

        res.status(201).json(invoice);
    } catch (error: any) {
        console.error('Create Invoice Error:', error);
        res.status(500).json({ message: 'Failed to create invoice', detail: error?.message });
    }
};

export const getInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const invoices = await prisma.invoice.findMany({
            where: { clinicId },
            include: {
                patient: true,
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(invoices);
    } catch (error) {
        console.error('Get Invoices Error:', error);
        res.status(500).json({ message: 'Failed to retrieve invoices' });
    }
};

export const getInvoiceById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;

        const invoice = await prisma.invoice.findFirst({
            where: { id, clinicId: clinicId ?? undefined },
            include: {
                patient: true,
                items: {
                    include: { service: true }
                }
            }
        });

        if (!invoice) {
            res.status(404).json({ message: 'Invoice not found' });
            return;
        }

        res.json(invoice);
    } catch (error) {
        console.error('Get Invoice By ID Error:', error);
        res.status(500).json({ message: 'Failed to retrieve invoice' });
    }
};

export const deleteInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;

        await prisma.invoice.delete({
            where: { id, clinicId: clinicId ?? undefined }
        });

        res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete invoice' });
    }
}
