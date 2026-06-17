const express = require('express');
const db = require('../database/db');
const { 
  getReceivableStatus, 
  getOverdueLevelText, 
  getAgeingBucket, 
  getAgeingBucketText,
  calculatePaymentSpeed
} = require('../utils/receivable');
const dayjs = require('dayjs');

const router = express.Router();

router.get('/summary', async (req, res) => {
  const invoices = await db.prepare(`
    SELECT i.*, cu.name as customer_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    WHERE i.remaining_amount > 0
    ORDER BY i.due_date ASC
  `).all();

  const invoicesWithStatus = invoices.map(invoice => {
    const statusInfo = getReceivableStatus(invoice);
    return {
      ...invoice,
      ...statusInfo,
      overdueLevelText: getOverdueLevelText(statusInfo.overdueLevel)
    };
  });

  const summary = {
    total_invoices: invoices.length,
    total_amount: invoices.reduce((sum, inv) => sum + inv.total_amount, 0),
    total_remaining: invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0),
    by_status: {
      not_due: {
        count: 0,
        amount: 0
      },
      due_soon: {
        count: 0,
        amount: 0
      },
      overdue: {
        count: 0,
        amount: 0
      }
    },
    by_overdue_level: {
      level1: { count: 0, amount: 0, text: '逾期30天内' },
      level2: { count: 0, amount: 0, text: '逾期30-60天' },
      level3: { count: 0, amount: 0, text: '逾期60天以上' }
    },
    invoices: invoicesWithStatus
  };

  invoicesWithStatus.forEach(inv => {
    if (summary.by_status[inv.status]) {
      summary.by_status[inv.status].count++;
      summary.by_status[inv.status].amount += inv.remaining_amount;
    }
    if (inv.overdueLevel && summary.by_overdue_level[inv.overdueLevel]) {
      summary.by_overdue_level[inv.overdueLevel].count++;
      summary.by_overdue_level[inv.overdueLevel].amount += inv.remaining_amount;
    }
  });

  res.json(summary);
});

router.get('/ageing-analysis', async (req, res) => {
  const { customer_id, as_of_date } = req.query;
  
  const referenceDate = as_of_date ? dayjs(as_of_date).startOf('day') : dayjs().startOf('day');

  let whereClause = 'WHERE i.remaining_amount > 0';
  let params = [];

  if (customer_id) {
    whereClause += ' AND i.customer_id = ?';
    params.push(customer_id);
  }

  const invoices = await db.prepare(`
    SELECT i.*, cu.name as customer_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    ${whereClause}
    ORDER BY i.due_date ASC
  `).all(...params);

  const buckets = ['not_due', '0-30', '31-60', '61-90', '91-180', 'over_180'];
  
  const customerAgeing = {};
  const overallAgeing = {};
  
  buckets.forEach(bucket => {
    overallAgeing[bucket] = {
      count: 0,
      amount: 0,
      text: getAgeingBucketText(bucket)
    };
  });

  invoices.forEach(invoice => {
    const dueDate = dayjs(invoice.due_date).startOf('day');
    const daysDiff = referenceDate.diff(dueDate, 'day');
    const remaining = invoice.remaining_amount;

    let bucket;
    if (daysDiff < 0) {
      bucket = 'not_due';
    } else if (daysDiff <= 30) {
      bucket = '0-30';
    } else if (daysDiff <= 60) {
      bucket = '31-60';
    } else if (daysDiff <= 90) {
      bucket = '61-90';
    } else if (daysDiff <= 180) {
      bucket = '91-180';
    } else {
      bucket = 'over_180';
    }

    overallAgeing[bucket].count++;
    overallAgeing[bucket].amount += remaining;

    if (!customerAgeing[invoice.customer_id]) {
      customerAgeing[invoice.customer_id] = {
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        total_remaining: 0,
        buckets: {}
      };
      buckets.forEach(b => {
        customerAgeing[invoice.customer_id].buckets[b] = {
          count: 0,
          amount: 0,
          text: getAgeingBucketText(b)
        };
      });
    }

    customerAgeing[invoice.customer_id].total_remaining += remaining;
    customerAgeing[invoice.customer_id].buckets[bucket].count++;
    customerAgeing[invoice.customer_id].buckets[bucket].amount += remaining;
  });

  const customerList = Object.values(customerAgeing)
    .sort((a, b) => b.total_remaining - a.total_remaining)
    .map(c => {
      const overdueTotal = buckets
        .filter(b => b !== 'not_due')
        .reduce((sum, b) => sum + c.buckets[b].amount, 0);
      return {
        ...c,
        overdue_total: overdueTotal
      };
    });

  const totalOverdue = buckets
    .filter(b => b !== 'not_due')
    .reduce((sum, b) => sum + overallAgeing[b].amount, 0);

  res.json({
    as_of_date: referenceDate.format('YYYY-MM-DD'),
    overall: {
      ...overallAgeing,
      total_remaining: invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0),
      total_overdue: totalOverdue,
      total_count: invoices.length
    },
    by_customer: customerList,
    invoices: invoices.map(inv => {
      const dueDate = dayjs(inv.due_date).startOf('day');
      const daysDiff = referenceDate.diff(dueDate, 'day');
      let bucket;
      if (daysDiff < 0) bucket = 'not_due';
      else if (daysDiff <= 30) bucket = '0-30';
      else if (daysDiff <= 60) bucket = '31-60';
      else if (daysDiff <= 90) bucket = '61-90';
      else if (daysDiff <= 180) bucket = '91-180';
      else bucket = 'over_180';

      return {
        ...inv,
        ageing_bucket: bucket,
        ageing_bucket_text: getAgeingBucketText(bucket),
        days_overdue: Math.max(0, daysDiff)
      };
    })
  });
});

