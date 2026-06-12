import { Response } from "express";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import prisma from "../../lib/prisma";
import { encrypt, decrypt } from "../../utils/encryption";

interface RazorpayCredential {
    id: string;
    label: string;
    keyId: string;
    keySecret: string;
    isActive: boolean;
}

// Helper to get all Razorpay credentials from system settings
const getCredentialsList = async (): Promise<RazorpayCredential[]> => {
    const setting = await prisma.systemSetting.findUnique({
        where: { key: "RAZORPAY_CONFIG" },
    });
    if (!setting) return [];
    try {
        const parsed = JSON.parse(setting.value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

// Helper to save Razorpay credentials to system settings
const saveCredentialsList = async (list: RazorpayCredential[]) => {
    return prisma.systemSetting.upsert({
        where: { key: "RAZORPAY_CONFIG" },
        update: { value: JSON.stringify(list) },
        create: { key: "RAZORPAY_CONFIG", value: JSON.stringify(list) },
    });
};

// GET /api/superadmin/razorpay-config
export const getRazorpayConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const list = await getCredentialsList();
        // Mask the keySecret
        const maskedList = list.map(c => ({
            ...c,
            keySecret: "********",
        }));

        res.json(maskedList);
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to fetch Razorpay config" });
    }
};

// POST /api/superadmin/razorpay-config
export const upsertRazorpayConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { id, label, keyId, keySecret } = req.body;

        if (!label || !keyId || !keySecret) {
            return res.status(400).json({ message: "Label, Key ID, and Key Secret are required" });
        }

        const list = await getCredentialsList();
        let updatedList: RazorpayCredential[];

        if (id) {
            // Edit mode
            const existing = list.find(c => c.id === id);
            if (!existing) {
                return res.status(404).json({ message: "Credential not found" });
            }

            // If keySecret is masked, keep the old encrypted secret. Else, encrypt the new one.
            const encryptedSecret = keySecret === "********" ? existing.keySecret : encrypt(keySecret);

            updatedList = list.map(c => c.id === id ? {
                ...c,
                label,
                keyId,
                keySecret: encryptedSecret,
            } : c);
        } else {
            // Add mode
            // If it's the first configuration, make it active
            const isActive = list.length === 0;
            const newCred: RazorpayCredential = {
                id: Date.now().toString(),
                label,
                keyId,
                keySecret: encrypt(keySecret),
                isActive,
            };
            updatedList = [...list, newCred];
        }

        await saveCredentialsList(updatedList);

        // Mask the secret for response
        const responseList = updatedList.map(c => ({
            ...c,
            keySecret: "********",
        }));

        res.json({ message: id ? "Razorpay credential updated successfully" : "Razorpay credential added successfully", config: responseList });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to save Razorpay config" });
    }
};

// DELETE /api/superadmin/razorpay-config/:id
export const deleteRazorpayConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { id } = req.params;
        const list = await getCredentialsList();
        const existing = list.find(c => c.id === id);

        if (!existing) {
            return res.status(404).json({ message: "Credential not found" });
        }

        let updatedList = list.filter(c => c.id !== id);

        // If we deleted the active one and list isn't empty, activate another one
        if (existing.isActive && updatedList.length > 0) {
            updatedList[0].isActive = true;
        }

        await saveCredentialsList(updatedList);

        const responseList = updatedList.map(c => ({
            ...c,
            keySecret: "********",
        }));

        res.json({ message: "Razorpay credential deleted successfully", config: responseList });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to delete Razorpay config" });
    }
};

// PUT /api/superadmin/razorpay-config/:id/activate
export const activateRazorpayConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (req.user?.role !== "SUPER_ADMIN") {
            return res.status(403).json({ message: "Forbidden" });
        }

        const { id } = req.params;
        const list = await getCredentialsList();
        const existing = list.find(c => c.id === id);

        if (!existing) {
            return res.status(404).json({ message: "Credential not found" });
        }

        const updatedList = list.map(c => ({
            ...c,
            isActive: c.id === id,
        }));

        await saveCredentialsList(updatedList);

        const responseList = updatedList.map(c => ({
            ...c,
            keySecret: "********",
        }));

        res.json({ message: "Razorpay credential activated successfully", config: responseList });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to activate Razorpay config" });
    }
};
