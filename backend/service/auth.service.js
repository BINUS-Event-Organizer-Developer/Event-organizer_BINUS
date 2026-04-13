import bcrypt from "bcrypt";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { fileURLToPath } from "url";
import getToken from "../utils/getToken.js";
import { saveNewRefreshToken } from "../service/token.service.js";
import { sendOTPEmail } from "../utils/emailSender.js";
import { saveOTPToDatabase } from "../service/otp.service.js";
import { generateOTP } from "../utils/otpGenerator.js";
import AppError from "../utils/AppError.js";
import { User, ResetToken } from "../model/index.js";
import {
    blacklistAccessToken,
    revokeRefreshToken,
} from "../service/token.service.js";
import { sequelize } from "../config/dbconfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BCRYPT_SALT_ROUDS = process.env.NODE_ENV === "test" ? 1 : 10;

export const handleUserLogin = async (data, deviceName, loginLogger) => {
    try {
        const { email, password } = data;

        loginLogger.info("Attempting to find user in database", { email });
        const user = await User.findOne({ where: { email } });

        if (!user) {
            loginLogger.warn("Login failed: User not found in database", {
                email,
            });
            throw new AppError(
                "Email atau Password salah.",
                401,
                "CLIENT_AUTH_ERROR",
            );
        }

        loginLogger.info("User found, proceeding with password verification", {
            userId: user.id,
        });

        const result = await bcrypt.compare(password, user.password);
        if (!result) {
            loginLogger.warn("Login failed: Password mismatch", {
                userId: user.id,
            });
            throw new AppError(
                "Email atau Password salah.",
                401,
                "CLIENT_AUTH_ERROR",
            );
        }

        loginLogger.info("Password verified. Generating tokens...", {
            userId: user.id,
        });
        const payload = { id: user.id, role: user.role };
        const { accessToken, refreshToken } = getToken(payload);

        await saveNewRefreshToken(
            user.id,
            refreshToken,
            deviceName,
            loginLogger,
        );

        loginLogger.info("New refresh token saved successfully", {
            userId: user.id,
            deviceName,
        });

        const userProfile = {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
        };

        return { user: userProfile, accessToken, refreshToken };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        loginLogger.error(
            "An unexpected error occurred in handleUserLogin service",
            {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            },
        );

        throw new AppError(
            "An internal server error occurred",
            500,
            "INTERNAL_SERVER_ERROR",
        );
    }
};

export const handleUserLogout = async (
    accessTokenFromUser,
    refreshTokenFromUser,
    userId,
    logoutLogger,
) => {
    logoutLogger.info("Starting logout process...");

    const tasks = [];
    if (accessTokenFromUser) {
        tasks.push(
            blacklistAccessToken(accessTokenFromUser, userId, logoutLogger),
        );
    }
    if (refreshTokenFromUser) {
        tasks.push(
            revokeRefreshToken(refreshTokenFromUser, userId, logoutLogger),
        );
    }

    await Promise.allSettled(tasks);

    logoutLogger.info("Logout process completed.");
};

export const requestPasswordReset = async (email, logger) => {
    try {
        logger.info("Forgot password process started in service");

        const user = await User.findOne({ where: { email } });
        if (!user) {
            logger.warn("Password reset requested for a non-existent email");
            throw new AppError("Email tidak terdaftar", 404, "USER_NOT_FOUND");
        }
        logger.info("User found in database, proceeding to generate OTP", {
            context: { userId: user.id },
        });

        const otp = generateOTP();
        logger.info("OTP generated successfully");

        const templatePath = path.join(__dirname, "../view/otp-email.html");

        let htmlContent = fs.readFileSync(templatePath, "utf8");
        htmlContent = htmlContent.replace("{{otp}}", otp);

        const mailOptions = {
            from: `BINUS Event Viewer <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Reset Password - Kode OTP`,
            html: htmlContent,
        };

        logger.info("Starting database transaction to save OTP and send email");
        await sequelize.transaction(async (transaction) => {
            await saveOTPToDatabase(user.id, otp, transaction, logger);
            logger.info("OTP successfully saved to database");

            await sendOTPEmail(mailOptions, email, logger);
            logger.info("OTP email sent successfully via email service");
        });

        logger.info("Database transaction committed successfully");
    } catch (error) {
        if (error instanceof AppError) throw error;

        logger.error(
            "An unexpected error occurred in requestPasswordReset service",
            {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    code: error.code,
                },
            },
        );

        if (error.code && error.code.startsWith("E")) {
            throw new AppError(
                "Gagal mengirimkan email verifikasi.",
                502,
                "EMAIL_SERVICE_ERROR",
            );
        }

        throw new AppError(
            "Terjadi kesalahan internal.",
            500,
            "INTERNAL_SERVER_ERROR",
        );
    }
};

export const resetPasswordHandler = async (
    user,
    newPassword,
    inputTokenRaw,
    logger,
) => {
    try {
        logger.info("Password reset handling process started in service");

        const tokenRecords = await ResetToken.findAll({
            where: {
                userId: user.id,
                expiresAt: { [Op.gt]: new Date() },
            },
        });

        if (!tokenRecords || tokenRecords.length === 0) {
            logger.warn(
                "Password reset failed: No active/unexpired reset tokens found for user",
            );
            throw new AppError(
                "Token reset tidak valid atau telah kedaluwarsa.",
                400,
                "INVALID_TOKEN",
            );
        }

        logger.info(
            `Found ${tokenRecords.length} active candidate token(s). Starting comparison.`,
        );

        let matchedData = null;

        for (const dataRow of tokenRecords) {
            const isMatch = await bcrypt.compare(inputTokenRaw, dataRow.token);
            if (isMatch) {
                matchedData = dataRow;
                break;
            }
        }

        if (!matchedData) {
            logger.warn(
                "Password reset failed: Provided token did not match any stored hash",
            );
            throw new AppError(
                "Token reset tidak valid.",
                400,
                "INVALID_TOKEN",
            );
        }

        logger.info(
            "Reset token matched successfully. Proceeding to update password.",
        );

        const hashedNewPassword = await bcrypt.hash(
            newPassword,
            BCRYPT_SALT_ROUDS,
        );

        await sequelize.transaction(async (t) => {
            await User.update(
                { password: hashedNewPassword },
                { where: { id: user.id }, transaction: t },
            );
            logger.info("User password updated successfully");

            await ResetToken.destroy({
                where: { userId: user.id },
                transaction: t,
            });
            logger.info(
                "All reset tokens for the user have been destroyed/invalidated",
            );
        });

        logger.info(
            "Database transaction for password reset committed successfully",
        );

        return true;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        logger.error(
            "An unexpected error occurred in resetPasswordHandler service",
            {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            },
        );

        throw new AppError(
            "Gagal mereset password karena masalah internal.",
            500,
            "INTERNAL_SERVER_ERROR",
        );
    }
};