router.get('/payment-speed', async (req, res) => {
  const { customer_id, start_date, end_date } = req.query;

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (customer_id) {
    whereClause += ' AND i.customer_id = ?';
    params.push(customer_id);
  }

  if (start_date) {
    whereClause += ' AND p.payment_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    whereClause += ' AND p.payment_date <= ?';
    params.push(end_date);
  }

  const payments = await db.prepare(`
    SELECT p.*, i.invoice_date, i.customer_id
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    ${whereClause}
    ORDER BY p.payment_date DESC
  `).all(...params);

  let invoiceWhere = 'WHERE i.remaining_amount <= 0';
  let invoiceParams = [];
  if (customer_id) {
    invoiceWhere += ' AND i.customer_id = ?';
    invoiceParams.push(customer_id);
  }

  const invoices = await db.prepare(`
    SELECT i.*, cu.name as customer_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    ${invoiceWhere}
  `).all(...invoiceParams);

  const paymentSpeed = calculatePaymentSpeed(payments, invoices);

  const customerMap = {};
  invoices.forEach(inv => {
    customerMap[inv.customer_id] = inv.customer_name;
  });

  const result = paymentSpeed.map(item => ({
    ...item,
    customer_name: customerMap[item.customerId] || '未知客户'
  }));

  res.json({
    data: result,
    total_customers: result.length,
    overall_avg_days: result.length > 0 
      ? Math.round(result.reduce((sum, r) => sum + r.avgDays, 0) / result.length)
      : 0
  });
});

