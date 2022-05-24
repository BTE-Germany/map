-- CreateTable
CREATE TABLE `Region` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `userUUID` VARCHAR(191) NOT NULL,
    `ownerID` VARCHAR(191) NOT NULL,
    `data` TEXT NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `area` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `ssoId` VARCHAR(191) NOT NULL,
    `discordId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_ssoId_key`(`ssoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Region` ADD CONSTRAINT `Region_ownerID_fkey` FOREIGN KEY (`ownerID`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
