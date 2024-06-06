/*
  Warnings:

  - You are about to drop the column `userId` on the `doc` table. All the data in the column will be lost.
  - Added the required column `senderId` to the `Doc` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `doc` DROP FOREIGN KEY `Doc_userId_fkey`;

-- AlterTable
ALTER TABLE `doc` DROP COLUMN `userId`,
    ADD COLUMN `senderId` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `DocRecipient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `docId` INTEGER NOT NULL,
    `recipientId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Doc` ADD CONSTRAINT `Doc_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocRecipient` ADD CONSTRAINT `DocRecipient_docId_fkey` FOREIGN KEY (`docId`) REFERENCES `Doc`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocRecipient` ADD CONSTRAINT `DocRecipient_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