router.get('/monthly-report', async (req, res) => {
  const { year, month } = req.query;
  
  const now = dayjs();
  const reportYear = parseInt(year) || now.year();
  const reportMonth = parseInt(month) || now.month() + 1;

  const startDate = dayjs(`${reportYear}-${reportMonth}-01`).startOf('month');
  const endDate = startDate.endOf('month');

  const monthInvoices = await db.prepare(`
    SELECT i.*, cu.name as customer_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    WHERE i.invoice_date BETWEEN ? AND ?
    ORDER BY i.invoice_date DESC
  `).all(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

  const monthPayments = await db.prepare(`
    SELECT p.*, i.invoice_no, i.invoice_date, cu.name as customer_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN customers cu ON p.customer_id = cu.id
    WHERE p.payment_date BETWEEN ? AND ?
    ORDER BY p.payment_date DESC
  `).all(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

  const receivables = await db.prepare(`
    SELECT i.*, cu.name as customer_name
    FROM invoices i
    JOIN customers cu ON i.customer_id = cu.id
    WHERE i.remaining_amount > 0
  `).all();

  const receivablesWithStatus = receivables.map(inv => {
    const statusInfo = getReceivableStatus(inv);
    return {
      ...inv,
      ...statusInfo,
      ageing_bucket: getAgeingBucket(inv),
      ageing_bucket_text: getAgeingBucketText(getAgeingBucket(inv))
    };
  });

  const ageingBuckets = ['not_due', '0-30', '31-60', '61-90', '91-180', 'over_180'];
  const ageingSummary = {};
  ageingBuckets.forEach(bucket => {
    ageingSummary[bucket] = {
      count: 0,
      amount: 0,
      text: getAgeingBucketText(bucket)
    };
  });

  receivablesWithStatus.forEach(inv => {
    if (inv.ageing_bucket && ageingSummary[inv.ageing_bucket]) {
      ageingSummary[inv.ageing_bucket].count++;
      ageingSummary[inv.ageing_bucket].amount += inv.remaining_amount;
    }
  });

  const newInvoicesAmount = monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const receivedAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalReceivable = receivables.reduce((sum, inv) => sum + inv.remaining_amount, 0);

  res.json({
    report_period: `${reportYear}年${reportMonth}月`,
    start_date: startDate.format('YYYY-MM-DD'),
    end_date: endDate.format('YYYY-MM-DD'),
    summary: {
      new_invoices_count: monthInvoices.length,
      new_invoices_amount: newInvoicesAmount,
      received_count: monthPayments.length,
      received_amount: receivedAmount,
      total_receivable: totalReceivable,
      total_receivable_count: receivables.length
    },
    new_invoices: monthInvoices,
    received_payments: monthPayments,
    ageing_summary: ageingSummary,
    receivables: receivablesWithStatus
  });
});

router.get('/customer-statement/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  const { start_date, end_date } = req.query;

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) {
    return res.status(404).json({ error: '客户不存在' });
  }

  // 计算期初余额：开始日期之前的所有开票 - 所有收款
  let openingBalance = 0;
  if (start_date) {
    const beforeInvoices = await db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices
      WHERE customer_id = ? AND invoice_date < ?
    `).get(customer_id, start_date);
    const beforePayments = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments
      WHERE customer_id = ? AND payment_date < ?
    `).get(customer_id, start_date);
    openingBalance = (beforeInvoices?.total || 0) - (beforePayments?.total || 0);
  }

  let whereClause = 'WHERE customer_id = ?';
  let params = [customer_id];

  if (start_date) {
    whereClause += ' AND invoice_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND invoice_date <= ?';
    params.push(end_date);
  }

  const invoices = await db.prepare(`
    SELECT * FROM invoices
    ${whereClause}
    ORDER BY invoice_date ASC
  `).all(...params);

  let paymentWhere = 'WHERE customer_id = ?';
  let paymentParams = [customer_id];
  if (start_date) {
    paymentWhere += ' AND payment_date >= ?';
    paymentParams.push(start_date);
  }
  if (end_date) {
    paymentWhere += ' AND payment_date <= ?';
    paymentParams.push(end_date);
  }

  const payments = await db.prepare(`
    SELECT p.*, i.invoice_no
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    ${paymentWhere}
    ORDER BY p.payment_date ASC
  `).all(...paymentParams);

  const transactions = [];
  
  invoices.forEach(inv => {
    transactions.push({
      date: inv.invoice_date,
      type: 'invoice',
      type_text: '开票',
      reference_no: inv.invoice_no,
      debit: inv.total_amount,
      credit: 0,
      balance: 0,
      remarks: inv.remarks || ''
    });
  });

  payments.forEach(pay => {
    transactions.push({
      date: pay.payment_date,
      type: 'payment',
      type_text: '收款',
      reference_no: pay.payment_no,
      invoice_no: pay.invoice_no,
      debit: 0,
      credit: pay.amount,
      balance: 0,
      remarks: pay.remarks || ''
    });
  });

  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 流水余额从期初余额开始滚动
  let runningBalance = openingBalance;
  transactions.forEach(t => {
    runningBalance = runningBalance + t.debit - t.credit;
    t.balance = runningBalance;
  });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const closingBalance = openingBalance + totalInvoiced - totalPaid;

  res.json({
    customer,
    period: { start_date, end_date },
    summary: {
      opening_balance: openingBalance,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      closing_balance: closingBalance,
      invoice_count: invoices.length,
      payment_count: payments.length
    },
    invoices,
    payments,
    transactions: transactions
  });
});

module.exports = router;
