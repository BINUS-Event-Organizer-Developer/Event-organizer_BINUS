import { DataTypes, Sequelize } from "sequelize";
import { sequelize } from "../config/dbconfig.js";
import userModel from "./user.model.js";
import eventModel from "./event.model.js";
import refreshTokenModel from "./refreshToken.model.js";
import blacklistedTokenModel from "./blacklistToken.model.js";
import resetTokenModel from "./resetToken.model.js";
import OTPModel from "./otp.model.js";
import notificationModel from "./notification.model.js";

const db = {};

db.User = userModel(sequelize, DataTypes);
db.Event = eventModel(sequelize, DataTypes);
db.RefreshToken = refreshTokenModel(sequelize, DataTypes);
db.BlacklistedToken = blacklistedTokenModel(sequelize, DataTypes);
db.ResetToken = resetTokenModel(sequelize, DataTypes);
db.OTP = OTPModel(sequelize, DataTypes);
db.Notification = notificationModel(sequelize, DataTypes);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

Object.values(db).forEach((model) => {
    if (model.associate) {
        model.associate(db);
    }
});

export const {
    User,
    Event,
    RefreshToken,
    BlacklistedToken,
    ResetToken,
    OTP,
    Notification,
} = db;

export default db;
