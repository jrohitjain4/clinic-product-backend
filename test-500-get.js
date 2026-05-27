const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/attendance?month=5&year=2026',
    method: 'GET',
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

    options.headers = {
        'Authorization': `Bearer ${token}`
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log('Response:', data));
    });
    req.on('error', e => console.error(e));
    req.end();
})();
