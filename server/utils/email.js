const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const db = require('../database/db');

const config = {
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'noreply@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
};

function createTransporter() {
  return nodemailer.createTransport(config);
}

function getPaymentReminderTemplate(invoice, customer, daysLeft) {
  return {
    subject: `【付款提醒】发票 ${invoice.invoice_no} 将于 ${daysLeft} 天后到期`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1890ff;">付款提醒</h2>
        <p>尊敬的 ${customer.name}：</p>
        <p>您好！以下发票将于 ${daysLeft} 天后到期，请及时安排付款。</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">发票编号</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoice_no}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">开票日期</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${dayjs(invoice.invoice_date).format('YYYY年MM月DD日')}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">到期日期</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${dayjs(invoice.due_date).format('YYYY年MM月DD日')}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">发票金额</th>
            <td style="padding: 10px; border: 1px solid #ddd;">¥ ${invoice.total_amount.toLocaleString()}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">待付金额</th>
            <td style="padding: 10px; border: 1px solid #ddd; color: #faad14; font-weight: bold;">¥ ${invoice.remaining_amount.toLocaleString()}</td>
          </tr>
        </table>
        
        <p style="color: #666;">如有任何疑问，请及时与我们联系。</p>
        <p>此致<br>公司财务部</p>
      </div>
    `
  };
}

function getOverdueReminderTemplate(invoice, customer, overdueDays) {
  let level = '';
  if (overdueDays <= 30) level = '请尽快安排付款';
  else if (overdueDays <= 60) level = '请务必尽快安排付款，避免影响后续合作';
  else level = '请立即安排付款，否则我们将采取进一步措施';

  return {
    subject: `【重要提醒】发票 ${invoice.invoice_no} 已逾期 ${overdueDays} 天`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${overdueDays > 60 ? '#f5222d' : '#faad14'};">逾期付款提醒</h2>
        <p>尊敬的 ${customer.name}：</p>
        <p style="color: ${overdueDays > 60 ? '#f5222d' : '#faad14'}; font-weight: bold;">
          您好！以下发票已逾期 ${overdueDays} 天，${level}。
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">发票编号</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoice_no}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">开票日期</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${dayjs(invoice.invoice_date).format('YYYY年MM月DD日')}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">到期日期</th>
            <td style="padding: 10px; border: 1px solid #ddd;">${dayjs(invoice.due_date).format('YYYY年MM月DD日')}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">逾期天数</th>
            <td style="padding: 10px; border: 1px solid #ddd; color: #f5222d; font-weight: bold;">${overdueDays} 天</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">发票金额</th>
            <td style="padding: 10px; border: 1px solid #ddd;">¥ ${invoice.total_amount.toLocaleString()}</td>
          </tr>
          <tr>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">逾期金额</th>
            <td style="padding: 10px; border: 1px solid #ddd; color: #f5222d; font-weight: bold;">¥ ${invoice.remaining_amount.toLocaleString()}</td>
          </tr>
        </table>
        
        <p style="color: #666;">如有任何疑问或付款困难，请及时与我们联系，协商解决方案。</p>
        <p>此致<br>公司财务部</p>
      </div>
    `
  };
}

async function sendEmail(invoice, customer, type, extraData = {}) {
  const transporter = createTransporter();
  
  let template;
  if (type === 'payment_reminder') {
    template = getPaymentReminderTemplate(invoice, customer, extraData.daysLeft);
  } else if (type === 'overdue_reminder') {
    template = getOverdueReminderTemplate(invoice, customer, extraData.overdueDays);
  } else {
    throw new Error('未知的邮件类型');
  }

  const logStmt = db.prepare(`
    INSERT INTO email_logs (invoice_id, customer_id, recipient_email, subject, content, type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const logResult = await logStmt.run(
    invoice.id,
    customer.id,
    customer.contact_email,
    template.subject,
    template.html,
    type,
    'pending'
  );
  const logId = logResult.lastInsertRowid;

  try {
    const info = await transporter.sendMail({
      from: config.auth.user,
      to: customer.contact_email,
      subject: template.subject,
      html: template.html
    });

    const updateStmt = db.prepare(`
      UPDATE email_logs SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    await updateStmt.run(logId);

    console.log(`邮件已发送: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const updateStmt = db.prepare(`
      UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?
    `);
    await updateStmt.run(error.message, logId);

    console.error(`邮件发送失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function sendPaymentReminders() {
  const today = dayjs().startOf('day');
  const reminderDate = today.add(3, 'day').format('YYYY-MM-DD');

  const invoices = await db.prepare(`
    SELECT i.*, c.name as customer_name, c.contact_email, c.contact_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status != 'paid' 
      AND i.remaining_amount > 0
      AND DATE(i.due_date) = ?
  `).all(reminderDate);

  console.log(`找到 ${invoices.length} 张需要发送付款提醒的发票`);

  for (const invoice of invoices) {
    const customer = {
      id: invoice.customer_id,
      name: invoice.customer_name,
      contact_email: invoice.contact_email,
      contact_name: invoice.contact_name
    };

    if (!customer.contact_email) {
      console.log(`跳过客户 ${customer.name}：无邮箱地址`);
      continue;
    }

    const alreadySent = await db.prepare(`
      SELECT id FROM email_logs 
      WHERE invoice_id = ? AND type = 'payment_reminder' AND DATE(created_at) = DATE('now')
    `).get(invoice.id);

    if (alreadySent) {
      console.log(`发票 ${invoice.invoice_no} 今日已发送过提醒，跳过`);
      continue;
    }

    await sendEmail(invoice, customer, 'payment_reminder', { daysLeft: 3 });
  }
}

async function sendOverdueReminders() {
  const today = dayjs().startOf('day');

  const invoices = await db.prepare(`
    SELECT i.*, c.name as customer_name, c.contact_email, c.contact_name
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status != 'paid' 
      AND i.remaining_amount > 0
      AND DATE(i.due_date) < DATE('now')
  `).all();

  console.log(`找到 ${invoices.length} 张逾期发票`);

  for (const invoice of invoices) {
    const dueDate = dayjs(invoice.due_date).startOf('day');
    const overdueDays = today.diff(dueDate, 'day');

    let shouldSend = false;
    if (overdueDays === 1 || overdueDays === 7 || overdueDays === 15 || overdueDays === 30) {
      shouldSend = true;
    } else if (overdueDays > 30 && overdueDays % 15 === 0) {
      shouldSend = true;
    }

    if (!shouldSend) {
      console.log(`发票 ${invoice.invoice_no} 逾期 ${overdueDays} 天，不在提醒日程中`);
      continue;
    }

    const customer = {
      id: invoice.customer_id,
      name: invoice.customer_name,
      contact_email: invoice.contact_email,
      contact_name: invoice.contact_name
    };

    if (!customer.contact_email) {
      console.log(`跳过客户 ${customer.name}：无邮箱地址`);
      continue;
    }

    const alreadySent = await db.prepare(`
      SELECT id FROM email_logs 
      WHERE invoice_id = ? AND type = 'overdue_reminder' AND DATE(created_at) = DATE('now')
    `).get(invoice.id);

    if (alreadySent) {
      console.log(`发票 ${invoice.invoice_no} 今日已发送过催款邮件，跳过`);
      continue;
    }

    await sendEmail(invoice, customer, 'overdue_reminder', { overdueDays });
  }
}

module.exports = {
  sendEmail,
  sendPaymentReminders,
  sendOverdueReminders
};
