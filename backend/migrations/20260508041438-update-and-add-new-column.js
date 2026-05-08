"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("events", "endDate", {
            type: DataTypes.DATEONLY,
            allowNull: false,
        });

        await queryInterface.renameColumn("events", "eventName", "name");
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn("events", "endDate");
        await queryInterface.renameColumn("events", "name", "eventName");
    },
};
