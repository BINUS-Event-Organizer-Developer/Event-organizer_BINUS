import AppError from "../utils/AppError.js";
import db from "../model/index.js";
import logger from "../utils/logger.js";

export const authenticateBlacklistedToken = async (req, res, next) => {
    const { correlationId, user } = req;
    const BlacklistedTokenModel = db.BlacklistedToken;

    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(" ")[1] : null;

    if (!user || !token) {
        return next();
    }

    try {
        const isBlacklisted = await BlacklistedTokenModel.findOne({
            where: { userId: user.id, token },
        });

        if (isBlacklisted) {
            logger.warn("Blacklisted token usage detected and blocked", {
                correlationId,
                source: "BlacklistAuthenticator",
                context: {
                    userId: user.id,
                    email: user.email,
                    request: {
                        ip: req.ip,
                        method: req.method,
                        url: req.originalUrl,
                    },
                },
            });

            throw new AppError(
                "Sesi Anda tidak lagi valid. Silakan login kembali.",
                403,
                "TOKEN_BLACKLISTED",
            );
        }
        next();
    } catch (error) {
        if (!(error instanceof AppError)) {
            logger.error(
                "Failed to check blacklisted token due to a system error",
                {
                    correlationId,
                    source: "BlacklistAuthenticator",
                    error: {
                        message: error.message,
                        stack: error.stack,
                    },
                },
            );
        }
        next(error);
    }
};
