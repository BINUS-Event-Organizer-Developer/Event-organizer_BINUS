import bcrypt from "bcrypt";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import getToken from "../utils/getToken.js";
import AppError from "../utils/AppError.js";
import { RefreshToken, ResetToken, BlacklistedToken } from "../model/index.js";
import { hashToken } from "../utils/hashing.js";
import {
    FIVE_MINUTES,
    FIFTEEN_MINUTES,
    SEVEN_DAYS,
} from "../constant/time.constant.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const saveNewRefreshToken = async (
    userId,
    newRefreshToken,
    deviceName,
    loginLogger,
) => {
    try {
        loginLogger.info("Starting process to save new refresh token");

        const hashedNewRefreshToken = hashToken(newRefreshToken);
        const userRefreshTokens = await RefreshToken.findAll({
            where: { ownerId: userId },
            order: [["expiresAt", "ASC"]],
        });
        loginLogger.info(
            `Found ${userRefreshTokens.length} existing token records for user`,
        );

        const revokedToken = userRefreshTokens.find(
            (token) => token.isRevoked === true,
        );

        const tokenData = {
            token: hashedNewRefreshToken,
            isRevoked: false,
            expiresAt: new Date(Date.now() + SEVEN_DAYS),
        };

        if (revokedToken) {
            loginLogger.info(
                "Reusing a previously revoked token record to save the new token",
                { tokenId: revokedToken.id },
            );
            await RefreshToken.update(tokenData, {
                where: { id: revokedToken.id },
            });
        } else if (userRefreshTokens.length < 3) {
            loginLogger.info("Creating a new refresh token record", {
                deviceName,
            });
            await RefreshToken.create({
                ...tokenData,
                ownerId: userId,
                device: deviceName,
            });
        } else {
            const oldestToken = userRefreshTokens[0];
            loginLogger.info(
                "Overwriting the oldest refresh token record (session limit reached)",
                { tokenId: oldestToken.id, deviceName },
            );
            await RefreshToken.update(tokenData, {
                where: { id: oldestToken.id },
            });
        }
    } catch (error) {
        loginLogger.error(
            "Failed to save new refresh token due to a system error",
            {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            },
        );

        throw new AppError(
            "Gagal menyimpan sesi login karena masalah internal.",
            500,
            "INTERNAL_SERVER_ERROR",
        );
    }
};

export const renewAccessToken = async (
    user,
    oldRefreshToken,
    refreshTokenLogger,
    deviceName,
) => {
    try {
        refreshTokenLogger.info("Searching for user's active refresh tokens");
        const hashedToken = hashToken(oldRefreshToken);

        const refreshTokenFromDB = await RefreshToken.findOne({
            where: { token: hashedToken },
        });

        if (!refreshTokenFromDB) {
            refreshTokenLogger.warn(
                "Token refresh failed: No active refresh tokens found in DB for user",
            );
            throw new AppError(
                "Sesi tidak valid. Silakan login kembali.",
                403,
                "REFRESH_TOKEN_NOT_FOUND",
            );
        }

        if (refreshTokenFromDB.isRevoked) {
            refreshTokenLogger.warn(
                "SECURITY ALERT: Attempt to reuse a revoked token!",
                {
                    userId: user.id,
                    tokenId: refreshTokenFromDB.id,
                },
            );

            await RefreshToken.update(
                { isRevoked: true },
                { where: { ownerId: user.id } },
            );

            throw new AppError(
                "Sesi terdeteksi ganda. Silakan login kembali demi keamanan.",
                403,
                "TOKEN_REUSE_DETECTED",
            );
        }

        if (refreshTokenFromDB.ownerId !== user.id) {
            refreshTokenLogger.warn("Token ownership mismatch");
            throw new AppError("Akses ditolak.", 403, "INVALID_TOKEN_OWNER");
        }

        if (new Date() > new Date(refreshTokenFromDB.expiresAt)) {
            refreshTokenLogger.warn("Token expired");
            throw new AppError(
                "Sesi berakhir. Silakan login kembali.",
                403,
                "REFRESH_TOKEN_EXPIRED",
            );
        }

        refreshTokenLogger.info(
            "Matching refresh token found. Proceeding to generate new tokens.",
        );

        const payload = { id: user.id, role: user.role };
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
            getToken(payload);
        refreshTokenLogger.info("New token pair generated successfully");

        const hashedNewRefreshToken = hashToken(newRefreshToken);
        await RefreshToken.update(
            {
                token: hashedNewRefreshToken,
                expiresAt: new Date(Date.now() + SEVEN_DAYS),
                device: deviceName,
                isRevoked: false,
            },
            {
                where: { id: refreshTokenFromDB.id },
            },
        );
        refreshTokenLogger.info(
            "Successfully updated the refresh token record in database (token rotation)",
        );

        return { newAccessToken, newRefreshToken };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        refreshTokenLogger.error(
            "An unexpected error occurred in renewAccessToken service",
            {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            },
        );

        throw new AppError(
            "Gagal memperbarui token karena masalah internal.",
            500,
            "INTERNAL_SERVER_ERROR",
        );
    }
};

