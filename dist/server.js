"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
// Middleware
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(null, false);
        }
    },
    credentials: true,
}));
app.use(express_1.default.json());
// Routes
app.use("/api/auth", auth_routes_1.default);
// Root Check
app.get("/", (req, res) => {
    res.json({ message: "Clinic Management SaaS API is running perfectly!" });
});
// Start Server
app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`===============================================`);
});
