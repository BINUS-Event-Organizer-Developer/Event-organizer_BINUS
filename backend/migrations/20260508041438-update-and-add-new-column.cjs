"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable("events");

        if (!tableDesc.endDate) {
            await queryInterface.addColumn("events", "endDate", {
                type: Sequelize.DATEONLY,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            });
        }

        if (tableDesc.eventName) {
            await queryInterface.renameColumn("events", "eventName", "name");
        }
    },

    async down(queryInterface, Sequelize) {
        const tableDesc = await queryInterface.describeTable("events");

        if (tableDesc.endDate) {
            await queryInterface.removeColumn("events", "endDate");
        }

        if (tableDesc.name) {
            await queryInterface.renameColumn("events", "name", "eventName");
        }
    },
};
