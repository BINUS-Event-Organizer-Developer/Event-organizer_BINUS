"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable("events");

        if (tableDesc.date) {
            await queryInterface.renameColumn("events", "date", "startDate");
        }
    },

    async down(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable("events");
        if (tableDesc.startDate) {
            await queryInterface.renameColumn("events", "startDate", "date");
        }
    },
};
