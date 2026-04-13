import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { accessTokenValidator } from "../middleware/tokenValidator.middleware.js";
import {
    eventViewer,
    createEvent,
    deleteEvent,
    createFeedback,
    editEvent,
    rejectEvent,
    approveEvent,
} from "../controller/event.controller.js";
import { authenticateBlacklistedToken } from "../middleware/auth.middleware.js";
import { roleValidator } from "../middleware/permission.middleware.js";
import { schemaValidator } from "../middleware/schemaValidator.middleware.js";
import {
    createEventSchema,
    updateEventSchema,
    feedbackSchema,
    eventParamsSchema,
} from "../validator/event.validator.js";
import uploadPoster from "../middleware/uploadPoster.middleware.js";
import handleMulter from "../middleware/handleMulter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { ACCESS_JWT_SECRET } = process.env;
const router = express.Router();

// Basic CRUD

/**
 * @openapi
 * /event:
 *   get:
 *     tags:
 *       - Events
 *     summary: Melihat daftar event
 *     description: Mengambil daftar event. Respon akan berbeda tergantung role pengguna (public akan melihat event terkategori, admin/super_admin akan melihat semua event dengan paginasi).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman (hanya untuk admin/super_admin).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah item per halaman (hanya untuk admin/super_admin).
 *     responses:
 *       200:
 *         description: Berhasil mengambil data event.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   description: Berisi array event atau objek paginasi.
 *       401:
 *         description: Unauthorized (Token tidak valid atau tidak ada).
 *       403:
 *         description: Forbidden (Role tidak diizinkan atau token di-blacklist).
 */
router.get(
    "/",
    accessTokenValidator(ACCESS_JWT_SECRET, { isOptional: true }),
    authenticateBlacklistedToken,
    eventViewer,
);

/**
 * @openapi
 * /event:
 *   post:
 *     tags:
 *       - Events
 *     summary: Membuat event baru (hanya Admin)
 *     description: Membuat event baru. Request ini membutuhkan otorisasi sebagai 'admin' dan mengirimkan data dalam format multipart/form-data. Event yang dibuat akan berstatus 'pending'.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - eventName
 *               - date
 *               - startTime
 *               - endTime
 *               - location
 *               - image
 *             properties:
 *               eventName:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *                 description: "Format YYYY-MM-DD"
 *               startTime:
 *                 type: string
 *                 example: "14:00"
 *               endTime:
 *                 type: string
 *                 example: "16:00"
 *               location:
 *                 type: string
 *               speaker:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: File poster event (JPG, PNG, WEBP, max 10MB).
 *     responses:
 *       200:
 *         description: Event berhasil dibuat dan sedang menunggu approval.
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
 *                   example: Event Successly Created
 *       400:
 *         description: "Bad Request (misal: ukuran file terlalu besar)."
 *       401:
 *         description: Unauthorized atau data tidak valid.
 *       403:
 *         description: Forbidden (hanya role 'admin' yang diizinkan).
 */
router.post(
    "/",
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    roleValidator("admin"),
    handleMulter(uploadPoster.single("image")),
    schemaValidator({ body: createEventSchema }),
    createEvent,
);

/**
 * @openapi
 * /event/{eventId}:
 *   patch:
 *     tags:
 *       - Events
 *     summary: Mengedit event (hanya Admin)
 *     description: Mengedit detail event yang sudah ada. Hanya admin yang membuat event tersebut yang bisa mengeditnya. Setelah diedit, status event akan kembali menjadi 'pending'.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID dari event yang akan diedit.
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 example: "14:30"
 *               endTime:
 *                 type: string
 *                 example: "16:30"
 *               location:
 *                 type: string
 *               speaker:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: File poster baru (opsional).
 *     responses:
 *       200:
 *         description: Event berhasil diperbarui.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: "string", example: "success" }
 *                 message: { type: "string", example: "Event berhasil diperbarui." }
 *       401:
 *         description: Unauthorized atau data tidak valid.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Event tidak ditemukan atau Anda tidak berhak mengubahnya.
 */
