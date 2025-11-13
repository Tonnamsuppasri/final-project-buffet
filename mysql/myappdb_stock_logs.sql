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
-- Table structure for table `stock_logs`
--

DROP TABLE IF EXISTS `stock_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_logs`
--

LOCK TABLES `stock_logs` WRITE;
/*!40000 ALTER TABLE `stock_logs` DISABLE KEYS */;
INSERT INTO `stock_logs` VALUES (1,1,0,0,'2025-10-23 16:42:04','initial',NULL,NULL),(2,2,0,0,'2025-10-23 16:42:04','initial',NULL,NULL),(3,3,0,0,'2025-10-23 16:42:04','initial',NULL,NULL),(4,1,300,300,'2025-10-23 17:04:08','adjustment',NULL,NULL),(5,3,24,24,'2025-10-23 17:04:13','adjustment',NULL,NULL),(6,2,49,49,'2025-10-23 17:04:17','adjustment',NULL,NULL),(7,1,-50,250,'2025-10-23 17:06:52','adjustment',NULL,NULL),(8,4,10,40,'2025-10-23 17:29:52','adjustment',NULL,NULL),(9,4,-5,35,'2025-10-23 17:29:55','adjustment',NULL,NULL),(10,5,15,115,'2025-10-23 17:30:00','adjustment',NULL,NULL),(11,5,-35,80,'2025-10-23 17:30:08','adjustment',NULL,NULL),(12,6,-20,180,'2025-10-23 17:30:14','adjustment',NULL,NULL),(13,1,-5,245,'2025-10-23 17:33:23','sale',NULL,35),(14,8,-7,59,'2025-10-23 17:34:03','adjustment',NULL,NULL),(15,7,-13,137,'2025-10-23 17:34:07','adjustment',NULL,NULL),(16,9,-13,86,'2025-10-23 17:34:11','adjustment',NULL,NULL),(17,9,10,96,'2025-10-23 17:34:15','adjustment',NULL,NULL);
/*!40000 ALTER TABLE `stock_logs` ENABLE KEYS */;
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
