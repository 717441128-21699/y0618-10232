import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Input, 
  Space, 
  Modal, 
  Form, 
  InputNumber,
  message, 
  Popconfirm,
  Card,
  Descriptions,
  Tag,
  Row,
  Col
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { customerApi, exportApi } from '../api';

function CustomerList() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [pagination.current, pagination.pageSize, keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await customerApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword
      });
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
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleView = async (id) => {
    try {
      const detail = await customerApi.detail(id);
      setDetailItem(detail);
      setDetailVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await customerApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await customerApi.update(editingItem.id, values);
        message.success('更新成功');
      } else {
        await customerApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const handleExportStatement = (id) => {
    exportApi.customerStatement(id, {});
  };

  const columns = [
    { title: '客户名称', dataIndex: 'name', width: 200 },
    { title: '联系人', dataIndex: 'contact_name', width: 100 },
    { title: '联系电话', dataIndex: 'contact_phone', width: 130 },
    { title: '邮箱', dataIndex: 'contact_email' },
    { 
      title: '信用等级', 
      dataIndex: 'credit_level',
      width: 100,
      render: (val) => {
        const colors = ['', 'green', 'blue', 'orange', 'red'];
        return <Tag color={colors[val] || 'default'}>等级 {val}</Tag>;
      }
    },
    { 
      title: '应收账款余额', 
      dataIndex: 'total_receivable',
      width: 140,
      render: (val) => (
        <span className={val > 0 ? 'amount-negative' : 'amount-positive'}>
          ¥ {val?.toLocaleString() || 0}
        </span>
      )
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除该客户吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        title="客户管理"
        extra={
          <Space>
            <Input
              placeholder="搜索客户名称、联系人、邮箱"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>新增客户</Button>
            <Button onClick={() => handleExportStatement(detailItem?.id)}>导出对账单</Button>
          </Space>
        }
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
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
        title={editingItem ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_name" label="联系人">
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_phone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="contact_email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>
          <Form.Item
            name="credit_level"
            label="信用等级"
            tooltip="1-5级，1级最高"
          >
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="客户详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="export" onClick={() => handleExportStatement(detailItem?.id)}>导出对账单</Button>,
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={800}
      >
        {detailItem && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="客户名称">{detailItem.name}</Descriptions.Item>
              <Descriptions.Item label="信用等级">等级 {detailItem.credit_level}</Descriptions.Item>
              <Descriptions.Item label="联系人">{detailItem.contact_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{detailItem.contact_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱" span={2}>{detailItem.contact_email || '-'}</Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>{detailItem.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="发票总数">{detailItem.invoice_count || 0}</Descriptions.Item>
              <Descriptions.Item label="累计开票金额">¥ {detailItem.total_invoice_amount?.toLocaleString() || 0}</Descriptions.Item>
              <Descriptions.Item label="应收账款余额" span={2}>
                <span className={detailItem.total_receivable > 0 ? 'amount-negative' : 'amount-positive'}>
                  ¥ {detailItem.total_receivable?.toLocaleString() || 0}
                </span>
              </Descriptions.Item>
            </Descriptions>
            
            <Card title="历史发票" size="small" style={{ marginBottom: 16 }}>
              <Table
                dataSource={detailItem.invoices || []}
                columns={[
                  { title: '发票编号', dataIndex: 'invoice_no' },
                  { title: '开票日期', dataIndex: 'invoice_date', width: 100 },
                  { title: '到期日期', dataIndex: 'due_date', width: 100 },
                  { title: '金额', dataIndex: 'total_amount', render: (v) => `¥ ${v?.toLocaleString()}` },
                  { title: '待付金额', dataIndex: 'remaining_amount', render: (v) => `¥ ${v?.toLocaleString()}` },
                  { title: '状态', dataIndex: 'status', render: (v) => {
                    const map = { unpaid: '未付款', partial: '部分付款', paid: '已结清' };
                    return map[v] || v;
                  }}
                ]}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </Card>

            <Card title="历史收款" size="small">
              <Table
                dataSource={detailItem.payments || []}
                columns={[
                  { title: '收款编号', dataIndex: 'payment_no' },
                  { title: '对应发票', dataIndex: 'invoice_no' },
                  { title: '收款日期', dataIndex: 'payment_date', width: 100 },
                  { title: '金额', dataIndex: 'amount', render: (v) => `¥ ${v?.toLocaleString()}` },
                  { title: '收款方式', dataIndex: 'payment_method' }
                ]}
                rowKey="id"
                size="small"
                pagination={false}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CustomerList;
