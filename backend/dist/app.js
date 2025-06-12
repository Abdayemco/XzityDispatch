"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const errorHandler_1 = require("./middlewares/errorHandler");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const ride_routes_1 = __importDefault(require("./routes/ride.routes"));
const test_routes_1 = __importDefault(require("./routes/test.routes")); // <--- Add this line
const app = (0, express_1.default)();
// Allow CORS from Vite dev server and optional .env CLIENT_URL
const allowedOrigins = [
    "http://localhost:5173",
];
if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL);
}
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express_1.default.json());
app.use("/api/auth", auth_routes_1.default);
app.use("/api/rides", ride_routes_1.default);
app.use("/test", test_routes_1.default); // <--- Add this line
app.use(errorHandler_1.errorHandler);
exports.default = app;
