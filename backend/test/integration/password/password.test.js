import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../../app.js";
import db from "../../../model/index.js";
import {
    TEST_USERS,
    createTestUser,
    createTestResetToken,
} from "../helpers/testHelpers.js";
import { sendOTPEmail } from "../../../utils/emailSender.js";

vi.mock("../../../utils/otpGenerator.js", () => ({
    generateOTP: vi.fn().mockReturnValue("123456"),
}));

vi.mock("../../../utils/emailSender.js", () => ({
    sendOTPEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../utils/logger.js", () => ({
    default: {
        child: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe("Password Reset Feature", () => {
    let testUser;

    beforeEach(async () => {
        const uniqueEmail = `admin.${Date.now()}@binus.ac.id`;
        const userData = { ...TEST_USERS.admin, email: uniqueEmail };
        testUser = await createTestUser(userData);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("POST /password/forgot-password", () => {
        it("should send OTP email and save hashed OTP to DB if email exists", async () => {
            const KNOWN_OTP = "123456";

            const response = await request(app)
                .post("/password/forgot-password")
                .send({
                    email: testUser.email,
                })
                .expect(200);

            expect(response.body).toMatchObject({
                message: "OTP sent to your email.",
            });

            expect(sendOTPEmail).toHaveBeenCalled();

            const otpRecord = await db.OTP.findOne({
                where: { userId: testUser.id },
                order: [["createdAt", "DESC"]],
            });

            expect(otpRecord).toBeDefined();

            expect(otpRecord.verifiedAt).toBeNull();
            expect(otpRecord.code.length).toBeGreaterThan(20);

            const isMatch = await bcrypt.compare(KNOWN_OTP, otpRecord.code);

            expect(isMatch).toBe(true);
        });
        it("should return 404 if email is not registered", async () => {
            const response = await request(app)
                .post("/password/forgot-password")
                .send({
                    email: "nonexistent@binus.ac.id",
                })
                .expect(404);

            expect(response.body).toMatchObject({
                message: "Email tidak terdaftar",
            });
        });

        describe("Validation Errors", () => {
            it("should reject request with invalid email format", async () => {
                const response = await request(app)
                    .post("/password/forgot-password")
                    .send({
                        email: "invalid-email-format",
                    })
                    .expect(400);

                expect(response.body).toHaveProperty("message");
            });

            it("should reject request with empty email", async () => {
                const response = await request(app)
                    .post("/password/forgot-password")
                    .send({
                        email: "",
                    })
                    .expect(400);
            });
        });

        describe("Rate Limiting", () => {
            it("should block requests after exceeding limit", async () => {
                const spamEmail = `spam.${Date.now()}@binus.ac.id`;

                for (let i = 0; i < 5; i++) {
                    await request(app)
                        .post("/password/forgot-password")
                        .send({ email: spamEmail })
                        .expect(404);
                }

                const response = await request(app)
                    .post("/password/forgot-password")
                    .send({ email: spamEmail })
                    .expect(429);

                expect(response.body).toMatchObject({
                    error: expect.stringContaining("Terlalu banyak permintaan"),
                });
            });
        });
    });

    const FIXED_OTP = "123456";
    describe("POST /password/verify-otp", () => {
        beforeEach(async () => {
            await request(app).post("/password/forgot-password").send({
                email: testUser.email,
            });
        });

        it("should verify OTP and return resetToken", async () => {
            const response = await request(app)
                .post("/password/verify-otp")
                .send({
                    email: testUser.email,
                    otp: FIXED_OTP,
                })
                .expect(200);

            expect(response.body).toMatchObject({
                status: "success",
                message: "OTP verified successfully",
            });

            expect(response.body).toHaveProperty("resetToken");
            expect(typeof response.body.resetToken).toBe("string");

            const otpRecord = await db.OTP.findOne({
                where: { userId: testUser.id },
                order: [["createdAt", "DESC"]],
            });

            expect(otpRecord.verifiedAt).not.toBeNull();
            expect(otpRecord.verifiedAt).toBeInstanceOf(Date);

            const tokenRecord = await db.ResetToken.findOne({
                where: { userId: testUser.id },
            });
            expect(tokenRecord).toBeDefined();
        });

        it("should reject invalid OTP", async () => {
            const response = await request(app)
                .post("/password/verify-otp")
                .send({
                    email: testUser.email,
                    otp: "000000",
                })
                .expect(400);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject OTP verification for non-existent user", async () => {
            await request(app)
                .post("/password/verify-otp")
                .send({
                    email: "ghost@binus.ac.id",
                    otp: "123456",
                })
                .expect(404);
        });
    });

    describe("POST /password/reset-password", () => {
        let rawResetToken;

        beforeEach(async () => {
            rawResetToken = await createTestResetToken(testUser.id);
        });

        it("should successfully reset password with valid token", async () => {
            const newPassword = "NewStrongPassword123!";

            const response = await request(app)
                .post("/password/reset-password")
                .send({
                    email: testUser.email,
                    password: newPassword,
                    resetToken: rawResetToken,
                })
                .expect(200);

            expect(response.body).toMatchObject({
                message: "Password reset successfully",
            });

            const updatedUser = await db.User.findByPk(testUser.id);
            const isMatch = await bcrypt.compare(
                newPassword,
                updatedUser.password,
            );
            expect(isMatch).toBe(true);

            const tokenRecord = await db.ResetToken.findOne({
                where: { userId: testUser.id },
            });
            expect(tokenRecord).toBeNull();
        });

        it("should reject reset request with invalid token", async () => {
            const response = await request(app)
                .post("/password/reset-password")
                .send({
                    email: testUser.email,
                    password: "NewPassword123!",
                    // ga ada di database, tapi valid sebagai format token
                    resetToken:
                        "kucingmakanikanasinbersamasamatapidibagiduadengankelincitidursor",
                })
                .expect(400);

            expect(response.body).toMatchObject({
                message: expect.stringMatching(/tidak /i),
            });
        });

        it("should reject reset request with invalid email", async () => {
            const response = await request(app)
                .post("/password/reset-password")
                .send({
                    email: "wronguser@binus.ac.id",
                    password: "NewPassword123!",
                    resetToken: rawResetToken,
                })
                .expect(404);
        });

        describe("Validation Errors", () => {
            it("should reject weak password", async () => {
                const response = await request(app)
                    .post("/password/reset-password")
                    .send({
                        email: testUser.email,
                        password: "123",
                        resetToken: rawResetToken,
                    })
                    .expect(400);

                expect(response.body).toHaveProperty("message");
            });
        });
    });

    describe("Correlation ID Tracking", () => {
        it("should process password reset with correlation ID", async () => {
            const correlationId = "test-reset-correlation-999";

            await request(app)
                .post("/password/forgot-password")
                .set("x-correlation-id", correlationId)
                .send({
                    email: testUser.email,
                })
                .expect(200);
        });
    });
});
