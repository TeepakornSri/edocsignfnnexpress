/*
  Warnings:

  - Added the required column `step` to the `DocRecipient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `docrecipient` ADD COLUMN `step` INTEGER NOT NULL;
