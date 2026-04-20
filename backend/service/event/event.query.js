import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { Op } from "sequelize";
import AppError from "../../utils/AppError.js";
import { Event } from "../../model/index.js";

export const getEventsByCategory = async ({ logger }) => {
    const timeZone = "Asia/Jakarta";
    const now = new Date();

    const nowInWIB = toZonedTime(now, timeZone);

    const WIBStartOfDay = startOfDay(nowInWIB);
    const WIBEndOfDay = endOfDay(nowInWIB);
    const WIBStartOfWeek = startOfWeek(nowInWIB, { weekStartsOn: 1 });
    const WIBEndOfWeek = endOfWeek(nowInWIB, { weekStartsOn: 1 });

    const todayStart = fromZonedTime(WIBStartOfDay, timeZone);
    const todayEnd = fromZonedTime(WIBEndOfDay, timeZone);
    const weekStart = fromZonedTime(WIBStartOfWeek, timeZone);
    const weekEnd = fromZonedTime(WIBEndOfWeek, timeZone);

    try {
        logger.info("Fetching categorized events from database");

        const commonOptions = {
            where: { status: "approved" },
            order: [
                ["startDate", "ASC"],
                ["startTime", "ASC"],
            ],
            attributes: [
                "id",
                "name",
                "description",
                "startDate",
                "endDate",
                "startTime",
                "endTime",
                "location",
                "speaker",
                "imageUrl",
            ],
        };

        const currentEvents = await Event.findAll({
            ...commonOptions,
            where: {
                ...commonOptions.where,
                [Op.and]: [
                    { startDate: { [Op.lte]: todayEnd } },
                    { endDate: { [Op.gte]: todayStart } },
                ],
            },
        });

        const thisWeekEvents = await Event.findAll({
            ...commonOptions,
            where: {
                ...commonOptions.where,
                startDate: {
                    [Op.between]: [weekStart, weekEnd],
                },
                [Op.not]: {
                    [Op.and]: [
                        { startDate: { [Op.lte]: todayEnd } },
                        { endDate: { [Op.gte]: todayStart } },
                    ],
                },
            },
        });

        const nextEvents = await Event.findAll({
            ...commonOptions,
            where: {
                ...commonOptions.where,
                startDate: { [Op.gt]: weekEnd },
            },
        });

        logger.info("Successfully fetched categorized events", {
            context: {
                resultCounts: {
                    current: currentEvents.length,
                    thisWeek: thisWeekEvents.length,
                    next: nextEvents.length,
                },
            },
        });

        return {
            current: currentEvents,
            thisWeek: thisWeekEvents,
            next: nextEvents,
        };
    } catch (error) {
        logger.error(
            "Failed to fetch categorized events due to a database error",
            {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            },
        );

        throw new AppError(
            "Gagal mengambil data event.",
            500,
            "DATABASE_ERROR",
        );
    }
};

export const getPaginatedEvents = async (options) => {
    const { userId, role, page, limit, logger } = options;

    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        logger.info("Fetching paginated events from database", {
            context: { role, page: pageNum, limit: limitNum },
        });

        const whereClause = {};
        if (role === "admin") {
            whereClause.creatorId = userId;
            logger.info(
                "Applying filter for admin role: fetching own events only",
                {
                    context: { creatorId: userId },
                },
            );
        }

        const { count, rows } = await Event.findAndCountAll({
            where: whereClause,
            limit: limitNum,
            offset,
            order: [["createdAt", "DESC"]],
        });

        logger.info("Successfully fetched paginated events", {
            context: {
                role,
                pagination: {
                    totalItems: count,
                    returnedItems: rows.length,
                    currentPage: pageNum,
                },
            },
        });

        return {
            data: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limitNum),
                currentPage: pageNum,
            },
        };
    } catch (error) {
        logger.error(
            "Failed to fetch paginated events due to a database error",
            {
                context: { role, page, limit },
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            },
        );

        throw new AppError(
            "Gagal mengambil daftar event.",
            500,
            "DATABASE_ERROR",
        );
    }
};
