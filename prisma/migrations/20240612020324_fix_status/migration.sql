/*
  Warnings:

  - The values [ACCEPTED] on the enum `DocRecipient_status` will be removed. If these variants are still used in the database, this will fail.
  - The values [ACCEPTED] on the enum `DocRecipient_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `doc` MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECT') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `docrecipient` MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECT') NOT NULL DEFAULT 'PENDING';
