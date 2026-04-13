import Joi from "joi";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FIVE_MINUTES } from "../constant/time.constant.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const baseEventSchema = Joi.object({
    eventName: Joi.string().trim().min(3).max(150).messages({
        "string.base": "Nama event harus berupa teks.",
        "string.empty": "Nama event tidak boleh kosong.",
        "string.min": "Nama event minimal 3 karakter.",
        "string.max": "Nama event maksimal 150 karakter.",
    }),

    startTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .messages({
            "string.base": "Waktu mulai event harus berupa teks.",
            "string.empty": "Waktu mulai event tidak boleh kosong.",
            "string.pattern.base":
                "Format waktu mulai tidak valid. Gunakan format HH:MM (misal: 14:30).",
        }),

    endTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .custom((value, helpers) => {
            const data = helpers.state.ancestors[0] || {};
            const { startTime } = data;

            if (!startTime || !value) {
                return value;
            }

            const [startHour, startMinute] = startTime.split(":").map(Number);
            const [endHour, endMinute] = value.split(":").map(Number);

            const startTotalMinutes = startHour * 60 + startMinute;
            const endTotalMinutes = endHour * 60 + endMinute;

            if (endTotalMinutes <= startTotalMinutes) {
                return helpers.error("time.endBeforeStart");
            }

            const durationMinutes = endTotalMinutes - startTotalMinutes;
            if (durationMinutes < 15) {
                return helpers.error("time.durationTooShort");
            }

            if (durationMinutes > 720) {
                return helpers.error("time.durationTooLong");
            }

            return value;
        })
        .messages({
            "string.base": "Waktu selesai event harus berupa teks.",
            "string.empty": "Waktu selesai event tidak boleh kosong.",
            "string.pattern.base":
                "Format waktu selesai tidak valid. Gunakan format HH:MM (misal: 16:30).",
            "time.endBeforeStart":
                "Waktu selesai harus lebih besar dari waktu mulai.",
            "time.durationTooShort": "Durasi event minimal 15 menit.",
            "time.durationTooLong": "Durasi event maksimal 12 jam.",
        }),

    date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}\.\d{3}Z)?$/)
        .custom((value, helpers) => {
            const data = helpers.state.ancestors[0] || {};
            const { startTime, endTime } = data;

            const eventDate = new Date(value);
            if (isNaN(eventDate.getTime())) {
                return helpers.error("date.invalid");
            }

            if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
                const [hours, minutes] = startTime.split(":").map(Number);
                const eventStartDateTime = new Date(eventDate);
                eventStartDateTime.setHours(hours, minutes, 0, 0);

                const now = new Date();
                const fiveMinutesFromNow = new Date(
                    now.getTime() + FIVE_MINUTES,
                );

                if (eventStartDateTime <= fiveMinutesFromNow) {
                    return helpers.error("datetime.past");
                }
            }

            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

            if (eventDate > oneYearFromNow) {
                return helpers.error("date.tooFarFuture");
            }

            return value;
        })
        .messages({
            "string.base": "Tanggal event harus berupa teks.",
            "string.empty": "Tanggal event tidak boleh kosong.",
            "string.pattern.base": "Format tanggal harus ISO (YYYY-MM-DD).",
            "date.invalid": "Tanggal tidak valid.",
            "datetime.past":
                "Tanggal dan waktu event tidak boleh di masa lalu.",
            "date.tooFarFuture":
                "Tanggal event tidak boleh lebih dari 1 tahun ke depan.",
        }),

    location: Joi.string().trim().min(5).max(100).messages({
        "string.base": "Lokasi event harus berupa teks.",
        "string.empty": "Lokasi event tidak boleh kosong.",
        "string.min": "Lokasi event minimal 5 karakter.",
        "string.max": "Lokasi event maksimal 100 karakter.",
    }),

    speaker: Joi.string().trim().min(3).max(100).messages({
        "string.base": "Nama speaker harus berupa teks.",
        "string.empty": "Nama speaker tidak boleh kosong.",
        "string.min": "Nama speaker minimal 3 karakter.",
        "string.max": "Nama speaker maksimal 100 karakter.",
    }),

    description: Joi.string().trim().max(5000).messages({
        "string.base": "Deskripsi event harus berupa teks.",
        "string.max": "Deskripsi event tidak boleh lebih dari 5,000 karakter.",
    }),

    image: Joi.object({
        fieldname: Joi.string().required(),
        originalname: Joi.string().required(),
        encoding: Joi.string().required(),
        mimetype: Joi.string()
            .valid(
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/gif",
                "image/webp",
            )
            .required()
            .messages({
                "any.only": "Tipe file harus JPEG, JPG, PNG, GIF, atau WebP.",
            }),
        size: Joi.number()
            .min(1024)
            .max(10 * 1024 * 1024)
            .required()
            .messages({
                "number.min": "Ukuran gambar minimal 1KB.",
                "number.max": "Ukuran gambar tidak boleh melebihi 10MB.",
            }),
        buffer: Joi.binary().required(),
    })
        .messages({
            "object.base": "Format gambar tidak valid.",
        })
        .unknown(true),
})
    .custom((value, helpers) => {
        const { startTime, endTime, date } = value;

        if (startTime && endTime && date) {
            try {
                const [startHour, startMinute] = startTime
                    .split(":")
                    .map(Number);
                const [endHour, endMinute] = endTime.split(":").map(Number);

                const eventDate = new Date(date);
                const startDateTime = new Date(eventDate);
                const endDateTime = new Date(eventDate);

                startDateTime.setHours(startHour, startMinute, 0, 0);
                endDateTime.setHours(endHour, endMinute, 0, 0);

                if (endDateTime <= startDateTime) {
                    return helpers.error("schema.timeLogicError");
                }

                const now = new Date();
                if (startDateTime <= now) {
                    return helpers.error("schema.eventInPast");
                }
            } catch (error) {
                return helpers.error("schema.dateTimeParseError");
            }
        }

        return value;
    })
    .messages({
        "schema.timeLogicError":
            "Terjadi kesalahan logika waktu. Pastikan waktu selesai lebih besar dari waktu mulai.",
        "schema.eventInPast": "Event tidak boleh dijadwalkan di masa lalu.",
        "schema.dateTimeParseError":
            "Terjadi kesalahan dalam memproses tanggal dan waktu.",
    });

