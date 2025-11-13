-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: myappdb
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `order_id` int unsigned NOT NULL AUTO_INCREMENT,
  `table_id` int unsigned NOT NULL,
  `customer_quantity` int NOT NULL,
  `plan_id` int unsigned DEFAULT NULL,
  `service_type` enum('ปิ้งย่าง','ชาบู') NOT NULL,
  `start_time` datetime NOT NULL,
  `order_status` varchar(50) NOT NULL DEFAULT 'in-progress',
  `total_price` decimal(10,2) DEFAULT NULL,
  `customer_join_count` int DEFAULT '0',
  PRIMARY KEY (`order_id`),
  KEY `table_id` (`table_id`),
  KEY `plan_id` (`plan_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`table_id`) REFERENCES `tables` (`table_id`),
  CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `pricing_plans` (`id`),
  CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`plan_id`) REFERENCES `pricing_plans` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (1,1,2,2,'ปิ้งย่าง','2025-10-17 00:42:08','completed',NULL,0),(2,1,4,1,'ปิ้งย่าง','2025-10-17 02:51:42','completed',NULL,0),(3,2,1,1,'ปิ้งย่าง','2025-10-17 03:04:35','completed',NULL,0),(4,1,1,1,'ปิ้งย่าง','2025-10-17 03:38:32','completed',NULL,0),(8,1,1,1,'ปิ้งย่าง','2025-10-17 20:35:35','completed',NULL,0),(11,1,1,1,'ปิ้งย่าง','2025-10-18 14:35:21','completed',NULL,0),(28,1,1,1,'ปิ้งย่าง','2025-10-19 16:13:05','completed',NULL,3),(29,1,1,1,'ปิ้งย่าง','2025-10-19 16:32:38','completed',NULL,0),(30,1,2,1,'ชาบู','2025-10-23 13:01:23','completed',NULL,0),(31,1,2,1,'ชาบู','2025-10-23 13:07:52','completed',NULL,2),(32,1,2,2,'ชาบู','2025-10-23 13:13:18','completed',NULL,2),(33,1,1,1,'ชาบู','2025-10-23 13:14:39','completed',NULL,2),(34,1,1,1,'ชาบู','2025-10-23 13:17:05','completed',NULL,1),(35,1,1,1,'ปิ้งย่าง','2025-10-23 13:39:19','completed',NULL,1);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-13 15:35:57
