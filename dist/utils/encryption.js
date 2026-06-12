"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY = crypto_1.default.createHash("sha256").update(process.env.JWT_SECRET || "default-secret-key-fallback").digest(); // 32 bytes
const IV_LENGTH = 16; // For AES-256-CBC
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}
exports.encrypt = encrypt;
function decrypt(text) {
    try {
        const textParts = text.split(":");
        if (textParts.length < 2)
            return text; // Fallback for unencrypted text if any
        const iv = Buffer.from(textParts.shift(), "hex");
        const encryptedText = Buffer.from(textParts.join(":"), "hex");
        const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
    catch (error) {
        console.error("Decryption failed:", error);
        return text; // Fallback to original text on failure
    }
}
exports.decrypt = decrypt;
