import bcrypt from "bcrypt";
import crypto from "crypto";
import { uuidv7 } from "uuidv7";
import db from "../../../model/index.js";
import getToken from "../../../utils/getToken.js";
import { hashToken } from "../../../utils/hashing.js";
import {
    FIVE_MINUTES,
    FIFTEEN_MINUTES,
    SEVEN_DAYS,
} from "../../../constant/time.constant.js";

export const TEST_USERS = {
    admin: {
        role: "admin",
        firstName: "Admin",
        lastName: "User",
        email: "admin@binus.ac.id",
        password: "admin123",
        confirmPassword: "admin123",
    },
    superAdmin: {
        role: "super_admin",
        firstName: "Super",
        lastName: "Admin",
        email: "super.admin@binus.ac.id",
        password: "super123",
        confirmPassword: "super123",
    },
};

export const createTestUser = async (userData) => {
    const saltRounds = process.env.NODE_ENV === "test" ? 1 : 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

    const user = await db.User.create({
        id: uuidv7(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        email: userData.email,
        password: hashedPassword,
        confirmPassword: hashedPassword,
    });

    return user;
};

export const generateTestTokens = (userId, role, options = {}) => {
    const payload = { id: userId, role };
    const { accessToken, refreshToken } = getToken(payload, options);

    return { accessToken, refreshToken };
};

export const saveNewRefreshToken = async (refreshToken, userId, deviceName) => {
    const hashedToken = hashToken(refreshToken);

    await db.RefreshToken.create({
        ownerId: userId,
        token: hashedToken,
        device: deviceName,
        expiresAt: new Date(Date.now() + SEVEN_DAYS),
    });

    return refreshToken;
};

export const blacklistTestToken = async (userId, token) => {
    await db.BlacklistedToken.create({
        userId,
        token,
        expiresAt: new Date(Date.now() + FIFTEEN_MINUTES),
    });
};

export const createTestResetToken = async (userId) => {
    const token = crypto.randomBytes(32).toString("hex");

    const saltRounds = process.env.NODE_ENV === "test" ? 1 : 10;
    const hashedToken = await bcrypt.hash(token, saltRounds);

    await db.ResetToken.create({
        userId,
        token: hashedToken,
        expiresAt: Date.now() + FIVE_MINUTES,
    });

    return token;
};

export const extractCookie = (response, cookieName) => {
    const cookies = response.headers["set-cookie"];
    console.log("ISI COOKIENYA ADALAH", cookies);
    if (!cookies) return null;

    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const cookie = cookieArray.find((c) => c.startsWith(`${cookieName}=`));

    if (!cookie) return null;

    const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
    return match ? match[1] : null;
};

export const getFutureDate = (daysToAdd) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split("T")[0];
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
