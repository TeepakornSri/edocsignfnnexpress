/*
  Warnings:

  - Added the required column `topic` to the `Doc` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `doc` ADD COLUMN `topic` ENUM('APPROVE', 'REVIEW') NOT NULL;
