import Joi from "joi";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const emailSchema = Joi.string()
    .trim()
    .lowercase()
    .max(150)
    .email({
        minDomainSegments: 2,
    })
    .pattern(/@(?:binus\.ac\.id|binus\.edu)$/)
    .required()
    .messages({
        "string.base": "Email harus berupa teks.",
        "string.empty": "Email tidak boleh kosong.",
        "string.email": "Format email tidak valid.",
        "string.max": "Email maksimal 255 karakter.",
        "string.pattern.base":
            "Email harus menggunakan domain @binus.ac.id atau @binus.edu",
        "any.required": "Email wajib diisi.",
    });

const passwordSchema = Joi.string().min(8).max(30).required().messages({
    "string.min": "Password minimal 8 karakter.",
    "string.max": "Password maksimal 30 karakter.",
    "string.empty": "Password tidak boleh kosong.",
    "any.required": "Password wajib diisi.",
});

const otpSchema = Joi.string().min(6).max(6).required().messages({
    "string.min": "OTP 6 karakter.",
    "string.max": "OTP 6 karakter.",
    "string.empty": "OTP tidak boleh kosong.",
    "any.required": "OTP wajib diisi.",
});

const resetTokenSchema = Joi.string().min(64).max(64).required().messages({
    "string.min": "Reset token tidak valid.",
    "string.max": "Reset token tidak valid.",
    "string.empty": "Reset token tidak boleh kosong.",
    "any.required": "Reset token wajib diisi.",
});

export const loginValidatorSchema = Joi.object({
    email: emailSchema,
    password: Joi.string().required().messages({
        "string.empty": "Password tidak boleh kosong.",
        "any.required": "Password wajib diisi.",
    }),
});

export const emailValidatorSchema = Joi.object({
    email: emailSchema,
});

export const passwordValidatorSchema = Joi.object({
    email: emailSchema,
    password: passwordSchema,
    resetToken: resetTokenSchema,
});

export const otpValidatorSchema = Joi.object({
    email: emailSchema,
    otp: otpSchema,
});

export const registerValidatorSchema = Joi.object({
    role: Joi.string().valid("admin", "super_admin").required().messages({
        "any.only": "Role hanya boleh berisi admin atau super_admin.",
        "any.required": "Role wajib diisi.",
    }),

    firstName: Joi.string().trim().min(1).max(100).required().messages({
        "string.min": "First name minimal 1 karakter.",
        "string.max": "First name maksimal 20 karakter.",
        "string.empty": "First name tidak boleh kosong.",
        "any.required": "First name wajib diisi.",
    }),

    lastName: Joi.string().trim().min(1).max(100).required().messages({
        "string.min": "Last name minimal 1 karakter.",
        "string.max": "Last name maksimal 20 karakter.",
        "string.empty": "Last name tidak boleh kosong.",
        "any.required": "Last name wajib diisi.",
    }),

    email: emailSchema,

    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .required()
        .messages({
            "string.min": "Password minimal 8 karakter.",
            "string.max": "Password maksimal 128 karakter.",
            "string.pattern.base":
                "Password harus mengandung minimal 1 huruf kecil, 1 huruf besar, dan 1 angka.",
            "string.empty": "Password tidak boleh kosong.",
            "any.required": "Password wajib diisi.",
        }),

    confirmPassword: Joi.string()
        .valid(Joi.ref("password"))
        .required()
        .messages({
            "any.only": "Konfirmasi password harus sama dengan password.",
            "any.required": "Konfirmasi password wajib diisi.",
        })
        .strip(),
});
