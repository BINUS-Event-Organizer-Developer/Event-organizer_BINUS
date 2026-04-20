import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import request from "supertest";
import { uuidv7 } from "uuidv7";
import app from "../../../app.js";
import db from "../../../model/index.js";
import {
    TEST_USERS,
    createTestUser,
    generateTestTokens,
    getFutureDate,
} from "../helpers/testHelpers.js";

vi.mock("../../../socket/index.js", () => ({
    default: {
        getIO: vi.fn().mockReturnValue({
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        }),
    },
}));

vi.mock("express-rate-limit", async () => {
    const actual = await vi.importActual("express-rate-limit");
    return {
        ...actual,
        default: () => (req, res, next) => next(),
        ipKeyGenerator: () => "127.0.0.1",
    };
});

vi.mock("../../../service/r2service.js", () => ({
    uploadToR2: vi.fn().mockResolvedValue({
        key: "dummy_key",
        url: "https://dummy-r2.com/dummy_key",
    }),
    deleteFromR2: vi.fn().mockResolvedValue(undefined),
}));

describe("Notification Flow Integration Test", () => {
    let adminUser, adminToken;
    let superAdminUser, superAdminToken;
    let testImageBuffer;

    const VALID_1PX_JPG =
        "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8yps8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==";

    const validImageBuffer = Buffer.from(VALID_1PX_JPG, "base64");
    const paddingBuffer = Buffer.alloc(1500);
    testImageBuffer = Buffer.concat([validImageBuffer, paddingBuffer]);

    const NEXT_WEEK = getFutureDate(7);
    const NEXT_MONTH = getFutureDate(30);

    beforeEach(async () => {
        adminUser = await createTestUser({
            ...TEST_USERS.admin,
            email: `admin-${uuidv7()}@binus.ac.id`,
        });
        const adminAuth = generateTestTokens(adminUser.id, adminUser.role);
        adminToken = adminAuth.accessToken;

        superAdminUser = await createTestUser({
            ...TEST_USERS.superAdmin,
            email: `super-${uuidv7()}@binus.ac.id`,
        });
        const superAuth = generateTestTokens(
            superAdminUser.id,
            superAdminUser.role,
        );
        superAdminToken = superAuth.accessToken;
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe("When Admin Creates an Event", () => {
        it("should generate 'event_pending' notif for Admin and 'event_created' notif for Super Admin", async () => {
            const res = await request(app)
                .post("/event")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("name", "Tech Summit 2024")
                .field("startDate", NEXT_WEEK)
                .field("endDate", NEXT_MONTH)
                .field("startTime", "10:00")
                .field("endTime", "12:00")
                .field("location", "Auditorium")
                .field("speaker", "Mr. X")
                .field("description", "An exciting tech event.")
                .attach("image", testImageBuffer, "poster.jpg");

            expect(res.status).toBe(201);
            const eventId = res.body.data.eventId;

            // Admin harus dapat notif bahwa requestnya sedang PENDING
            const adminNotif = await db.Notification.findOne({
                where: {
                    recipientId: adminUser.id,
                    eventId: eventId,
                    notificationType: "event_pending",
                },
            });

            expect(adminNotif).not.toBeNull();
            expect(adminNotif.isRead).toBe(false);
            expect(adminNotif.payload).toHaveProperty(
                "name",
                "Tech Summit 2024",
            );

            // Super Admin harus dapat notif ada event baru (event_created)
            const superAdminNotif = await db.Notification.findOne({
                where: {
                    recipientId: superAdminUser.id,
                    eventId: eventId,
                    notificationType: "event_created",
                },
            });

            expect(superAdminNotif).not.toBeNull();
            expect(superAdminNotif.senderId).toBe(adminUser.id);
            expect(superAdminNotif.payload).toHaveProperty(
                "name",
                "Tech Summit 2024",
            );
        });
    });

    describe("When Super Admin Approves an Event", () => {
        let eventId;

        beforeEach(async () => {
            const event = await db.Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Event to Approve",
                startDate: NEXT_WEEK,
                endDate: NEXT_MONTH,
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Loc",
                status: "pending",
                description: "Test Desc",
                imagePublicId: "dummy_id",
                imageUrl: "http://dummy.url",
            });
            eventId = event.id;
        });

        it("should generate 'event_approved' notification for the Admin", async () => {
            const res = await request(app)
                .post(`/event/${eventId}/approve`)
                .set("Authorization", `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);

            const notification = await db.Notification.findOne({
                where: {
                    recipientId: adminUser.id,
                    eventId: eventId,
                    notificationType: "event_approved",
                },
            });

            expect(notification).not.toBeNull();
            expect(notification.isRead).toBe(false);
            expect(notification.senderId).toBe(superAdminUser.id);
            expect(notification.payload.name).toBe("Event to Approve");
        });
    });

    describe("When Super Admin Rejects an Event", () => {
        let eventId;

        beforeEach(async () => {
            const event = await db.Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Event to Reject",
                startDate: NEXT_WEEK,
                endDate: NEXT_MONTH,
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Loc",
                status: "pending",
                description: "Test Desc",
                imagePublicId: "dummy_id",
                imageUrl: "http://dummy.url",
            });
            eventId = event.id;
        });

        it("should generate 'event_rejected' notification with feedback for the Admin", async () => {
            const feedbackMsg = "Poster blur, tolong perbaiki.";

            const res = await request(app)
                .post(`/event/${eventId}/reject`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({ feedback: feedbackMsg });

            expect(res.status).toBe(200);

            const notification = await db.Notification.findOne({
                where: {
                    recipientId: adminUser.id,
                    eventId: eventId,
                    notificationType: "event_rejected",
                },
            });

            expect(notification).not.toBeNull();
            expect(notification.feedback).toBe(feedbackMsg);
            expect(notification.senderId).toBe(superAdminUser.id);
        });
    });

    describe("When Super Admin Requests Feedback/Revision", () => {
        let eventId;

        beforeEach(async () => {
            const event = await db.Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Event to Revise",
                startDate: NEXT_WEEK,
                endDate: NEXT_MONTH,
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Loc",
                status: "pending",
                description: "Test Desc",
                imagePublicId: "dummy_id",
                imageUrl: "http://dummy.url",
            });
            eventId = event.id;
        });

        it("should generate 'event_revised' notification for the Admin", async () => {
            const feedbackMsg = "Ganti warna poster.";

            const res = await request(app)
                .post(`/event/${eventId}/feedback`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({ feedback: feedbackMsg });

            expect(res.status).toBe(201);

            const notification = await db.Notification.findOne({
                where: {
                    recipientId: adminUser.id,
                    eventId: eventId,
                    notificationType: "event_revised",
                },
            });

            expect(notification).not.toBeNull();
            expect(notification.feedback).toBe(feedbackMsg);

            const updatedEvent = await db.Event.findByPk(eventId);
            expect(updatedEvent.status).toBe("revised");
        });
    });
});
