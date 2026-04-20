import {
    describe,
    it,
    vi,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
} from "vitest";
import request from "supertest";
import { uuidv7 } from "uuidv7";
import app from "../../../app.js";
import { Event, Notification } from "../../../model/index.js";
import { deleteFromR2 } from "../../../service/r2service.js";
import {
    TEST_USERS,
    createTestUser,
    generateTestTokens,
    getFutureDate,
} from "../helpers/testHelpers.js";

vi.mock("../../../service/r2service.js", () => ({
    uploadToR2: vi.fn().mockResolvedValue({
        url: "http://example.com/mock-image.jpg",
        key: "mock_r2_key",
    }),
    deleteFromR2: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../../socket/index.js", () => ({
    default: {
        getIO: vi.fn().mockReturnValue({
            to: vi.fn().mockReturnThis(),
            emit: vi.fn(),
        }),
    },
}));

describe("Event Integration Tests", () => {
    let adminToken, superAdminToken, anotherAdminToken;
    let adminUser, superAdminUser, anotherAdminUser;
    let testImageBuffer;

    const TOMORROW = getFutureDate(1);
    const TOMORROW_END = getFutureDate(2);
    const NEXT_MONTH = getFutureDate(30);
    const NEXT_MONTH_END = getFutureDate(31);
    const PAST_DATE = getFutureDate(-5);
    const PAST_DATE_END = getFutureDate(-4);

    beforeAll(() => {
        const VALID_1PX_JPG =
            "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8yps8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==";

        const validImageBuffer = Buffer.from(VALID_1PX_JPG, "base64");
        const paddingBuffer = Buffer.alloc(1500);
        testImageBuffer = Buffer.concat([validImageBuffer, paddingBuffer]);
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        adminUser = await createTestUser(TEST_USERS.admin);
        superAdminUser = await createTestUser(TEST_USERS.superAdmin);

        anotherAdminUser = await createTestUser({
            role: "admin",
            firstName: "Another",
            lastName: "Admin",
            email: "another@gmail.com",
            password: "password123",
            confirmPassword: "password123",
        });

        adminToken = generateTestTokens(
            adminUser.id,
            adminUser.role,
        ).accessToken;
        superAdminToken = generateTestTokens(
            superAdminUser.id,
            superAdminUser.role,
        ).accessToken;
        anotherAdminToken = generateTestTokens(
            anotherAdminUser.id,
            anotherAdminUser.role,
        ).accessToken;
    });

    describe("POST /event - Create Event", () => {
        it("should rollback (delete) uploaded image if database transaction fails", async () => {
            const dbError = new Error("Simulated Database Transaction Failure");

            const createSpy = vi
                .spyOn(Event, "create")
                .mockRejectedValueOnce(dbError);

            try {
                const response = await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Rollback Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg");

                expect(response.status).toBe(500);

                expect(deleteFromR2).toHaveBeenCalledTimes(1);
                expect(deleteFromR2).toHaveBeenCalledWith("mock_r2_key");
            } finally {
                createSpy.mockRestore();
            }
        });

        describe("Success Cases", () => {
            it("should create event successfully with all required fields", async () => {
                const eventData = {
                    name: "Test Event",
                    startDate: NEXT_MONTH,
                    endDate: NEXT_MONTH_END,
                    startTime: "10:00",
                    endTime: "12:00",
                    location: "Test Location",
                    speaker: "Test Speaker",
                    description: "Test Description",
                };

                const response = await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", eventData.name)
                    .field("startDate", eventData.startDate)
                    .field("endDate", eventData.endDate)
                    .field("startTime", eventData.startTime)
                    .field("endTime", eventData.endTime)
                    .field("location", eventData.location)
                    .field("speaker", eventData.speaker)
                    .field("description", eventData.description)
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(201);

                expect(response.body.status).toBe("success");
                expect(response.body.message).toBe(
                    "Event successfully created",
                );
                expect(response.body.data).toHaveProperty("eventId");

                const event = await Event.findByPk(response.body.data.eventId);
                expect(event).toBeDefined();
                expect(event.name).toBe(eventData.name);
                expect(event.status).toBe("pending");
            });

            it("should create event without optional speaker field", async () => {
                const response = await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(201);

                expect(response.body.status).toBe("success");
            });

            it("should create notification for super admin", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(201);

                const notifications = await Notification.findAll({
                    where: { recipientId: superAdminUser.id },
                });

                expect(notifications.length).toBeGreaterThan(0);
            });

            it("should create notification for event creator", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(201);

                const notifications = await Notification.findAll({
                    where: {
                        recipientId: adminUser.id,
                        notificationType: "event_pending",
                    },
                });

                expect(notifications).toHaveLength(1);
            });
        });

        describe("Validation Errors", () => {
            it("should reject request without name", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(400);
            });

            it("should reject request without date (startDate and endDate)", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(400);
            });

            it("should reject request with invalid date format", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", "invalid-date")
                    .field("endDate", "invalid-date")
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(400);
            });

            it("should reject request with invalid time format", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", PAST_DATE)
                    .field("endDate", PAST_DATE_END)
                    .field("startTime", "25:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(400);
            });

            it("should reject request without image", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .expect(400);
            });

            it("should reject file larger than 2MB", async () => {
                const largeBuffer = Buffer.alloc(3 * 1024 * 1024); // 3MB

                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", largeBuffer, "large.jpg")
                    .expect(400);
            });

            it("should reject file with invalid mime type", async () => {
                const textBuffer = Buffer.from("Ini bukan gambar", "utf-8");

                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Test Invalid Mime")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", textBuffer, {
                        filename: "test.txt",
                        contentType: "text/plain",
                    })
                    .expect(400);
            });
        });

        describe("Authorization", () => {
            it("should reject request from super_admin", async () => {
                await request(app)
                    .post("/event")
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(403);
            });

            it("should reject request without token", async () => {
                await request(app)
                    .post("/event")
                    .field("name", "Test Event")
                    .field("startDate", NEXT_MONTH)
                    .field("endDate", NEXT_MONTH_END)
                    .field("startTime", "10:00")
                    .field("endTime", "12:00")
                    .field("location", "Test Location")
                    .field("description", "Test Description")
                    .attach("image", testImageBuffer, "test.jpg")
                    .expect(401);
            });
        });
    });

    describe("GET /event - Event Viewer", () => {
        beforeAll(() => {
            vi.mock("date-fns-tz", async (importOriginal) => {
                const actual = await importOriginal();
                return {
                    ...actual,
                    toZonedTime: () => new Date("2024-01-01T00:00:00+07:00"),
                    fromZonedTime: actual.fromZonedTime,
                };
            });
        });

        afterAll(() => {
            vi.restoreAllMocks();
        });

        describe("Public", () => {
            beforeEach(async () => {
                const baseDate = new Date("2024-01-01T00:00:00Z");

                const createFixedDate = (daysToAdd) => {
                    const d = new Date(baseDate);
                    d.setDate(d.getDate() + daysToAdd);
                    return d;
                };

                const today = createFixedDate(0); // (Today)
                const todayEnd = createFixedDate(1);
                const tomorrow = createFixedDate(1); // (This Week)
                const tomorrowEnd = createFixedDate(2);
                const nextWeek = createFixedDate(8); // (Next Week)
                const nextWeekEnd = createFixedDate(9);

                await Event.bulkCreate([
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Event Today",
                        startDate: today,
                        endDate: todayEnd,
                        startTime: "10:00",
                        endTime: "12:00",
                        location: "Room A",
                        description: "Event happening today",
                        imageUrl: "http://example.com/image1.jpg",
                        imagePublicId: "public_id_1",
                        status: "approved",
                    },
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Event This Week",
                        startDate: tomorrow,
                        endDate: tomorrowEnd,
                        startTime: "14:00",
                        endTime: "16:00",
                        location: "Room B",
                        description: "Event happening tomorrow",
                        imageUrl: "http://example.com/image2.jpg",
                        imagePublicId: "public_id_2",
                        status: "approved",
                    },
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Event Next Week",
                        startDate: nextWeek,
                        endDate: nextWeekEnd,
                        startTime: "09:00",
                        endTime: "11:00",
                        location: "Room C",
                        description: "Event happening next week",
                        imageUrl: "http://example.com/image3.jpg",
                        imagePublicId: "public_id_3",
                        status: "approved",
                    },
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Pending Event",
                        startDate: today,
                        endDate: todayEnd,
                        startTime: "15:00",
                        endTime: "17:00",
                        location: "Room D",
                        description: "Should not show",
                        imageUrl: "http://example.com/image4.jpg",
                        imagePublicId: "public_id_4",
                        status: "pending",
                    },
                ]);
            });

            it("should return categorized events for public", async () => {
                const response = await request(app).get("/event").expect(200);

                expect(response.body.status).toBe("success");

                expect(response.body.data).toHaveProperty("current");
                expect(response.body.data).toHaveProperty("thisWeek");
                expect(response.body.data).toHaveProperty("next");

                expect(response.body.data.current).toHaveLength(1);
                expect(response.body.data.thisWeek).toHaveLength(1);
                expect(response.body.data.next).toHaveLength(1);
            });

            it("should only return approved events to public", async () => {
                const response = await request(app).get("/event").expect(200);

                const allEvents = [
                    ...response.body.data.current,
                    ...response.body.data.thisWeek,
                    ...response.body.data.next,
                ];

                expect(allEvents.length).toBe(3);

                allEvents.forEach((event) => {
                    expect(event.status).toBeUndefined();
                });
            });

            it("should not include sensitive fields in response", async () => {
                const response = await request(app).get("/event").expect(200);

                const allEvents = [
                    ...response.body.data.current,
                    ...response.body.data.thisWeek,
                    ...response.body.data.next,
                ];

                allEvents.forEach((event) => {
                    expect(event).not.toHaveProperty("creatorId");
                    expect(event).not.toHaveProperty("imagePublicId");
                    expect(event).not.toHaveProperty("status");
                });
            });
        });

        describe("Admin Role", () => {
            beforeEach(async () => {
                const dateStart = new Date();
                const dateEnd = new Date(dateStart.getTime() + 86400000); // +1 Day

                await Event.bulkCreate([
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Admin Event 1",
                        startDate: dateStart,
                        endDate: dateEnd,
                        startTime: "10:00",
                        endTime: "12:00",
                        location: "Room A",
                        status: "pending",
                        description: "Desc",
                        imageUrl: "u",
                        imagePublicId: "p",
                    },
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Admin Event 2",
                        startDate: dateStart,
                        endDate: dateEnd,
                        startTime: "14:00",
                        endTime: "16:00",
                        location: "Room B",
                        status: "approved",
                        description: "Desc",
                        imageUrl: "u",
                        imagePublicId: "p",
                    },
                    {
                        id: uuidv7(),
                        creatorId: anotherAdminUser.id,
                        name: "Another Admin Event",
                        startDate: dateStart,
                        endDate: dateEnd,
                        startTime: "09:00",
                        endTime: "11:00",
                        location: "Room C",
                        status: "approved",
                        description: "Desc",
                        imageUrl: "u",
                        imagePublicId: "p",
                    },
                ]);
            });

            it("should return paginated events for admin (own events only)", async () => {
                const response = await request(app)
                    .get("/event?page=1&limit=10")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.status).toBe("success");
                expect(response.body.data.data).toHaveLength(2);
                expect(response.body.data.pagination.totalItems).toBe(2);
            });

            it("should handle pagination correctly", async () => {
                const eventsToCreate = Array.from({ length: 15 }).map(
                    (_, i) => ({
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "Bulk " + i,
                        startDate: new Date(),
                        endDate: new Date(),
                        startTime: "10:00",
                        endTime: "12:00",
                        location: "Room",
                        status: "pending",
                        description: "Desc",
                        imageUrl: "u",
                        imagePublicId: "p",
                    }),
                );

                await Event.bulkCreate(eventsToCreate);

                const response = await request(app)
                    .get("/event?page=2&limit=10")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.data.pagination.currentPage).toBe(2);
                expect(response.body.data.data.length).toBe(7);
            });

            it("should return empty data for admin with no events", async () => {
                const response = await request(app)
                    .get("/event")
                    .set("Authorization", `Bearer ${anotherAdminToken}`)
                    .expect(200);

                expect(response.body.data.data).toHaveLength(1);
            });
        });

        describe("Super Admin Role", () => {
            beforeEach(async () => {
                await Event.bulkCreate([
                    {
                        id: uuidv7(),
                        creatorId: adminUser.id,
                        name: "E1",
                        startDate: new Date(),
                        endDate: new Date(),
                        status: "pending",
                        startTime: "10",
                        endTime: "12",
                        location: "A",
                        description: "D",
                        imageUrl: "u",
                        imagePublicId: "p",
                    },
                    {
                        id: uuidv7(),
                        creatorId: anotherAdminUser.id,
                        name: "E2",
                        startDate: new Date(),
                        endDate: new Date(),
                        status: "approved",
                        startTime: "10",
                        endTime: "12",
                        location: "B",
                        description: "D",
                        imageUrl: "u",
                        imagePublicId: "p",
                    },
                ]);
            });

            it("should return all events for super admin", async () => {
                const response = await request(app)
                    .get("/event")
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(200);

                expect(response.body.data.data).toHaveLength(2);
            });
        });

        describe("Authentication & Authorization", () => {
            it("should reject request with invalid token", async () => {
                await request(app)
                    .get("/event")
                    .set("Authorization", "Bearer invalid-token")
                    .expect(401);
            });
        });
    });

    describe("PATCH /event/:eventId - Edit Event", () => {
        let testEvent;

        beforeEach(async () => {
            testEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Original Event",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Original Location",
                speaker: "Original Speaker",
                status: "pending",
                description: "Event Description",
                imageUrl: "http://example.com/original.jpg",
                imagePublicId: "original_public_id",
            });
        });

        describe("Success Cases", () => {
            it("should update event successfully", async () => {
                const updateData = {
                    name: "Updated Event",
                    location: "Updated Location",
                };

                const response = await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", updateData.name)
                    .field("location", updateData.location)
                    .expect(200);

                expect(response.body.status).toBe("success");
                expect(response.body.message).toBe(
                    "Event berhasil diperbarui.",
                );

                await testEvent.reload();
                expect(testEvent.name).toBe(updateData.name);
                expect(testEvent.location).toBe(updateData.location);
                expect(testEvent.status).toBe("pending");
            });

            it("should update event with new image", async () => {
                const response = await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Updated Event")
                    .attach("image", testImageBuffer, "new.jpg")
                    .expect(200);

                expect(response.body.status).toBe("success");
            });

            it("should update only provided fields", async () => {
                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Updated Name Only")
                    .expect(200);

                await testEvent.reload();
                expect(testEvent.name).toBe("Updated Name Only");
                expect(testEvent.location).toBe("Original Location");
            });

            it("should reset status to pending after update", async () => {
                await testEvent.update({ status: "approved" });

                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Updated Event")
                    .expect(200);

                await testEvent.reload();
                expect(testEvent.status).toBe("pending");
            });

            it("should create notification for super admin after update", async () => {
                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Updated Event")
                    .expect(200);

                const notifications = await Notification.findAll({
                    where: {
                        recipientId: superAdminUser.id,
                        notificationType: "event_updated",
                    },
                });

                expect(notifications.length).toBeGreaterThan(0);
            });
        });

        describe("Authorization & Ownership", () => {
            it("should reject update from different admin", async () => {
                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${anotherAdminToken}`)
                    .field("name", "Hacked Event")
                    .expect(404);
            });

            it("should reject update from public", async () => {
                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .field("name", "Hacked Event")
                    .expect(401);
            });

            it("should reject update from super admin", async () => {
                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .field("name", "Updated by Super Admin")
                    .expect(403);
            });
        });

        describe("Validation Errors", () => {
            it("should reject invalid eventId format", async () => {
                await request(app)
                    .patch("/event/invalid-uuid")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Updated Event")
                    .expect(400);
            });

            it("should reject update for non-existent event", async () => {
                const fakeId = uuidv7();
                await request(app)
                    .patch(`/event/${fakeId}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("name", "Updated Event")
                    .expect(404);
            });

            it("should reject invalid date format", async () => {
                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .field("startDate", "invalid-date")
                    .field("endDate", "invalid-date")
                    .expect(400);
            });

            it("should reject file larger than 2MB", async () => {
                const largeBuffer = Buffer.alloc(3 * 1024 * 1024);

                await request(app)
                    .patch(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .attach("image", largeBuffer, "large.jpg")
                    .expect(400);
            });
        });
    });

    describe("DELETE /event/:eventId - Delete Event", () => {
        let testEvent;

        beforeEach(async () => {
            testEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Event to Delete",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Location",
                status: "pending",
                description: "Event Description",
                imageUrl: "http://example.com/image.jpg",
                imagePublicId: "test_public_id",
            });
        });

        describe("Success Cases", () => {
            it("should delete event successfully", async () => {
                const response = await request(app)
                    .delete(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(200);

                expect(response.body.status).toBe("success");
                expect(response.body.message).toBe(
                    "Event Successfully Deleted",
                );

                // Verify deletion
                const deletedEvent = await Event.findByPk(testEvent.id);
                expect(deletedEvent).toBeNull();
            });

            it("should create notification for super admin after deletion", async () => {
                await request(app)
                    .delete(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(200);

                const notifications = await Notification.findAll({
                    where: {
                        recipientId: superAdminUser.id,
                        notificationType: "event_deleted",
                    },
                });

                expect(notifications.length).toBeGreaterThan(0);
            });

            it("should delete event with approved status", async () => {
                await testEvent.update({ status: "approved" });

                await request(app)
                    .delete(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(200);
            });
        });

        describe("Authorization & Ownership", () => {
            it("should reject deletion from different admin", async () => {
                await request(app)
                    .delete(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${anotherAdminToken}`)
                    .expect(404);
            });

            it("should reject deletion from super admin", async () => {
                await request(app)
                    .delete(`/event/${testEvent.id}`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(403);
            });
        });

        describe("Validation Errors", () => {
            it("should reject invalid eventId format", async () => {
                await request(app)
                    .delete("/event/invalid-uuid")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(400);
            });

            it("should reject deletion for non-existent event", async () => {
                const fakeId = uuidv7();
                await request(app)
                    .delete(`/event/${fakeId}`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(404);
            });
        });
    });

    describe("POST /event/:eventId/approve - Approve Event", () => {
        let pendingEvent, revisedEvent, approvedEvent;

        beforeEach(async () => {
            pendingEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Pending Event Approval",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Location",
                status: "pending",
                description: "Event Description",
                imageUrl: "http://example.com/image.jpg",
                imagePublicId: "test_public_id",
            });

            revisedEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Revised Event Approval",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Location",
                status: "revised",
                description: "Event Description",
                imageUrl: "http://example.com/image.jpg",
                imagePublicId: "test_public_id_rev",
            });

            approvedEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Already Approved Event",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Location",
                status: "approved",
                description: "Event Description",
                imageUrl: "http://example.com/image.jpg",
                imagePublicId: "test_public_id_app",
            });
        });

        describe("Success Cases", () => {
            it("should allow Super Admin to approve pending event", async () => {
                const response = await request(app)
                    .post(`/event/${pendingEvent.id}/approve`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(200);
                expect(response.body.status).toBe("success");
                expect(response.body.message).toBe("Event berhasil disetujui.");

                await pendingEvent.reload();
                expect(pendingEvent.status).toBe("approved");
            });

            it("should allow Super Admin to approve revised event", async () => {
                const response = await request(app)
                    .post(`/event/${revisedEvent.id}/approve`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(200);

                expect(response.body.status).toBe("success");

                await revisedEvent.reload();
                expect(revisedEvent.status).toBe("approved");
            });

            it("should create notification for event creator after approval", async () => {
                await request(app)
                    .post(`/event/${pendingEvent.id}/approve`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(200);

                const notifications = await Notification.findAll({
                    where: {
                        recipientId: adminUser.id,
                        notificationType: "event_approved",
                    },
                });

                expect(notifications.length).toBeGreaterThan(0);
            });
        });

        describe("Authorization", () => {
            it("should reject approval from Admin (Forbidden)", async () => {
                await request(app)
                    .post(`/event/${pendingEvent.id}/approve`)
                    .set("Authorization", `Bearer ${adminToken}`)
                    .expect(403);
            });
        });

        describe("Validation & Logic Errors", () => {
            it("should reject approval for non-existent event", async () => {
                const fakeId = uuidv7();
                await request(app)
                    .post(`/event/${fakeId}/approve`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(404);
            });

            it("should reject if event is already approved", async () => {
                await request(app)
                    .post(`/event/${approvedEvent.id}/approve`)
                    .set("Authorization", `Bearer ${superAdminToken}`)
                    .expect(409);
            });
        });
    });

    describe("POST /event/:eventId/reject - Reject Event", () => {
        let pendingEvent;

        beforeEach(async () => {
            pendingEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Event to Reject",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Location",
                status: "pending",
                description: "Event Description",
                imageUrl: "http://example.com/image.jpg",
                imagePublicId: "public_id",
            });
        });

        it("should allow Super Admin to reject event with reason", async () => {
            const response = await request(app)
                .post(`/event/${pendingEvent.id}/reject`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({ feedback: "Konten tidak sesuai panduan" })
                .expect(200);

            expect(response.body.status).toBe("success");

            await pendingEvent.reload();
            expect(pendingEvent.status).toBe("rejected");

            const rejectNotification = await Notification.findOne({
                where: {
                    recipientId: adminUser.id,
                    notificationType: "event_rejected",
                },
            });

            expect(rejectNotification.feedback).toBe(
                "Konten tidak sesuai panduan",
            );
        });

        it("should require rejection reason", async () => {
            await request(app)
                .post(`/event/${pendingEvent.id}/reject`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({})
                .expect(400);
        });

        it("should create notification for creator after rejection", async () => {
            await request(app)
                .post(`/event/${pendingEvent.id}/reject`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({ feedback: "Alasan penolakan" })
                .expect(200);

            const notifications = await Notification.findAll({
                where: {
                    recipientId: adminUser.id,
                    notificationType: "event_rejected",
                },
            });
            expect(notifications.length).toBeGreaterThan(0);
        });
    });

    describe("POST /event/:eventId/feedback - Giving Feedback", () => {
        let pendingEvent;

        beforeEach(async () => {
            pendingEvent = await Event.create({
                id: uuidv7(),
                creatorId: adminUser.id,
                name: "Event for Revision",
                startDate: new Date(NEXT_MONTH),
                endDate: new Date(NEXT_MONTH_END),
                startTime: "10:00",
                endTime: "12:00",
                location: "Test Location",
                status: "pending",
                description: "Event Description",
                imageUrl: "http://example.com/image.jpg",
                imagePublicId: "public_id",
            });
        });

        it("should allow Super Admin to request revision", async () => {
            const response = await request(app)
                .post(`/event/${pendingEvent.id}/feedback`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({ feedback: "Tolong ganti poster" })
                .expect(201);

            expect(response.body.status).toBe("success");

            await pendingEvent.reload();
            expect(pendingEvent.status).toBe("revised");

            const notification = await Notification.findOne({
                where: {
                    eventId: pendingEvent.id,
                    recipientId: pendingEvent.creatorId,
                },
            });

            expect(notification).toBeTruthy();

            expect(notification.feedback).toBe("Tolong ganti poster");
        });

        it("should require revision note", async () => {
            await request(app)
                .post(`/event/${pendingEvent.id}/feedback`)
                .set("Authorization", `Bearer ${superAdminToken}`)
                .send({})
                .expect(400);
        });
    });
});
