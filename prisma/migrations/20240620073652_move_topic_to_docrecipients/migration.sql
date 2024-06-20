/*
  Warnings:

  - You are about to drop the column `topic` on the `doc` table. All the data in the column will be lost.
  - Added the required column `topic` to the `DocRecipient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `doc` DROP COLUMN `topic`;

-- AlterTable
ALTER TABLE `docrecipient` ADD COLUMN `topic` ENUM('APPROVE', 'REVIEW') NOT NULL;
