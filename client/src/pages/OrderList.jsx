import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Input, 
  Space, 
  Modal, 
  Form, 
  Select, 
  DatePicker, 
  InputNumber,
  message, 
  Popconfirm,
  Card,
  Descriptions,
  Row,
  Col,
  Tag
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { orderApi, customerApi, contractApi } from '../api';
import dayjs from 'dayjs';

function OrderList() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [keyword, setKeyword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [contractOptions, setContractOptions] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadCustomers();
    loadContracts();
  }, [pagination.current, pagination.pageSize, keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await orderApi.list({
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

  const loadCustomers = async () => {
    try {
      const response = await customerApi.all();
      setCustomerOptions(response.map(item => ({ label: item.name, value: item.id })));
    } catch (error) {
      console.error('加载客户列表失败');
    }
  };

  const loadContracts = async () => {
    try {
      const response = await contractApi.all();
      setContractOptions(response.map(item => ({ label: `${item.contract_no} - ${item.name}`, value: item.id })));
    } catch (error) {
      console.error('加载合同列表失败');
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    const formData = {
      ...record,
      customer_id: record.customer_id,
      contract_id: record.contract_id,
      order_date: record.order_date ? dayjs(record.order_date) : null
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleView = async (id) => {
    try {
      const detail = await orderApi.detail(id);
      setDetailItem(detail);
      setDetailVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await orderApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData = {
        ...values,
        order_date: values.order_date ? values.order_date.format('YYYY-MM-DD') : null
      };
      if (editingItem) {
        await orderApi.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await orderApi.create(submitData);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      active: { color: 'green', text: '进行中' },
      completed: { color: 'blue', text: '已完成' },
      cancelled: { color: 'red', text: '已取消' },
      pending: { color: 'orange', text: '待处理' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    { title: '订单编号', dataIndex: 'order_no', width: 150 },
    { title: '订单名称', dataIndex: 'name', width: 200 },
    { title: '客户名称', dataIndex: 'customer_name', width: 150 },
    { title: '关联合同', dataIndex: 'contract_no', width: 150 },
    { 
      title: '订单金额', 
      dataIndex: 'amount',
      width: 130,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { title: '订单日期', dataIndex: 'order_date', width: 120 },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 100,
      render: (val) => getStatusTag(val)
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(record.id)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定要删除该订单吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        title="订单管理"
        extra={
          <Space>
            <Input
              placeholder="搜索订单编号、订单名称、客户名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>新增订单</Button>
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
        title={editingItem ? '编辑订单' : '新增订单'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="order_no"
                label="订单编号"
                rules={[{ required: true, message: '请输入订单编号' }]}
              >
                <Input placeholder="请输入订单编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="订单名称"
                rules={[{ required: true, message: '请输入订单名称' }]}
              >
                <Input placeholder="请输入订单名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customer_id"
                label="客户名称"
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <Select placeholder="请选择客户" options={customerOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contract_id"
                label="关联合同"
              >
                <Select placeholder="请选择关联合同" options={contractOptions} allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="订单金额"
                rules={[{ required: true, message: '请输入订单金额' }]}
              >
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="请输入订单金额"
                  formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\¥\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="order_date"
                label="订单日期"
                rules={[{ required: true, message: '请选择订单日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              placeholder="请选择状态"
              options={[
                { label: '进行中', value: 'active' },
                { label: '已完成', value: 'completed' },
                { label: '已取消', value: 'cancelled' },
                { label: '待处理', value: 'pending' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {detailItem && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="订单编号">{detailItem.order_no}</Descriptions.Item>
            <Descriptions.Item label="订单名称">{detailItem.name}</Descriptions.Item>
            <Descriptions.Item label="客户名称">{detailItem.customer_name}</Descriptions.Item>
            <Descriptions.Item label="关联合同">{detailItem.contract_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="订单金额">¥ {detailItem.amount?.toLocaleString() || 0}</Descriptions.Item>
            <Descriptions.Item label="订单日期">{detailItem.order_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(detailItem.status)}</Descriptions.Item>
            {detailItem.description && (
              <Descriptions.Item label="备注" span={2}>{detailItem.description}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default OrderList;
