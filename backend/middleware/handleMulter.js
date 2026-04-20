import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";

const handleMulter = (multerMiddleware) => {
    return (req, res, next) => {
        const { correlationId } = req;

        multerMiddleware(req, res, (err) => {
            if (!err) return next();

            const errorLogContext = {
                correlationId,
                source: "MulterErrorHandler",
                context: {
                    request: {
                        ip: req.ip,
                        method: req.method,
                        url: req.originalUrl,
                    },
                    multerError: {
                        code: err.code,
                        field: err.field,
                    },
                },
            };

            if (err.code === "LIMIT_FILE_SIZE") {
                logger.warn(
                    "File upload rejected: File too large",
                    errorLogContext,
                );
                return next(
                    new AppError(
                        "Ukuran file terlalu besar. Maksimal 2MB.",
                        400,
                        "FILE_TOO_LARGE",
                    ),
                );
            }

            if (err.code === "LIMIT_UNEXPECTED_FILE") {
                logger.warn(
                    "File upload rejected: Unexpected file field",
                    errorLogContext,
                );
                return next(
                    new AppError(
                        "Terlalu banyak file atau nama field salah.",
                        400,
                        "UNEXPECTED_FILE_FIELD",
                    ),
                );
            }

            if (err instanceof AppError) {
                logger.warn(`File upload rejected: ${err.message}`, {
                    ...errorLogContext,
                    context: {
                        ...errorLogContext.context,
                        validationError: err.message,
                    },
                });
                return next(err);
            }

            logger.error("An unexpected error occurred during file upload", {
                ...errorLogContext,
                error: { message: err.message, stack: err.stack },
            });
            return next(
                new AppError(
                    err.message || "Gagal mengupload file.",
                    500,
                    "FILE_UPLOAD_FAILED",
                ),
            );
        });
    };
};

export default handleMulter;
