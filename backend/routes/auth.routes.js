import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import {
    loginValidatorSchema,
    registerValidatorSchema,
} from "../validator/auth.validator.js";
import { schemaValidator } from "../middleware/schemaValidator.middleware.js";
import {
    accessTokenValidator,
    refreshTokenValidator,
} from "../middleware/tokenValidator.middleware.js";
import {
    register,
    login,
    logout,
    refreshAccessToken,
} from "../controller/auth.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { ACCESS_JWT_SECRET, REFRESH_JWT_SECRET } = process.env;
const router = express.Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Registrasi pengguna baru
 *     description: Mendaftarkan akun baru untuk admin, atau super_admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *               - confirmPassword
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, super_admin]
 *                 example: "admin"
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@binus.ac.id"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Minimal 8 karakter.
 *                 example: "password123"
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Harus sama dengan password.
 *                 example: "password123"
 *     responses:
 *       201:
 *         description: Pengguna berhasil dibuat.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "user Created"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Data tidak valid (Validation Error).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       500:
 *         description: Internal Server Error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/register",
    schemaValidator({ body: registerValidatorSchema }),
    register,
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login pengguna
 *     description: Mengautentikasi pengguna dan mengembalikan Access Token JWT serta Refresh Token dalam cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@binus.ac.id"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login berhasil.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=...; Path=/; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login Success !"
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 role:
 *                   type: string
 *                   enum: [admin, super_admin]
 *                 accessToken:
 *                   type: string
 *                   description: JWT Token untuk otorisasi request selanjutnya.
 *       401:
 *         description: Email atau password salah / Data tidak valid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", schemaValidator({ body: loginValidatorSchema }), login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout pengguna
 *     description: |
 *       Menghapus sesi pengguna. Proses ini akan:
 *       1. Mem-blacklist Access Token yang sedang digunakan agar tidak bisa dipakai lagi.
 *       2. Mencabut (revoke) Refresh Token di database.
 *       3. Menghapus cookie `refreshToken` dari browser client.
 *       Membutuhkan Access Token di header Authorization dan Refresh Token di cookie.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token yang didapat saat login.
 *     responses:
 *       200:
 *         description: Logout berhasil.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               description: Cookie refreshToken akan dihapus (di-set dengan max-age=0).
 *               example: refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout Successfully."
 *       401:
 *         description: Unauthorized. Access Token tidak valid, kadaluarsa, atau tidak ada.
 *       403:
 *         description: Forbidden. Access Token valid tapi sudah di-blacklist.
 *       404:
 *         description: Not Found. Refresh Token yang diberikan tidak ditemukan di database.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/logout",
    accessTokenValidator(ACCESS_JWT_SECRET, {
        ignoreExpiration: true,
        failSilently: true,
    }),
    logout,
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Memperbarui Access Token
 *     description: |
 *       Menggunakan `refreshToken` yang valid dari cookie untuk mendapatkan `accessToken` yang baru.
 *       Endpoint ini juga akan mengembalikan `refreshToken` yang baru di dalam cookie.
 *       **Penting:** Endpoint ini TIDAK memerlukan header `Authorization`.
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh token yang didapat saat login atau dari response refresh sebelumnya.
 *     responses:
 *       200:
 *         description: Access Token berhasil diperbarui.
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               description: Mengirim refreshToken yang baru.
 *               example: refreshToken=...; Path=/; HttpOnly; Secure; SameSite=Strict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Access Token Sent Successfully !"
 *                 accessToken:
 *                   type: string
 *                   description: Access Token JWT yang baru untuk digunakan pada request selanjutnya.
 *       401:
 *         description: Unauthorized. Refresh Token tidak valid, kadaluarsa, atau tidak ada.
 *       404:
 *         description: Not Found. Refresh Token yang diberikan tidak ditemukan di database.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/refresh",
    refreshTokenValidator(REFRESH_JWT_SECRET),
    refreshAccessToken,
);

export default router;
