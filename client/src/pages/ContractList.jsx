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
import { contractApi, customerApi } from '../api';
import dayjs from 'dayjs';

function ContractList() {
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
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadCustomers();
  }, [pagination.current, pagination.pageSize, keyword]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await contractApi.list({
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
      sign_date: record.sign_date ? dayjs(record.sign_date) : null,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null
    };
    form.setFieldsValue(formData);
    setModalVisible(true);
  };

  const handleView = async (id) => {
    try {
      const detail = await contractApi.detail(id);
      setDetailItem(detail);
      setDetailVisible(true);
    } catch (error) {
      message.error('加载详情失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await contractApi.delete(id);
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
        sign_date: values.sign_date ? values.sign_date.format('YYYY-MM-DD') : null,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null
      };
      if (editingItem) {
        await contractApi.update(editingItem.id, submitData);
        message.success('更新成功');
      } else {
        await contractApi.create(submitData);
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
      active: { color: 'green', text: '生效中' },
      expired: { color: 'red', text: '已到期' },
      pending: { color: 'orange', text: '待生效' },
      terminated: { color: 'default', text: '已终止' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    { title: '合同编号', dataIndex: 'contract_no', width: 150 },
    { title: '合同名称', dataIndex: 'name', width: 200 },
    { title: '客户名称', dataIndex: 'customer_name', width: 150 },
    { 
      title: '合同金额', 
      dataIndex: 'amount',
      width: 130,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { title: '签订日期', dataIndex: 'sign_date', width: 120 },
    { title: '开始日期', dataIndex: 'start_date', width: 120 },
    { title: '结束日期', dataIndex: 'end_date', width: 120 },
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
          <Popconfirm title="确定要删除该合同吗？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        title="合同管理"
        extra={
          <Space>
            <Input
              placeholder="搜索合同编号、合同名称、客户名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>新增合同</Button>
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
        title={editingItem ? '编辑合同' : '新增合同'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="contract_no"
                label="合同编号"
                rules={[{ required: true, message: '请输入合同编号' }]}
              >
                <Input placeholder="请输入合同编号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="合同名称"
                rules={[{ required: true, message: '请输入合同名称' }]}
              >
                <Input placeholder="请输入合同名称" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="customer_id"
            label="客户名称"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户" options={customerOptions} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="合同金额"
            rules={[{ required: true, message: '请输入合同金额' }]}
          >
            <InputNumber 
              min={0} 
              style={{ width: '100%' }} 
              placeholder="请输入合同金额"
              formatter={value => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\¥\s?|(,*)/g, '')}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="sign_date"
                label="签订日期"
                rules={[{ required: true, message: '请选择签订日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="start_date"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="end_date"
                label="结束日期"
                rules={[{ required: true, message: '请选择结束日期' }]}
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
                { label: '生效中', value: 'active' },
                { label: '已到期', value: 'expired' },
                { label: '待生效', value: 'pending' },
                { label: '已终止', value: 'terminated' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="合同详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {detailItem && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="合同编号">{detailItem.contract_no}</Descriptions.Item>
            <Descriptions.Item label="合同名称">{detailItem.name}</Descriptions.Item>
            <Descriptions.Item label="客户名称">{detailItem.customer_name}</Descriptions.Item>
            <Descriptions.Item label="合同金额">¥ {detailItem.amount?.toLocaleString() || 0}</Descriptions.Item>
            <Descriptions.Item label="签订日期">{detailItem.sign_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(detailItem.status)}</Descriptions.Item>
            <Descriptions.Item label="开始日期">{detailItem.start_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="结束日期">{detailItem.end_date || '-'}</Descriptions.Item>
            {detailItem.description && (
              <Descriptions.Item label="备注" span={2}>{detailItem.description}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default ContractList;
