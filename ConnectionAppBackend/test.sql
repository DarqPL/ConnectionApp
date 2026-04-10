-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               11.8.3-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.15.0.7171
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for appchat
CREATE DATABASE IF NOT EXISTS `appchat` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;
USE `appchat`;

-- Dumping structure for table appchat.conversation_users
CREATE TABLE IF NOT EXISTS `conversation_users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `joined_at` datetime(6) DEFAULT NULL,
  `role` enum('CO_OWNER','MEMBER','OWNER') DEFAULT NULL,
  `unread_counts` bigint(20) DEFAULT NULL,
  `conversation_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKst1n0w3ucx3g40ojkxeqy8mpj` (`conversation_id`,`user_id`),
  KEY `FKpn6opxurwrxsbkr91jqj2qfdy` (`user_id`),
  CONSTRAINT `FK63p0tbk14kd41sn7v1cw6xp2f` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`),
  CONSTRAINT `FKpn6opxurwrxsbkr91jqj2qfdy` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table appchat.conversation_users: ~7 rows (approximately)
INSERT INTO `conversation_users` (`id`, `joined_at`, `role`, `unread_counts`, `conversation_id`, `user_id`) VALUES
	(1, '2026-03-10 18:00:00.000000', 'MEMBER', 0, 1, 1),
	(2, '2026-03-10 18:00:00.000000', 'MEMBER', 2, 1, 2),
	(3, '2026-03-10 18:10:00.000000', 'MEMBER', 1, 2, 1),
	(4, '2026-03-10 18:10:00.000000', 'MEMBER', 0, 2, 3),
	(5, '2026-03-10 18:30:00.000000', 'OWNER', 0, 3, 1),
	(6, '2026-03-10 18:32:00.000000', 'CO_OWNER', 5, 3, 2),
	(7, '2026-03-10 18:35:00.000000', 'MEMBER', 0, 3, 3);

-- Dumping structure for table appchat.conversations
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `activate` bit(1) NOT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `last_message_at` datetime(6) DEFAULT NULL,
  `last_message_content` text DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `type` enum('GROUP','PRIVATE') DEFAULT NULL,
  `update_at` datetime(6) DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK5uxcbsjes7nd38wm1qtsfaw28` (`created_by`),
  CONSTRAINT `FK5uxcbsjes7nd38wm1qtsfaw28` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table appchat.conversations: ~3 rows (approximately)
INSERT INTO `conversations` (`id`, `activate`, `avatar_url`, `created_at`, `last_message_at`, `last_message_content`, `name`, `type`, `update_at`, `created_by`) VALUES
	(1, b'1', NULL, '2026-03-10 18:00:00.000000', NULL, NULL, NULL, 'PRIVATE', '2026-03-10 18:05:00.000000', 1),
	(2, b'1', NULL, '2026-03-10 18:10:00.000000', NULL, NULL, NULL, 'PRIVATE', '2026-03-10 18:12:00.000000', 3),
	(3, b'1', 'https://example.com/avatar/team-dev.jpg', '2026-03-10 18:30:00.000000', NULL, NULL, 'Team Dev', 'GROUP', '2026-03-10 18:45:00.000000', 1);

-- Dumping structure for table appchat.friends
CREATE TABLE IF NOT EXISTS `friends` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `status` enum('ACCEPTED','BLOCKED','PENDING') NOT NULL,
  `update_at` datetime(6) DEFAULT NULL,
  `receiver_id` bigint(20) NOT NULL,
  `requester_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKkfpr9vjrin0b2d6k5of006l9c` (`requester_id`,`receiver_id`),
  KEY `FK5c5mwkpdeyhhbhulwujqhv4al` (`receiver_id`),
  CONSTRAINT `FK5c5mwkpdeyhhbhulwujqhv4al` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK5mwylmmw7ot92jog0004x3gn1` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table appchat.friends: ~4 rows (approximately)
