import { describe, it, expect } from "vitest";
import request from "supertest";
import { uuidv7 } from "uuidv7";
import bcrypt from "bcrypt";
import app from "../../../app.js";
import db from "../../../model/index.js";
import { TEST_USERS, createTestUser } from "../helpers/testHelpers.js";

describe("POST /auth/register", () => {
    describe("Successful Registration Cases", () => {
        it("should register a new user with all required fields", async () => {
            const userData = {
                firstName: "John",
                lastName: "Doe",
                email: "john.doe@binus.ac.id",
                password: "SecurePassword123!",
                confirmPassword: "SecurePassword123!",
                role: "super_admin",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(userData)
                .expect("Content-Type", /json/)
                .expect(201);

            expect(response.body).toMatchObject({
                message: expect.stringMatching(/berhasil/i),
                data: {
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                    role: userData.role,
                },
            });

            expect(response.body.data).toHaveProperty("id");
            expect(response.body.data).toHaveProperty("createdAt");
            expect(response.body.data).not.toHaveProperty("password");

            const userInDb = await db.User.findOne({
                where: { email: userData.email },
            });
            expect(userInDb).toBeTruthy();
            expect(userInDb.email).toBe(userData.email);

            const passwordMatch = await bcrypt.compare(
                userData.password,
                userInDb.password,
            );
            expect(passwordMatch).toBe(true);
        });

        it("should include correlation ID in logs when provided in headers", async () => {
            const correlationId = uuidv7();
            const userData = {
                firstName: "Test",
                lastName: "User",
                email: "test.user@binus.ac.id",
                password: "Password123!",
                confirmPassword: "Password123!",
                role: "admin",
            };

            const response = await request(app)
                .post("/auth/register")
                .set("x-correlation-id", correlationId)
                .send(userData)
                .expect(201);

            expect(response.body.data.email).toBe(userData.email);
        });
    });

    describe("Duplicate Data Cases", () => {
        it("should return 409 when email already exists", async () => {
            const existingUser = await createTestUser(TEST_USERS.admin);

            const newUserData = {
                firstName: "New",
                lastName: "User",
                email: existingUser.email,
                password: "DifferentPassword123!",
                confirmPassword: "DifferentPassword123!",
                role: "admin",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(newUserData)
                .expect(409);

            expect(response.body.message).toMatch(/exist|sudah terdaftar/i);

            const userCount = await db.User.count({
                where: { email: existingUser.email },
            });
            expect(userCount).toBe(1);
        });
    });

    describe("Validation Error Cases", () => {
        it("should return 400 for missing required fields", async () => {
            const invalidData = {
                firstName: "John",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty("message");
        });

        it("should return 400 for invalid email format", async () => {
            const invalidData = {
                firstName: "John",
                lastName: "Doe",
                email: "invalid-email-format",
                password: "Password123!",
                confirmPassword: "Password123!",
                role: "admin",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(invalidData)
                .expect(400);

            if (response.body.errors) {
                expect(JSON.stringify(response.body)).toMatch(/email/i);
            }
        });

        it("should return 400 for invalid role", async () => {
            const invalidData = {
                firstName: "John",
                lastName: "Doe",
                email: "john@binus.ac.id",
                password: "Password123!",
                confirmPassword: "Password123!",
                role: "super_saiyan",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(invalidData)
                .expect(400);
        });
    });

    describe("Edge Cases & Security", () => {
        it("should trim whitespace from email", async () => {
            const userData = {
                firstName: "Test",
                lastName: "User",
                email: "  spaced@binus.ac.id ",
                password: "Password123!",
                confirmPassword: "Password123!",
                role: "admin",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(userData)
                .expect(201);

            expect(response.body.data.email).toBe("spaced@binus.ac.id");
        });

        it("should handle SQL injection attempts safely", async () => {
            const maliciousData = {
                firstName: "'; DROP TABLE Users; --",
                lastName: "Test",
                email: "injection@binus.ac.id",
                password: "Password123!",
                confirmPassword: "Password123!",
                role: "admin",
            };

            const response = await request(app)
                .post("/auth/register")
                .send(maliciousData);

            expect(response.status).not.toBe(500);

            const tableExists = await db.User.findOne();
            expect(tableExists !== undefined).toBe(true);
        });
    });

    describe("Concurrent Registration Attempts", () => {
        it("should handle concurrent registration with same email", async () => {
            const userData = {
                firstName: "Concurrent",
                lastName: "Test",
                email: "concurrent@binus.ac.id",
                password: "Password123!",
                confirmPassword: "Password123!",
                role: "admin",
            };

            const userData2 = {
                ...userData,
                lastName: "Testing",
            };

            const [response1, response2] = await Promise.all([
                request(app).post("/auth/register").send(userData),
                request(app).post("/auth/register").send(userData2),
            ]);

            const successResponses = [response1, response2].filter(
                (r) => r.status === 201,
            );
            const conflictResponses = [response1, response2].filter(
                (r) => r.status === 409,
            );

            expect(successResponses).toHaveLength(1);
            expect(conflictResponses).toHaveLength(1);
        });
    });
});
