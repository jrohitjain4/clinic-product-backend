import crypto from "crypto";

const ENCRYPTION_KEY = crypto.createHash("sha256").update(process.env.JWT_SECRET || "default-secret-key-fallback").digest(); // 32 bytes
const IV_LENGTH = 16; // For AES-256-CBC

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text: string): string {
    try {
        const textParts = text.split(":");
        if (textParts.length < 2) return text; // Fallback for unencrypted text if any
        const iv = Buffer.from(textParts.shift()!, "hex");
        const encryptedText = Buffer.from(textParts.join(":"), "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Decryption failed:", error);
        return text; // Fallback to original text on failure
    }
}
