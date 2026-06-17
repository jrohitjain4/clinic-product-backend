import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';


const getTransporter = async () => {
    // Try to get SMTP config from database
    const setting = await prisma.systemSetting.findUnique({
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
                dbConfig = parsed.find((c: any) => c.isActive) || parsed[0];
            } else {
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
        } catch (e) {
            console.error('Failed to parse SMTP config from DB', e);
        }
    }

    return nodemailer.createTransport(config);
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const transporter = await getTransporter();

        // Get from address info
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'SMTP_CONFIG' },
        });

        let fromEmail = process.env.SMTP_USER || 'no-reply@docyori.com';
        let fromName = "Docyori";

        if (setting) {
            try {
                const parsed = JSON.parse(setting.value);
                let dbConfig;
                if (Array.isArray(parsed)) {
                    dbConfig = parsed.find((c: any) => c.isActive) || parsed[0];
                } else {
                    dbConfig = parsed;
                }

                if (dbConfig) {
                    if (dbConfig.user) fromEmail = dbConfig.user;
                    if (dbConfig.fromName) fromName = dbConfig.fromName;
                }
            } catch (e) { }
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
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

export const sendAdminCongratulationsEmail = async (
    to: string,
    ownerName: string,
    username: string,
    password: string,
    plan: {
        name: string;
        price: number;
        durationInDays: number;
        maxDoctors: number;
        maxPatients: number;
        maxAppointments: number;
    }
) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
        const loginUrl = `${frontendLink}/login`;
        const priceDisplay = plan.price === 0 ? "Free Trial" : `₹${plan.price.toLocaleString("en-IN")}`;
        
        const formatLimit = (limit: number) => {
            if (limit === -1 || limit === 9999 || limit >= 9999) return "Unlimited";
            return limit.toString();
        };

        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <h2 style="color: #2c3e50;">Congratulations, ${ownerName}! Your Account has been Created</h2>
            <p>We are excited to welcome you to Docyori! Your clinic administration account has been successfully created. Here are your account credentials and subscription plan details:</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d6efd;">
              <p style="margin-top: 0;"><strong>Your Login Credentials:</strong></p>
              <ul style="margin-bottom: 0;">
                <li>Username: <strong>${username}</strong></li>
                <li>Email: <strong>${to}</strong></li>
                <li>Password: <strong>${password}</strong></li>
              </ul>
            </div>

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #198754;">
              <p style="margin-top: 0;"><strong>Your Subscription Plan Details:</strong></p>
              <ul style="margin-bottom: 0;">
                <li>Plan Name: <strong>${plan.name}</strong></li>
                <li>Price: <strong>${priceDisplay}</strong></li>
                <li>Duration: <strong>${plan.durationInDays} Days</strong></li>
                <li>Max Doctors: <strong>${formatLimit(plan.maxDoctors)}</strong></li>
                <li>Max Patients: <strong>${formatLimit(plan.maxPatients)}</strong></li>
                <li>Max Appointments: <strong>${formatLimit(plan.maxAppointments)}</strong></li>
              </ul>
            </div>

            <p style="color: #dc3545; font-size: 14px; font-weight: bold;">
              ⚠️ Please change your password after logging in for the first time.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #0d6efd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Click here to Login</a>
            </div>
            <p style="font-size: 13px; color: #6c757d;">Regards,<br/><strong>The Docyori Team</strong></p>
          </div>`;

        return await sendEmail(to.toLowerCase(), "Welcome to Docyori! Account & Plan Details", emailBody);
    } catch (error) {
        console.error("Error sending admin congratulations email:", error);
        return false;
    }
};

