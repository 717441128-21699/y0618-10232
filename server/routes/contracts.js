const express = require('express');
const db = require('../database/db');
const { generateContractNo } = require('../utils/receivable');

const router = express.Router();

router.get('/', async (req, res) => {
  const { page = 1, pageSize = 10, keyword = '', customer_id, status } = req.query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (keyword) {
    whereClause += ' AND (contract_no LIKE ? OR name LIKE ?)';
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

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM contracts ${whereClause}`);
  const { total } = await countStmt.get(...params);

  const stmt = db.prepare(`
    SELECT c.*, cu.name as customer_name
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const contracts = await stmt.all(...params, parseInt(pageSize), offset);

  res.json({
    data: contracts,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

router.get('/all', async (req, res) => {
  const contracts = await db.prepare(`
    SELECT id, contract_no, name, customer_id, amount, status
    FROM contracts
    ORDER BY contract_no DESC
  `).all();

  res.json(contracts);
});

router.get('/:id', async (req, res) => {
  const contract = await db.prepare(`
    SELECT c.*, cu.name as customer_name
    FROM contracts c
    JOIN customers cu ON c.customer_id = cu.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  const orders = await db.prepare(`
    SELECT * FROM orders WHERE contract_id = ? ORDER BY order_date DESC
  `).all(req.params.id);

  const invoices = await db.prepare(`
    SELECT * FROM invoices WHERE contract_id = ? ORDER BY invoice_date DESC
  `).all(req.params.id);

  res.json({
    ...contract,
    orders,
    invoices
  });
});

router.post('/', async (req, res) => {
  const { customer_id, name, amount, sign_date, start_date, end_date, status, remarks } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: '客户和合同名称不能为空' });
  }

  const contract_no = generateContractNo();

  const stmt = db.prepare(`
    INSERT INTO contracts (contract_no, customer_id, name, amount, sign_date, start_date, end_date, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(
    contract_no,
    customer_id,
    name,
    amount || 0,
    sign_date || null,
    start_date || null,
    end_date || null,
    status || 'active',
    remarks || null
  );

  res.json({
    id: result.lastInsertRowid,
    contract_no,
    message: '合同创建成功'
  });
});

router.put('/:id', async (req, res) => {
  const { customer_id, name, amount, sign_date, start_date, end_date, status, remarks } = req.body;

  if (!customer_id || !name) {
    return res.status(400).json({ error: '客户和合同名称不能为空' });
  }

  const contract = await db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  const stmt = db.prepare(`
    UPDATE contracts 
    SET customer_id = ?, name = ?, amount = ?, sign_date = ?, start_date = ?, 
        end_date = ?, status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  await stmt.run(
    customer_id,
    name,
    amount || 0,
    sign_date || null,
    start_date || null,
    end_date || null,
    status || 'active',
    remarks || null,
    req.params.id
  );

  res.json({ message: '合同更新成功' });
});

router.delete('/:id', async (req, res) => {
  const contract = await db.prepare('SELECT * FROM contracts WHERE id = ?').get(req.params.id);
  if (!contract) {
    return res.status(404).json({ error: '合同不存在' });
  }

  const hasInvoices = (await db.prepare('SELECT COUNT(*) as count FROM invoices WHERE contract_id = ?').get(req.params.id)).count > 0;
  if (hasInvoices) {
    return res.status(400).json({ error: '该合同存在关联发票，无法删除' });
  }

  const hasOrders = (await db.prepare('SELECT COUNT(*) as count FROM orders WHERE contract_id = ?').get(req.params.id)).count > 0;
  if (hasOrders) {
    return res.status(400).json({ error: '该合同存在关联订单，无法删除' });
  }

  await db.prepare('DELETE FROM contracts WHERE id = ?').run(req.params.id);

  res.json({ message: '合同删除成功' });
});

module.exports = router;
