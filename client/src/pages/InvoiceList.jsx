import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Input, 
  Space, 
  Modal, 
  Form, 
  InputNumber,
  DatePicker,
  Select,
  message, 
  Popconfirm,
  Card,
  Descriptions,
  Tag,
  Row,
  Col
} from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  MailOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { invoiceApi, customerApi, contractApi, orderApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function InvoiceList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [reminderInvoice, setReminderInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form] = Form.useForm();
  const [reminderForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, keyword, statusFilter, dateRange]);

  useEffect(() => {
    loadSelectData();
  }, []);

  const loadSelectData = async () => {
    try {
      const [customerRes, contractRes, orderRes] = await Promise.all([
        customerApi.all(),
        contractApi.all(),
        orderApi.all()
      ]);
      setCustomers(customerRes);
      setContracts(contractRes);
      setOrders(orderRes);
    } catch (error) {
      message.error('加载选项数据失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword,
        status: statusFilter,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD')
      };
      const response = await invoiceApi.list(params);
      setData(response.data);
      setTotal(response.total);
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      invoice_amount: record.amount,
      invoice_date: record.invoice_date ? dayjs(record.invoice_date) : null,
      due_date: record.due_date ? dayjs(record.due_date) : null
    });
    setModalVisible(true);
  };

  const handleView = (id) => {
    navigate(`/invoices/${id}`);
  };

  const handleDelete = async (id) => {
    try {
      await invoiceApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSendReminder = (record) => {
    setReminderInvoice(record);
    reminderForm.resetFields();
    setReminderVisible(true);
  };

  const handleSubmitReminder = async () => {
    try {
      const values = await reminderForm.validateFields();
      await invoiceApi.sendReminder(reminderInvoice.id, values);
      message.success('提醒邮件发送成功');
      setReminderVisible(false);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '发送失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        amount: values.invoice_amount,
        invoice_date: values.invoice_date?.format('YYYY-MM-DD'),
        due_date: values.due_date?.format('YYYY-MM-DD')
      };
      delete submitData.invoice_amount;
      delete submitData.tax_rate;
      delete submitData.paid_amount;
      if (editingItem) {
        await invoiceApi.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await invoiceApi.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '操作失败');
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

  const columns = [
    { title: '发票编号', dataIndex: 'invoice_no', width: 140 },
    { title: '客户名称', dataIndex: 'customer_name', width: 150 },
    { title: '关联合同', dataIndex: 'contract_no', width: 140 },
    { title: '关联订单', dataIndex: 'order_no', width: 140 },
    { 
      title: '发票金额', 
      dataIndex: 'invoice_amount',
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '税额', 
      dataIndex: 'tax_amount',
      width: 100,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '总金额', 
      dataIndex: 'total_amount',
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { title: '开票日期', dataIndex: 'invoice_date', width: 110 },
    { title: '到期日期', dataIndex: 'due_date', width: 110 },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 140,
      render: (_, record) => getStatusTag(record.status, record.overdue_level)
    },
    { 
      title: '已付金额', 
      dataIndex: 'paid_amount',
      width: 120,
      render: (val) => <span className="amount-positive">¥ {val?.toLocaleString() || 0}</span>
    },
    { 
      title: '待付金额', 
      dataIndex: 'remaining_amount',
      width: 120,
      render: (val) => <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
    },
    {
      title: '操作',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>详情</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" icon={<MailOutlined />} onClick={() => handleSendReminder(record)}>提醒</Button>
          <Popconfirm title="确定要删除该发票吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        title="发票管理"
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
              placeholder="状态筛选"
              value={statusFilter || undefined}
              onChange={setStatusFilter}
              style={{ width: 140 }}
              allowClear
            >
              <Option value="unpaid">未付款</Option>
              <Option value="partial">部分付款</Option>
              <Option value="paid">已结清</Option>
            </Select>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>新增发票</Button>
          </Space>
        }
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{
            ...pagination,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize })
          }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑发票' : '新增发票'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customer_id"
                label="客户名称"
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <Select placeholder="请选择客户">
                  {customers.map(item => (
                    <Option key={item.id} value={item.id}>{item.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="invoice_no"
                label="发票编号"
                rules={[{ required: true, message: '请输入发票编号' }]}
              >
                <Input placeholder="请输入发票编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contract_id" label="关联合同">
                <Select placeholder="请选择合同" allowClear>
                  {contracts.map(item => (
                    <Option key={item.id} value={item.id}>{item.contract_no}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="order_id" label="关联订单">
                <Select placeholder="请选择订单" allowClear>
                  {orders.map(item => (
                    <Option key={item.id} value={item.id}>{item.order_no}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="invoice_amount"
                label="发票金额"
                rules={[{ required: true, message: '请输入发票金额' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tax_amount"
                label="税额"
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="total_amount"
                label="总金额"
                rules={[{ required: true, message: '请输入总金额' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="payment_method"
                label="付款方式"
              >
                <Input placeholder="请输入付款方式" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="invoice_date"
                label="开票日期"
                rules={[{ required: true, message: '请选择开票日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="due_date"
                label="到期日期"
                rules={[{ required: true, message: '请选择到期日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发送提醒邮件"
        open={reminderVisible}
        onOk={handleSubmitReminder}
        onCancel={() => setReminderVisible(false)}
        width={500}
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
            <Input placeholder="请输入邮件主题" defaultValue="付款提醒" />
          </Form.Item>
          <Form.Item name="content" label="邮件内容">
            <Input.TextArea rows={4} placeholder="请输入邮件内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InvoiceList;
