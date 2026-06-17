import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { createNotificationInternal } from "./notification.controller";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { sendEmail } from "../utils/email";

/* ─── GET /api/landing/:clinicId  (public, no auth) ─── */
export const getClinicLandingPage = async (req: Request, res: Response) => {
    try {
        const { clinicId, username } = req.params;

        const clinic = await prisma.clinic.findFirst({
            where: username ? { username } : { id: clinicId },
            include: {
                landingPage: true,
                doctors: {
                    where: { status: "Active" },
                    include: { specializations: true, designation: true },
                    orderBy: { createdAt: "asc" },
                },
                services: {
                    where: { status: "Active" },
                    include: { department: true },
                    orderBy: { serviceName: "asc" },
                },
                patients: { select: { id: true } },
                workingDaysConfig: true,
            },
        });

        if (!clinic) {
            return res.status(404).json({ message: "Clinic not found" });
        }

        const lp = clinic.landingPage;

        const doctors = clinic.doctors.map((d) => ({
            id: d.id,
            name: d.fullName,
            qualification: d.designation?.name || "",
            specialization: d.specializations[0]?.name || "",
            experience: d.yearOfExperience || 0,
            fee: d.consultationCharge || 0,
            days: d.schedules
                ? (() => {
                    try {
                        const s = Array.isArray(d.schedules)
                            ? (d.schedules as Array<{ day: string; isActive?: boolean }>)
                            : [];
                        const activeDays = s
                            .filter((x) => x.isActive !== false)
                            .map((x) => x.day);
                        return activeDays.join(", ") || "Mon-Sat";
                    } catch {
                        return "Mon-Sat";
                    }
                })()
                : "Mon-Sat",
            timing: "9 AM - 5 PM",
            photo: d.profileImage || "",
            bio: d.bio || "",
            phone: d.phone || "",
            email: d.email || "",
            medicalLicenseNumber: d.medicalLicenseNumber || "",
            languagesSpoken: d.languagesSpoken || [],
            bloodGroup: d.bloodGroup || "",
            gender: d.gender || "",
            dob: d.dob || null,
            educations: d.educations || [],
            awards: d.awards || [],
            certifications: d.certifications || [],
            schedules: d.schedules || [],
            clinicName: clinic.name
        }));

        const services = (lp?.services as Array<{ icon: string; label: string }> | null) ??
            clinic.services.map((s) => ({
                icon: "ti ti-stethoscope",
                label: s.serviceName,
            }));

        const apptCount = await prisma.appointment.count({ where: { clinicId: clinic.id } });
        const nextAppointmentCode = `AP${String(apptCount + 1).padStart(3, "0")}`;

        const response = {
            id: clinic.id,
            name: clinic.name,
            tagline: lp?.tagline || "Quality Healthcare for Your Family",
            phone: clinic.phone || "",
            whatsapp: lp?.whatsapp || clinic.phone || "",
            email: lp?.email || "",
            address: `${clinic.addressLine1 || ""} ${clinic.addressLine2 || ""}`.trim(),
            city: clinic.city || "",
            mapUrl: lp?.mapUrl || "",
            directionsUrl: lp?.directionsUrl || "",
            about: lp?.about || "",
            established: lp?.established || null,
            patientsServed: lp?.patientsServed || `${clinic.patients.length}+`,
            experience: lp?.experience || null,
            logo: lp?.logo || "",
            headerImage: lp?.headerImage || "",
            aboutImage: lp?.aboutImage || "",
            facebook: lp?.facebook || "",
            instagram: lp?.instagram || "",
            doctors,
            services,
            reviews: (lp?.reviews as Array<{ name: string; rating: number; feedback: string }>) || [],
            gallery: (lp?.gallery as Array<{ url: string; category: string }>) || [],
            workingDays: clinic.workingDaysConfig || null,
            onboardingStep: clinic.onboardingStep,
            nextAppointmentCode
        };

        return res.json(response);
    } catch (error) {
        console.error("Landing page error:", error);
        return res.status(500).json({ message: "Error fetching landing page" });
    }
};

