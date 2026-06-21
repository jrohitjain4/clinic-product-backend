"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendClinicAppointmentNotificationEmail = exports.sendClinicSubscriptionExpiringSoonEmail = exports.sendClinicSubscriptionExpiredEmail = exports.sendClinicSubscriptionActivatedEmail = exports.sendClinicWelcomeTrialEmail = exports.sendDoctorAppointmentEmail = exports.sendDoctorRegistrationEmail = exports.sendPatientAppointmentEmail = exports.sendPatientRegistrationEmail = exports.sendAdminCongratulationsEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let cachedTransporter = null;
let cachedConfigKey = '';
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
        tls: {
            rejectUnauthorized: false
        }
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
                    secure: dbConfig.encryption === 'ssl' || dbConfig.port === '465' || dbConfig.port === 465,
                    auth: {
                        user: dbConfig.user || config.auth.user,
                        pass: dbConfig.pass || config.auth.pass,
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                };
            }
        }
        catch (e) {
            console.error('Failed to parse SMTP config from DB', e);
        }
    }
    const configKey = JSON.stringify(config);
    if (cachedTransporter && cachedConfigKey === configKey) {
        return cachedTransporter;
    }
    console.log('Creating new mail transporter with config:', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.auth.user,
        pass: config.auth.pass ? '***' : 'none'
    });
    const transporter = nodemailer_1.default.createTransport(config);
    cachedTransporter = transporter;
    cachedConfigKey = configKey;
    // Verify SMTP transporter in background
    transporter.verify().then(() => {
        console.log('SMTP transporter connection verified successfully.');
    }).catch((err) => {
        console.error('SMTP transporter verification failed:', err);
    });
    return transporter;
};
const sendEmail = async (to, subject, html) => {
    // Run the actual email sending logic in the background so it is completely non-blocking
    (async () => {
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
            const logoPngPath = path_1.default.join(process.cwd(), 'logo.png');
            const logoSvgPath = path_1.default.join(process.cwd(), 'logo.svg');
            if (fs_1.default.existsSync(logoPngPath)) {
                mailOptions.attachments = [
                    {
                        filename: 'logo.png',
                        path: logoPngPath,
                        cid: 'logo'
                    }
                ];
            }
            else if (fs_1.default.existsSync(logoSvgPath)) {
                mailOptions.attachments = [
                    {
                        filename: 'logo.svg',
                        path: logoSvgPath,
                        cid: 'logo'
                    }
                ];
            }
            // In dev environment without credentials just log it
            if (process.env.NODE_ENV !== 'production' && (!fromEmail || fromEmail === 'test@example.com')) {
                console.log('--- MOCK EMAIL ---');
                console.log(`To: ${to}`);
                console.log(`Subject: ${subject}`);
                console.log(`Body: ${html}`);
                console.log('------------------');
                return;
            }
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent in background: %s', info.messageId);
        }
        catch (error) {
            console.error('Error sending email in background:', error);
        }
    })();
    // Return true immediately to prevent request blocking
    return true;
};
exports.sendEmail = sendEmail;
const sendAdminCongratulationsEmail = async (to, ownerName, username, password, plan) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        const priceDisplay = plan.price === 0 ? "Free Trial" : `₹${plan.price.toLocaleString("en-IN")}`;
        const formatLimit = (limit) => {
            if (limit === -1 || limit === 9999 || limit >= 9999)
                return "Unlimited";
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
        return await (0, exports.sendEmail)(to.toLowerCase(), "Welcome to Docyori! Account & Plan Details", emailBody);
    }
    catch (error) {
        console.error("Error sending admin congratulations email:", error);
        return false;
    }
};
exports.sendAdminCongratulationsEmail = sendAdminCongratulationsEmail;
const sendPatientRegistrationEmail = async (to, patientName, patientId, credentials) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        let credentialsSection = "";
        if (credentials && credentials.password) {
            credentialsSection = `
              <tr>
                <td style="color: #6b7280; padding: 4px 0; border-top: 1px dashed #e2e8f0; margin-top: 4px;">Username</td>
                <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600; border-top: 1px dashed #e2e8f0;">: ${credentials.username}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 4px 0;">Password</td>
                <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${credentials.password}</td>
              </tr>
            `;
        }
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Welcome to DocYori! 👋</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>${patientName}</strong>,<br/>
                Your registration is successful. We're happy to have you with us.
              </p>
              
              <div style="background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #6b21a8; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Patient Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Patient ID</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${patientId}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Registered On</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  </tr>
                  ${credentialsSection}
                </table>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #7c3aed; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);">Login to Account</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "Patient Registration Successfully", emailBody);
    }
    catch (error) {
        console.error("Error sending patient registration email:", error);
        return false;
    }
};
exports.sendPatientRegistrationEmail = sendPatientRegistrationEmail;
const sendPatientAppointmentEmail = async (to, patientName, doctorName, date, time, appointmentId, credentials) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        let credentialsSection = "";
        if (credentials && credentials.password) {
            credentialsSection = `
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; font-size: 14px;">
                <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Your Patient Portal Account:</h4>
                <p style="margin: 0 0 10px 0; color: #475569;">We have automatically created an account for you to view your prescriptions and history.</p>
                <ul style="margin: 0; padding-left: 20px; color: #1e293b;">
                  <li>Username: <strong>${credentials.username}</strong></li>
                  <li>Password: <strong>${credentials.password}</strong></li>
                </ul>
              </div>
            `;
        }
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Appointment Confirmed ✅</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Dear <strong>${patientName}</strong>,<br/>
                Your appointment has been successfully booked.
              </p>
              
              <div style="background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #6b21a8; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Appointment Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Doctor</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: Dr. ${doctorName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Date</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${date}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Time</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${time}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Type</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: Consultation</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Appointment ID</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${appointmentId}</td>
                  </tr>
                </table>
              </div>
              
              ${credentialsSection}

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #7c3aed; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(124, 58, 237, 0.25);">View Appointment</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "Your Appointment Confirmation", emailBody);
    }
    catch (error) {
        console.error("Error sending patient appointment email:", error);
        return false;
    }
};
exports.sendPatientAppointmentEmail = sendPatientAppointmentEmail;
const sendDoctorRegistrationEmail = async (to, doctorName, doctorCode, credentials) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Welcome to DocYori! 🩺</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>Dr. ${doctorName}</strong>,<br/>
                Your doctor account registration is successful. Welcome to our clinic team!
              </p>
              
              <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #1e40af; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Account & Credentials</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Doctor ID</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${doctorCode}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Username</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${credentials.username}</td>
                  </tr>
                  ${credentials.password ? `
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Password</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${credentials.password}</td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Registered On</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #dc2626; font-size: 13px; font-weight: 700; text-align: center; margin-bottom: 20px;">
                ⚠️ Please change your temporary password after logging in.
              </p>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">Login to Account</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "Doctors registration Successfully", emailBody);
    }
    catch (error) {
        console.error("Error sending doctor registration email:", error);
        return false;
    }
};
exports.sendDoctorRegistrationEmail = sendDoctorRegistrationEmail;
const sendDoctorAppointmentEmail = async (to, doctorName, patientName, date, time, type) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">New Appointment Assigned</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>Dr. ${doctorName}</strong>,<br/>
                You have a new appointment scheduled.
              </p>
              
              <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #1e40af; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Appointment Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Patient</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${patientName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Date</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${date}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Time</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${time}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Type</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${type}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">View Appointment</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "New Appointment Assigned", emailBody);
    }
    catch (error) {
        console.error("Error sending doctor appointment email:", error);
        return false;
    }
};
exports.sendDoctorAppointmentEmail = sendDoctorAppointmentEmail;
const sendClinicWelcomeTrialEmail = async (to, ownerName, username, password, planName = "Enterprise", durationDays = 14, expiresAt) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const expiryString = expiresAt
            ? expiresAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">Your Free Trial Has Started! 🚀</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>${ownerName}</strong>,<br/>
                Your enterprise account has been successfully created. Explore all the powerful features and streamline your clinic operations.
              </p>

              ${password ? `
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 20px; font-size: 14px;">
                <h4 style="margin: 0 0 8px 0; color: #334155;">Account Login Details:</h4>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #6b7280; padding: 2px 0;">Username</td>
                    <td style="color: #1e293b; padding: 2px 0; font-weight: 600;">: ${username}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 2px 0;">Password</td>
                    <td style="color: #1e293b; padding: 2px 0; font-weight: 600;">: ${password}</td>
                  </tr>
                </table>
              </div>
              ` : ''}
              
              <div style="background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #6b21a8; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Trial Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Plan</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${planName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Duration</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${durationDays} Days</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Expires On</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${expiryString}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">Explore DocYori!</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "Welcome to DocYori! Free Trial Started", emailBody);
    }
    catch (error) {
        console.error("Error sending clinic trial email:", error);
        return false;
    }
};
exports.sendClinicWelcomeTrialEmail = sendClinicWelcomeTrialEmail;
const sendClinicSubscriptionActivatedEmail = async (to, ownerName, planName, amount, durationDays, expiresAt, isRenewal = false) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const expiryString = expiresAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const titleText = isRenewal ? "Your Subscription Has Been Renewed" : "Subscription Activated!";
        const mainText = isRenewal
            ? "Your subscription has been successfully renewed. Thank you for continuing with DocYori."
            : "Great! Your subscription has been successfully activated.";
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">${titleText} 🎉</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>${ownerName}</strong>,<br/>
                ${mainText}
              </p>
              
              <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #166534; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Subscription Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Plan</td>
                    <td style="color: #166534; padding: 4px 0; font-weight: 600;">: ${planName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Duration</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${durationDays} Days</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Amount Paid</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ₹${amount.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Valid Till</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${expiryString}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">Go to Dashboard</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), isRenewal ? "Your Subscription Has Been Renewed" : "Subscription Activated Successfully", emailBody);
    }
    catch (error) {
        console.error("Error sending subscription activation email:", error);
        return false;
    }
};
exports.sendClinicSubscriptionActivatedEmail = sendClinicSubscriptionActivatedEmail;
const sendClinicSubscriptionExpiredEmail = async (to, ownerName, planName, isTrial = false) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const renewUrl = `${frontendLink}/membership/membership-plans`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const titleText = isTrial ? "Your Free Trial Has Expired" : "Your Subscription Has Expired";
        const descriptionText = isTrial
            ? "Your free trial of DocYori has expired. Upgrade your account to continue using all features seamlessly."
            : `Your subscription for the "${planName}" plan has expired. Upgrade/renew your account now to avoid interruptions in managing your clinic.`;
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #ef4444; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">${titleText} ⚠️</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 24px;">
                Hello <strong>${ownerName}</strong>,<br/>
                ${descriptionText}
              </p>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${renewUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">Choose a Plan</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), titleText, emailBody);
    }
    catch (error) {
        console.error("Error sending subscription expired email:", error);
        return false;
    }
};
exports.sendClinicSubscriptionExpiredEmail = sendClinicSubscriptionExpiredEmail;
const sendClinicSubscriptionExpiringSoonEmail = async (to, ownerName, planName, expiresAt, daysLeft) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const renewUrl = `${frontendLink}/membership/membership-plans`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const expiryString = expiresAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const titleText = `${daysLeft} Days Left in Your Free Trial`;
        const descriptionText = daysLeft <= 7
            ? `Your DocYori free trial will expire in ${daysLeft} days. Upgrade now to continue seamlessly.`
            : `Your subscription is expiring soon. Renew now to avoid any interruption in clinic services.`;
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #eab308; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">⏰ ${titleText}</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>${ownerName}</strong>,<br/>
                ${descriptionText}
              </p>
              
              <div style="background-color: #fefbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #854d0e; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Subscription Status</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Plan</td>
                    <td style="color: #854d0e; padding: 4px 0; font-weight: 600;">: ${planName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Expires On</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${expiryString}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${renewUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">Renew Now</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "Subscription Expiring Soon!", emailBody);
    }
    catch (error) {
        console.error("Error sending subscription expiring email:", error);
        return false;
    }
};
exports.sendClinicSubscriptionExpiringSoonEmail = sendClinicSubscriptionExpiringSoonEmail;
const sendClinicAppointmentNotificationEmail = async (to, ownerName, patientName, doctorName, date, time, type) => {
    try {
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "https://docyori.com";
        const loginUrl = `${frontendLink}/login`;
        // Fetch support contacts from settings
        const supportEmailSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_email" } });
        const supportPhoneSetting = await prisma_1.default.systemSetting.findUnique({ where: { key: "contact_phone" } });
        const supportEmail = supportEmailSetting?.value || "support@docyori.com";
        const supportPhone = supportPhoneSetting?.value || "+91 12345 67890";
        const emailBody = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #f0f0f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="text-align: center; margin-bottom: 24px;">
                <img src="cid:logo" alt="DocYori" style="height: 50px; width: auto; object-fit: contain;" />
              </div>
              
              <h2 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 8px;">New Clinic Booking 📅</h2>
              
              <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 0; margin-bottom: 20px;">
                Hello <strong>${ownerName}</strong>,<br/>
                A new appointment has been successfully booked in your clinic.
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="color: #475569; font-size: 14px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Booking Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0; width: 40%;">Patient Name</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${patientName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Doctor Assigned</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: Dr. ${doctorName}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Date</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${date}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Time</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${time}</td>
                  </tr>
                  <tr>
                    <td style="color: #6b7280; padding: 4px 0;">Type</td>
                    <td style="color: #1e1b4b; padding: 4px 0; font-weight: 600;">: ${type}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${loginUrl}" style="background: #10b981; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);">Go to Dashboard</a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin-bottom: 20px;" />
              
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <h5 style="color: #0f172a; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Need Help?</h5>
                  <p style="color: #64748b; font-size: 12px; margin: 0; line-height: 1.4;">
                    We're here for you!<br/>
                    <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 600;">${supportEmail}</a><br/>
                    <a href="tel:${supportPhone.replace(/\s+/g, '')}" style="color: #475569; text-decoration: none;">${supportPhone}</a>
                  </p>
                </div>
                <div style="text-align: right;">
                  <img src="https://img.icons8.com/color/48/whatsapp--v1.png" alt="Help" style="height: 36px; width: 36px;" />
                </div>
              </div>
            </div>
        `;
        return await (0, exports.sendEmail)(to.toLowerCase(), "New Appointment Booked", emailBody);
    }
    catch (error) {
        console.error("Error sending clinic appointment email:", error);
        return false;
    }
};
exports.sendClinicAppointmentNotificationEmail = sendClinicAppointmentNotificationEmail;
