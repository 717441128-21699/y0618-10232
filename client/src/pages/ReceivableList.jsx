import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Modal, 
  Form, 
  Input,
  Select,
  Space,
  message,
  Statistic,
  Row,
  Col,
  Descriptions
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined, 
  MailOutlined,
  MoneyCollectOutlined,
  FileTextOutlined,
  WarningOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { receivableApi, customerApi, invoiceApi } from '../api';

const { Option } = Select;

function ReceivableList() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customers, setCustomers] = useState([]);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [reminderInvoice, setReminderInvoice] = useState(null);
  const [reminderForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [keyword, customerFilter, statusFilter]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await customerApi.all();
      setCustomers(response);
    } catch (error) {
      message.error('加载客户数据失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const summaryData = await receivableApi.summary();
      setSummary(summaryData);
      
      let invoices = summaryData.invoices || [];
      
      if (keyword) {
        const kw = keyword.toLowerCase();
        invoices = invoices.filter(item => 
          item.invoice_no?.toLowerCase().includes(kw) ||
          item.customer_name?.toLowerCase().includes(kw)
        );
      }
      
      if (customerFilter) {
        invoices = invoices.filter(item => item.customer_id === customerFilter);
      }
      
      if (statusFilter) {
        invoices = invoices.filter(item => item.status === statusFilter);
      }
      
      invoices.sort((a, b) => {
        return new Date(a.due_date) - new Date(b.due_date);
      });
      
      setData(invoices);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status, overdueLevel) => {
    const statusMap = {
      unpaid: { text: '未付款', color: 'red' },
      partial: { text: '部分付款', color: 'orange' },
      paid: { text: '已结清', color: 'green' }
    };
    const overdueColors = {
      0: statusMap[status]?.color || 'default',
      1: 'orange',
      2: 'red',
      3: 'magenta'
    };
    const color = overdueLevel > 0 ? overdueColors[overdueLevel] : statusMap[status]?.color || 'default';
    const baseText = statusMap[status]?.text || status;
    const overdueText = overdueLevel > 0 ? ` (逾期${overdueLevel}级)` : '';
    return <Tag color={color}>{baseText}{overdueText}</Tag>;
  };

  const handleViewDetail = (id) => {
    navigate(`/invoices/${id}`);
  };

  const handleSendReminder = (record) => {
    setReminderInvoice(record);
    reminderForm.resetFields();
    const content = `尊敬的${record.customer_name}：\n\n贵司发票 ${record.invoice_no} 将于 ${record.due_date} 到期，金额为 ¥${record.remaining_amount?.toLocaleString()}。请及时安排付款。\n\n谢谢！`;
    
    reminderForm.setFieldsValue({
      email: record.customer_email || '',
      subject: '付款提醒',
      content
    });
    setReminderVisible(true);
  };

  const handleSubmitReminder = async () => {
    try {
      const values = await reminderForm.validateFields();
      await invoiceApi.sendReminder(reminderInvoice.id, values);
      message.success('提醒邮件发送成功');
      setReminderVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '发送失败');
    }
  };

  const columns = [
    { title: '发票编号', dataIndex: 'invoice_no', width: 140, fixed: 'left' },
    { title: '客户名称', dataIndex: 'customer_name', width: 180 },
    { 
      title: '发票金额', 
      dataIndex: 'total_amount',
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '待付金额', 
      dataIndex: 'remaining_amount',
      width: 120,
      render: (val) => <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
    },
    { title: '到期日期', dataIndex: 'due_date', width: 120 },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 140,
      render: (_, record) => getStatusTag(record.status, record.overdue_level)
    },
    { 
      title: '逾期天数', 
      dataIndex: 'overdue_days',
      width: 100,
      render: (val, record) => {
        if (record.overdue_level > 0) {
          return <span className="amount-negative">{val || 0} 天</span>;
        }
        return '-';
      }
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>查看详情</Button>
          <Button size="small" icon={<MailOutlined />} onClick={() => handleSendReminder(record)}>发送提醒</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="应收账款总额"
              value={summary?.total_remaining || 0}
              precision={2}
              prefix={<MoneyCollectOutlined />}
              suffix="元"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="未到期金额"
              value={summary?.by_status?.not_due?.amount || 0}
              precision={2}
              prefix={<FileTextOutlined />}
              suffix="元"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="即将到期金额"
              value={summary?.by_status?.due_soon?.amount || 0}
              precision={2}
              prefix={<WarningOutlined />}
              suffix="元"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已逾期金额"
              value={summary?.by_status?.overdue?.amount || 0}
              precision={2}
              prefix={<BarChartOutlined />}
              suffix="元"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title="应收账款列表"
        extra={
          <Space>
            <Input
              placeholder="搜索发票编号、客户名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              placeholder="客户筛选"
              value={customerFilter || undefined}
              onChange={setCustomerFilter}
              style={{ width: 180 }}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {customers.map(item => (
                <Option key={item.id} value={item.id}>{item.name}</Option>
              ))}
            </Select>
            <Select
              placeholder="状态筛选"
              value={statusFilter || undefined}
              onChange={setStatusFilter}
              style={{ width: 140 }}
              allowClear
            >
              <Option value="unpaid">未付款</Option>
              <Option value="partial">部分付款</Option>
            </Select>
            <Button onClick={loadData}>刷新</Button>
          </Space>
        }
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`
          }}
        />
      </Card>

      <Modal
        title="发送提醒邮件"
        open={reminderVisible}
        onOk={handleSubmitReminder}
        onCancel={() => setReminderVisible(false)}
        width={550}
      >
        <Form form={reminderForm} layout="vertical">
          {reminderInvoice && (
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="发票编号">{reminderInvoice.invoice_no}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{reminderInvoice.customer_name}</Descriptions.Item>
              <Descriptions.Item label="待付金额">
                <span className="amount-negative">¥ {reminderInvoice.remaining_amount?.toLocaleString() || 0}</span>
              </Descriptions.Item>
              <Descriptions.Item label="到期日期">{reminderInvoice.due_date}</Descriptions.Item>
            </Descriptions>
          )}
          <Form.Item
            name="email"
            label="收件人邮箱"
            rules={[
              { required: true, message: '请输入收件人邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入收件人邮箱" />
          </Form.Item>
          <Form.Item
            name="subject"
            label="邮件主题"
            rules={[{ required: true, message: '请输入邮件主题' }]}
          >
            <Input placeholder="请输入邮件主题" />
          </Form.Item>
          <Form.Item
            name="content"
            label="邮件内容"
            rules={[{ required: true, message: '请输入邮件内容' }]}
          >
            <Input.TextArea rows={6} placeholder="请输入邮件内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ReceivableList;