/* ─── PUT /api/landing/:clinicId  (authenticated) ─── */
export const upsertLandingPage = async (req: Request, res: Response) => {
    try {
        const { clinicId } = req.params;
        const {
            tagline, whatsapp, email, facebook, instagram,
            about, established, patientsServed, experience,
            mapUrl, directionsUrl, reviews, gallery, services, logo,
            headerImage, aboutImage,
        } = req.body;

        const landingPage = await prisma.landingPage.upsert({
            where: { clinicId },
            create: {
                clinicId,
                tagline, whatsapp, email, facebook, instagram,
                about, established: established ? Number(established) : undefined,
                patientsServed, experience: experience ? Number(experience) : undefined,
                mapUrl, directionsUrl, reviews, gallery, services, logo,
                headerImage, aboutImage,
            },
            update: {
                tagline, whatsapp, email, facebook, instagram,
                about, established: established ? Number(established) : undefined,
                patientsServed, experience: experience ? Number(experience) : undefined,
                mapUrl, directionsUrl,
                ...(reviews !== undefined && { reviews }),
                ...(gallery !== undefined && { gallery }),
                ...(services !== undefined && { services }),
                ...(logo !== undefined && { logo }),
                ...(headerImage !== undefined && { headerImage }),
                ...(aboutImage !== undefined && { aboutImage }),
            },
        });

        return res.json({ success: true, landingPage });
    } catch (error) {
        console.error("Upsert landing page error:", error);
        return res.status(500).json({ message: "Error saving landing page" });
    }
};

