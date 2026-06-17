import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Statistic, Tag, Button } from 'antd';
import { 
  FileTextOutlined, 
  MoneyCollectOutlined, 
  WarningOutlined, 
  CheckCircleOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { receivableApi, invoiceApi } from '../api';
import dayjs from 'dayjs';

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, invoiceData] = await Promise.all([
        receivableApi.summary(),
        invoiceApi.list({ pageSize: 10, page: 1 })
      ]);
      setSummary(summaryData);
      setRecentInvoices(invoiceData.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status, overdueLevel) => {
    const statusMap = {
      not_due: { color: 'blue', text: '未到期' },
      due_soon: { color: 'orange', text: '即将到期' },
      overdue: { color: 'red', text: '已逾期' },
      paid: { color: 'green', text: '已结清' }
    };
    
    if (status === 'overdue' && overdueLevel) {
      const levelMap = {
        level1: { color: 'orange', text: '逾期30天内' },
        level2: { color: 'orange', text: '逾期30-60天' },
        level3: { color: 'red', text: '逾期60天以上' }
      };
      const level = levelMap[overdueLevel];
      return <Tag color={level.color}>{level.text}</Tag>;
    }
    
    const info = statusMap[status] || { color: 'default', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const statusChartOption = summary ? {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      data: [
        { value: summary.by_status.not_due.amount, name: '未到期', itemStyle: { color: '#1890ff' } },
        { value: summary.by_status.due_soon.amount, name: '即将到期', itemStyle: { color: '#faad14' } },
        { value: summary.by_status.overdue.amount, name: '已逾期', itemStyle: { color: '#f5222d' } }
      ]
    }]
  } : {};

  const overdueChartOption = summary ? {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { value: summary.by_overdue_level.level1.amount, name: '逾期30天内', itemStyle: { color: '#faad14' } },
        { value: summary.by_overdue_level.level2.amount, name: '逾期30-60天', itemStyle: { color: '#fa8c16' } },
        { value: summary.by_overdue_level.level3.amount, name: '逾期60天以上', itemStyle: { color: '#f5222d' } }
      ]
    }]
  } : {};

  const columns = [
    { title: '发票编号', dataIndex: 'invoice_no', width: 160 },
    { title: '客户名称', dataIndex: 'customer_name' },
    { 
      title: '发票金额', 
      dataIndex: 'total_amount',
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '待付金额', 
      dataIndex: 'remaining_amount',
      render: (val, record) => (
        <span className={val > 0 ? 'amount-negative' : 'amount-positive'}>
          ¥ {val?.toLocaleString() || 0}
        </span>
      )
    },
    { title: '到期日期', dataIndex: 'due_date', width: 120 },
    { 
      title: '状态', 
      dataIndex: 'status',
      render: (val, record) => getStatusTag(val, record.overdueLevel)
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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="应收账款状态分布" extra={<Button size="small" onClick={loadData}>刷新</Button>}>
            <ReactECharts option={statusChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="逾期账款分级分布" extra={<Button size="small" onClick={loadData}>刷新</Button>}>
            <ReactECharts option={overdueChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Card 
        title="最近发票" 
        extra={<Button type="link" onClick={() => window.location.href = '/invoices'}>查看全部</Button>}
      >
        <Table
          dataSource={recentInvoices}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
}

export default Dashboard;
