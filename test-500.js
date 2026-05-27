const http = require('http');

const body = JSON.stringify({
    employeeId: "some-id",
    employeeType: "DOCTOR",
    date: "2026-05-26",
    status: "PRESENT"
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance/mark',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
};

(async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({ where: { email: 'owner@clinic.com' } });
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, clinicId: user.clinicId },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '1d' }
    );
    await prisma.$disconnect();

    options.headers['Authorization'] = `Bearer ${token}`;

    // Get an actual employee ID
    const prisma2 = new PrismaClient();
    const doctor = await prisma2.doctor.findFirst({ where: { clinicId: user.clinicId } });
    await prisma2.$disconnect();

    if (doctor) {
        const dBody = JSON.stringify({
            employeeId: doctor.id,
            employeeType: "DOCTOR",
            date: "2026-05-26",
            status: "PRESENT"
        });
        options.headers['Content-Length'] = Buffer.byteLength(dBody);

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => console.log('Response:', data));
        });
        req.on('error', e => console.error(e));
        req.write(dBody);
        req.end();
    }
})();