export const createEventSchema = baseEventSchema.keys({
    eventName: baseEventSchema.extract("eventName").required().messages({
        "any.required": "Nama event wajib diisi.",
    }),
    description: baseEventSchema.extract("description").required().messages({
        "any.required": "Deksripsi event tidak boleh kosong.",
    }),
    startTime: baseEventSchema.extract("startTime").required().messages({
        "any.required": "Waktu mulai event wajib diisi.",
    }),
    endTime: baseEventSchema.extract("endTime").required().messages({
        "any.required": "Waktu selesai event wajib diisi.",
    }),
    date: baseEventSchema.extract("date").required().messages({
        "any.required": "Tanggal event wajib diisi..",
    }),
    location: baseEventSchema.extract("location").required().messages({
        "any.required": "Lokasi event wajib diisi.",
    }),
    image: baseEventSchema.extract("image").required().messages({
        "any.required": "Poster event wajib diisi.",
    }),
});

export const updateEventSchema = baseEventSchema;

const uuidV7Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const eventParamsSchema = Joi.object({
    eventId: Joi.string().pattern(uuidV7Regex).required().messages({
        "string.pattern.base": "Parameter 'eventId' tidak valid",
        "any.required": "Parameter 'eventId' wajib diisi",
    }),
});

export const feedbackSchema = Joi.object({
    feedback: Joi.string().trim().min(1).max(1000).required(),
});
