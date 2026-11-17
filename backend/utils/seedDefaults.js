const { v4: uuidv4 } = require('uuid');

/**
 * Seeds essential initial rows (shop, service_types, pricing_plans, tables)
 * if the database was created with schema-only SQL and those tables are empty.
 */
const ensureDefaultData = async (db) => {
  try {
    // 1. Default shop row (id = 1)
    const [shopRows] = await db.query('SELECT COUNT(*) AS cnt FROM shop');
    if (shopRows[0].cnt === 0) {
      await db.query(
        "INSERT IGNORE INTO shop (id, shop_name, shop_address, shop_phone, open_time, close_time, refill_water_price) VALUES (1, 'มากินปิ้งย่างยากินิกึ & ชาบู', '', '', '10:00:00', '22:00:00', 39.00)"
      );
      console.log('🌱 Seeded default shop record (id = 1)');
    }

    // 2. Default service_types
    const [serviceRows] = await db.query('SELECT COUNT(*) AS cnt FROM service_types');
    if (serviceRows[0].cnt === 0) {
      await db.query(
        "INSERT INTO service_types (name) VALUES ('เตาถ่าน'), ('เตาไฟฟ้า'), ('หม้อชาบู')"
      );
      console.log('🌱 Seeded default service_types');
    }

    // 3. Default pricing_plans
    const [planRows] = await db.query('SELECT COUNT(*) AS cnt FROM pricing_plans');
    if (planRows[0].cnt === 0) {
      await db.query(
        "INSERT INTO pricing_plans (plan_name, price_per_person, description, allow_refill) VALUES ('Set 199 BAHT', 199.00, 'ชุดประหยัด หมู/ไก่/ผัก', 1), ('Set 299 BAHT', 299.00, 'ชุดพรีเมียม เนื้อ/ซีฟู้ด/รีฟิล', 1)"
      );
      console.log('🌱 Seeded default pricing_plans');
    }

    // 4. Default tables (1-4)
    const [tableRows] = await db.query('SELECT COUNT(*) AS cnt FROM tables');
    if (tableRows[0].cnt === 0) {
      const defaultTables = [1, 2, 3, 4].map((num) => [uuidv4(), num, 4, 'ว่าง']);
      await db.query(
        'INSERT INTO tables (uuid, table_number, seat_capacity, status) VALUES ?',
        [defaultTables]
      );
      console.log('🌱 Seeded default tables (1-4)');
    }
  } catch (err) {
    console.warn('⚠️ Default data seeding skipped or failed:', err.message);
  }
};

module.exports = { ensureDefaultData };
