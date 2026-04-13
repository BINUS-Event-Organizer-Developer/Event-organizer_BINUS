import jwt from "jsonwebtoken";
import { uuidv7 } from "uuidv7";
import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";

export function parseAndVerifyToken({
    token,
    type,
    secretKey,
    ignoreExpiration = false,
}) {
    if (!token) {
        const errorCode =
            {
                accessToken: "ACCESS_TOKEN_MISSING",
                refreshToken: "REFRESH_TOKEN_MISSING",
            }[type] || "NO_AUTH_TOKEN";

        throw new AppError("Silahkan login terlebih dahulu.", 401, errorCode);
    }

    try {
        return jwt.verify(token, secretKey, { ignoreExpiration });
    } catch (error) {
        let errorMessage = "Token tidak valid.";
        if (error.name === "TokenExpiredError") {
            errorMessage = "Token kadaluarsa. Silakan login kembali.";
        } else if (error.name === "JsonWebTokenError") {
            errorMessage = "Token tidak valid atau format salah.";
        }
        throw new AppError(errorMessage, 401, "TOKEN_VALIDATION_ERROR");
    }
}

export const accessTokenValidator = (secretKey, options = {}) => {
    return (req, res, next) => {
        const correlationId =
            req.correlationId || req.headers["x-correlation-id"] || uuidv7();
        req.correlationId = correlationId;

        try {
            const authHeader = req.headers?.authorization;
            const accessToken = authHeader?.startsWith("Bearer ")
                ? authHeader.substring(7)
                : null;

            req.rawAccessToken = accessToken;

            if (!accessToken && options.isOptional) {
                req.user = null;
                return next();
            }

            const decoded = parseAndVerifyToken({
                token: accessToken,
                type: "accessToken",
                secretKey,
                ignoreExpiration: options.ignoreExpiration,
            });

            req.user = decoded;
            next();
        } catch (error) {
            logger.warn("Access token validation failed", {
                correlationId,
                source: "AccessTokenValidator",
                context: {
                    request: {
                        ip: req.ip,
                        method: req.method,
                        url: req.originalUrl,
                    },
                    error: {
                        message: error.message,
                        errorCode: error.errorCode,
                        originalError: error.errorField?.originalError,
                    },
                },
            });

            if (options.failSilently) {
                req.user = null;
                return next();
            }

            next(error);
        }
    };
};

export const refreshTokenValidator = (secretKey) => {
    return (req, res, next) => {
        const correlationId =
            req.correlationId || req.headers["x-correlation-id"] || uuidv7();
        req.correlationId = correlationId;

        try {
            const refreshToken = req.cookies.refreshToken;
            const decoded = parseAndVerifyToken({
                token: refreshToken,
                type: "refreshToken",
                secretKey,
            });
            req.user = decoded;
            next();
        } catch (error) {
            logger.warn("Refresh token validation failed", {
                correlationId,
                source: "RefreshTokenValidator",
                context: {
                    request: {
                        ip: req.ip,
                        method: req.method,
                        url: req.originalUrl,
                    },
                    error: {
                        message: error.message,
                        errorCode: error.errorCode,
                        originalError: error.errorField?.originalError,
                    },
                },
            });
            next(error);
        }
    };
};
