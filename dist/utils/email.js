"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || 'test@example.com',
        pass: process.env.SMTP_PASS || 'password',
    },
});
const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: `"Docyori" <${process.env.SMTP_USER || 'no-reply@docyori.com'}>`,
            to,
            subject,
            html,
        };
        // In dev environment without credentials just log it
        if (process.env.NODE_ENV !== 'production' && (!process.env.SMTP_USER || process.env.SMTP_USER === 'test@example.com')) {
            console.log('--- MOCK EMAIL ---');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Body: ${html}`);
            console.log('------------------');
            return true;
        }
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return true;
    }
    catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};
exports.sendEmail = sendEmail;
