import { sequelize } from "../../config/dbconfig.js";
import "../../model/index.js";

export default async function globalSetup() {
    try {
        await sequelize.authenticate();
        console.log(
            "Global Setup: Connection has been established successfully.",
        );

        await sequelize.sync({ force: true, logging: false });
        console.log("Global Setup: Database Schema Created");

        return async () => {
            await sequelize.close();
            console.log("Global Teardown: Database connection closed.");
        };
    } catch (error) {
        console.error("Global Setup Error:", error);
        process.exit(1);
    }
}
