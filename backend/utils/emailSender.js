import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import AppError from "./AppError.js";
import globalLogger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const checkEmailConnection = async () => {
    try {
        await transporter.verify();
        globalLogger.info("✅ Server email siap menerima pesan");
    } catch (error) {
        const message = "Gagal terhubung ke server email";
        globalLogger.error(`❌ ${message}\n`, error);
        throw new AppError(message, 500, "EAUTH");
    }
};

export const sendOTPEmail = async (mailOptions, email, logger) => {
    try {
        logger.info("Attempting to send OTP email via external service", {
            context: {
                recipientEmail: email,
            },
        });

        const info = await transporter.sendMail(mailOptions);

        logger.info("OTP email sent successfully", {
            context: {
                recipientEmail: email,
                messageId: info.messageId,
                response: info.response,
            },
        });
    } catch (error) {
        logger.error("Failed to send OTP email", {
            context: {
                recipientEmail: email,
            },
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
            },
        });

        throw error;
    }
};
