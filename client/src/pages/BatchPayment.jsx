import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Button,
  Table,
  Checkbox,
  Row,
  Col,
  message,
  Tag,
  Space,
  Divider,
  Statistic
} from 'antd';
import { ArrowLeftOutlined, AppstoreOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { paymentApi, customerApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

function BatchPayment() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await customerApi.all();
      setCustomers(response || []);
    } catch (error) {
      message.error('加载客户列表失败');
    }
  };

  const getInvoiceStatus = (invoice) => {
    const today = dayjs().startOf('day');
    const dueDate = dayjs(invoice.due_date).startOf('day');
    const daysDiff = dueDate.diff(today, 'day');

    if (daysDiff > 3) {
      return { status: 'not_due', text: '未到期', color: 'green' };
    } else if (daysDiff >= 0 && daysDiff <= 3) {
      return { status: 'due_soon', text: '即将到期', color: 'orange' };
    } else {
      return { status: 'overdue', text: '已逾期', color: 'red' };
    }
  };

  const queryUnpaidInvoices = async () => {
    if (!selectedCustomerId) {
      message.warning('请先选择客户');
      return;
    }
    setLoading(true);
    try {
      const response = await paymentApi.listUnpaid(selectedCustomerId);
      const invoiceList = (response.data || []).map(inv => ({
        ...inv,
        checked: false,
        allocation: 0,
        ...getInvoiceStatus(inv)
      }));
      invoiceList.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setInvoices(invoiceList);
    } catch (error) {
      message.error('查询发票失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (value) => {
    setSelectedCustomerId(value);
    setInvoices([]);
  };

  const handleCheckAll = (e) => {
    const checked = e.target.checked;
    setInvoices(prev => prev.map(inv => ({
      ...inv,
      checked,
      allocation: checked ? inv.allocation : 0
    })));
  };

  const handleCheckRow = (invoiceId, checked) => {
    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId
        ? { ...inv, checked, allocation: checked ? inv.allocation : 0 }
        : inv
    ));
  };

  const handleAllocationChange = (invoiceId, value) => {
    const allocation = parseFloat(value) || 0;
    setInvoices(prev => prev.map(inv =>
      inv.id === invoiceId ? { ...inv, allocation } : inv
    ));
  };

  const autoAllocate = () => {
    if (!totalAmount || totalAmount <= 0) {
      message.warning('请先输入总到账金额');
      return;
    }

    const sortedInvoices = [...invoices].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    let remaining = totalAmount;
    const allocatedInvoices = sortedInvoices.map(inv => {
      if (remaining <= 0) {
        return { ...inv, checked: false, allocation: 0 };
      }
      const allocateAmount = Math.min(remaining, inv.remaining_amount);
      remaining = Math.max(0, remaining - allocateAmount);
      return {
        ...inv,
        checked: allocateAmount > 0,
        allocation: allocateAmount
      };
    });

    const invoiceMap = {};
    allocatedInvoices.forEach(inv => {
      invoiceMap[inv.id] = inv;
    });

    setInvoices(prev => prev.map(inv => invoiceMap[inv.id] || inv));
  };

  const checkedInvoices = invoices.filter(inv => inv.checked);
  const totalAllocated = checkedInvoices.reduce((sum, inv) => sum + inv.allocation, 0);
  const pendingAllocation = totalAmount - totalAllocated;
  const allChecked = invoices.length > 0 && invoices.every(inv => inv.checked);
  const someChecked = invoices.some(inv => inv.checked);

  const validateAllocations = () => {
    for (const inv of checkedInvoices) {
      if (inv.allocation <= 0) {
        message.error(`发票 ${inv.invoice_no} 的分配金额必须大于0`);
        return false;
      }
      if (inv.allocation > inv.remaining_amount) {
        message.error(`发票 ${inv.invoice_no} 的分配金额不能超过待付金额 ¥${inv.remaining_amount.toLocaleString()}`);
        return false;
      }
    }

    if (Math.abs(totalAllocated - totalAmount) > 0.01) {
      message.error(`分配金额合计 ¥${totalAllocated.toLocaleString()} 与总到账金额 ¥${totalAmount.toLocaleString()} 不一致`);
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (!validateAllocations()) {
        return;
      }

      const allocations = checkedInvoices.map(inv => ({
        invoice_id: inv.id,
        amount: inv.allocation
      }));

      setLoading(true);
      await paymentApi.batchCreate({
        customer_id: selectedCustomerId,
        total_amount: totalAmount,
        payment_date: values.payment_date.format('YYYY-MM-DD'),
        payment_method: values.payment_method,
        allocations
      });

      message.success('批量收款登记成功');
      navigate('/payments');
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '保存失败');
    } finally {
      setLoading(false);
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
    {
      title: (
        <Checkbox
          indeterminate={someChecked && !allChecked}
          checked={allChecked}
          onChange={handleCheckAll}
        />
      ),
      dataIndex: 'checked',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={record.checked}
          onChange={(e) => handleCheckRow(record.id, e.target.checked)}
        />
      )
    },
    { title: '发票编号', dataIndex: 'invoice_no', width: 140 },
    { title: '开票日期', dataIndex: 'invoice_date', width: 110 },
    { title: '到期日期', dataIndex: 'due_date', width: 110 },
    {
      title: '发票金额',
      dataIndex: 'total_amount',
      width: 130,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    {
      title: '待付金额',
      dataIndex: 'remaining_amount',
      width: 130,
      render: (val) => <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
    },
    {
      title: '本次分配',
      dataIndex: 'allocation',
      width: 150,
      render: (val, record) => (
        <InputNumber
          min={0}
          max={record.remaining_amount}
          step={0.01}
          value={val}
          disabled={!record.checked}
          onChange={(value) => handleAllocationChange(record.id, value)}
          style={{ width: '100%' }}
          placeholder="请输入分配金额"
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={record.color}>{record.text}</Tag>
      )
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/payments')}>返回</Button>
            <span>批量登记收款</span>
          </Space>
        }
      >
        <Card size="small" title="选择客户" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Form.Item
                name="customer_id"
                label="客户"
                rules={[{ required: true, message: '请选择客户' }]}
                style={{ marginBottom: 0 }}
              >
                <Select
                  placeholder="请选择客户"
                  value={selectedCustomerId}
                  onChange={handleCustomerChange}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {customers.map(c => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<AppstoreOutlined />}
                onClick={queryUnpaidInvoices}
                disabled={!selectedCustomerId}
              >
                查询未结清发票
              </Button>
            </Col>
          </Row>
        </Card>

        {invoices.length > 0 && (
          <>
            <Card size="small" title="收款信息" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="total_amount"
                    label="总到账金额"
                    rules={[{ required: true, message: '请输入总到账金额' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      min={0.01}
                      step={0.01}
                      style={{ width: '100%' }}
                      placeholder="请输入总到账金额"
                      value={totalAmount}
                      onChange={setTotalAmount}
                      addonBefore="¥"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="payment_date"
                    label="收款日期"
                    rules={[{ required: true, message: '请选择收款日期' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="payment_method"
                    label="收款方式"
                    rules={[{ required: true, message: '请选择收款方式' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select placeholder="请选择收款方式">
                      {paymentMethodOptions.map(item => (
                        <Option key={item.value} value={item.value}>{item.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="选择发票并分配金额" style={{ marginBottom: 16 }}>
              <Table
                dataSource={invoices}
                columns={columns}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1000 }}
                pagination={false}
                rowClassName={(record) => record.checked ? 'table-row-selected' : ''}
              />
            </Card>

            <Card size="small">
              <Row gutter={24} align="middle">
                <Col>
                  <Statistic
                    title="已勾选发票"
                    value={checkedInvoices.length}
                    suffix="张"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="已分配金额"
                    value={totalAllocated}
                    prefix="¥"
                    formatter={(val) => val?.toLocaleString() || 0}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col>
                  <Statistic
                    title="待分配金额"
                    value={Math.max(0, pendingAllocation)}
                    prefix="¥"
                    formatter={(val) => val?.toLocaleString() || 0}
                    valueStyle={{ color: pendingAllocation > 0 ? '#faad14' : '#52c41a' }}
                  />
                </Col>
                <Col flex="auto" style={{ textAlign: 'right' }}>
                  <Space>
                    <Button onClick={autoAllocate} disabled={!totalAmount || totalAmount <= 0}>
                      自动分配（按到期日优先）
                    </Button>
                    <Divider type="vertical" />
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      loading={loading}
                      disabled={checkedInvoices.length === 0 || Math.abs(pendingAllocation) > 0.01}
                    >
                      保存
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </>
        )}

        <Form form={form} style={{ display: 'none' }}>
          <Form.Item name="customer_id" />
          <Form.Item name="payment_date" />
          <Form.Item name="payment_method" />
        </Form>
      </Card>
    </div>
  );
}

export default BatchPayment;
