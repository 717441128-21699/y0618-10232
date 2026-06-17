const express = require('express');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const db = require('../database/db');
const { getReceivableStatus, getOverdueLevelText, getAgeingBucketText, getAgeingBucket, calculatePaymentSpeed } = require('../utils/receivable');

const router = express.Router();

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
    overallAgeing[bucket] = { count: 0, amount: 0 };
  });

  invoices.forEach(invoice => {
    const dueDate = dayjs(invoice.due_date).startOf('day');
    const daysDiff = referenceDate.diff(dueDate, 'day');
    const remaining = invoice.remaining_amount;

    let bucket;
    if (daysDiff < 0) bucket = 'not_due';
    else if (daysDiff <= 30) bucket = '0-30';
    else if (daysDiff <= 60) bucket = '31-60';
    else if (daysDiff <= 90) bucket = '61-90';
    else if (daysDiff <= 180) bucket = '91-180';
    else bucket = 'over_180';

    overallAgeing[bucket].count++;
    overallAgeing[bucket].amount += remaining;

    if (!customerAgeing[invoice.customer_id]) {
      customerAgeing[invoice.customer_id] = {
        customer_name: invoice.customer_name,
        total_remaining: 0,
        buckets: {}
      };
      buckets.forEach(b => {
        customerAgeing[invoice.customer_id].buckets[b] = { count: 0, amount: 0 };
      });
    }

    customerAgeing[invoice.customer_id].total_remaining += remaining;
    customerAgeing[invoice.customer_id].buckets[bucket].amount += remaining;
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '应收账款管理系统';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('汇总表');
  summarySheet.columns = [
    { header: '账龄区间', key: 'bucket', width: 15 },
    { header: '发票数量', key: 'count', width: 12 },
    { header: '金额(元)', key: 'amount', width: 18 }
  ];

  buckets.forEach(bucket => {
    summarySheet.addRow({
      bucket: getAgeingBucketText(bucket),
      count: overallAgeing[bucket].count,
      amount: overallAgeing[bucket].amount
    });
  });

  const totalRow = summarySheet.addRow({
    bucket: '合计',
    count: invoices.length,
    amount: invoices.reduce((sum, inv) => sum + inv.remaining_amount, 0)
  });
  totalRow.font = { bold: true };

  const customerSheet = workbook.addWorksheet('按客户分类');
  const customerColumns = [
    { header: '客户名称', key: 'customer_name', width: 25 },
    { header: '应收账款余额', key: 'total_remaining', width: 15 }
  ];
  buckets.forEach(bucket => {
    customerColumns.push({
      header: getAgeingBucketText(bucket), key: bucket, width: 15 });
  });
  customerSheet.columns = customerColumns;

  Object.entries(customerAgeing).forEach(([id, data]) => {
    const row = {
      customer_name: data.customer_name,
      total_remaining: data.total_remaining
    };
    buckets.forEach(bucket => {
      row[bucket] = data.buckets[bucket].amount;
    });
    customerSheet.addRow(row);
  });

  const detailSheet = workbook.addWorksheet('明细表');
  detailSheet.columns = [
    { header: '发票编号', key: 'invoice_no', width: 22 },
    { header: '客户名称', key: 'customer_name', width: 25 },
    { header: '开票日期', key: 'invoice_date', width: 12 },
    { header: '到期日期', key: 'due_date', width: 12 },
    { header: '发票金额', key: 'total_amount', width: 15 },
    { header: '待付金额', key: 'remaining_amount', width: 15 },
    { header: '状态', key: 'status_text', width: 12 },
    { header: '账龄区间', key: 'ageing_bucket', width: 15 },
    { header: '逾期天数', key: 'overdue_days', width: 12 }
  ];

  invoices.forEach(inv => {
    const statusInfo = getReceivableStatus(inv);
    const dueDate = dayjs(inv.due_date).startOf('day');
    const daysDiff = referenceDate.diff(dueDate, 'day');
    const bucket = getAgeingBucket(inv);

    detailSheet.addRow({
      invoice_no: inv.invoice_no,
      customer_name: inv.customer_name,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      total_amount: inv.total_amount,
      remaining_amount: inv.remaining_amount,
      status_text: statusInfo.statusText,
      ageing_bucket: getAgeingBucketText(bucket),
      overdue_days: Math.max(0, daysDiff)
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="应收账款账龄分析表_${referenceDate.format('YYYYMMDD')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
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
    SELECT p.*, i.invoice_no, cu.name as customer_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN customers cu ON p.customer_id = cu.id
    WHERE p.payment_date BETWEEN ? AND ?
    ORDER BY p.payment_date DESC
  `).all(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '应收账款管理系统';

  const summarySheet = workbook.addWorksheet('月度汇总');
  summarySheet.columns = [
    { header: '项目', key: 'item', width: 20 },
    { header: '数值', key: 'value', width: 20 }
  ];

  const newInvoicesAmount = monthInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const receivedAmount = monthPayments.reduce((sum, p) => sum + p.amount, 0);

  summarySheet.addRow({ item: '报告月份', value: `${reportYear}年${reportMonth}月` });
  summarySheet.addRow({ item: '本期新增发票数', value: monthInvoices.length });
  summarySheet.addRow({ item: '本期新增发票金额', value: newInvoicesAmount });
  summarySheet.addRow({ item: '本期收款笔数', value: monthPayments.length });
  summarySheet.addRow({ item: '本期收款金额', value: receivedAmount });

  const invoiceSheet = workbook.addWorksheet('本月开票');
  invoiceSheet.columns = [
    { header: '发票编号', key: 'invoice_no', width: 22 },
    { header: '客户名称', key: 'customer_name', width: 25 },
    { header: '开票日期', key: 'invoice_date', width: 12 },
    { header: '到期日期', key: 'due_date', width: 12 },
    { header: '金额', key: 'total_amount', width: 15 },
    { header: '状态', key: 'status', width: 10 },
    { header: '备注', key: 'remarks', width: 30 }
  ];

  monthInvoices.forEach(inv => {
    const statusMap = { unpaid: '未付款', partial: '部分付款', paid: '已结清' };
    invoiceSheet.addRow({
      invoice_no: inv.invoice_no,
      customer_name: inv.customer_name,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      total_amount: inv.total_amount,
      status: statusMap[inv.status] || inv.status,
      remarks: inv.remarks || ''
    });
  });

  const paymentSheet = workbook.addWorksheet('本月收款');
  paymentSheet.columns = [
    { header: '收款编号', key: 'payment_no', width: 22 },
    { header: '客户名称', key: 'customer_name', width: 25 },
    { header: '对应发票', key: 'invoice_no', width: 22 },
    { header: '收款日期', key: 'payment_date', width: 12 },
    { header: '收款金额', key: 'amount', width: 15 },
    { header: '收款方式', key: 'payment_method', width: 12 },
    { header: '备注', key: 'remarks', width: 30 }
  ];

  monthPayments.forEach(pay => {
    paymentSheet.addRow({
      payment_no: pay.payment_no,
      customer_name: pay.customer_name,
      invoice_no: pay.invoice_no,
      payment_date: pay.payment_date,
      amount: pay.amount,
      payment_method: pay.payment_method || '',
      remarks: pay.remarks || ''
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="月度报告_${reportYear}${reportMonth.toString().padStart(2, '0')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

router.get('/customer-statement/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  const { start_date, end_date } = req.query;

  const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
  if (!customer) {
    return res.status(404).json({ error: '客户不存在' });
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
    ORDER BY invoice_date DESC
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
    ORDER BY payment_date DESC
  `).all(...paymentParams);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '应收账款管理系统';

  const infoSheet = workbook.addWorksheet('客户信息');
  infoSheet.columns = [
    { header: '项目', key: 'item', width: 20 },
    { header: '内容', key: 'value', width: 40 }
  ];

  infoSheet.addRow({ item: '客户名称', value: customer.name });
  infoSheet.addRow({ item: '联系人', value: customer.contact_name || '' });
  infoSheet.addRow({ item: '联系电话', value: customer.contact_phone || '' });
  infoSheet.addRow({ item: '邮箱', value: customer.contact_email || '' });
  infoSheet.addRow({ item: '地址', value: customer.address || '' });
  infoSheet.addRow({ item: '期间', value: start_date && end_date ? `${start_date} 至 ${end_date}` : '全部' });

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalRemaining = totalInvoiced - totalPaid;

  infoSheet.addRow({ item: '本期开票金额', value: totalInvoiced });
  infoSheet.addRow({ item: '本期收款金额', value: totalPaid });
  infoSheet.addRow({ item: '期末余额', value: totalRemaining });

  const transSheet = workbook.addWorksheet('往来明细');
  transSheet.columns = [
    { header: '日期', key: 'date', width: 12 },
    { header: '类型', key: 'type_text', width: 10 },
    { header: '单据号', key: 'reference_no', width: 22 },
    { header: '对应发票', key: 'invoice_no', width: 22 },
    { header: '借方(开票)', key: 'debit', width: 15 },
    { header: '贷方(收款)', key: 'credit', width: 15 },
    { header: '余额', key: 'balance', width: 15 },
    { header: '备注', key: 'remarks', width: 30 }
  ];

  const transactions = [];
  
  invoices.forEach(inv => {
    transactions.push({
      date: inv.invoice_date,
      type: 'invoice',
      type_text: '开票',
      reference_no: inv.invoice_no,
      invoice_no: '',
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

  let runningBalance = 0;
  transactions.forEach(t => {
    runningBalance = runningBalance + t.debit - t.credit;
    t.balance = runningBalance;
    transSheet.addRow(t);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="客户对账单_${customer.name}_${dayjs().format('YYYYMMDD')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
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

  const paymentSpeedData = calculatePaymentSpeed(payments, invoices);

  const customerMap = {};
  invoices.forEach(inv => {
    customerMap[inv.customer_id] = inv.customer_name;
  });

  const customerData = paymentSpeedData.map(item => ({
    ...item,
    customer_name: customerMap[item.customerId] || '未知客户'
  }));

  const totalPayments = customerData.reduce((sum, c) => sum + c.totalPayments, 0);
  const overallAvgDays = customerData.length > 0
    ? Math.round(customerData.reduce((sum, c) => sum + c.avgDays, 0) / customerData.length)
    : 0;

  const speedBuckets = [
    { key: 'fast', label: '快速(≤15天)', min: 0, max: 15 },
    { key: 'normal', label: '正常(16-30天)', min: 16, max: 30 },
    { key: 'slow', label: '较慢(31-60天)', min: 31, max: 60 },
    { key: 'very_slow', label: '很慢(61-90天)', min: 61, max: 90 },
    { key: 'overdue', label: '严重逾期(>90天)', min: 91, max: Infinity }
  ];

  const bucketStats = {};
  speedBuckets.forEach(bucket => {
    bucketStats[bucket.key] = { count: 0, label: bucket.label };
  });

  customerData.forEach(customer => {
    for (const bucket of speedBuckets) {
      if (customer.avgDays >= bucket.min && customer.avgDays <= bucket.max) {
        bucketStats[bucket.key].count++;
        break;
      }
    }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '应收账款管理系统';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('汇总表');
  summarySheet.columns = [
    { header: '指标', key: 'item', width: 25 },
    { header: '数值', key: 'value', width: 20 }
  ];

  summarySheet.addRow({ item: '统计期间', value: start_date && end_date ? `${start_date} 至 ${end_date}` : '全部' });
  summarySheet.addRow({ item: '客户总数', value: customerData.length });
  summarySheet.addRow({ item: '总付款笔数', value: totalPayments });
  summarySheet.addRow({ item: '总体平均回款天数', value: overallAvgDays });

  const distributionSheet = workbook.addWorksheet('速度分布');
  distributionSheet.columns = [
    { header: '回款速度区间', key: 'bucket', width: 25 },
    { header: '客户数量', key: 'count', width: 15 },
    { header: '占比', key: 'percentage', width: 15 }
  ];

  speedBuckets.forEach(bucket => {
    const count = bucketStats[bucket.key].count;
    const percentage = customerData.length > 0 ? ((count / customerData.length) * 100).toFixed(2) + '%' : '0%';
    distributionSheet.addRow({
      bucket: bucket.label,
      count: count,
      percentage: percentage
    });
  });

  const rankingSheet = workbook.addWorksheet('客户排名');
  rankingSheet.columns = [
    { header: '排名', key: 'rank', width: 8 },
    { header: '客户名称', key: 'customer_name', width: 25 },
    { header: '付款次数', key: 'totalPayments', width: 12 },
    { header: '平均回款天数', key: 'avgDays', width: 15 },
    { header: '最快回款天数', key: 'fastest', width: 15 },
    { header: '最慢回款天数', key: 'slowest', width: 15 },
    { header: '总付款金额', key: 'totalAmount', width: 18 }
  ];

  const sortedCustomers = [...customerData].sort((a, b) => a.avgDays - b.avgDays);
  sortedCustomers.forEach((customer, index) => {
    const daysList = customer.invoices.map(inv => inv.daysToPay);
    const fastest = Math.min(...daysList);
    const slowest = Math.max(...daysList);
    const totalAmount = customer.invoices.reduce((sum, inv) => sum + inv.amount, 0);

    rankingSheet.addRow({
      rank: index + 1,
      customer_name: customer.customer_name,
      totalPayments: customer.totalPayments,
      avgDays: customer.avgDays,
      fastest: fastest,
      slowest: slowest,
      totalAmount: totalAmount
    });
  });

  const dateSuffix = start_date && end_date 
    ? `${start_date}_${end_date}` 
    : dayjs().format('YYYYMMDD');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="回款速度分析表_${dateSuffix}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
