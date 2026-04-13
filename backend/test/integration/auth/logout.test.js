import jwt from "jsonwebtoken";
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../app.js";
import db from "../../../model/index.js";
import {
    TEST_USERS,
    createTestUser,
    generateTestTokens,
    saveNewRefreshToken,
} from "../helpers/testHelpers.js";
import { hashToken } from "../../../utils/hashing.js";

describe("POST /auth/logout", () => {
    // Variable scope global untuk describe ini
    let testUser;
    let accessToken;
    let refreshToken;

    describe("Authorized Scenarios", () => {
        beforeEach(async () => {
            testUser = await createTestUser(TEST_USERS.admin);
            const tokens = generateTestTokens(testUser.id, testUser.role);
            accessToken = tokens.accessToken;
            refreshToken = tokens.refreshToken;
            await saveNewRefreshToken(refreshToken, testUser.id, "Test Device");
        });

        describe("Successful Logout", () => {
            it("should logout successfully with valid tokens", async () => {
                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                expect(response.body).toMatchObject({
                    message: "Logout successful.",
                });
            });

            it("should clear refreshToken cookie", async () => {
                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const cookies = response.headers["set-cookie"];
                const refreshTokenCookie = cookies.find((cookie) =>
                    cookie.startsWith("refreshToken="),
                );

                expect(refreshTokenCookie).toBeDefined();
                expect(refreshTokenCookie).toContain("refreshToken=;");
                expect(refreshTokenCookie).toMatch(/Expires=.*1970/);
            });

            it("should set secure flag in production (cookie clearing)", async () => {
                const originalEnv = process.env.NODE_ENV;
                process.env.NODE_ENV = "production";

                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const cookies = response.headers["set-cookie"];
                const refreshTokenCookie = cookies.find((cookie) =>
                    cookie.startsWith("refreshToken="),
                );

                expect(refreshTokenCookie).toContain("Secure");
                expect(refreshTokenCookie).toContain("HttpOnly");

                process.env.NODE_ENV = originalEnv;
            });

            it("should handle correlation ID in logout", async () => {
                const correlationId = "test-logout-correlation-123";

                await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .set("x-correlation-id", correlationId)
                    .expect(200);
            });

            it("should blacklist the access token", async () => {
                await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const blacklistedTokens = await db.BlacklistedToken.findAll({
                    where: { userId: testUser.id, token: accessToken },
                });

                expect(blacklistedTokens[0].token).toBe(accessToken);
            });

            it("should blacklist the access token with expiration time", async () => {
                await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const blacklistedToken = await db.BlacklistedToken.findOne({
                    where: { token: accessToken },
                });

                expect(blacklistedToken).toBeDefined();
                expect(blacklistedToken.expiresAt).toBeInstanceOf(Date);
                expect(blacklistedToken.expiresAt.getTime()).toBeGreaterThan(
                    Date.now(),
                );
            });

            it("should revoke the refresh token from database", async () => {
                await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const remainingTokens = await db.RefreshToken.findOne({
                    where: { ownerId: testUser.id },
                });

                if (remainingTokens) {
                    expect(remainingTokens.isRevoked).toBe(true);
                } else {
                    expect(remainingTokens).toBeNull();
                }
            });

            it("should logout even with expired access token", async () => {
                const expiredTokens = generateTestTokens(
                    testUser.id,
                    testUser.role,
                    { accessToken: { expiresIn: "-1s" } },
                );

                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${expiredTokens.accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                expect(response.body.message).toBe("Logout successful.");
            });
        });

        describe("Partial Logout Scenarios", () => {
            it("should still logout even if access token blacklisting fails (idempotent)", async () => {
                await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                expect(response.body.message).toBe("Logout successful.");
            });

            it("should handle logout when refresh token already revoked", async () => {
                await db.RefreshToken.destroy({
                    where: { ownerId: testUser.id },
                });

                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                expect(response.body.message).toBe("Logout successful.");
            });
        });

        describe("Multiple Device Logout", () => {
            it("should only logout current device, not all devices", async () => {
                const tokensDevice2 = generateTestTokens(
                    testUser.id,
                    testUser.role,
                );
                await saveNewRefreshToken(
                    tokensDevice2.refreshToken,
                    testUser.id,
                    "Device 2",
                );

                await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer ${accessToken}`)
                    .set("Cookie", [`refreshToken=${refreshToken}`])
                    .expect(200);

                const allTokens = await db.RefreshToken.findAll({
                    where: { ownerId: testUser.id },
                    paranoid: false,
                });

                const device1Data = allTokens.find(
                    (t) => t.token === hashToken(refreshToken),
                );
                const device2Data = allTokens.find(
                    (t) => t.token === hashToken(tokensDevice2.refreshToken),
                );

                expect(device1Data.isRevoked).toBe(true);
                expect(device2Data.isRevoked).toBe(false);
            });
        });
    });

    describe("Unauthorized Scenarios", () => {
        describe("Edge Cases", () => {
            it("should handle logout without any tokens (graceful degradation)", async () => {
                const response = await request(app)
                    .post("/auth/logout")
                    .expect(200);

                expect(response.body.message).toMatch(/Logout successful/);
            });

            it("should handle logout with invalid access token format", async () => {
                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", "Bearer invalid-token-string")
                    .set("Cookie", [`refreshToken=dummy-cookie`])
                    .expect(200);

                expect(response.body.message).toMatch(/Logout successful/);
            });

            it("should handle logout with invalid refresh token", async () => {
                const response = await request(app)
                    .post("/auth/logout")
                    .set("Authorization", `Bearer dummy.jwt.token`)
                    .set("Cookie", ["refreshToken=invalid-refresh-token"])
                    .expect(200);

                expect(response.body.message).toBe("Logout successful.");
            });
        });
    });
});
