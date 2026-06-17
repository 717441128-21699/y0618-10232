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
  Alert,
  Row,
  Col
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { paymentApi, invoiceApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

function PaymentList() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, keyword, dateRange]);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await invoiceApi.list({ page: 1, pageSize: 1000 });
      setInvoices(response.data || []);
    } catch (error) {
      message.error('加载发票数据失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD')
      };
      const response = await paymentApi.list(params);
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
    setSelectedInvoice(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    const inv = invoices.find(i => i.id === record.invoice_id);
    setSelectedInvoice(inv || null);
    form.setFieldsValue({
      ...record,
      customer_id: record.customer_id,
      payment_date: record.payment_date ? dayjs(record.payment_date) : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await paymentApi.delete(id);
      message.success('删除成功');
      loadData();
      loadInvoices();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleInvoiceChange = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    setSelectedInvoice(inv || null);
    if (inv) {
      form.setFieldsValue({ customer_id: inv.customer_id });
    } else {
      form.setFieldsValue({ customer_id: undefined });
    }
    const currentAmount = form.getFieldValue('amount');
    if (currentAmount && inv && currentAmount > inv.remaining_amount) {
      form.setFieldsValue({ amount: inv.remaining_amount });
    }
  };

  const validateAmount = async (rule, value) => {
    if (value && selectedInvoice && value > selectedInvoice.remaining_amount) {
      throw new Error(`收款金额不能超过待付金额 ¥${selectedInvoice.remaining_amount?.toLocaleString()}`);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        payment_date: values.payment_date?.format('YYYY-MM-DD')
      };
      if (editingItem) {
        await paymentApi.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await paymentApi.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
      loadInvoices();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const paymentMethodOptions = [
    { value: '现金', label: '现金' },
    { value: '银行转账', label: '银行转账' },
    { value: '支票', label: '支票' },
    { value: '支付宝', label: '支付宝' },
    { value: '微信支付', label: '微信支付' },
    { value: '其他', label: '其他' }
  ];

  const columns = [
    { title: '收款编号', dataIndex: 'payment_no', width: 140 },
    { title: '客户名称', dataIndex: 'customer_name', width: 150 },
    { title: '对应发票', dataIndex: 'invoice_no', width: 140 },
    { 
      title: '收款金额', 
      dataIndex: 'amount',
      width: 140,
      render: (val) => <span className="amount-positive">¥ {val?.toLocaleString() || 0}</span>
    },
    { title: '收款日期', dataIndex: 'payment_date', width: 120 },
    { title: '收款方式', dataIndex: 'payment_method', width: 120 },
    { title: '银行名称', dataIndex: 'bank_name', width: 140 },
    { title: '银行账号', dataIndex: 'bank_account', width: 160 },
    {
      title: '操作',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除该收款记录吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        title="收款管理"
        extra={
          <Space>
            <Input
              placeholder="搜索收款编号、客户名称、发票编号"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>新增收款</Button>
          </Space>
        }
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
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
        title={editingItem ? '编辑收款' : '新增收款'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={650}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customer_id" hidden>
            <Input />
          </Form.Item>
          {selectedInvoice && selectedInvoice.remaining_amount > 0 && (
            <Alert
              message={`该发票待付金额：¥ ${selectedInvoice.remaining_amount?.toLocaleString() || 0}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="invoice_id"
                label="对应发票"
                rules={[{ required: true, message: '请选择对应发票' }]}
              >
                <Select 
                  placeholder="请选择发票" 
                  onChange={handleInvoiceChange}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {invoices.filter(inv => editingItem || inv.remaining_amount > 0).map(item => (
                    <Option key={item.id} value={item.id}>
                      {item.invoice_no} - {item.customer_name} (待付: ¥{item.remaining_amount?.toLocaleString() || 0})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="payment_no"
                label="收款编号"
                rules={[{ required: true, message: '请输入收款编号' }]}
              >
                <Input placeholder="请输入收款编号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="收款金额"
                rules={[
                  { required: true, message: '请输入收款金额' },
                  { validator: validateAmount }
                ]}
              >
                <InputNumber 
                  min={0} 
                  step={0.01}
                  style={{ width: '100%' }} 
                  max={selectedInvoice?.remaining_amount}
                  placeholder={selectedInvoice ? `最大 ${selectedInvoice.remaining_amount?.toLocaleString() || 0}` : '请选择发票'}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="payment_date"
                label="收款日期"
                rules={[{ required: true, message: '请选择收款日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="payment_method"
                label="收款方式"
                rules={[{ required: true, message: '请选择收款方式' }]}
              >
                <Select placeholder="请选择收款方式">
                  {paymentMethodOptions.map(item => (
                    <Option key={item.value} value={item.value}>{item.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bank_name" label="银行名称">
                <Input placeholder="请输入银行名称" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="bank_account" label="银行账号">
            <Input placeholder="请输入银行账号" />
          </Form.Item>
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PaymentList;
