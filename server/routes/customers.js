const express = require('express');
const db = require('../database/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { page = 1, pageSize = 10, keyword = '' } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClause = '';
  let params = [];

  if (keyword) {
    whereClause = 'WHERE name LIKE ? OR contact_name LIKE ? OR contact_email LIKE ?';
    params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`];
  }

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM customers ${whereClause}`);
  const { total } = await countStmt.get(...params);

  const stmt = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) as invoice_count,
      (SELECT COALESCE(SUM(total_amount), 0) FROM invoices i WHERE i.customer_id = c.id) as total_invoice_amount,
      (SELECT COALESCE(SUM(remaining_amount), 0) FROM invoices i WHERE i.customer_id = c.id AND i.remaining_amount > 0) as total_receivable
    FROM customers c
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const customers = await stmt.all(...params, parseInt(pageSize), offset);

  res.json({
    data: customers,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

router.get('/all', async (req, res) => {
  const customers = await db.prepare(`
    SELECT id, name, contact_name, contact_email, contact_phone
    FROM customers
    ORDER BY name
  `).all();

  res.json(customers);
});

router.get('/:id', async (req, res) => {
  const customer = await db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) as invoice_count,
      (SELECT COALESCE(SUM(total_amount), 0) FROM invoices i WHERE i.customer_id = c.id) as total_invoice_amount,
      (SELECT COALESCE(SUM(remaining_amount), 0) FROM invoices i WHERE i.customer_id = c.id AND i.remaining_amount > 0) as total_receivable
    FROM customers c
    WHERE c.id = ?
  `).get(req.params.id);

  if (!customer) {
    return res.status(404).json({ error: '客户不存在' });
  }

  const invoices = await db.prepare(`
    SELECT i.*,
      ct.contract_no,
      o.order_no
    FROM invoices i
    LEFT JOIN contracts ct ON i.contract_id = ct.id
    LEFT JOIN orders o ON i.order_id = o.id
    WHERE i.customer_id = ?
    ORDER BY i.invoice_date DESC
  `).all(req.params.id);

  const payments = await db.prepare(`
    SELECT p.*, i.invoice_no
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE p.customer_id = ?
    ORDER BY p.payment_date DESC
  `).all(req.params.id);

  res.json({
    ...customer,
    invoices,
    payments
  });
});

router.post('/', async (req, res) => {
  const { name, contact_name, contact_email, contact_phone, address, credit_level } = req.body;

  if (!name) {
    return res.status(400).json({ error: '客户名称不能为空' });
  }

  const stmt = db.prepare(`
    INSERT INTO customers (name, contact_name, contact_email, contact_phone, address, credit_level)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(
    name,
    contact_name || null,
    contact_email || null,
    contact_phone || null,
    address || null,
    credit_level || 1
  );

  res.json({
    id: result.lastInsertRowid,
    message: '客户创建成功'
  });
});

router.put('/:id', async (req, res) => {
  const { name, contact_name, contact_email, contact_phone, address, credit_level } = req.body;

  if (!name) {
    return res.status(400).json({ error: '客户名称不能为空' });
  }

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: '客户不存在' });
  }

  const stmt = db.prepare(`
    UPDATE customers 
    SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, 
        address = ?, credit_level = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  await stmt.run(
    name,
    contact_name || null,
    contact_email || null,
    contact_phone || null,
    address || null,
    credit_level || 1,
    req.params.id
  );

  res.json({ message: '客户更新成功' });
});

router.delete('/:id', async (req, res) => {
  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: '客户不存在' });
  }

  const hasInvoices = (await db.prepare('SELECT COUNT(*) as count FROM invoices WHERE customer_id = ?').get(req.params.id)).count > 0;
  if (hasInvoices) {
    return res.status(400).json({ error: '该客户存在关联发票，无法删除' });
  }

  await db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);

  res.json({ message: '客户删除成功' });
});

module.exports = router;
