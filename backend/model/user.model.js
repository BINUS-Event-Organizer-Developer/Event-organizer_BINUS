import { uuidv7 } from "uuidv7";

const userModel = (sequelize, DataTypes) => {
    const User = sequelize.define(
        "User",
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: () => uuidv7(),
                primaryKey: true,
                allowNull: false,
                unique: true,
            },
            role: {
                type: DataTypes.ENUM("admin", "super_admin"),
                allowNull: false,
            },
            firstName: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            lastName: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                },
            },
            password: {
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            deletedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "users",
            timestamps: true,
            paranoid: true,
            indexes: [
                {
                    fields: ["email"],
                    name: "email_idx",
                },
                {
                    fields: ["role"],
                    name: "role_idx",
                },
            ],
        },
    );

    User.associate = (models) => {
        User.hasMany(models.RefreshToken, {
            foreignKey: "ownerId",
            onDelete: "CASCADE",
        });

        User.hasMany(models.Event, {
            foreignKey: "creatorId",
            onDelete: "SET NULL",
        });

        User.hasMany(models.Notification, {
            foreignKey: "senderId",
            as: "sentNotifications",
            onDelete: "SET NULL",
        });

        User.hasMany(models.Notification, {
            foreignKey: "recipientId",
            as: "receivedNotifications",
        });

        User.hasMany(models.OTP, { foreignKey: "userId", onDelete: "CASCADE" });

        User.hasMany(models.ResetToken, {
            foreignKey: "userId",
            onDelete: "CASCADE",
        });
    };

    return User;
};

export default userModel;
