import express from "express";
import dns from "node:dns";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import errorHandler from "./middleware/errorHandler.js";
import router from "./routes/index.js";
import AppError from "./utils/AppError.js";
import requestLogger from "./middleware/requestLogger.js";
import logger from "./utils/logger.js";
import "./utils/scheduler.js";

import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "./.env") });

process.env.FORCE_IPV4 === "true" && dns.setDefaultResultOrder?.("ipv4first");

const isProduction = process.env.NODE_ENV === "production";

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (!isProduction || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                logger.warn("CORS blocked request", { origin });
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

if (!isProduction) {
    const options = {
        definition: {
            openapi: "3.0.0",
            info: {
                title: "BINUS Event Viewer API",
                version: "1.0.0",
                description:
                    "Dokumentasi API lengkap untuk backend aplikasi BINUS Event Viewer.",
            },
            servers: [
                {
                    url: `http://localhost:${process.env.PORT}`,
                    description: "Development Server",
                },
            ],
            components: {
                securitySchemes: {
                    BearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                        description:
                            "Masukkan token JWT yang didapat dari endpoint login. Contoh: 'Bearer {token}'",
                    },
                },
                schemas: {
                    User: {
                        type: "object",
                        properties: {
                            id: { type: "string", format: "uuid" },
                            role: {
                                type: "string",
                                enum: ["admin", "super_admin"],
                            },
                            firstName: { type: "string" },
                            lastName: { type: "string" },
                            email: { type: "string", format: "email" },
                            createdAt: { type: "string", format: "date-time" },
                            updatedAt: { type: "string", format: "date-time" },
                        },
                    },
                    Event: {
                        type: "object",
                        properties: {
                            id: { type: "string", format: "uuid" },
                            creatorId: { type: "string", format: "uuid" },
                            eventName: { type: "string" },
                            date: { type: "string", format: "date" },
                            startTime: { type: "string", example: "14:30" },
                            endTime: { type: "string", example: "16:30" },
                            location: { type: "string" },
                            speaker: { type: "string", nullable: true },
                            status: {
                                type: "string",
                                enum: [
                                    "pending",
                                    "revised",
                                    "approved",
                                    "rejected",
                                ],
                            },
                            imageUrl: { type: "string", format: "uri" },
                        },
                    },
                    Feedback: {
                        type: "object",
                        required: ["feedback"],
                        properties: {
                            feedback: {
                                type: "string",
                                description:
                                    "Pesan feedback atau revisi untuk admin.",
                                minLength: 1,
                                maxLength: 1000,
                                example:
                                    "Mohon perbaiki deskripsi acara agar lebih jelas.",
                            },
                        },
                    },
                    Notification: {
                        type: "object",
                        properties: {
                            id: { type: "string", format: "uuid" },
                            eventId: { type: "string", format: "uuid" },
                            senderId: { type: "string", format: "uuid" },
                            recipientId: { type: "string", format: "uuid" },
                            feedback: { type: "string", nullable: true },
                            payload: {
                                type: "object",
                                description:
                                    "Detail data notifikasi, seperti detail event.",
                            },
                            notificationType: {
                                type: "string",
                                enum: [
                                    "event_created",
                                    "event_updated",
                                    "event_deleted",
                                    "event_pending",
                                    "event_revised",
                                    "event_approved",
                                    "event_rejected",
                                ],
                            },
                            isRead: { type: "boolean" },
                            createdAt: { type: "string", format: "date-time" },
                            updatedAt: { type: "string", format: "date-time" },
                        },
                    },
                    ErrorResponse: {
                        type: "object",
                        properties: {
                            status: { type: "string", example: "error" },
                            message: { type: "string" },
                            errorCode: { type: "string" },
                        },
                    },
                    ValidationErrorResponse: {
                        type: "object",
                        properties: {
                            status: { type: "string", example: "error" },
                            message: {
                                type: "string",
                                example: "Invalid request data",
                            },
                            errorCode: {
                                type: "string",
                                example: "VALIDATION_ERROR",
                            },
                            errorField: {
                                type: "object",
                                properties: {
                                    fieldName: {
                                        type: "string",
                                        example: "Pesan error untuk field ini",
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        apis: ["./routes/*.js"],
    };

    const swaggerSpec = swaggerJsdoc(options);
    app.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
            customCss: ".swagger-ui .topbar { display: none }",
            customSiteTitle: "Event Viewer API Docs",
        }),
    );

    logger.info("Swagger UI aktif di /api-docs");
}

app.use(requestLogger);
app.use(router);
app.use("/", (req, res, next) => {
    next(new AppError("Page Not Found", 404, "PAGE_NOT_FOUND"));
});
app.use(errorHandler);

export default app;