/* ─── POST /api/landing/:clinicId/book  (public, no auth) ─── */
export const bookPublicAppointment = async (req: Request, res: Response) => {
    try {
        const { clinicId } = req.params;
        const { firstName, lastName, email, phone, gender, doctorId, date, time, reason } = req.body;

        if (!firstName || !lastName || !email || !phone || !gender || !date || !time) {
            return res.status(400).json({ message: "First name, last name, email, phone, gender, date and time are required." });
        }

        const clinic = await prisma.clinic.findUnique({
            where: { id: clinicId },
            include: { workingDaysConfig: true }
        });
        if (!clinic) return res.status(404).json({ message: "Clinic not found" });

        // Validate Clinic Working Days
        const scheduledDate = new Date(date);
        const dayOfWeek = scheduledDate.getDay();
        const offDays = (clinic.workingDaysConfig?.offDays as number[]) || [0];
        if (offDays.includes(dayOfWeek)) {
            return res.status(400).json({ message: "The clinic is closed on this day. Please select another date." });
        }

        // Find or create patient by phone or email
        let patient = await prisma.patient.findFirst({
            where: {
                clinicId,
                OR: [
                    { phone },
                    { email: email.toLowerCase() }
                ]
            }
        });

        if (!patient) {
            const count = await prisma.patient.count({ where: { clinicId } });
            const patientCode = `PAT${String(count + 1).padStart(6, "0")}`;
            patient = await prisma.patient.create({
                data: {
                    patientCode,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone,
                    email: email.toLowerCase(),
                    gender,
                    clinicId,
                    status: "Active",
                    dob: new Date("1990-01-01"),
                },
            });
        }

        // Check if user account already exists by email
        let existingUser = await prisma.user.findFirst({
            where: { email: email.toLowerCase() }
        });

        let generatedPassword = "";
        let isNewUserCreated = false;

        if (!existingUser) {
            // Check if phone number is already taken by another user account
            let phoneToUse = phone || null;
            if (phone) {
                const phoneTaken = await prisma.user.findFirst({
                    where: { phone }
                });
                if (phoneTaken) {
                    phoneToUse = null; // Prevent unique constraint crash by omitting duplicate phone
                }
            }

            generatedPassword = randomBytes(4).toString("hex"); // 8 chars hex password
            const passwordHash = await bcrypt.hash(generatedPassword, 10);
            await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    phone: phoneToUse,
                    username: email.toLowerCase(),
                    passwordHash,
                    fullName: `${firstName.trim()} ${lastName.trim()}`,
                    role: "PATIENT",
                    clinicId,
                }
            });
            isNewUserCreated = true;
        }

        // Resolve doctor
        let resolvedDoctorId = doctorId;
        if (!resolvedDoctorId) {
            const firstDoc = await prisma.doctor.findFirst({ where: { clinicId, status: "Active" } });
            if (!firstDoc) return res.status(400).json({ message: "No available doctors in this clinic." });
            resolvedDoctorId = firstDoc.id;
        }

        const doctor = await prisma.doctor.findFirst({ where: { id: resolvedDoctorId, clinicId } });
        if (!doctor) return res.status(400).json({ message: "Invalid doctor selected." });

        let timeStr = time;
        if (timeStr.split(':').length === 2) {
            timeStr = `${timeStr}:00`;
        }
        const scheduledAt = new Date(`${date}T${timeStr}`);
        if (isNaN(scheduledAt.getTime())) {
            return res.status(400).json({ message: "Invalid date or time format." });
        }

        const count = await prisma.appointment.count({ where: { clinicId } });
        const appointmentCode = `AP${String(count + 1).padStart(3, "0")}`;

        const appointment = await prisma.appointment.create({
            data: {
                appointmentCode,
                patientId: patient.id,
                doctorId: resolvedDoctorId,
                departmentId: doctor.departmentId || null,
                scheduledAt,
                endAt: null,
                mode: "In-person",
                appointmentType: "Online Booking",
                status: "Schedule",
                reason: reason || "Online booking from clinic website",
                location: null,
                clinicId,
            },
        });

        // 🔴 P0 Email Notification with credentials and booking status
        const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
        const loginUrl = `${frontendLink}/login`;

        let emailBody = "";
        if (isNewUserCreated) {
            emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e2e8f0; padding: 24px; borderRadius: 8px;">
                    <h2 style="color: #1d4ed8; text-align: center; margin-top: 0;">Booking Confirmation</h2>
                    <p>Dear <strong>${firstName.trim()} ${lastName.trim()}</strong>,</p>
                    <p>Thank you for booking an appointment with us. Your appointment has been scheduled successfully!</p>
                    
                    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <h4 style="margin: 0 0 10px 0; color: #15803d;">Appointment Details:</h4>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Appointment ID: <strong>${appointmentCode}</strong></li>
                            <li>Doctor: <strong>Dr. ${doctor.fullName}</strong></li>
                            <li>Date: <strong>${scheduledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong></li>
                            <li>Time: <strong>${time}</strong></li>
                        </ul>
                    </div>

                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                        <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Your Patient Portal Account:</h4>
                        <p style="margin: 0 0 10px 0;">We have automatically created an account for you to view your prescriptions and history.</p>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Login URL: <a href="${loginUrl}">${loginUrl}</a></li>
                            <li>Email / Username: <strong>${email.toLowerCase()}</strong></li>
                            <li>Password: <strong>${generatedPassword}</strong></li>
                        </ul>
                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #ef4444; font-weight: bold;">
                            * Note: Please change this temporary password after logging in for the first time.
                        </p>
                    </div>

                    <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; text-align: center;">
                        <h4 style="margin: 0 0 10px 0; color: #b45309;">⚠️ Action Required to Confirm Your Booking</h4>
                        <p style="margin: 0; font-weight: bold; font-size: 15px; color: #b45309;">
                            To confirm your booking, please call the admin and pay the advance.
                        </p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                    <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 0;">
                        Regards,<br/><strong>${clinic.name} Team</strong>
                    </p>
                </div>
            `;
        } else {
            emailBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #e2e8f0; padding: 24px; borderRadius: 8px;">
                    <h2 style="color: #1d4ed8; text-align: center; margin-top: 0;">Booking Confirmation</h2>
                    <p>Dear <strong>${firstName.trim()} ${lastName.trim()}</strong>,</p>
                    <p>Your new appointment has been scheduled successfully!</p>
                    
                    <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <h4 style="margin: 0 0 10px 0; color: #15803d;">Appointment Details:</h4>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li>Appointment ID: <strong>${appointmentCode}</strong></li>
                            <li>Doctor: <strong>Dr. ${doctor.fullName}</strong></li>
                            <li>Date: <strong>${scheduledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong></li>
                            <li>Time: <strong>${time}</strong></li>
                        </ul>
                    </div>

                    <div style="background-color: #fffbeb; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; text-align: center;">
                        <h4 style="margin: 0 0 10px 0; color: #b45309;">⚠️ Action Required to Confirm Your Booking</h4>
                        <p style="margin: 0; font-weight: bold; font-size: 15px; color: #b45309;">
                            To confirm your booking, please call the admin and pay the advance.
                        </p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                    <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 0;">
                        Regards,<br/><strong>${clinic.name} Team</strong>
                    </p>
                </div>
            `;
        }

        await sendEmail(email.toLowerCase(), "Your Booking Confirmation & Account Details", emailBody);

        const patientName = `${patient.firstName} ${patient.lastName}`.trim();
        await createNotificationInternal({
            clinicId,
            type: "APPOINTMENT",
            title: "New Online Appointment Booked!",
            message: `${patientName} (${phone}) booked an appointment with Dr. ${doctor.fullName} on ${scheduledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${time}.`,
            targetRole: "ALL",
            link: `/appointments`,
        });

        return res.status(201).json({
            success: true,
            appointmentCode,
            isNewUserCreated,
            generatedPassword,
            email,
            message: "Appointment booked successfully!",
        });

    } catch (error) {
        console.error("Public booking error:", error);
        return res.status(500).json({ message: "Error booking appointment. Please try again." });
    }
};
