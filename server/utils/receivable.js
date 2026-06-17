const dayjs = require('dayjs');

function getReceivableStatus(invoice) {
  const today = dayjs().startOf('day');
  const dueDate = dayjs(invoice.due_date).startOf('day');
  const daysDiff = dueDate.diff(today, 'day');
  const remaining = invoice.remaining_amount || invoice.total_amount;

  if (remaining <= 0) {
    return { status: 'paid', statusText: '已结清', overdueLevel: null, overdueDays: 0 };
  }

  if (daysDiff > 3) {
    return { status: 'not_due', statusText: '未到期', overdueLevel: null, overdueDays: 0 };
  } else if (daysDiff >= 0 && daysDiff <= 3) {
    return { status: 'due_soon', statusText: '即将到期', overdueLevel: null, overdueDays: 0 };
  } else {
    const overdueDays = Math.abs(daysDiff);
    let overdueLevel;
    if (overdueDays <= 30) {
      overdueLevel = 'level1';
    } else if (overdueDays <= 60) {
      overdueLevel = 'level2';
    } else {
      overdueLevel = 'level3';
    }
    return { status: 'overdue', statusText: '已逾期', overdueLevel, overdueDays };
  }
}

function getOverdueLevelText(level) {
  const map = {
    level1: '逾期30天内',
    level2: '逾期30-60天',
    level3: '逾期60天以上'
  };
  return map[level] || '';
}

function getAgeingBucket(invoice) {
  const today = dayjs().startOf('day');
  const dueDate = dayjs(invoice.due_date).startOf('day');
  const daysDiff = today.diff(dueDate, 'day');
  const remaining = invoice.remaining_amount || invoice.total_amount;

  if (remaining <= 0) return null;

  if (daysDiff < 0) {
    return 'not_due';
  } else if (daysDiff <= 30) {
    return '0-30';
  } else if (daysDiff <= 60) {
    return '31-60';
  } else if (daysDiff <= 90) {
    return '61-90';
  } else if (daysDiff <= 180) {
    return '91-180';
  } else {
    return 'over_180';
  }
}

function getAgeingBucketText(bucket) {
  const map = {
    not_due: '未到期',
    '0-30': '0-30天',
    '31-60': '31-60天',
    '61-90': '61-90天',
    '91-180': '91-180天',
    over_180: '180天以上'
  };
  return map[bucket] || bucket;
}

function calculatePaymentSpeed(payments, invoices) {
  const customerStats = {};

  invoices.forEach(invoice => {
    if (invoice.remaining_amount > 0) return;

    const invoiceDate = dayjs(invoice.invoice_date);
    const customerPayments = payments.filter(p => p.invoice_id === invoice.id);

    if (customerPayments.length === 0) return;

    customerPayments.forEach(payment => {
      const paymentDate = dayjs(payment.payment_date);
      const daysToPay = paymentDate.diff(invoiceDate, 'day');

      if (!customerStats[invoice.customer_id]) {
        customerStats[invoice.customer_id] = {
          customerId: invoice.customer_id,
          totalPayments: 0,
          totalDays: 0,
          avgDays: 0,
          invoices: []
        };
      }

      customerStats[invoice.customer_id].totalPayments++;
      customerStats[invoice.customer_id].totalDays += daysToPay;
      customerStats[invoice.customer_id].invoices.push({
        invoiceNo: invoice.invoice_no,
        amount: payment.amount,
        daysToPay
      });
    });
  });

  Object.values(customerStats).forEach(stat => {
    stat.avgDays = Math.round(stat.totalDays / stat.totalPayments);
  });

  return Object.values(customerStats).sort((a, b) => b.avgDays - a.avgDays);
}

function generateInvoiceNo() {
  const now = dayjs();
  const prefix = 'INV' + now.format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return prefix + random;
}

function generatePaymentNo() {
  const now = dayjs();
  const prefix = 'PAY' + now.format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return prefix + random;
}

function generateContractNo() {
  const now = dayjs();
  const prefix = 'CT' + now.format('YYYYMM');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return prefix + random;
}

function generateOrderNo() {
  const now = dayjs();
  const prefix = 'OD' + now.format('YYYYMM');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return prefix + random;
}

module.exports = {
  getReceivableStatus,
  getOverdueLevelText,
  getAgeingBucket,
  getAgeingBucketText,
  calculatePaymentSpeed,
  generateInvoiceNo,
  generatePaymentNo,
  generateContractNo,
  generateOrderNo
};
