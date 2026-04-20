import AppError from "../../utils/AppError.js";
import { createAndEmitNotification } from "../notification.service.js";
import { sequelize } from "../../config/dbconfig.js";
import { Event } from "../../model/index.js";

const processEventStatusChange = async ({
    eventId,
    superAdminId,
    targetStatus,
    notificationType,
    logger,
    actionName,
    serviceName,
    errorMessage,
    notFoundMessage,
    requiredCurrentStatuses = null,
    feedback = null,
    getSocketConfig,
}) => {
    try {
        logger.info(`${actionName} process started in service`);

        const result = await sequelize.transaction(async (t) => {
            const queryOptions = {
                where: { id: eventId },
                transaction: t,
                lock: t.LOCK.UPDATE,
            };

            const event = await Event.findOne(queryOptions);

            if (!event) {
                logger.warn(
                    `${actionName} failed: Event not found in database`,
                );
                throw new AppError(notFoundMessage, 404, "NOT_FOUND");
            }

            if (
                requiredCurrentStatuses &&
                !requiredCurrentStatuses.includes(event.status)
            ) {
                const message = `Event tidak dapat diproses karena statusnya sudah ${event.status}`;
                logger.warn(
                    `${actionName} failed: Invalid status. Current: ${event.status}, Required: ${requiredCurrentStatuses}`,
                );
                throw new AppError(message, 409, "CONFLICT_STATE");
            }

            logger.info(`Event found. Processing change.`, {
                context: {
                    id: event.id,
                    fromStatus: event.status,
                    toStatus: targetStatus,
                },
            });

            await event.update({ status: targetStatus }, { transaction: t });

            const socketConfig = getSocketConfig(event);

            await createAndEmitNotification({
                eventId: event.id,
                senderId: superAdminId,
                recipientId: event.creatorId,
                notificationType,
                feedback,
                payload: {
                    name: event.name,
                    startTime: event.startTime,
                    endTime: event.endTime,
                    startDate: event.startDate,
                    endDate: event.endDate,
                    location: event.location,
                    speaker: event.speaker,
                    imageUrl: event.imageUrl,
                },
                socketConfig,
                transaction: t,
                logger,
            });
            return event;
        });

        logger.info(`${actionName} transaction committed successfully`);

        return result;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        logger.error(`Unexpected error in ${serviceName}`, {
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name,
            },
        });

        throw new AppError(errorMessage, 500, "INTERNAL_SERVER_ERROR");
    }
};

export const rejectEventService = async (
    eventId,
    superAdminId,
    feedback,
    logger,
) => {
    return processEventStatusChange({
        eventId,
        superAdminId,
        targetStatus: "rejected",
        notificationType: "event_rejected",
        logger,
        actionName: "Event rejection",
        serviceName: "rejectEvent",
        errorMessage: "Gagal menolak event karena masalah internal.",
        notFoundMessage:
            "Event tidak ditemukan atau status tidak valid untuk ditolak.",
        requiredCurrentStatuses: ["pending", "revised"],
        feedback,
        getSocketConfig: () => ({
            title: "Your Request has been REJECTED",
            message: "Please review the provided Feedback.",
        }),
    });
};

export const approveEventService = async (eventId, superAdminId, logger) => {
    return processEventStatusChange({
        eventId,
        superAdminId,
        targetStatus: "approved",
        notificationType: "event_approved",
        logger,
        actionName: "Event approval",
        serviceName: "approveEvent",
        errorMessage: "Gagal menyetujui event karena masalah internal.",
        notFoundMessage:
            "Event tidak ditemukan atau status tidak valid untuk disetujui.",
        requiredCurrentStatuses: ["pending", "revised"],
        getSocketConfig: (event) => ({
            title: "Your Request has been APPROVED",
            message: `Congratulations! Your event "${event.name}" has been approved.`,
        }),
    });
};

export const submitEventFeedbackService = async (
    eventId,
    superAdminId,
    feedback,
    logger,
) => {
    return processEventStatusChange({
        eventId,
        superAdminId,
        targetStatus: "revised",
        notificationType: "event_revised",
        logger,
        actionName: "Feedback sending",
        serviceName: "sendFeedback",
        errorMessage: "Gagal mengirim feedback karena masalah internal.",
        notFoundMessage: "Event tidak ditemukan atau status tidak valid.",
        requiredCurrentStatuses: ["pending", "revised"],
        feedback,
        getSocketConfig: () => ({
            title: "Your Request requires REVISION",
            message: "Please review the provided Feedback",
        }),
    });
};
