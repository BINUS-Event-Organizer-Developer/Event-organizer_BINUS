import { uuidv7 } from "uuidv7";
import AppError from "../../utils/AppError.js";
import {
    createAndEmitNotification,
    createAndEmitBroadcastNotification,
} from "../notification.service.js";
import { sequelize } from "../../config/dbconfig.js";
import { Event, User } from "../../model/index.js";
import { generateEventAssetPaths } from "../../utils/storageHelper.js";
import { uploadToR2, deleteFromR2 } from "../r2service.js";

export const NOTIFICATION_TYPES = {
    EVENT_CREATED: "event_created",
    EVENT_UPDATED: "event_updated",
    EVENT_PENDING: "event_pending",
    EVENT_DELETED: "event_deleted",
};

export const ROOMS = {
    SUPER_ADMIN: "super_admin-room",
};

export const createEventService = async (userId, data, file, logger) => {
    const {
        name,
        startDate,
        endDate,
        startTime,
        endTime,
        location,
        speaker,
        description,
    } = data;

    const eventId = uuidv7();
    const { key, folderPath } = generateEventAssetPaths(
        eventId,
        file.originalname,
        startDate,
    );

    let uploadResult;
    try {
        logger.info("Event creation and notification process started");

        logger.info("Attempting to upload poster image to R2", {
            context: { folder: folderPath, key },
        });

        uploadResult = await uploadToR2(file.buffer, key, file.mimetype);

        logger.info("Image uploaded successfully", {
            context: {
                url: uploadResult.url,
                key: uploadResult.key,
            },
        });

        let creatorName;
        logger.info("Starting database transaction");
        const newEvent = await sequelize.transaction(async (t) => {
            const [creator, superAdmins] = await Promise.all([
                User.findByPk(userId, {
                    attributes: ["firstName"],
                    transaction: t,
                }),
                User.findAll({
                    where: { role: "super_admin" },
                    attributes: ["id"],
                    transaction: t,
                }),
            ]);

            if (!creator) {
                logger.warn("Event creation failed: Creator user not found");
                throw new AppError(
                    "User tidak ditemukan",
                    404,
                    "USER_NOT_FOUND",
                );
            }
            creatorName = creator.firstName;
            logger.info("Creator and super admins fetched successfully", {
                context: { superAdminCount: superAdmins.length },
            });

            const event = await Event.create(
                {
                    id: eventId,
                    creatorId: userId,
                    name,
                    startDate,
                    endDate,
                    startTime,
                    endTime,
                    location,
                    speaker,
                    description,
                    status: "pending",
                    imageUrl: uploadResult.url,
                    imageKey: uploadResult.key,
                },
                { transaction: t },
            );

            logger.info("Event record created successfully in database", {
                context: { eventId: event.id },
            });

            await Promise.all([
                createAndEmitBroadcastNotification({
                    eventId: event.id,
                    senderId: userId,
                    recipients: superAdmins,
                    notificationType: NOTIFICATION_TYPES.EVENT_CREATED,
                    payload: {
                        name,
                        startTime,
                        endTime,
                        startDate,
                        endDate,
                        location,
                        speaker,
                        imageUrl: event.imageUrl,
                    },
                    socketConfig: {
                        room: ROOMS.SUPER_ADMIN,
                        title: "A new request has been submitted",
                        message: `${creatorName} has submitted a request for the event: ${event.name}. Please review it.`,
                    },
                    transaction: t,
                    logger,
                }),
                createAndEmitNotification({
                    eventId: event.id,
                    senderId: userId,
                    recipientId: userId,
                    notificationType: NOTIFICATION_TYPES.EVENT_PENDING,
                    payload: {
                        name,
                        startTime,
                        endTime,
                        startDate,
                        endDate,
                        location,
                        speaker,
                        imageUrl: event.imageUrl,
                    },
                    socketConfig: {
                        title: "Your Request is currently PENDING",
                        message:
                            "We will inform you of the outcome as soon as possible.",
                    },
                    transaction: t,
                    logger,
                }),
            ]);

            return event;
        });

        logger.info("Database transaction committed successfully");
        logger.info("Socket notifications emitted to rooms", {
            context: { rooms: [ROOMS.SUPER_ADMIN, userId] },
        });

        return newEvent;
    } catch (error) {
        if (uploadResult) {
            logger.warn(
                "Database operation failed. Rolling back: deleting uploaded image from R2.",
                {
                    context: {
                        key: uploadResult.key,
                        reason: error.message,
                    },
                },
            );

            deleteFromR2(uploadResult.key).catch((deleteErr) => {
                logger.error(
                    "Failed to delete orphaned file from R2 during rollback",
                    {
                        context: { key: uploadResult.key },
                        error: {
                            message: deleteErr.message,
                            stack: deleteErr.stack,
                        },
                    },
                );
            });
        }

        if (!(error instanceof AppError)) {
            logger.error(
                "An unexpected error occurred in saveNewEventAndNotify service",
                {
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name,
                    },
                },
            );
        }

        throw error;
    }
};

