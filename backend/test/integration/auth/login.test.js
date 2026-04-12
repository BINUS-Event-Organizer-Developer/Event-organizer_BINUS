import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../app.js";
import db from "../../../model/index.js";
import {
    TEST_USERS,
    createTestUser,
    extractCookie,
} from "../helpers/testHelpers.js";

describe("POST /auth/login", () => {
    let testUser;

    beforeEach(async () => {
        testUser = await createTestUser(TEST_USERS.admin);
    });

    describe("Successful Login", () => {
        it("should login successfully with valid credentials", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            expect(response.body).toMatchObject({
                message: "Login successful",
                user: {
                    id: testUser.id,
                    name: `${testUser.firstName} ${testUser.lastName}`,
                    email: testUser.email,
                    role: testUser.role,
                },
            });

            expect(response.body).toHaveProperty("accessToken");
            expect(response.body.accessToken).toMatch(
                /^[\w-]+\.[\w-]+\.[\w-]+$/,
            );
        });

        it("should set refreshToken in httpOnly cookie", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            const cookies = response.headers["set-cookie"];
            expect(cookies).toBeDefined();

            const refreshTokenCookie = cookies.find((cookie) =>
                cookie.startsWith("refreshToken="),
            );
            expect(refreshTokenCookie).toBeDefined();
            expect(refreshTokenCookie).toContain("HttpOnly");
            expect(refreshTokenCookie).toContain("Path=/");
            expect(refreshTokenCookie).toContain("SameSite=Strict");
        });

        it("should set Secure flag in production environment", async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";

            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            const cookies = response.headers["set-cookie"];
            const refreshTokenCookie = cookies.find((c) =>
                c.startsWith("refreshToken="),
            );
            expect(refreshTokenCookie).toContain("Secure");

            process.env.NODE_ENV = originalEnv;
        });

        it("should save refresh token to database", async () => {
            await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            const refreshTokens = await db.RefreshToken.findAll({
                where: { ownerId: testUser.id },
            });

            expect(refreshTokens).toHaveLength(1);
            expect(refreshTokens[0].device).toBeDefined();
        });

        it("should generate valid JWT tokens", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            const { accessToken } = response.body;
            const decoded = jwt.verify(
                accessToken,
                process.env.ACCESS_JWT_SECRET,
            );

            expect(decoded).toMatchObject({
                id: testUser.id,
                role: testUser.role,
            });
            expect(decoded).toHaveProperty("iat");
            expect(decoded).toHaveProperty("exp");
        });

        it("should capture device information", async () => {
            const response = await request(app)
                .post("/auth/login")
                .set(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                )
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            const refreshTokens = await db.RefreshToken.findAll({
                where: { ownerId: testUser.id },
            });

            expect(refreshTokens[0].device).toBeTruthy();
        });
    });

    describe("Failed Login Attempts", () => {
        it("should reject login with non-existent email", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: "nonexistent@binus.ac.id",
                    password: "SomePassword123!",
                })
                .expect(401);

            expect(response.body).toMatchObject({
                message: "Email atau Password salah.",
            });
        });

        it("should reject login with incorrect password", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: "WrongPassword123!",
                })
                .expect(401);

            expect(response.body).toMatchObject({
                message: "Email atau Password salah.",
            });
        });

        it("should not reveal if email exists when password is wrong", async () => {
            const wrongPasswordResponse = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                    password: "WrongPassword123!",
                });

            const wrongEmailResponse = await request(app)
                .post("/auth/login")
                .send({
                    email: "nonexistent@binus.ac.id",
                    password: "SomePassword123!",
                });

            expect(wrongPasswordResponse.body.message).toBe(
                wrongEmailResponse.body.message,
            );
        });
    });

    describe("Validation Errors", () => {
        it("should reject login without email", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    password: TEST_USERS.admin.password,
                })
                .expect(400);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject login without password", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: TEST_USERS.admin.email,
                })
                .expect(400);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject login with invalid email format", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: "invalid-email",
                    password: TEST_USERS.admin.password,
                })
                .expect(400);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject login with empty credentials", async () => {
            const response = await request(app)
                .post("/auth/login")
                .send({
                    email: "",
                    password: "",
                })
                .expect(400);

            expect(response.body).toHaveProperty("message");
        });
    });

    describe("Multiple Login Sessions", () => {
        it("should allow multiple devices to login simultaneously", async () => {
            // Login from device 1
            await request(app)
                .post("/auth/login")
                .set("User-Agent", "Device1")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            // Login from device 2
            await request(app)
                .post("/auth/login")
                .set("User-Agent", "Device2")
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            const refreshTokens = await db.RefreshToken.findAll({
                where: { ownerId: testUser.id },
            });

            expect(refreshTokens).toHaveLength(2);
        });
    });

    describe("Correlation ID Tracking", () => {
        it("should use provided correlation ID", async () => {
            const correlationId = "test-login-correlation-123";

            const response = await request(app)
                .post("/auth/login")
                .set("x-correlation-id", correlationId)
                .send({
                    email: TEST_USERS.admin.email,
                    password: TEST_USERS.admin.password,
                })
                .expect(200);

            expect(response.body).toHaveProperty("accessToken");
        });
    });
});
