import React, { useState, useEffect } from 'react';
import { Card, Table, Button, DatePicker, Space, message, Statistic, Row, Col, Tag } from 'antd';
import { ReloadOutlined, ExportOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { receivableApi, exportApi } from '../api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

function PaymentSpeed() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(6, 'month'), dayjs()]);

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD')
      };
      const res = await receivableApi.paymentSpeed(params);
      setData(res);
    } catch (error) {
      message.error('加载回款速度数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = {
      startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: dateRange?.[1]?.format('YYYY-MM-DD')
    };
    exportApi.paymentSpeed(params);
  };

  const getSpeedTag = (days) => {
    if (days <= 15) return <Tag color="green">快</Tag>;
    if (days <= 30) return <Tag color="blue">正常</Tag>;
    if (days <= 60) return <Tag color="orange">较慢</Tag>;
    return <Tag color="red">慢</Tag>;
  };

  const getRankColor = (index) => {
    if (index === 0) return '#f5222d';
    if (index === 1) return '#fa8c16';
    if (index === 2) return '#faad14';
    return '#595959';
  };

  const speedChartOption = data ? {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const item = params[0];
        return `${item.axisValue}<br/>${item.marker} 客户数: ${item.value} 家`;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['0-15天', '16-30天', '31-60天', '61-90天', '90天以上'],
      axisLabel: { interval: 0 }
    },
    yAxis: {
      type: 'value',
      name: '客户数',
      axisLabel: { formatter: '{value}' }
    },
    series: [{
      name: '客户数',
      type: 'bar',
      barWidth: '50%',
      itemStyle: {
        color: (params) => {
          const colors = ['#52c41a', '#1890ff', '#faad14', '#fa8c16', '#f5222d'];
          return colors[params.dataIndex] || '#1890ff';
        }
      },
      data: [
        data.speed_distribution?.['0-15'] || 0,
        data.speed_distribution?.['16-30'] || 0,
        data.speed_distribution?.['31-60'] || 0,
        data.speed_distribution?.['61-90'] || 0,
        data.speed_distribution?.['90+'] || 0
      ]
    }]
  } : {};

  const rankingColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 80,
      fixed: 'left',
      render: (_, __, index) => (
        <span style={{ 
          color: getRankColor(index), 
          fontWeight: index < 3 ? 'bold' : 'normal',
          fontSize: index < 3 ? '16px' : '14px'
        }}>
          {index + 1}
        </span>
      )
    },
    { title: '客户名称', dataIndex: 'customer_name', width: 200, fixed: 'left' },
    { 
      title: '付款次数', 
      dataIndex: 'payment_count',
      width: 120,
      render: (val) => val || 0
    },
    { 
      title: '平均回款天数', 
      dataIndex: 'avg_payment_days',
      width: 140,
      sorter: (a, b) => b.avg_payment_days - a.avg_payment_days,
      defaultSortOrder: 'descend',
      render: (val) => (
        <span style={{ color: val > 60 ? '#f5222d' : val > 30 ? '#faad14' : '#52c41a', fontWeight: 'bold' }}>
          {val || 0} 天
        </span>
      )
    },
    { 
      title: '回款速度', 
      dataIndex: 'avg_payment_days',
      width: 100,
      render: (val) => getSpeedTag(val)
    },
    { 
      title: '最快回款', 
      dataIndex: 'min_payment_days',
      width: 120,
      render: (val) => `${val || 0} 天`
    },
    { 
      title: '最慢回款', 
      dataIndex: 'max_payment_days',
      width: 120,
      render: (val) => <span className="amount-negative">{val || 0} 天</span>
    },
    { 
      title: '付款总金额', 
      dataIndex: 'total_paid_amount',
      width: 140,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="总体平均回款天数"
              value={data?.overall_avg_days || 0}
              precision={1}
              prefix={<ClockCircleOutlined />}
              suffix="天"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="统计客户数"
              value={data?.customer_count || 0}
              prefix={<RiseOutlined />}
              suffix="家"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="总付款笔数"
              value={data?.total_payments || 0}
              suffix="笔"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="回款速度分布"
        loading={loading}
        style={{ marginBottom: 16 }}
      >
        <ReactECharts option={speedChartOption} style={{ height: 350 }} />
      </Card>

      <Card
        title="客户回款速度排名"
        extra={
          <Space>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            <Button icon={<ExportOutlined />} type="primary" onClick={handleExport}>导出报告</Button>
          </Space>
        }
      >
        <Table
          dataSource={data?.by_customer || []}
          columns={rankingColumns}
          rowKey="customer_id"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`
          }}
        />
      </Card>
    </div>
  );
}

export default PaymentSpeed;