INSERT INTO `friends` (`id`, `created_at`, `status`, `update_at`, `receiver_id`, `requester_id`) VALUES
	(1, '2026-03-10 17:40:00.000000', 'ACCEPTED', '2026-03-10 17:45:00.000000', 2, 1),
	(2, '2026-03-10 17:41:00.000000', 'ACCEPTED', '2026-03-10 17:46:00.000000', 1, 3),
	(3, '2026-03-10 17:50:00.000000', 'PENDING', NULL, 4, 2),
	(4, '2026-03-10 17:55:00.000000', 'BLOCKED', '2026-03-10 17:55:00.000000', 4, 3);

-- Dumping structure for table appchat.refesh_tokens
CREATE TABLE IF NOT EXISTS `refesh_tokens` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `expiry_date` datetime(6) DEFAULT NULL,
  `token` varchar(255) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKhsw7kv130m2flob0vdw8y38w2` (`token`),
  KEY `idx_refesh_tokens_user_id` (`user_id`),
  CONSTRAINT `FKndh3gopjg6n48emqb8iihy6pb` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table appchat.refesh_tokens: ~4 rows (approximately)
INSERT INTO `refesh_tokens` (`id`, `expiry_date`, `token`, `user_id`) VALUES
	(1, '2026-03-17 18:17:33.645732', 'cb926ebd-399d-455a-9d7c-37a39c5343e6', 1),
	(2, '2026-03-17 18:19:14.525111', 'aec4a255-ff06-4826-9c2a-08de40c81522', 2),
	(3, '2026-03-17 17:39:15.353631', 'e9b3d422-badf-45c2-936c-38f3bcd60160', 4),
	(4, '2026-03-17 18:01:44.646229', '289438c1-2fb9-4b6f-a31d-d52a53f74b14', 3);

-- Dumping structure for table appchat.users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `avatar_url` varchar(255) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `dob` datetime(6) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `gender` enum('FEMALE','MALE','OTHER') DEFAULT NULL,
  `hash_password` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `role` enum('ADMIN','USER') DEFAULT NULL,
  `status` enum('OFFLINE','ONLINE') DEFAULT NULL,
  `update_at` datetime(6) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKr43af9ap4edm43mmtq01oddj6` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table appchat.users: ~4 rows (approximately)
INSERT INTO `users` (`id`, `avatar_url`, `created_at`, `display_name`, `dob`, `email`, `gender`, `hash_password`, `phone`, `role`, `status`, `update_at`, `username`) VALUES
	(1, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test1', '2026-03-10 17:27:46.454238', 'tentest hotest', NULL, 'test@gmail.com', NULL, '$2a$10$SFwMBqPMqmZGk4qRXw6oUeWpqz.UaYvAkd/h0vD5E1fSW1mwDKHyK', NULL, 'USER', 'OFFLINE', NULL, 'test'),
	(2, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test2', '2026-03-10 17:28:09.795926', 'tentest2 hotest2', NULL, 'test2@gmail.com', NULL, '$2a$10$3aS5nWp0eWq/Ed/OQeodcOgVtJiZxnBBIR7dUrsMAlOjMNiKmC2Ce', NULL, 'USER', 'OFFLINE', NULL, 'test2'),
	(3, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test3', '2026-03-10 17:30:42.914501', 'hotest3 hotest3', NULL, 'test3@gmail.com', NULL, '$2a$10$/Ykim0KVJmtYmaCsjUl1beznrH7DeP5FB5Afr.iGuw9rY2HCKESY.', NULL, 'USER', 'OFFLINE', NULL, 'test3'),
	(4, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test4', '2026-03-10 17:30:58.366804', 'hotest4 hotest4', NULL, 'test4@gmail.com', NULL, '$2a$10$4jgZmX8a0XMUx9PDAxspjeGlksWUHh5a8NsF9HLtvL5VtD9bz75mK', NULL, 'USER', 'OFFLINE', NULL, 'test4');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
