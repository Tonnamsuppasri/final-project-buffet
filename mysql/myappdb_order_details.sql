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
-- Table structure for table `order_details`
--

DROP TABLE IF EXISTS `order_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_details`
--

LOCK TABLES `order_details` WRITE;
/*!40000 ALTER TABLE `order_details` DISABLE KEYS */;
INSERT INTO `order_details` VALUES (1,1,1,2,59.00,'กำลังจัดทำ','2025-10-17 14:40:32',NULL),(2,8,1,2,59.00,'จัดส่งแล้ว','2025-10-17 14:46:09',NULL),(3,8,1,2,59.00,'จัดส่งแล้ว','2025-10-17 14:49:19',NULL),(4,8,1,2,59.00,'กำลังจัดทำ','2025-10-17 14:49:33',NULL),(5,11,1,4,0.00,'กำลังจัดทำ','2025-10-18 08:17:19',NULL),(6,11,1,3,0.00,'จัดส่งแล้ว','2025-10-18 08:42:50',NULL),(7,11,1,1,0.00,'จัดส่งแล้ว','2025-10-18 09:25:39',NULL),(8,11,1,1,0.00,'กำลังจัดทำ','2025-10-18 11:31:16',NULL),(9,11,1,1,0.00,'กำลังจัดทำ','2025-10-18 15:29:59',NULL),(10,11,1,2,0.00,'กำลังจัดทำ','2025-10-18 16:01:55',NULL),(11,11,1,1,0.00,'กำลังจัดทำ','2025-10-18 16:03:35',NULL),(12,11,1,1,0.00,'กำลังจัดทำ','2025-10-18 16:03:54',NULL),(23,28,1,2,0.00,'จัดส่งแล้ว','2025-10-19 09:15:46','ลูกค้า A'),(24,30,3,7,10.00,'กำลังจัดทำ','2025-10-23 06:01:45','ลูกค้า A'),(25,30,1,5,0.00,'กำลังจัดทำ','2025-10-23 06:01:45','ลูกค้า A'),(26,31,3,4,10.00,'กำลังจัดทำ','2025-10-23 06:11:09','ลูกค้า B'),(27,32,3,4,10.00,'กำลังจัดทำ','2025-10-23 06:13:25','ลูกค้า B'),(28,33,1,24,0.00,'จัดส่งแล้ว','2025-10-23 06:15:24','ลูกค้า B'),(29,33,2,3,0.00,'จัดส่งแล้ว','2025-10-23 06:15:24','ลูกค้า B'),(30,33,3,2,10.00,'กำลังจัดทำ','2025-10-23 06:17:14','ลูกค้า B'),(31,34,3,3,10.00,'กำลังจัดทำ','2025-10-23 06:17:49','ลูกค้า A'),(32,34,2,5,0.00,'กำลังจัดทำ','2025-10-23 06:18:16','ลูกค้า A'),(33,34,1,4,0.00,'กำลังจัดทำ','2025-10-23 06:18:16','ลูกค้า A'),(34,34,1,12,0.00,'กำลังจัดทำ','2025-10-23 06:18:35','ลูกค้า A'),(35,35,1,5,0.00,'จัดส่งแล้ว','2025-10-23 10:32:58','ลูกค้า A');
/*!40000 ALTER TABLE `order_details` ENABLE KEYS */;
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
