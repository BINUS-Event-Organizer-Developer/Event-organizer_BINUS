import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const getAccessToken = (payload, options = {}) => {
    const { ACCESS_JWT_SECRET } = process.env;
    if (!ACCESS_JWT_SECRET) {
        throw new Error("ACCESS_JWT_SECRET is not defined in .env");
    }

    const { expiresIn = "15m", algorithm = "HS256" } = options;
    const newAccessToken = jwt.sign(payload, ACCESS_JWT_SECRET, {
        expiresIn,
        algorithm,
    });
    return newAccessToken;
};

const getRefreshToken = (payload) => {
    const { REFRESH_JWT_SECRET } = process.env;
    if (!REFRESH_JWT_SECRET) {
        throw new Error("REFRESH_JWT_SECRET is not defined in .env");
    }
    const uniquePayload = { ...payload, jti: crypto.randomUUID() };
    const newRefreshToken = jwt.sign(uniquePayload, REFRESH_JWT_SECRET, {
        expiresIn: "7d",
        algorithm: "HS256",
    });
    return newRefreshToken;
};

export default function getToken(payload, options = {}) {
    return {
        accessToken: getAccessToken(payload, options.accessToken),
        refreshToken: getRefreshToken(payload),
    };
}
