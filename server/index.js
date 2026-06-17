const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'data.sqlite');
const dbExists = fs.existsSync(dbPath);

const { authenticateToken } = require('./middleware/auth');
const { sendPaymentReminders, sendOverdueReminders } = require('./utils/email');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const contractRoutes = require('./routes/contracts');
const orderRoutes = require('./routes/orders');
const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const receivableRoutes = require('./routes/receivables');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);

app.use('/api/customers', authenticateToken, customerRoutes);
app.use('/api/contracts', authenticateToken, contractRoutes);
app.use('/api/orders', authenticateToken, orderRoutes);
app.use('/api/invoices', authenticateToken, invoiceRoutes);
app.use('/api/payments', authenticateToken, paymentRoutes);
app.use('/api/receivables', authenticateToken, receivableRoutes);
app.use('/api/export', authenticateToken, exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

async function startServer() {
  if (!dbExists) {
    console.log('数据库不存在，正在初始化...');
    const initDatabase = require('./database/init');
    await initDatabase();
  } else {
    console.log('数据库已存在，跳过初始化');
  }

  console.log('正在启动定时任务...');

  cron.schedule('0 9 * * *', async () => {
    console.log('[' + new Date().toLocaleString() + '] 开始执行每日付款提醒任务');
    try {
      await sendPaymentReminders();
      console.log('[' + new Date().toLocaleString() + '] 付款提醒任务完成');
    } catch (error) {
      console.error('付款提醒任务失败:', error);
    }
  });

  cron.schedule('0 10 * * *', async () => {
    console.log('[' + new Date().toLocaleString() + '] 开始执行每日逾期催款任务');
    try {
      await sendOverdueReminders();
      console.log('[' + new Date().toLocaleString() + '] 逾期催款任务完成');
    } catch (error) {
      console.error('逾期催款任务失败:', error);
    }
  });

  console.log('定时任务已启动：');
  console.log('  - 每日 09:00 发送付款提醒');
  console.log('  - 每日 10:00 发送逾期催款');

  app.listen(PORT, () => {
    console.log(`\n应收账款管理系统后端服务已启动`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`API健康检查: http://localhost:${PORT}/api/health`);
    console.log(`\n默认账号: admin / 123456`);
  });
}

startServer().catch(err => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});

module.exports = app;
