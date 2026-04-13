import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { uuidv7 } from "uuidv7";

import { accessTokenValidator } from "../middleware/tokenValidator.middleware.js";
import {
    getNotification,
    markAsRead,
} from "../controller/notification.controller.js";
import { authenticateBlacklistedToken } from "../middleware/auth.middleware.js";
import { schemaValidator } from "../middleware/schemaValidator.middleware.js";
import { notificationParamsSchema } from "../validator/notification.validator.js";
import { ONE_MINUTE } from "../constant/time.constant.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
const { ACCESS_JWT_SECRET } = process.env;

export const notificationLimiter = rateLimit({
    windowMs: ONE_MINUTE,
    max: 30,
    message: {
        status: "fail",
        message: "Terlalu banyak request notifikasi, coba lagi dalam 1 menit.",
        errorCode: "TOO_MANY_REQUESTS",
    },
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req, res) => req.user?.id || ipKeyGenerator(req),

    handler: (req, res, next, options) => {
        const correlationId =
            req.correlationId || req.headers["x-correlation-id"] || uuidv7();
        req.correlationId = correlationId;

        logger.warn("Rate limit exceeded for notifications", {
            correlationId,
            source: "NotificationLimiter",
            context: {
                request: {
                    ip: req.ip,
                    method: req.method,
                    url: req.originalUrl,
                },
                limit: {
                    limit: options.limit,
                    windowMs: options.windowMs,
                },
                userId: req.user?.id || "unauthenticated",
            },
        });

        res.status(options.statusCode).json(options.message);
    },
    skipSuccessfulRequests: true,
});

const router = express.Router();

/**
 * @openapi
 * /notification:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Mendapatkan daftar notifikasi pengguna
 *     description: |
 *       Mengambil daftar notifikasi untuk pengguna yang sedang login, dengan sistem paginasi.
 *       Endpoint ini memiliki rate limit **30 request per menit**.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman yang ingin ditampilkan.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah notifikasi per halaman.
 *     responses:
 *       200:
 *         description: Berhasil mengambil daftar notifikasi.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalItems:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *       401:
 *         description: Unauthorized (Token tidak valid atau tidak ada).
 *       403:
 *         description: Forbidden (Token di-blacklist).
 *       429:
 *         description: Too Many Requests (Rate limit terlampaui).
 */
router.get(
    "/",
    notificationLimiter,
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    getNotification,
);

/**
 * @openapi
 * /notification/{notificationId}/read:
 *   patch:
 *     tags:
 *       - Notifications
 *     summary: Menandai notifikasi sebagai sudah dibaca
 *     description: |
 *       Mengubah status `isRead` dari sebuah notifikasi menjadi `true`.
 *       Endpoint ini memiliki rate limit **30 request per menit**.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID dari notifikasi yang akan ditandai.
 *     responses:
 *       200:
 *         description: Notifikasi berhasil ditandai sebagai sudah dibaca.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Notification successfully marked as read
 *       401:
 *         description: Unauthorized atau parameter tidak valid.
 *       403:
 *         description: Forbidden (Token di-blacklist).
 *       404:
 *         description: Notifikasi tidak ditemukan atau bukan milik pengguna.
 *       429:
 *         description: Too Many Requests (Rate limit terlampaui).
 */
router.patch(
    "/:notificationId/read",
    notificationLimiter,
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    schemaValidator({ params: notificationParamsSchema }),
    markAsRead,
);

export default router;
