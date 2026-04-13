import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import {
    emailValidatorSchema,
    passwordValidatorSchema,
    otpValidatorSchema,
} from "../validator/auth.validator.js";
import { schemaValidator } from "../middleware/schemaValidator.middleware.js";
import {
    forgotPassword,
    verifyOTP,
    resetPassword,
} from "../controller/password.controller.js";
import {
    forgotPasswordLimiter,
    otpVerificationLimiter,
    resetPasswordLimiter,
} from "../middleware/limiter/password.limiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const router = express.Router();

/**
 * @openapi
 * /password/forgot-password:
 *   post:
 *     tags:
 *       - Password Reset
 *     summary: Memulai proses reset password (Langkah 1)
 *     description: |
 *       Mengirimkan email yang berisi kode OTP ke alamat email pengguna yang terdaftar.
 *       Ini adalah langkah pertama dalam alur reset password.
 *       Endpoint ini memiliki rate limit **5 request per 15 menit** per email/IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@binus.ac.id"
 *     responses:
 *       200:
 *         description: Permintaan berhasil, email berisi OTP telah dikirim.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent to email"
 *       401:
 *         description: Data tidak valid (Validation Error).
 *       404:
 *         description: Email yang dimasukkan tidak terdaftar di sistem.
 *       429:
 *         description: Terlalu banyak permintaan reset password.
 *       502:
 *         description: Gagal mengirimkan email (Email Service Error).
 */
router.post(
    "/forgot-password",
    forgotPasswordLimiter,
    schemaValidator({ body: emailValidatorSchema }),
    forgotPassword,
);

/**
 * @openapi
 * /password/verify-otp:
 *   post:
 *     tags:
 *       - Password Reset
 *     summary: Memverifikasi kode OTP (Langkah 2)
 *     description: |
 *       Memvalidasi kode OTP yang diterima pengguna melalui email.
 *       Jika OTP valid, endpoint ini akan mengembalikan `resetToken` yang akan digunakan pada langkah selanjutnya.
 *       Endpoint ini memiliki rate limit **5 percobaan per 5 menit** per email/IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@binus.ac.id"
 *               otp:
 *                 type: string
 *                 description: Kode OTP 6 digit.
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP berhasil diverifikasi.
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
 *                   example: "OTP verified successfully"
 *                 resetToken:
 *                   type: string
 *                   description: Token yang harus digunakan untuk me-reset password.
 *       401:
 *         description: OTP tidak valid, kadaluarsa, atau percobaan sudah maksimal.
 *       404:
 *         description: Email tidak terdaftar.
 *       429:
 *         description: Terlalu banyak percobaan verifikasi OTP.
 */
router.post(
    "/verify-otp",
    otpVerificationLimiter,
    schemaValidator({ body: otpValidatorSchema }),
    verifyOTP,
);

/**
 * @openapi
 * /password/reset-password:
 *   post:
 *     tags:
 *       - Password Reset
 *     summary: Mengatur ulang password baru (Langkah 3)
 *     description: |
 *       Mengatur password baru untuk pengguna menggunakan `resetToken` yang didapat dari verifikasi OTP.
 *       Ini adalah langkah terakhir dalam alur reset password.
 *       Endpoint ini memiliki rate limit **3 percobaan per 10 menit** per `resetToken`/IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - resetToken
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@binus.ac.id"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Password baru, minimal 8 karakter.
 *                 example: "newStrongPassword123"
 *               resetToken:
 *                 type: string
 *                 description: Token yang didapat dari endpoint /verify-otp.
 *     responses:
 *       200:
 *         description: Password berhasil di-reset.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset successfully"
 *       401:
 *         description: Data tidak valid (Validation Error).
 *       403:
 *         description: Reset token tidak valid atau sudah kadaluarsa.
 *       404:
 *         description: Email tidak terdaftar.
 *       429:
 *         description: Terlalu banyak percobaan reset password.
 */
router.post(
    "/reset-password",
    resetPasswordLimiter,
    schemaValidator({ body: passwordValidatorSchema }),
    resetPassword,
);

export default router;
