const express = require('express');
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/auth');

module.exports = () => {
  const router = express.Router();

  router.get('/api/plans', async (req, res) => {
    try {
      const [plans] = await db.query('SELECT * FROM pricing_plans');
      const [accessData] = await db.query('SELECT * FROM plan_menu_access');

      const plansWithMenus = plans.map((plan) => {
        const pId = String(plan.id || plan.plan_id || plan.pricing_plan_id);

        const selectedMenuIds = accessData
          .filter((item) => {
            const accessPlanId = String(item.plan_id || item.pricing_plan_id);
            return accessPlanId === pId;
          })
          .map((item) => Number(item.menu_id));

        return {
          ...plan,
          id: Number(pId),
          menu_ids: selectedMenuIds
        };
      });

      res.json(plansWithMenus);
    } catch (err) {
      console.error('Error fetching plans:', err);
      res.status(500).json({ error: 'Failed to fetch plans' });
    }
  });

  // Protected: เพิ่มแผนราคา
  router.post('/api/plans', requireAuth, requireAdmin, async (req, res) => {
    const { plan_name, price_per_person, description, menu_ids, allow_refill } = req.body;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'INSERT INTO pricing_plans (plan_name, price_per_person, description, allow_refill) VALUES (?, ?, ?, ?)',
        [plan_name, price_per_person, description, allow_refill || 0]
      );
      const planId = result.insertId;

      if (menu_ids && menu_ids.length > 0) {
        const values = menu_ids.map((menuId) => [planId, menuId]);
        await connection.query(
          'INSERT INTO plan_menu_access (plan_id, menu_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      res.json({ message: 'Plan created successfully', id: planId });
    } catch (err) {
      await connection.rollback();
      console.error(err);
      res.status(500).json({ error: 'Failed to create plan' });
    } finally {
      connection.release();
    }
  });

  // Protected: แก้ไขแผนราคา
  router.put('/api/plans/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { plan_name, price_per_person, description, menu_ids, allow_refill } = req.body;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        'UPDATE pricing_plans SET plan_name = ?, price_per_person = ?, description = ?, allow_refill = ? WHERE id = ?',
        [plan_name, price_per_person, description, allow_refill || 0, id]
      );

      await connection.query('DELETE FROM plan_menu_access WHERE plan_id = ?', [id]);

      if (menu_ids && menu_ids.length > 0) {
        const values = menu_ids.map((menuId) => [id, menuId]);
        await connection.query(
          'INSERT INTO plan_menu_access (plan_id, menu_id) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      res.json({ message: 'Plan updated successfully' });
    } catch (err) {
      await connection.rollback();
      console.error(err);
      res.status(500).json({ error: 'Failed to update plan' });
    } finally {
      connection.release();
    }
  });

  // Protected: ลบแผนราคา
  router.delete('/api/plans/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM pricing_plans WHERE id = ?', [id]);
      res.json({ message: 'Plan deleted successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  });

  return router;
};
