"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTicketStatus = exports.getTickets = exports.createTicket = void 0;
const client_1 = require("../../prisma/generated/client");
const prisma = new client_1.PrismaClient();
const createTicket = async (req, res) => {
    const { subject, description, priority } = req.body;
    const user = req.user;
    try {
        const ticket = await prisma.ticket.create({
            data: {
                subject,
                description,
                priority,
                clinicId: user.clinicId,
                userId: user.id,
                userName: user.fullName,
                userEmail: user.email,
                ticketCode: `TKT-${Math.floor(100000 + Math.random() * 900000)}`,
            },
        });
        res.status(201).json(ticket);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create ticket' });
    }
};
exports.createTicket = createTicket;
const getTickets = async (req, res) => {
    const user = req.user;
    try {
        let tickets;
        if (user.role === 'SUPER_ADMIN') {
            tickets = await prisma.ticket.findMany({
                include: { clinic: true },
                orderBy: { createdAt: 'desc' },
            });
        }
        else {
            tickets = await prisma.ticket.findMany({
                where: { clinicId: user.clinicId },
                orderBy: { createdAt: 'desc' },
            });
        }
        res.json(tickets);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch tickets' });
    }
};
exports.getTickets = getTickets;
const updateTicketStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;
    if (user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Only super admin can update ticket status' });
    }
    try {
        const ticket = await prisma.ticket.update({
            where: { id },
            data: { status },
        });
        res.json(ticket);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update ticket status' });
    }
};
exports.updateTicketStatus = updateTicketStatus;
