const express = require('express');
const db = require('../database/db');
const { generateInvoiceNo, getReceivableStatus, getOverdueLevelText } = require('../utils/receivable');

const router = express.Router();

router.get('/', async (req, res) => {
  const { 
    page = 1, 
    pageSize = 10, 
    keyword = '', 
    customer_id, 
    status,
    start_date,
    end_date,
    sort_by = 'due_date',
    sort_order = 'desc'
  } = req.query;
  
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (keyword) {
    whereClause += ' AND (invoice_no LIKE ? OR i.remarks LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (customer_id) {
    whereClause += ' AND i.customer_id = ?';
    params.push(customer_id);
  }

  if (status && status !== 'all') {
    if (status === 'unpaid') {
      whereClause += ' AND i.status != "paid" AND i.remaining_amount > 0';
    } else {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }
  }

  if (start_date) {
    whereClause += ' AND i.invoice_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND i.invoice_date <= ?';
    params.push(end_date);
  }

  const validSortFields = ['invoice_date', 'due_date', 'total_amount', 'remaining_amount', 'created_at'];
  const orderBy = validSortFields.includes(sort_by) ? sort_by : 'due_date';
  const orderDir = sort_order === 'asc' ? 'ASC' : 'DESC';

  const { total } = await db.get(`SELECT COUNT(*) as total FROM invoices i ${whereClause}`, ...params);

  const invoices = await db.all(`
    SELECT i.*, 
      cu.name as customer_name,
      cu.contact_email,
      ct.contract_no,
      o.order_no
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    LEFT JOIN contracts ct ON i.contract_id = ct.id
    LEFT JOIN orders o ON i.order_id = o.id
    ${whereClause}
    ORDER BY i.${orderBy} ${orderDir}
    LIMIT ? OFFSET ?
  `, ...params, parseInt(pageSize), offset);

  const invoicesWithStatus = invoices.map(invoice => {
    const statusInfo = getReceivableStatus(invoice);
    return {
      ...invoice,
      invoice_amount: invoice.amount,
      ...statusInfo,
      overdueLevelText: getOverdueLevelText(statusInfo.overdueLevel)
    };
  });

  const stats = await db.get(`
    SELECT
      COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN total_amount ELSE 0 END), 0) as total_receivable,
      COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN remaining_amount ELSE 0 END), 0) as total_outstanding,
      COALESCE(SUM(CASE WHEN remaining_amount <= 0 THEN total_amount ELSE 0 END), 0) as total_paid,
      COUNT(*) as total_count
    FROM invoices i
    ${whereClause}
  `, ...params);

  res.json({
    data: invoicesWithStatus,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    stats
  });
});

router.get('/:id', async (req, res) => {
  const invoice = await db.get(`
    SELECT i.*, 
      cu.name as customer_name,
      cu.contact_name,
      cu.contact_email,
      cu.contact_phone,
      cu.address,
      ct.contract_no,
      ct.name as contract_name,
      o.order_no,
      o.name as order_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    LEFT JOIN contracts ct ON i.contract_id = ct.id
    LEFT JOIN orders o ON i.order_id = o.id
    WHERE i.id = ?
  `, req.params.id);

  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }

  const statusInfo = getReceivableStatus(invoice);

  const payments = await db.all(`
    SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
  `, req.params.id);

  const emailLogs = await db.all(`
    SELECT * FROM email_logs WHERE invoice_id = ? ORDER BY created_at DESC
  `, req.params.id);

  res.json({
    ...invoice,
    invoice_amount: invoice.amount,
    ...statusInfo,
    overdueLevelText: getOverdueLevelText(statusInfo.overdueLevel),
    payments,
    emailLogs
  });
});

