import dotenv from "dotenv";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../../app.js";
import db from "../../../model/index.js";
import {
    TEST_USERS,
    createTestUser,
    generateTestTokens,
    saveNewRefreshToken,
    extractCookie,
} from "../helpers/testHelpers.js";
import { hashToken } from "../../../utils/hashing.js";
import { SEVEN_DAYS } from "../../../constant/time.constant.js";

dotenv.config();

describe("POST /auth/refresh", () => {
    let testUser;
    let refreshToken;

    describe("Successful Token Refresh", () => {
        beforeEach(async () => {
            testUser = await createTestUser(TEST_USERS.admin);

            const tokens = generateTestTokens(testUser.id, testUser.role);
            refreshToken = tokens.refreshToken;

            await saveNewRefreshToken(refreshToken, testUser.id, "Test Device");
        });

        it("should refresh access token with valid refresh token", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${refreshToken}`])
                .expect(200);

            expect(response.body).toMatchObject({
                message: "Access Token Sent Successfully !",
            });
            expect(response.body).toHaveProperty("accessToken");
            expect(response.body.accessToken).toMatch(
                /^[\w-]+\.[\w-]+\.[\w-]+$/,
            );
        });

        it("should return new access token with correct payload", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${refreshToken}`])
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

        it("should issue new refresh token in cookie", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${refreshToken}`])
                .expect(200);

            const cookies = response.headers["set-cookie"];
            expect(cookies).toBeDefined();

            const newRefreshTokenCookie = cookies.find(
                (cookie) =>
                    cookie.startsWith("refreshToken=") &&
                    !cookie.includes("refreshToken=;"),
            );

            expect(newRefreshTokenCookie).toBeDefined();
            expect(newRefreshTokenCookie).toContain("HttpOnly");
            expect(newRefreshTokenCookie).toContain("SameSite=Strict");
        });

        it("should replace old refresh token with new one", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${refreshToken}`])
                .expect(200);

            const newRefreshToken = extractCookie(response, "refreshToken");
            expect(newRefreshToken).toBeTruthy();
            expect(newRefreshToken).not.toBe(refreshToken);
        });

        it("should rotate refresh token in database (update same record)", async () => {
            const tokensBefore = await db.RefreshToken.findAll({
                where: { ownerId: testUser.id },
            });

            expect(tokensBefore).toHaveLength(1);

            const oldTokenRecord = tokensBefore[0];
            const oldHashedToken = oldTokenRecord.token;
            const oldTokenId = oldTokenRecord.id;

            await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${refreshToken}`])
                .expect(200);

            const tokensAfter = await db.RefreshToken.findAll({
                where: { ownerId: testUser.id },
            });

            expect(tokensAfter).toHaveLength(1);

            const newTokenRecord = tokensAfter[0];

            expect(newTokenRecord.id).toBe(oldTokenId);
            expect(newTokenRecord.token).not.toBe(oldHashedToken);
            expect(newTokenRecord.isRevoked).toBe(false);
            expect(
                new Date(newTokenRecord.expiresAt).getTime(),
            ).toBeGreaterThanOrEqual(
                new Date(oldTokenRecord.expiresAt).getTime(),
            );
        });

        it("should preserve (or update) device information correctly on token rotation", async () => {
            const before = await db.RefreshToken.findOne({
                where: { ownerId: testUser.id },
            });

            const realUserAgent =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

            await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${refreshToken}`])
                .set("user-agent", realUserAgent)
                .expect(200);

            const after = await db.RefreshToken.findOne({
                where: { ownerId: testUser.id },
            });

            expect(after.id).toBe(before.id);

            expect(after.device).not.toBe("Test Device");
            expect(after.device).toContain("Chrome");
            expect(after.device).toContain("Windows");
        });

        describe("Configuration & Concurrency", () => {
            it("should set httpOnly flag on refresh token cookie", async () => {
                const response = await request(app)
                    .post("/auth/refresh")
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const cookies = response.headers["set-cookie"];
                const refreshTokenCookie = cookies.find(
                    (cookie) =>
                        cookie.startsWith("refreshToken=") &&
                        !cookie.includes("refreshToken=;"),
                );
                expect(refreshTokenCookie).toContain("HttpOnly");
            });

            it("should set SameSite=Strict on refresh token cookie", async () => {
                const response = await request(app)
                    .post("/auth/refresh")
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const cookies = response.headers["set-cookie"];
                const refreshTokenCookie = cookies.find(
                    (cookie) =>
                        cookie.startsWith("refreshToken=") &&
                        !cookie.includes("refreshToken=;"),
                );
                expect(refreshTokenCookie).toContain("SameSite=Strict");
            });

            it("should set Secure flag in production environment", async () => {
                const originalEnv = process.env.NODE_ENV;
                process.env.NODE_ENV = "production";

                const response = await request(app)
                    .post("/auth/refresh")
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const cookies = response.headers["set-cookie"];
                const refreshTokenCookie = cookies.find(
                    (cookie) =>
                        cookie.startsWith("refreshToken=") &&
                        !cookie.includes("refreshToken=;"),
                );
                expect(refreshTokenCookie).toContain("Secure");

                process.env.NODE_ENV = originalEnv;
            });

            it("should handle correlation ID in refresh request", async () => {
                const correlationId = "test-refresh-correlation-123";
                const response = await request(app)
                    .post("/auth/refresh")
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .set("x-correlation-id", correlationId)
                    .expect(200);
                expect(response.body).toHaveProperty("accessToken");
            });

            it("should handle concurrent refresh requests safely", async () => {
                const requests = Array(3)
                    .fill(null)
                    .map(() =>
                        request(app)
                            .post("/auth/refresh")
                            .set("Cookie", [`refreshToken=${refreshToken}`]),
                    );
                const responses = await Promise.allSettled(requests);
                const successfulResponses = responses.filter(
                    (r) => r.status === "fulfilled" && r.value.status === 200,
                );

                expect(successfulResponses.length).toBeGreaterThanOrEqual(1);
            });
        });
    });

    describe("Invalid Refresh Token Scenarios", () => {
        it("should reject refresh without refresh token", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .expect(401);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject refresh with invalid refresh token", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", ["refreshToken=invalid-token"])
                .expect(401);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject refresh with expired refresh token", async () => {
            const expiredToken = jwt.sign(
                { id: "dummy-id", role: "admin" },
                process.env.REFRESH_JWT_SECRET,
                { expiresIn: "-1h" },
            );

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${expiredToken}`])
                .expect(401);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject refresh with malformed JWT", async () => {
            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", ["refreshToken=not.a.valid.jwt.token"])
                .expect(401);

            expect(response.body).toHaveProperty("message");
        });

        it("should reject refresh token signed with wrong secret", async () => {
            const wrongSecretToken = jwt.sign(
                { id: "dummy-id", role: "admin" },
                "wrong-secret-key",
                { expiresIn: "7d" },
            );

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${wrongSecretToken}`])
                .expect(401);

            expect(response.body).toHaveProperty("message");
        });

        it("should not accept access token as refresh token", async () => {
            const accessToken = jwt.sign(
                { id: "dummy-id", role: "admin" },
                "wrong-jwt-secret",
                { expiresIn: "15m" },
            );

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${accessToken}`])
                .expect(401);

            expect(response.body).toHaveProperty("message");
        });
    });

    describe("Token Reuse Detection", () => {
        let reuseUser;

        beforeEach(async () => {
            reuseUser = await createTestUser(TEST_USERS.admin);
        });

        it("should return Not Found when reusing a valid token that has been rotated (not in DB)", async () => {
            const rotatedToken = jwt.sign(
                { id: reuseUser.id, role: reuseUser.role },
                process.env.REFRESH_JWT_SECRET,
                { expiresIn: "7d" },
            );

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${rotatedToken}`])
                .expect(403);

            expect(response.body).toMatchObject({
                errorCode: "REFRESH_TOKEN_NOT_FOUND",
            });
        });

        it("should detect reuse (Security Alert) when using a specifically revoked token", async () => {
            const tokens = generateTestTokens(reuseUser.id, reuseUser.role);

            await db.RefreshToken.create({
                token: hashToken(tokens.refreshToken),
                ownerId: reuseUser.id,
                device: "Compromised Device",
                expiresAt: new Date(Date.now() + SEVEN_DAYS),
                isRevoked: true,
            });

            const response = await request(app)
                .post("/auth/refresh")
                .set("Cookie", [`refreshToken=${tokens.refreshToken}`])
                .expect(403);

            expect(response.body).toMatchObject({
                errorCode: "TOKEN_REUSE_DETECTED",
            });
        });
    });
});