export const deleteEventService = async (adminId, eventId, logger) => {
    let eventDataForCleanupAndNotify;
    let adminName;

    try {
        logger.info("Starting event deletion process in service");
        logger.info("Starting database transaction for event deletion");

        await sequelize.transaction(async (t) => {
            const event = await Event.findOne({
                where: { id: eventId, creatorId: adminId },
                include: [
                    {
                        model: User,
                        as: "creator",
                        attributes: ["firstName"],
                    },
                ],
                transaction: t,
            });

            if (!event) {
                logger.warn(
                    "Deletion failed: Event not found or user lacks permission",
                );

                throw new AppError(
                    "Event tidak ditemukan atau Anda tidak berhak menghapusnya.",
                    404,
                    "NOT_FOUND",
                );
            }

            logger.info(
                "Event found in database. Proceeding with deletion logic.",
            );

            const superAdmins = await User.findAll({
                where: { role: "super_admin" },
                attributes: ["id"],
                transaction: t,
            });

            eventDataForCleanupAndNotify = event.toJSON();
            adminName = event.creator.firstName;

            await event.destroy({ transaction: t });
            logger.info("Event record successfully deleted from database");

            await createAndEmitBroadcastNotification({
                eventId: eventDataForCleanupAndNotify.id,
                senderId: adminId,
                recipients: superAdmins,
                notificationType: NOTIFICATION_TYPES.EVENT_DELETED,
                payload: {
                    name: eventDataForCleanupAndNotify.name,
                    startTime: eventDataForCleanupAndNotify.startTime,
                    endTime: eventDataForCleanupAndNotify.endTime,
                    startDate: eventDataForCleanupAndNotify.startDate,
                    endDate: eventDataForCleanupAndNotify.endDate,
                    location: eventDataForCleanupAndNotify.location,
                    speaker: eventDataForCleanupAndNotify.speaker,
                    imageUrl: eventDataForCleanupAndNotify.imageUrl,
                },
                socketConfig: {
                    room: ROOMS.SUPER_ADMIN,
                    title: `Event "${eventDataForCleanupAndNotify.name}" has been deleted.`,
                    message: `${adminName} removed this event from the system.`,
                },
                transaction: t,
                logger,
            });
        });

        logger.info("Database transaction committed successfully");

        if (eventDataForCleanupAndNotify?.imageKey) {
            const r2Key = eventDataForCleanupAndNotify.imageKey;

            logger.info(
                "Event has an associated image. Starting cloud cleanup process.",
                { context: { key: r2Key } },
            );

            try {
                await deleteFromR2(r2Key);

                logger.info("Cloud asset deleted successfully", {
                    context: { key: r2Key },
                });
            } catch (cloudError) {
                logger.error(
                    "Cloud asset cleanup failed after successful DB deletion. Manual cleanup may be required.",
                    {
                        context: { key: r2Key },
                        error: {
                            message: cloudError.message,
                            stack: cloudError.stack,
                        },
                    },
                );
            }
        } else {
            logger.info(
                "Event has no associated image. Skipping cloud cleanup.",
            );
        }

        return true;
    } catch (dbError) {
        if (!(dbError instanceof AppError)) {
            logger.error(
                "An unexpected error occurred during the database transaction for event deletion",
                {
                    error: {
                        message: dbError.message,
                        stack: dbError.stack,
                        name: dbError.name,
                    },
                },
            );
        }
        throw dbError;
    }
};

