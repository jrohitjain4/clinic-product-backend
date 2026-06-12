"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const getTransporter = async () => {
    // Try to get SMTP config from database
    const setting = await prisma_1.default.systemSetting.findUnique({
        where: { key: 'SMTP_CONFIG' },
    });
    let config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER || 'test@example.com',
            pass: process.env.SMTP_PASS || 'password',
        },
    };
    if (setting) {
        try {
            const parsed = JSON.parse(setting.value);
            let dbConfig;
            if (Array.isArray(parsed)) {
                // Find active config or use first one
                dbConfig = parsed.find((c) => c.isActive) || parsed[0];
            }
            else {
                dbConfig = parsed;
            }
            if (dbConfig) {
                config = {
                    host: dbConfig.host || config.host,
                    port: parseInt(dbConfig.port || config.port.toString()),
                    secure: dbConfig.encryption === 'ssl' || dbConfig.port === '465',
                    auth: {
                        user: dbConfig.user || config.auth.user,
                        pass: dbConfig.pass || config.auth.pass,
                    },
                };
            }
        }
        catch (e) {
            console.error('Failed to parse SMTP config from DB', e);
        }
    }
    return nodemailer_1.default.createTransport(config);
};
const sendEmail = async (to, subject, html) => {
    try {
        const transporter = await getTransporter();
        // Get from address info
        const setting = await prisma_1.default.systemSetting.findUnique({
            where: { key: 'SMTP_CONFIG' },
        });
        let fromEmail = process.env.SMTP_USER || 'no-reply@docyori.com';
        let fromName = "Docyori";
        if (setting) {
            try {
                const parsed = JSON.parse(setting.value);
                let dbConfig;
                if (Array.isArray(parsed)) {
                    dbConfig = parsed.find((c) => c.isActive) || parsed[0];
                }
                else {
                    dbConfig = parsed;
                }
                if (dbConfig) {
                    if (dbConfig.user)
                        fromEmail = dbConfig.user;
                    if (dbConfig.fromName)
                        fromName = dbConfig.fromName;
                }
            }
            catch (e) { }
        }
        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            html,
        };
        // In dev environment without credentials just log it
        if (process.env.NODE_ENV !== 'production' && (!fromEmail || fromEmail === 'test@example.com')) {
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
