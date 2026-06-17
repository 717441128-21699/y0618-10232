const express = require('express');
const db = require('../database/db');
const { generateOrderNo } = require('../utils/receivable');

const router = express.Router();

router.get('/', async (req, res) => {
  const { page = 1, pageSize = 10, keyword = '', customer_id, status } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (keyword) {
    whereClause += ' AND (order_no LIKE ? OR name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (customer_id) {
    whereClause += ' AND customer_id = ?';
    params.push(customer_id);
  }

  if (status && status !== 'all') {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`);
  const { total } = await countStmt.get(...params);

  const stmt = db.prepare(`
    SELECT o.*, cu.name as customer_name, ct.contract_no
    FROM orders o
    JOIN customers cu ON o.customer_id = cu.id
    LEFT JOIN contracts ct ON o.contract_id = ct.id
    ${whereClause}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const orders = await stmt.all(...params, parseInt(pageSize), offset);

  res.json({
    data: orders,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

router.get('/all', async (req, res) => {
  const orders = await db.prepare(`
    SELECT id, order_no, name, customer_id, contract_id, amount, status
    FROM orders
    ORDER BY order_no DESC
  `).all();

  res.json(orders);
});

router.get('/:id', async (req, res) => {
  const order = await db.prepare(`
    SELECT o.*, cu.name as customer_name, ct.contract_no, ct.name as contract_name
    FROM orders o
    JOIN customers cu ON o.customer_id = cu.id
    LEFT JOIN contracts ct ON o.contract_id = ct.id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const invoices = await db.prepare(`
    SELECT * FROM invoices WHERE order_id = ? ORDER BY invoice_date DESC
  `).all(req.params.id);

  res.json({
    ...order,
    invoices
  });
});

router.post('/', async (req, res) => {
  const { customer_id, contract_id, name, amount, order_date, status, remarks } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: '客户和订单名称不能为空' });
  }

  const order_no = generateOrderNo();

  const stmt = db.prepare(`
    INSERT INTO orders (order_no, customer_id, contract_id, name, amount, order_date, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(
    order_no,
    customer_id,
    contract_id || null,
    name,
    amount || 0,
    order_date || null,
    status || 'pending',
    remarks || null
  );

  res.json({
    id: result.lastInsertRowid,
    order_no,
    message: '订单创建成功'
  });
});

router.put('/:id', async (req, res) => {
  const { customer_id, contract_id, name, amount, order_date, status, remarks } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: '客户和订单名称不能为空' });
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const stmt = db.prepare(`
    UPDATE orders 
    SET customer_id = ?, contract_id = ?, name = ?, amount = ?, order_date = ?, 
        status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  await stmt.run(
    customer_id,
    contract_id || null,
    name,
    amount || 0,
    order_date || null,
    status || 'pending',
    remarks || null,
    req.params.id
  );

  res.json({ message: '订单更新成功' });
});

router.delete('/:id', async (req, res) => {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }

  const hasInvoices = (await db.prepare('SELECT COUNT(*) as count FROM invoices WHERE order_id = ?').get(req.params.id)).count > 0;
  if (hasInvoices) {
    return res.status(400).json({ error: '该订单存在关联发票，无法删除' });
  }

  await db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);

  res.json({ message: '订单删除成功' });
});

module.exports = router;
