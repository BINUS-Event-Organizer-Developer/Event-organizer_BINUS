import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { parseAndVerifyToken } from "../middleware/tokenValidator.middleware.js";
import AppError from "../utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

let io;

const socketService = {
    init(httpServer) {
        io = new Server(httpServer, {
            cors: {
                origin: process.env.CLIENT_URL,
                methods: ["GET", "POST"],
            },
        });

        io.use((socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                const decoded = parseAndVerifyToken({
                    token,
                    type: "accessToken",
                    secretKey: process.env.ACCESS_JWT_SECRET,
                });
                socket.user = decoded;
                next();
            } catch (error) {
                next(new AppError(error, 401, "TOKEN_VALIDATION_ERROR"));
            }
        });

        io.on("connection", async (socket) => {
            console.log("Client terhubung:", socket.id);

            const { id: userId, role } = socket.user;
            socket.join(userId);

            if (role === "super_admin") {
                socket.join("super_admin-room");
                console.log(`User ${userId} masuk ke room super_admin-room`);
            }

            socket.on("disconnect", () => {
                console.log("Client terputus:", socket.id);
            });
        });

        return io;
    },

    getIO() {
        if (!io) {
            throw new Error("Socket.io belum diinisialisasi!");
        }
        return io;
    },
};

export default socketService;
