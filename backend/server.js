import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app.js";
import { testDBConnection } from "./config/dbconfig.js";
import { checkEmailConnection } from "./utils/emailSender.js";
import socketService from "./socket/index.js";
import http from "http";
import logger from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "./.env") });

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

const getServerAddress = (server) => {
    const addr = server.address();
    if (!addr) return "unknown";
    if (typeof addr === "string") return addr;

    if (NODE_ENV === "production" && process.env.APP_URL) {
        return process.env.APP_URL;
    }

    return `http://localhost:${addr.port}`;
};

const withTimeout = (promise, ms, name) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(
                new Error(
                    `Timeout: ${name} memakan waktu lebih dari ${ms}ms dan nge-hang.`,
                ),
            );
        }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
};

const startServer = async () => {
    try {
        await withTimeout(checkEmailConnection(), 10000, "Email Connection");
        await withTimeout(testDBConnection(), 10000, "Database Connection");

        const server = http.createServer(app);
        socketService.init(server);

        server.listen(PORT, "0.0.0.0", () => {
            logger.info(
                `[${NODE_ENV.toUpperCase()}] Server running at ${getServerAddress(server)}`,
            );
        });

        const shutdown = (signal) => {
            logger.warn(`Received ${signal}. Shutting down gracefully...`);
            server.close(() => {
                logger.info("HTTP server closed.");
                process.exit(0);
            });

            setTimeout(() => {
                logger.error("Forced shutdown after timeout.");
                process.exit(1);
            }, 10_000);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        process.on("unhandledRejection", (reason, promise) => {
            logger.error("Unhandled Rejection at:", { promise, reason });
        });

        process.on("uncaughtException", (error) => {
            logger.error("Uncaught Exception:", { error });
            shutdown("uncaughtException");
        });
    } catch (error) {
        console.error("FATAL ERROR SAAT STARTUP");
        console.error(error.message || error);

        if (logger && typeof logger.error === "function") {
            logger.error("Failed to start server:", { error });
        }

        setTimeout(() => {
            console.error("Mematikan server...");
            process.exit(1);
        }, 1000);
    }
};

startServer();
