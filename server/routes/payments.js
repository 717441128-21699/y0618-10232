const express = require('express');
const db = require('../database/db');
const { generatePaymentNo } = require('../utils/receivable');

const router = express.Router();

router.get('/', async (req, res) => {
  const { 
    page = 1, 
    pageSize = 10, 
    keyword = '', 
    customer_id, 
    invoice_id,
    start_date,
    end_date
  } = req.query;
  
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (keyword) {
    whereClause += ' AND (payment_no LIKE ? OR p.remarks LIKE ? OR i.invoice_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (customer_id) {
    whereClause += ' AND p.customer_id = ?';
    params.push(customer_id);
  }

  if (invoice_id) {
    whereClause += ' AND p.invoice_id = ?';
    params.push(invoice_id);
  }

  if (start_date) {
    whereClause += ' AND p.payment_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND p.payment_date <= ?';
    params.push(end_date);
  }

  const { total } = await db.get(`SELECT COUNT(*) as total FROM payments p ${whereClause}`, ...params);

  const payments = await db.all(`
    SELECT p.*, 
      cu.name as customer_name,
      i.invoice_no,
      i.total_amount as invoice_amount
    FROM payments p
    JOIN customers cu ON p.customer_id = cu.id
    JOIN invoices i ON p.invoice_id = i.id
    ${whereClause}
    ORDER BY p.payment_date DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `, ...params, parseInt(pageSize), offset);

  const stats = await db.get(`
    SELECT
      COALESCE(SUM(p.amount), 0) as total_amount,
      COUNT(*) as total_count
    FROM payments p
    ${whereClause}
  `, ...params);

  res.json({
    data: payments,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    stats
  });
});

router.get('/:id', async (req, res) => {
  const payment = await db.get(`
    SELECT p.*, 
      cu.name as customer_name,
      cu.contact_email,
      i.invoice_no,
      i.total_amount as invoice_amount,
      i.remaining_amount as invoice_remaining
    FROM payments p
    JOIN customers cu ON p.customer_id = cu.id
    JOIN invoices i ON p.invoice_id = i.id
    WHERE p.id = ?
  `, req.params.id);

  if (!payment) {
    return res.status(404).json({ error: '收款记录不存在' });
  }

  res.json(payment);
});

router.post('/', async (req, res) => {
  const {
    customer_id,
    invoice_id,
    amount,
    payment_date,
    payment_method,
    bank_name,
    bank_account,
    remarks
  } = req.body;

  if (!customer_id || !invoice_id || !amount || !payment_date) {
    return res.status(400).json({ error: '必填字段不能为空' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: '收款金额必须大于0' });
  }

  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', invoice_id);
  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }

  if (invoice.customer_id !== parseInt(customer_id)) {
    return res.status(400).json({ error: '客户与发票不匹配' });
  }

  if (amount > invoice.remaining_amount) {
    return res.status(400).json({ 
      error: `收款金额不能超过发票待付金额 ¥${invoice.remaining_amount.toLocaleString()}` 
    });
  }

  const payment_no = generatePaymentNo();

  const result = await db.run(`
    INSERT INTO payments (
      payment_no, customer_id, invoice_id, amount,
      payment_date, payment_method, bank_name, bank_account, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    payment_no,
    customer_id,
    invoice_id,
    amount,
    payment_date,
    payment_method || null,
    bank_name || null,
    bank_account || null,
    remarks || null
  );

  const newPaidAmount = invoice.paid_amount + amount;
  const newRemainingAmount = invoice.total_amount - newPaidAmount;
  const newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';

  await db.run(`
    UPDATE invoices 
    SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, newPaidAmount, newRemainingAmount, newStatus, invoice_id);

  res.json({
    id: result.lastInsertRowid,
    payment_no,
    message: '收款记录创建成功，发票已更新',
    invoice_status: newStatus,
    invoice_remaining: newRemainingAmount
  });
});