export const updateEventService = async (
    eventId,
    adminId,
    data,
    image,
    logger,
) => {
    let uploadResult;
    let oldImageKey = null;

    try {
        logger.info("Event update process started in service", {
            context: { eventId },
        });

        const existingEvent = await Event.findOne({
            where: { id: eventId, creatorId: adminId },
        });

        if (!existingEvent) {
            logger.warn(
                "Update failed: Event not found or user lacks permission",
                { context: { eventId, attemptedByUserId: adminId } },
            );
            throw new AppError(
                "Event tidak ditemukan atau Anda tidak berhak mengubahnya.",
                404,
                "NOT_FOUND",
            );
        }

        if (image) {
            const effectiveDate = data.startDate || existingEvent.startDate;

            const { key, folderPath } = generateEventAssetPaths(
                eventId,
                image.originalname,
                effectiveDate,
            );

            logger.info("New image provided. Attempting to upload...", {
                context: { folder: folderPath },
            });

            uploadResult = await uploadToR2(image.buffer, key, image.mimetype);

            if (existingEvent.imageKey) {
                oldImageKey = existingEvent.imageKey;
            }

            logger.info("New image uploaded successfully", {
                context: {
                    url: uploadResult.url,
                    key: uploadResult.key,
                },
            });
        } else {
            logger.info(
                "No new image provided, proceeding with data update only",
            );
        }

        logger.info("Starting database transaction");
        const updatedEvent = await sequelize.transaction(async (t) => {
            const eventToUpdate = await Event.findByPk(eventId, {
                transaction: t,
            });

            const allowedUpdates = {
                name: data.name,
                startDate: data.startDate,
                endDate: data.endDate,
                startTime: data.startTime,
                endTime: data.endTime,
                location: data.location,
                speaker: data.speaker,
                description: data.description,
                imageUrl: uploadResult ? uploadResult.url : undefined,
                imageKey: uploadResult ? uploadResult.key : undefined,
            };

            Object.keys(allowedUpdates).forEach(
                (key) =>
                    allowedUpdates[key] === undefined &&
                    delete allowedUpdates[key],
            );

            logger.info("Applying updates to event record", {
                context: { eventId, updates: allowedUpdates },
            });

            await eventToUpdate.update(
                { ...allowedUpdates, status: "pending" },
                { transaction: t },
            );

            logger.info("Event record updated successfully in database");

            const superAdmins = await User.findAll({
                where: { role: "super_admin" },
                attributes: ["id"],
                transaction: t,
            });

            const updatedPayloadData = { ...eventToUpdate.dataValues };

            await Promise.all([
                createAndEmitBroadcastNotification({
                    eventId: eventToUpdate.id,
                    senderId: adminId,
                    recipients: superAdmins,
                    notificationType: NOTIFICATION_TYPES.EVENT_UPDATED,
                    payload: {
                        name: updatedPayloadData.name,
                        startTime: updatedPayloadData.startTime,
                        endTime: updatedPayloadData.endTime,
                        startDate: updatedPayloadData.startDate,
                        endDate: updatedPayloadData.endDate,
                        location: updatedPayloadData.location,
                        speaker: updatedPayloadData.speaker,
                        imageUrl: updatedPayloadData.imageUrl,
                    },
                    socketConfig: {
                        room: ROOMS.SUPER_ADMIN,
                        name: "eventUpdated",
                        message: `Event "${updatedPayloadData.name}" telah diperbarui dan menunggu persetujuan.`,
                    },
                    transaction: t,
                    logger,
                }),
                createAndEmitNotification({
                    eventId: eventToUpdate.id,
                    senderId: adminId,
                    recipientId: adminId,
                    notificationType: NOTIFICATION_TYPES.EVENT_PENDING,
                    payload: {
                        name: updatedPayloadData.name,
                        startTime: updatedPayloadData.startTime,
                        endTime: updatedPayloadData.endTime,
                        startDate: updatedPayloadData.startDate,
                        endDate: updatedPayloadData.endDate,
                        location: updatedPayloadData.location,
                        speaker: updatedPayloadData.speaker,
                        imageUrl: updatedPayloadData.imageUrl,
                    },
                    socketConfig: {
                        title: "Your Request is currently PENDING",
                        message:
                            "We will inform you of the outcome as soon as possible.",
                    },
                    transaction: t,
                    logger,
                }),
            ]);

            return eventToUpdate;
        });

        logger.info("Database transaction committed successfully");

        if (oldImageKey) {
            logger.info("Deleting old image replaced during update", {
                context: { oldImageKey },
            });

            deleteFromR2(oldImageKey).catch((deleteErr) => {
                logger.error("Failed to delete old file from R2 (Clean up)", {
                    context: { key: oldImageKey },
                    error: deleteErr.message,
                });
            });
        }

        return updatedEvent;
    } catch (error) {
        if (uploadResult) {
            logger.warn(
                "Transaction failed. Rolling back: deleting newly uploaded image.",
                { context: { imageKey: uploadResult.key } },
            );

            deleteFromR2(uploadResult.key).catch((deleteErr) => {
                logger.error("Failed to rollback R2 file", {
                    error: deleteErr.message,
                });
            });
        }

        if (!(error instanceof AppError)) {
            logger.error("An unexpected error occurred in editEventService", {
                context: { eventId },
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
            });
        }

        throw error;
    }
};
