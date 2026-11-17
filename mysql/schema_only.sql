CREATE DATABASE IF NOT EXISTS `myappdb` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `myappdb`;

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `attendance` (
  `attendance_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `clock_in_time` datetime NOT NULL,
  `clock_out_time` datetime DEFAULT NULL,
  `date` date NOT NULL,
  `notes` text,
  PRIMARY KEY (`attendance_id`),
  KEY `idx_user_date` (`user_id`,`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `menu` (
  `menu_id` int NOT NULL AUTO_INCREMENT,
  `menu_name` varchar(255) NOT NULL,
  `menu_description` text,
  `menu_category` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `menu_quantity` int NOT NULL DEFAULT '0',
  `menu_image` longblob,
  PRIMARY KEY (`menu_id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_details` (
  `order_detail_id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `menu_id` int NOT NULL,
  `quantity` int NOT NULL,
  `price_per_item` decimal(10,2) NOT NULL,
  `item_status` varchar(50) NOT NULL DEFAULT 'กำลังจัดทำ',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `customer_name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`order_detail_id`),
  KEY `order_id` (`order_id`),
  KEY `menu_id` (`menu_id`),
  CONSTRAINT `order_details_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  CONSTRAINT `order_details_ibfk_2` FOREIGN KEY (`menu_id`) REFERENCES `menu` (`menu_id`)
) ENGINE=InnoDB AUTO_INCREMENT=146 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orders` (
  `order_id` int unsigned NOT NULL AUTO_INCREMENT,
  `table_id` int unsigned NOT NULL,
  `customer_quantity` int NOT NULL,
  `plan_id` int unsigned DEFAULT NULL,
  `service_type` varchar(100) NOT NULL,
  `start_time` datetime NOT NULL,
  `order_status` varchar(50) NOT NULL DEFAULT 'in-progress',
  `total_price` decimal(10,2) DEFAULT NULL,
  `customer_join_count` int DEFAULT '0',
  `order_uuid` varchar(36) DEFAULT NULL,
  `refill_water` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`order_id`),
  UNIQUE KEY `order_uuid` (`order_uuid`),
  KEY `table_id` (`table_id`),
  KEY `plan_id` (`plan_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`table_id`) REFERENCES `tables` (`table_id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `pricing_plans` (`id`),
  CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`plan_id`) REFERENCES `pricing_plans` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `payment` (
  `payment_id` int unsigned NOT NULL AUTO_INCREMENT,
  `order_id` int unsigned NOT NULL,
  `payment_time` datetime NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `discount` decimal(10,2) DEFAULT '0.00',
  `promotion_id` int DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `uq_order_id` (`order_id`),
  CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plan_menu_access` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int unsigned NOT NULL,
  `menu_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `plan_id` (`plan_id`,`menu_id`),
  KEY `menu_id` (`menu_id`),
  CONSTRAINT `plan_menu_access_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `pricing_plans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `plan_menu_access_ibfk_2` FOREIGN KEY (`menu_id`) REFERENCES `menu` (`menu_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=87 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pricing_plans` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `plan_name` varchar(255) NOT NULL,
  `price_per_person` decimal(10,2) NOT NULL,
  `description` text,
  `allow_refill` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `promotions` (
  `promotion_id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `type` enum('percentage','fixed_amount','special') NOT NULL,
  `value` decimal(10,2) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `conditions` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`promotion_id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shop` (
  `id` int NOT NULL AUTO_INCREMENT,
  `shop_name` varchar(255) NOT NULL,
  `shop_address` text,
  `shop_phone` varchar(50) DEFAULT NULL,
  `open_time` time DEFAULT NULL,
  `close_time` time DEFAULT NULL,
  `payment_qr_code` longblob,
  `shop_logo` longblob,
  `refill_water_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stock_logs` (
  `log_id` int unsigned NOT NULL AUTO_INCREMENT,
  `menu_id` int NOT NULL,
  `change_quantity` int NOT NULL,
  `new_quantity` int NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` enum('stock_in','sale','adjustment','waste','initial') NOT NULL,
  `user_id` int DEFAULT NULL,
  `order_detail_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_menu_time` (`menu_id`,`timestamp`),
  KEY `user_id` (`user_id`),
  KEY `order_detail_id` (`order_detail_id`),
  CONSTRAINT `stock_logs_ibfk_1` FOREIGN KEY (`menu_id`) REFERENCES `menu` (`menu_id`) ON DELETE CASCADE,
  CONSTRAINT `stock_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_logs_ibfk_3` FOREIGN KEY (`order_detail_id`) REFERENCES `order_details` (`order_detail_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=72 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tables` (
  `table_id` int unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(36) NOT NULL,
  `table_number` int unsigned NOT NULL,
  `seat_capacity` int NOT NULL,
  `status` enum('ว่าง','ไม่ว่าง') NOT NULL,
  PRIMARY KEY (`table_id`),
  UNIQUE KEY `table_number` (`table_number`),
  UNIQUE KEY `uuid` (`uuid`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(100) NOT NULL,
  `role` enum('Admin','Staff') NOT NULL DEFAULT 'Staff',
  `nickname` varchar(100) DEFAULT '',
  `first_name` varchar(100) DEFAULT '',
  `last_name` varchar(100) DEFAULT '',
  `phone` varchar(20) DEFAULT ' ',
  `image` longblob,
  `permissions` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`username`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
