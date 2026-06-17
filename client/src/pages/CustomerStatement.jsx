import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  DatePicker,
  Table,
  Statistic,
  Row,
  Col,
  message,
  Tag,
  Space,
  Descriptions,
  Typography
} from 'antd';
import { ArrowLeftOutlined, SearchOutlined, ExportOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { receivableApi, exportApi } from '../api';
import dayjs from 'dayjs';

const { Title } = Typography;

function CustomerStatement() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState(dayjs().subtract(1, 'year').startOf('day'));
  const [endDate, setEndDate] = useState(dayjs().endOf('day'));

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const params = {
        start_date: startDate?.format('YYYY-MM-DD'),
        end_date: endDate?.format('YYYY-MM-DD')
      };
      const response = await receivableApi.customerStatement(id, params);
      setData(response);
    } catch (error) {
      message.error('加载对账单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!startDate || !endDate) {
      message.warning('请选择开始日期和结束日期');
      return;
    }
    if (startDate.isAfter(endDate)) {
      message.warning('开始日期不能晚于结束日期');
      return;
    }
    loadData();
  };

  const handleExport = () => {
    if (!id) return;
    const params = {
      start_date: startDate?.format('YYYY-MM-DD'),
      end_date: endDate?.format('YYYY-MM-DD')
    };
    exportApi.customerStatement(id, params);
  };

  const totalDebit = data?.transactions?.reduce((sum, t) => sum + (t.debit || 0), 0) || 0;
  const totalCredit = data?.transactions?.reduce((sum, t) => sum + (t.credit || 0), 0) || 0;
  const beginningBalance = data?.summary?.opening_balance ?? 0;
  const endingBalance = data?.summary?.closing_balance ?? 0;

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 120,
      fixed: 'left'
    },
    {
      title: '类型',
      dataIndex: 'type_text',
      width: 80,
      render: (text, record) => (
        <Tag color={record.type === 'invoice' ? 'blue' : 'green'}>{text}</Tag>
      )
    },
    {
      title: '凭证号',
      dataIndex: 'reference_no',
      width: 160,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <span>{text}</span>
          {record.invoice_no && (
            <span style={{ fontSize: 12, color: '#999' }}>发票: {record.invoice_no}</span>
          )}
        </Space>
      )
    },
    {
      title: '借方（开票）',
      dataIndex: 'debit',
      width: 140,
      align: 'right',
      render: (val) => val > 0 ? (
        <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
      ) : '-'
    },
    {
      title: '贷方（收款）',
      dataIndex: 'credit',
      width: 140,
      align: 'right',
      render: (val) => val > 0 ? (
        <span className="amount-positive">¥ {val?.toLocaleString() || 0}</span>
      ) : '-'
    },
    {
      title: '余额',
      dataIndex: 'balance',
      width: 140,
      align: 'right',
      fixed: 'right',
      render: (val) => (
        <span className={val > 0 ? 'amount-negative' : 'amount-positive'}>
          ¥ {val?.toLocaleString() || 0}
        </span>
      )
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      render: (val) => val || '-'
    }
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>返回</Button>
            <span>客户往来对账</span>
          </Space>
        }
        extra={
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
            disabled={!data}
          >
            导出对账单
          </Button>
        }
      >
        {data?.customer && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>客户信息</Title>
            <Descriptions bordered size="small" column={4}>
              <Descriptions.Item label="客户名称">{data.customer.name}</Descriptions.Item>
              <Descriptions.Item label="联系人">{data.customer.contact_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{data.customer.contact_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{data.customer.contact_email || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col>
              <span style={{ marginRight: 8 }}>开始日期：</span>
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="开始日期"
              />
            </Col>
            <Col>
              <span style={{ marginRight: 8 }}>结束日期：</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="结束日期"
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
              >
                查询
              </Button>
            </Col>
          </Row>
        </Card>

        {data && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>汇总统计</Title>
              <Row gutter={24}>
                <Col span={6}>
                  <Statistic
                    title="期初余额"
                    value={beginningBalance}
                    prefix="¥"
                    formatter={(val) => val?.toLocaleString() || 0}
                    valueStyle={{ color: beginningBalance > 0 ? '#cf1322' : '#3f8600' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="本期开票合计"
                    value={totalDebit}
                    prefix="¥"
                    formatter={(val) => val?.toLocaleString() || 0}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="本期收款合计"
                    value={totalCredit}
                    prefix="¥"
                    formatter={(val) => val?.toLocaleString() || 0}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="期末余额"
                    value={endingBalance}
                    prefix="¥"
                    formatter={(val) => val?.toLocaleString() || 0}
                    valueStyle={{ color: endingBalance > 0 ? '#cf1322' : '#3f8600' }}
                  />
                </Col>
              </Row>
              <Row gutter={24} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <div style={{ color: '#666' }}>开票笔数</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                    {data.summary?.invoice_count || 0} 笔
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ color: '#666' }}>收款笔数</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#52c41a' }}>
                    {data.summary?.payment_count || 0} 笔
                  </div>
                </Col>
              </Row>
            </Card>

            <Card size="small" title="往来明细">
              <Table
                dataSource={data.transactions || []}
                columns={columns}
                rowKey={(record, index) => `${record.date}-${record.type}-${record.reference_no}-${index}`}
                loading={loading}
                scroll={{ x: 900 }}
                pagination={{
                  pageSize: 50,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (t) => `共 ${t} 条记录`
                }}
              />
            </Card>
          </>
        )}
      </Card>
    </div>
  );
}

export default CustomerStatement;
