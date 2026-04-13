import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const MAX_ATTEMPTS = 3;
export const EXPIRY_MINUTES = 5;
export const RATE_LIMIT_WINDOW = 15;
export const MAX_REQUESTS_PER_WINDOW = 5;
export const BCRYPT_ROUNDS = process.env.NODE_ENV === "test" ? 1 : 10;
export const OTP_LENGTH = 6;