export const saveResetTokenToDatabase = async (user, resetToken) => {
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    await ResetToken.create({
        userId: user.id,
        token: hashedResetToken,
        expiresAt: Date.now() + FIVE_MINUTES,
    });
};

export const blacklistAccessToken = async (
    accessTokenFromUser,
    userId,
    logoutLogger,
) => {
    try {
        let expiresAt;
        try {
            const decoded = jwt.decode(accessTokenFromUser);
            expiresAt = decoded?.exp
                ? new Date(decoded.exp * 1000)
                : new Date(Date.now() + FIFTEEN_MINUTES);
        } catch {
            expiresAt = new Date(Date.now() + FIFTEEN_MINUTES);
        }

        if (expiresAt > new Date()) {
            await BlacklistedToken.create({
                token: accessTokenFromUser,
                userId,
                reason: "logout",
                expiresAt,
            });
            logoutLogger.info("Access token successfully added to blacklist");
        } else {
            logoutLogger.info(
                "Skipping blacklist: Access token already expired",
            );
        }
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        logoutLogger.error("Failed to blacklist access token", {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
        });
    }
};

export const revokeRefreshToken = async (
    refreshTokenFromUser,
    userId,
    logoutLogger,
) => {
    if (!refreshTokenFromUser) {
        logoutLogger.info("Skipping revocation: No refresh token provided");
        return;
    }

    let finalUserId = userId;

    if (!finalUserId) {
        try {
            const decoded = jwt.decode(refreshTokenFromUser);
            if (
                decoded?.id &&
                ["string", "number"].includes(typeof decoded.id)
            ) {
                finalUserId = decoded.id;
            }
        } catch {
            logoutLogger.warn("Failed to extract userId from refresh token", {
                reason: "invalid_token_format",
            });
        }
    }

    try {
        logoutLogger.info("Initiating refresh token revocation (SHA-256)", {
            userId: finalUserId ?? "unknown",
            action: "revoke_start",
        });

        const tokenHash = hashToken(refreshTokenFromUser);

        const [updatedRows] = await RefreshToken.update(
            { isRevoked: true },
            { where: { token: tokenHash, isRevoked: false } },
        );

        if (updatedRows === 0) {
            logoutLogger.warn(
                "Revocation skipped: Token not found or already revoked",
                {
                    userId: finalUserId ?? "unknown",
                    reason: "token_not_found_or_already_revoked",
                },
            );
            return;
        }

        logoutLogger.info("Refresh token revoked successfully", {
            userId: finalUserId ?? "unknown",
            action: "revoke_success",
        });
    } catch (error) {
        const isAppError = error instanceof AppError;
        logoutLogger.error(
            isAppError
                ? "Application error during revocation"
                : "Unexpected error during revocation",
            {
                userId: finalUserId ?? "unknown",
                action: "revoke_error",
                errorType: error.constructor.name,
                errorMessage: error.message,
                errorStack: !isAppError ? error.stack : undefined,
            },
        );
    }
};
