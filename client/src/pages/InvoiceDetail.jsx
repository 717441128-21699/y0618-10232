import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Descriptions, 
  Table, 
  Button, 
  Tag, 
  Modal, 
  Form, 
  InputNumber,
  DatePicker,
  Select,
  Space,
  message,
  Row,
  Col,
  Input,
  Alert
} from 'antd';
import { 
  ArrowLeftOutlined, 
  MailOutlined, 
  MoneyCollectOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceApi, paymentApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderType, setReminderType] = useState('reminder');
  const [paymentForm] = Form.useForm();
  const [reminderForm] = Form.useForm();

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await invoiceApi.detail(id);
      setDetail(data);
    } catch (error) {
      message.error('加载发票详情失败');
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

  const handleBack = () => {
    navigate('/invoices');
  };

  const handleRegisterPayment = () => {
    paymentForm.resetFields();
    paymentForm.setFieldsValue({
      payment_date: dayjs(),
      amount: detail?.remaining_amount
    });
    setPaymentModalVisible(true);
  };

  const handleSubmitPayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      const submitData = {
        ...values,
        invoice_id: id,
        customer_id: detail?.customer_id,
        payment_date: values.payment_date?.format('YYYY-MM-DD')
      };
      await paymentApi.create(submitData);
      message.success('收款登记成功');
      setPaymentModalVisible(false);
      loadDetail();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '登记失败');
    }
  };

  const handleSendReminder = (type) => {
    setReminderType(type);
    reminderForm.resetFields();
    const subject = type === 'reminder' ? '付款提醒' : '催款通知';
    const content = type === 'reminder' 
      ? `尊敬的${detail?.customer_name}：\n\n贵司发票 ${detail?.invoice_no} 将于 ${detail?.due_date} 到期，金额为 ¥${detail?.remaining_amount?.toLocaleString()}。请及时安排付款。\n\n谢谢！`
      : `尊敬的${detail?.customer_name}：\n\n贵司发票 ${detail?.invoice_no} 已逾期，到期日为 ${detail?.due_date}，待付金额为 ¥${detail?.remaining_amount?.toLocaleString()}。请尽快安排付款，避免产生额外费用。\n\n如有疑问请及时联系。`;
    
    reminderForm.setFieldsValue({
      email: detail?.customer_email || '',
      subject,
      content
    });
    setReminderModalVisible(true);
  };

  const handleSubmitReminder = async () => {
    try {
      const values = await reminderForm.validateFields();
      await invoiceApi.sendReminder(id, values);
      message.success('邮件发送成功');
      setReminderModalVisible(false);
      loadDetail();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '发送失败');
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

  const paymentColumns = [
    { title: '收款编号', dataIndex: 'payment_no', width: 140 },
    { 
      title: '收款金额', 
      dataIndex: 'amount',
      width: 120,
      render: (val) => <span className="amount-positive">¥ {val?.toLocaleString() || 0}</span>
    },
    { title: '收款日期', dataIndex: 'payment_date', width: 120 },
    { title: '收款方式', dataIndex: 'payment_method', width: 120 },
    { title: '银行名称', dataIndex: 'bank_name' },
    { title: '银行账号', dataIndex: 'bank_account' },
    { title: '备注', dataIndex: 'remarks' }
  ];

  const emailColumns = [
    { title: '发送时间', dataIndex: 'sent_at', width: 160 },
    { title: '收件人', dataIndex: 'email' },
    { title: '邮件类型', dataIndex: 'type', width: 120, render: (val) => {
      const map = { reminder: '付款提醒', dunning: '催款通知' };
      return map[val] || val;
    }},
    { title: '主题', dataIndex: 'subject' },
    { title: '状态', dataIndex: 'status', width: 100, render: (val) => {
      const map = { sent: { text: '已发送', color: 'green' }, failed: { text: '发送失败', color: 'red' } };
      const info = map[val] || { text: val, color: 'default' };
      return <Tag color={info.color}>{info.text}</Tag>;
    }}
  ];

  return (
    <div>
      <Card
        loading={loading}
        title="发票详情"
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回列表</Button>
            {detail && detail.status !== 'paid' && (
              <>
                <Button 
                  type="primary" 
                  icon={<MoneyCollectOutlined />} 
                  onClick={handleRegisterPayment}
                >
                  快速登记收款
                </Button>
                <Button 
                  icon={<MailOutlined />} 
                  onClick={() => handleSendReminder('reminder')}
                >
                  发送付款提醒
                </Button>
                {detail?.overdue_level > 0 && (
                  <Button 
                    danger
                    icon={<MailOutlined />} 
                    onClick={() => handleSendReminder('dunning')}
                  >
                    发送催款邮件
                  </Button>
                )}
              </>
            )}
          </Space>
        }
      >
        {detail && (
          <div>
            {detail.overdue_level > 0 && (
              <Alert
                message={`该发票已逾期 ${detail.overdue_days || 0} 天，待付金额 ¥${detail.remaining_amount?.toLocaleString() || 0}`}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label="发票编号">{detail.invoice_no}</Descriptions.Item>
                <Descriptions.Item label="开票日期">{detail.invoice_date}</Descriptions.Item>
                <Descriptions.Item label="到期日期">{detail.due_date}</Descriptions.Item>
                <Descriptions.Item label="发票金额">¥ {detail.invoice_amount?.toLocaleString() || 0}</Descriptions.Item>
                <Descriptions.Item label="税额">¥ {detail.tax_amount?.toLocaleString() || 0}</Descriptions.Item>
                <Descriptions.Item label="总金额">¥ {detail.total_amount?.toLocaleString() || 0}</Descriptions.Item>
                <Descriptions.Item label="已付金额">
                  <span className="amount-positive">¥ {detail.paid_amount?.toLocaleString() || 0}</span>
                </Descriptions.Item>
                <Descriptions.Item label="待付金额">
                  <span className="amount-negative">¥ {detail.remaining_amount?.toLocaleString() || 0}</span>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  {getStatusTag(detail.status, detail.overdue_level)}
                </Descriptions.Item>
                {detail.overdue_level > 0 && (
                  <Descriptions.Item label="逾期天数">
                    <span className="amount-negative">{detail.overdue_days || 0} 天</span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card title="客户信息" size="small" style={{ marginBottom: 16 }}>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="客户名称">{detail.customer_name}</Descriptions.Item>
                <Descriptions.Item label="联系人">{detail.customer_contact || '-'}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{detail.customer_phone || '-'}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{detail.customer_email || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>{detail.customer_address || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card title="关联合同" size="small">
                  {detail.contract_no ? (
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="合同编号">{detail.contract_no}</Descriptions.Item>
                      <Descriptions.Item label="合同金额">¥ {detail.contract_amount?.toLocaleString() || 0}</Descriptions.Item>
                      <Descriptions.Item label="签订日期">{detail.contract_date || '-'}</Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <span style={{ color: '#999' }}>暂无关联合同</span>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="关联订单" size="small">
                  {detail.order_no ? (
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="订单编号">{detail.order_no}</Descriptions.Item>
                      <Descriptions.Item label="订单金额">¥ {detail.order_amount?.toLocaleString() || 0}</Descriptions.Item>
                      <Descriptions.Item label="订单日期">{detail.order_date || '-'}</Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <span style={{ color: '#999' }}>暂无关联订单</span>
                  )}
                </Card>
              </Col>
            </Row>

            {detail.remarks && (
              <Card title="备注" size="small" style={{ marginBottom: 16 }}>
                <p>{detail.remarks}</p>
              </Card>
            )}

            <Card title="收款记录" size="small" style={{ marginBottom: 16 }}>
              <Table
                dataSource={detail.payments || []}
                columns={paymentColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 800 }}
              />
            </Card>

            <Card title="邮件发送记录" size="small">
              <Table
                dataSource={detail.email_logs || []}
                columns={emailColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 800 }}
              />
            </Card>
          </div>
        )}
      </Card>

      <Modal
        title="登记收款"
        open={paymentModalVisible}
        onOk={handleSubmitPayment}
        onCancel={() => setPaymentModalVisible(false)}
        width={600}
      >
        <Form form={paymentForm} layout="vertical">
          {detail && (
            <Alert
              message={`发票待付金额：¥ ${detail.remaining_amount?.toLocaleString() || 0}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="payment_no"
                label="收款编号"
                rules={[{ required: true, message: '请输入收款编号' }]}
              >
                <Input placeholder="请输入收款编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="收款金额"
                rules={[
                  { required: true, message: '请输入收款金额' },
                  { 
                    validator: (_, value) => {
                      if (value && detail && value > detail.remaining_amount) {
                        return Promise.reject(`收款金额不能超过待付金额 ¥${detail.remaining_amount?.toLocaleString()}`);
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber 
                  min={0} 
                  step={0.01}
                  style={{ width: '100%' }}
                  max={detail?.remaining_amount}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="payment_date"
                label="收款日期"
                rules={[{ required: true, message: '请选择收款日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
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
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bank_name" label="银行名称">
                <Input placeholder="请输入银行名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bank_account" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={reminderType === 'reminder' ? '发送付款提醒' : '发送催款邮件'}
        open={reminderModalVisible}
        onOk={handleSubmitReminder}
        onCancel={() => setReminderModalVisible(false)}
        width={550}
      >
        <Form form={reminderForm} layout="vertical">
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
            <TextArea rows={6} placeholder="请输入邮件内容" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InvoiceDetail;
