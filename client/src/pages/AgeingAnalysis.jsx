import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Select, DatePicker, Space, message, Statistic, Row, Col, Tabs } from 'antd';
import { ReloadOutlined, ExportOutlined, CalendarOutlined, UserOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { receivableApi, exportApi, customerApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

function AgeingAnalysis() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [cutoffDate, setCutoffDate] = useState(dayjs());

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    loadData();
  }, [customerId, cutoffDate]);

  const loadCustomers = async () => {
    try {
      const res = await customerApi.all();
      setCustomers(res);
    } catch (error) {
      message.error('加载客户列表失败');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        customerId: customerId || undefined,
        cutoffDate: cutoffDate?.format('YYYY-MM-DD')
      };
      const res = await receivableApi.ageingAnalysis(params);
      setData(res);
    } catch (error) {
      message.error('加载账龄分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = {
      customerId: customerId || undefined,
      cutoffDate: cutoffDate?.format('YYYY-MM-DD')
    };
    exportApi.ageingAnalysis(params);
  };

  const ageingChartOption = data ? {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach(item => {
          result += `${item.marker} ${item.seriesName}: ¥ ${item.value?.toLocaleString() || 0}<br/>`;
        });
        return result;
      }
    },
    legend: { data: ['金额', '笔数'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['未到期', '0-30天', '31-60天', '61-90天', '91-180天', '180天以上']
    },
    yAxis: [
      { type: 'value', name: '金额(元)', axisLabel: { formatter: '{value}' } },
      { type: 'value', name: '笔数', axisLabel: { formatter: '{value}' } }
    ],
    series: [
      {
        name: '金额',
        type: 'bar',
        barWidth: '30%',
        itemStyle: { color: '#1890ff' },
        data: [
          data.ageing_distribution?.not_due?.amount || 0,
          data.ageing_distribution?.['0-30']?.amount || 0,
          data.ageing_distribution?.['31-60']?.amount || 0,
          data.ageing_distribution?.['61-90']?.amount || 0,
          data.ageing_distribution?.['91-180']?.amount || 0,
          data.ageing_distribution?.['180+']?.amount || 0
        ]
      },
      {
        name: '笔数',
        type: 'bar',
        barWidth: '30%',
        yAxisIndex: 1,
        itemStyle: { color: '#52c41a' },
        data: [
          data.ageing_distribution?.not_due?.count || 0,
          data.ageing_distribution?.['0-30']?.count || 0,
          data.ageing_distribution?.['31-60']?.count || 0,
          data.ageing_distribution?.['61-90']?.count || 0,
          data.ageing_distribution?.['91-180']?.count || 0,
          data.ageing_distribution?.['180+']?.count || 0
        ]
      }
    ]
  } : {};

  const customerAgeingColumns = [
    { title: '客户名称', dataIndex: 'customer_name', width: 180, fixed: 'left' },
    { 
      title: '应收账款总额', 
      dataIndex: 'total_amount',
      width: 140,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '未到期', 
      dataIndex: ['ageing', 'not_due'],
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '0-30天', 
      dataIndex: ['ageing', '0-30'],
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '31-60天', 
      dataIndex: ['ageing', '31-60'],
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '61-90天', 
      dataIndex: ['ageing', '61-90'],
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '91-180天', 
      dataIndex: ['ageing', '91-180'],
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '180天以上', 
      dataIndex: ['ageing', '180+'],
      width: 120,
      render: (val) => <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
    }
  ];

  const detailColumns = [
    { title: '发票编号', dataIndex: 'invoice_no', width: 160 },
    { title: '客户名称', dataIndex: 'customer_name', width: 180 },
    { title: '到期日期', dataIndex: 'due_date', width: 120 },
    { 
      title: '发票金额', 
      dataIndex: 'invoice_amount',
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '待付金额', 
      dataIndex: 'remaining_amount',
      width: 120,
      render: (val) => <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
    },
    { 
      title: '账龄区间', 
      dataIndex: 'ageing_period',
      width: 120,
      render: (val) => {
        const colorMap = {
          '未到期': 'blue',
          '0-30天': 'cyan',
          '31-60天': 'geekblue',
          '61-90天': 'orange',
          '91-180天': 'red',
          '180天以上': 'magenta'
        };
        return <span style={{ color: colorMap[val] || '#000' }}>{val}</span>;
      }
    },
    { 
      title: '逾期天数', 
      dataIndex: 'overdue_days',
      width: 100,
      render: (val) => val > 0 ? <span className="amount-negative">{val}天</span> : '-'
    }
  ];

  const tabItems = [
    {
      key: 'chart',
      label: '账龄分布图',
      children: (
        <Card loading={loading}>
          <ReactECharts option={ageingChartOption} style={{ height: 400 }} />
        </Card>
      )
    },
    {
      key: 'customer',
      label: '按客户分类',
      children: (
        <Card loading={loading}>
          <Table
            dataSource={data?.by_customer || []}
            columns={customerAgeingColumns}
            rowKey="customer_id"
            scroll={{ x: 1000 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`
            }}
          />
        </Card>
      )
    },
    {
      key: 'detail',
      label: '明细表',
      children: (
        <Card loading={loading}>
          <Table
            dataSource={data?.details || []}
            columns={detailColumns}
            rowKey="id"
            scroll={{ x: 1000 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`
            }}
          />
        </Card>
      )
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="应收账款总额"
              value={data?.total_receivable || 0}
              precision={2}
              prefix={<CalendarOutlined />}
              suffix="元"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="逾期总额"
              value={data?.total_overdue || 0}
              precision={2}
              prefix={<UserOutlined />}
              suffix="元"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="逾期率"
              value={data?.overdue_rate || 0}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="账龄分析"
        extra={
          <Space>
            <Select
              placeholder="选择客户"
              value={customerId || undefined}
              onChange={setCustomerId}
              style={{ width: 200 }}
              allowClear
            >
              {customers.map(item => (
                <Option key={item.id} value={item.id}>{item.name}</Option>
              ))}
            </Select>
            <DatePicker
              value={cutoffDate}
              onChange={setCutoffDate}
              placeholder="截止日期"
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            <Button icon={<ExportOutlined />} type="primary" onClick={handleExport}>导出Excel</Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Tabs items={tabItems} defaultActiveKey="chart" />
      </Card>
    </div>
  );
}

export default AgeingAnalysis;
