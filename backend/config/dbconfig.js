import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";
import AppError from "../utils/AppError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";
const databaseName = isTest ? process.env.DB_NAME_TEST : process.env.DB_NAME;

logger.info(`Mode: ${process.env.NODE_ENV || "development"}`);
logger.info(`Target DB: ${databaseName}`);

if (isTest && databaseName === process.env.DB_NAME) {
    logger.error(
        "CRITICAL SAFETY ERROR: System mendeteksi mode TESTING, tetapi koneksi mengarah ke database UTAMA.",
    );
    logger.error(`Target terdeteksi: ${databaseName}`);
    logger.error("Proses dihentikan paksa untuk mencegah penghapusan data.");
    process.exit(1);
}

const productionDialectOptions = {
    ssl: {
        require: true,
        rejectUnauthorized: false,
    },
};

export const sequelize = new Sequelize(
    databaseName,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || 3306,
        dialect: "mysql",
        logging: isProduction || isTest ? false : (msg) => logger.debug(msg),
        dialectOptions: isProduction ? productionDialectOptions : {},
    },
);

export async function testDBConnection() {
    try {
        await sequelize.authenticate();
        logger.info("✅ Koneksi database berhasil!");
    } catch (error) {
        const message = `Gagal koneksi ke database: ${error.message || "Unknown error"}`;
        logger.error(`❌ ${message}`, error);
        throw new AppError(message, 500, "DBCONN");
    }
}