router.patch(
    "/:eventId",
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    roleValidator("admin"),
    handleMulter(uploadPoster.single("image")),
    schemaValidator({
        params: eventParamsSchema,
        body: updateEventSchema,
    }),
    editEvent,
);

/**
 * @openapi
 * /event/{eventId}:
 *   delete:
 *     tags:
 *       - Events
 *     summary: Menghapus event (hanya Admin)
 *     description: Menghapus event secara permanen. Hanya admin yang membuat event yang bisa menghapusnya.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID dari event yang akan dihapus.
 *     responses:
 *       200:
 *         description: Event berhasil dihapus.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: "string", example: "success" }
 *                 message: { type: "string", example: "Event Successly Deleted" }
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (bukan role 'admin').
 *       404:
 *         description: Event tidak ditemukan atau Anda tidak berhak menghapusnya.
 */
router.delete(
    "/:eventId",
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    roleValidator("admin"),
    schemaValidator({ params: eventParamsSchema }),
    deleteEvent,
);

// Event Management Actions
/**
 * @openapi
 * /event/{eventId}/approve:
 *   post:
 *     tags:
 *       - Event Management
 *     summary: Menyetujui event (hanya Super Admin)
 *     description: Mengubah status event dari 'pending' atau 'revised' menjadi 'approved'. Membutuhkan otorisasi sebagai 'super_admin'.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID dari event yang akan disetujui.
 *     responses:
 *       200:
 *         description: Event berhasil disetujui.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: "string", example: "success" }
 *                 message: { type: "string", example: "Event berhasil disetujui." }
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden (bukan role 'super_admin').
 *       404:
 *         description: Event tidak ditemukan atau statusnya tidak lagi 'pending'/'revised'.
 */
router.post(
    "/:eventId/approve",
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    roleValidator("super_admin"),
    schemaValidator({ params: eventParamsSchema }),
    approveEvent,
);

/**
 * @openapi
 * /event/{eventId}/reject:
 *   post:
 *     tags:
 *       - Event Management
 *     summary: Menolak event (hanya Super Admin)
 *     description: Mengubah status event menjadi 'rejected'. Super admin harus menyertakan alasan penolakan dalam body request.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID dari event yang akan ditolak.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feedback
 *             properties:
 *               feedback:
 *                 type: string
 *                 description: Alasan mengapa event ditolak.
 *                 example: "Poster acara tidak sesuai standar."
 *     responses:
 *       200:
 *         description: Event berhasil ditolak.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: "string", example: "success" }
 *                 message: { type: "string", example: "Event berhasil ditolak." }
 *       401:
 *         description: Unauthorized atau data tidak valid.
 *       403:
 *         description: Forbidden (bukan role 'super_admin').
 *       404:
 *         description: Event tidak ditemukan.
 */
router.post(
    "/:eventId/reject",
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    roleValidator("super_admin"),
    schemaValidator({ params: eventParamsSchema, body: feedbackSchema }),
    rejectEvent,
);

/**
 * @openapi
 * /event/{eventId}/feedback:
 *   post:
 *     tags:
 *       - Event Management
 *     summary: Memberikan feedback revisi (hanya Super Admin)
 *     description: Mengubah status event menjadi 'revised' dan mengirimkan feedback kepada admin pembuat event.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID dari event yang akan diberi feedback.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Feedback'
 *     responses:
 *       201:
 *         description: Feedback berhasil dikirim dan status event diubah menjadi 'revised'.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: "string", example: "success" }
 *                 message: { type: "string", example: "Feedback berhasil dikirim." }
 *       401:
 *         description: Unauthorized atau data tidak valid.
 *       403:
 *         description: Forbidden (bukan role 'super_admin').
 *       404:
 *         description: Event tidak ditemukan.
 */
router.post(
    "/:eventId/feedback",
    accessTokenValidator(ACCESS_JWT_SECRET),
    authenticateBlacklistedToken,
    roleValidator("super_admin"),
    schemaValidator({
        params: eventParamsSchema,
        body: feedbackSchema,
    }),
    createFeedback,
);

export default router;