router.post('/', async (req, res) => {
  const {
    invoice_no,
    customer_id,
    contract_id,
    order_id,
    amount,
    tax_amount,
    total_amount,
    invoice_date,
    due_date,
    payment_method,
    remarks
  } = req.body;

  if (!customer_id || !amount || !total_amount || !invoice_date || !due_date) {
    return res.status(400).json({ error: '必填字段不能为空' });
  }

  if (new Date(due_date) < new Date(invoice_date)) {
    return res.status(400).json({ error: '付款日期不能早于开票日期' });
  }

  const finalInvoiceNo = invoice_no || generateInvoiceNo();

  const result = await db.run(`
    INSERT INTO invoices (
      invoice_no, customer_id, contract_id, order_id,
      amount, tax_amount, total_amount,
      invoice_date, due_date, status,
      paid_amount, remaining_amount, payment_method, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 0, ?, ?, ?)
  `,
    finalInvoiceNo,
    customer_id,
    contract_id || null,
    order_id || null,
    amount,
    tax_amount || 0,
    total_amount,
    invoice_date,
    due_date,
    total_amount,
    payment_method || null,
    remarks || null
  );

  res.json({
    id: result.lastInsertRowid,
    invoice_no: finalInvoiceNo,
    message: '发票创建成功'
  });
});

router.put('/:id', async (req, res) => {
  const {
    invoice_no,
    customer_id,
    contract_id,
    order_id,
    amount,
    tax_amount,
    total_amount,
    invoice_date,
    due_date,
    payment_method,
    remarks
  } = req.body;

  if (!customer_id || !amount || !total_amount || !invoice_date || !due_date) {
    return res.status(400).json({ error: '必填字段不能为空' });
  }

  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }

  if (invoice.status === 'paid' && total_amount < invoice.paid_amount) {
    return res.status(400).json({ error: '发票总金额不能小于已收款金额' });
  }

  const remaining_amount = Math.max(0, total_amount - invoice.paid_amount);
  const newStatus = remaining_amount <= 0 ? 'paid' : invoice.status;

  await db.run(`
    UPDATE invoices 
    SET invoice_no = ?, customer_id = ?, contract_id = ?, order_id = ?,
        amount = ?, tax_amount = ?, total_amount = ?,
        invoice_date = ?, due_date = ?, status = ?,
        remaining_amount = ?, payment_method = ?, remarks = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    invoice_no || invoice.invoice_no,
    customer_id,
    contract_id || null,
    order_id || null,
    amount,
    tax_amount || 0,
    total_amount,
    invoice_date,
    due_date,
    newStatus,
    remaining_amount,
    payment_method || null,
    remarks || null,
    req.params.id
  );

  res.json({ message: '发票更新成功' });
});

router.delete('/:id', async (req, res) => {
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }

  const hasPayments = (await db.get('SELECT COUNT(*) as count FROM payments WHERE invoice_id = ?', req.params.id)).count > 0;
  if (hasPayments) {
    return res.status(400).json({ error: '该发票存在关联收款记录，无法删除' });
  }

  await db.run('DELETE FROM email_logs WHERE invoice_id = ?', req.params.id);
  await db.run('DELETE FROM invoices WHERE id = ?', req.params.id);

  res.json({ message: '发票删除成功' });
});

router.post('/:id/send-reminder', async (req, res) => {
  const { type = 'payment_reminder' } = req.body;

  const invoice = await db.get(`
    SELECT i.*, cu.name as customer_name, cu.contact_email, cu.contact_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    WHERE i.id = ?
  `, req.params.id);

  if (!invoice) {
    return res.status(404).json({ error: '发票不存在' });
  }

  if (!invoice.contact_email) {
    return res.status(400).json({ error: '客户没有设置邮箱地址' });
  }

  const customer = {
    id: invoice.customer_id,
    name: invoice.customer_name,
    contact_email: invoice.contact_email,
    contact_name: invoice.contact_name
  };

  const { sendEmail } = require('../utils/email');
  const dayjs = require('dayjs');

  const statusInfo = getReceivableStatus(invoice);
  let result;

  if (type === 'overdue_reminder') {
    const overdueDays = statusInfo.overdueDays || 1;
    result = await sendEmail(invoice, customer, 'overdue_reminder', { overdueDays });
  } else {
    const dueDate = dayjs(invoice.due_date);
    const today = dayjs();
    const daysLeft = Math.max(0, dueDate.diff(today, 'day'));
    result = await sendEmail(invoice, customer, 'payment_reminder', { daysLeft });
  }

  if (result.success) {
    res.json({ message: '提醒邮件发送成功' });
  } else {
    res.status(500).json({ error: '邮件发送失败: ' + result.error });
  }
});

module.exports = router;
