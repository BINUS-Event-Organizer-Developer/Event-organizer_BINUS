import { uuidv7 } from "uuidv7";

const eventModel = (sequelize, DataTypes) => {
    const Event = sequelize.define(
        "Event",
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: () => uuidv7(),
                primaryKey: true,
                allowNull: false,
                unique: true,
            },
            creatorId: {
                type: DataTypes.UUID,
                allowNull: true,
                references: {
                    model: "users",
                    key: "id",
                },
            },
            name: {
                type: DataTypes.STRING(70),
                allowNull: false,
            },
            startDate: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            endDate: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            startTime: {
                type: DataTypes.TIME,
                allowNull: false,
            },
            endTime: {
                type: DataTypes.TIME,
                allowNull: false,
            },
            location: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            speaker: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM(
                    "pending",
                    "revised",
                    "approved",
                    "rejected",
                ),
                allowNull: false,
                defaultValue: "pending",
            },
            imageKey: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            imageUrl: {
                type: DataTypes.STRING(2048),
                allowNull: true,
                validate: {
                    isUrl: true,
                },
            },
            deletedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "events",
            timestamps: true,
            paranoid: true,
            indexes: [
                {
                    fields: ["status"],
                },
                {
                    fields: ["startDate", "endDate"],
                },
            ],
        },
    );

    Event.associate = (models) => {
        Event.belongsTo(models.User, {
            foreignKey: "creatorId",
            as: "creator",
        });

        Event.hasMany(models.Notification, {
            foreignKey: "eventId",
            as: "notifications",
            onDelete: "SET NULL",
        });
    };

    return Event;
};

export default eventModel;