router.put('/:id', async (req, res) => {
  const {
    customer_id,
    invoice_id,
    amount,
    payment_date,
    payment_method,
    bank_name,
    bank_account,
    remarks
  } = req.body;

  if (!customer_id || !invoice_id || !amount || !payment_date) {
    return res.status(400).json({ error: '必填字段不能为空' });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: '收款金额必须大于0' });
  }

  const payment = await db.get('SELECT * FROM payments WHERE id = ?', req.params.id);
  if (!payment) {
    return res.status(404).json({ error: '收款记录不存在' });
  }

  const oldInvoice = await db.get('SELECT * FROM invoices WHERE id = ?', payment.invoice_id);
  if (!oldInvoice) {
    return res.status(404).json({ error: '原发票不存在' });
  }

  if (payment.invoice_id !== parseInt(invoice_id)) {
    const newInvoice = await db.get('SELECT * FROM invoices WHERE id = ?', invoice_id);
    if (!newInvoice) {
      return res.status(404).json({ error: '新发票不存在' });
    }
    if (newInvoice.customer_id !== parseInt(customer_id)) {
      return res.status(400).json({ error: '客户与发票不匹配' });
    }

    const oldPaidAmount = oldInvoice.paid_amount - payment.amount;
    const oldRemainingAmount = oldInvoice.total_amount - oldPaidAmount;
    const oldStatus = oldRemainingAmount <= 0 ? 'paid' : (oldPaidAmount > 0 ? 'partial' : 'unpaid');

    await db.run(`
      UPDATE invoices 
      SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, oldPaidAmount, oldRemainingAmount, oldStatus, oldInvoice.id);

    if (amount > newInvoice.remaining_amount) {
      return res.status(400).json({ 
        error: `收款金额不能超过发票待付金额 ¥${newInvoice.remaining_amount.toLocaleString()}` 
      });
    }

    const newPaidAmount = newInvoice.paid_amount + amount;
    const newRemainingAmount = newInvoice.total_amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';

    await db.run(`
      UPDATE invoices 
      SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, newPaidAmount, newRemainingAmount, newStatus, invoice_id);
  } else {
    const amountDiff = amount - payment.amount;
    const newPaidAmount = oldInvoice.paid_amount + amountDiff;
    const newRemainingAmount = oldInvoice.total_amount - newPaidAmount;

    if (newRemainingAmount < 0) {
      return res.status(400).json({ 
        error: `收款金额不能超过发票总金额 ¥${oldInvoice.total_amount.toLocaleString()}` 
      });
    }

    const newStatus = newRemainingAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

    await db.run(`
      UPDATE invoices 
      SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, newPaidAmount, newRemainingAmount, newStatus, invoice_id);
  }

  await db.run(`
    UPDATE payments 
    SET customer_id = ?, invoice_id = ?, amount = ?,
        payment_date = ?, payment_method = ?, bank_name = ?, 
        bank_account = ?, remarks = ?
    WHERE id = ?
  `,
    customer_id,
    invoice_id,
    amount,
    payment_date,
    payment_method || null,
    bank_name || null,
    bank_account || null,
    remarks || null,
    req.params.id
  );

  res.json({ message: '收款记录更新成功' });
});

router.delete('/:id', async (req, res) => {
  const payment = await db.get('SELECT * FROM payments WHERE id = ?', req.params.id);
  if (!payment) {
    return res.status(404).json({ error: '收款记录不存在' });
  }

  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', payment.invoice_id);
  if (!invoice) {
    await db.run('DELETE FROM payments WHERE id = ?', req.params.id);
    return res.json({ message: '收款记录删除成功' });
  }

  const newPaidAmount = Math.max(0, invoice.paid_amount - payment.amount);
  const newRemainingAmount = invoice.total_amount - newPaidAmount;
  const newStatus = newRemainingAmount <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

  await db.run(`
    UPDATE invoices 
    SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, newPaidAmount, newRemainingAmount, newStatus, payment.invoice_id);

  await db.run('DELETE FROM payments WHERE id = ?', req.params.id);

  res.json({ 
    message: '收款记录删除成功，发票已更新',
    invoice_status: newStatus,
    invoice_remaining: newRemainingAmount
  });
});

module.exports = router;
