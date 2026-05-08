"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable("events");

        if (tableDesc.date) {
            await queryInterface.renameColum("events", "date", "startDate");
        }
    },

    async down(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable("events");
        if (tableDesc.startDate) {
            await queryInterface.renameColum("events", "startDate", "endDate");
        }
    },
};
