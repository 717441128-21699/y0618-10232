import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Select, DatePicker, Space, message, Statistic, Row, Col, Tabs, Tag } from 'antd';
import { ReloadOutlined, ExportOutlined, FileTextOutlined, MoneyCollectOutlined, AccountBookOutlined } from '@ant-design/icons';
import { receivableApi, exportApi } from '../api';
import dayjs from 'dayjs';

const { Option } = Select;
const { MonthPicker } = DatePicker;

function MonthlyReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const transformData = (rawData) => {
    const summary = rawData.summary || {};
    const ageingSummary = rawData.ageing_summary || {};
    
    const totalReceivable = summary.total_receivable || 0;
    
    const ageingTableData = [
      { period: '未到期', ...ageingSummary.not_due, percentage: totalReceivable > 0 ? (ageingSummary.not_due?.amount || 0) / totalReceivable * 100 : 0 },
      { period: '0-30天', ...ageingSummary['0-30'], percentage: totalReceivable > 0 ? (ageingSummary['0-30']?.amount || 0) / totalReceivable * 100 : 0 },
      { period: '31-60天', ...ageingSummary['31-60'], percentage: totalReceivable > 0 ? (ageingSummary['31-60']?.amount || 0) / totalReceivable * 100 : 0 },
      { period: '61-90天', ...ageingSummary['61-90'], percentage: totalReceivable > 0 ? (ageingSummary['61-90']?.amount || 0) / totalReceivable * 100 : 0 },
      { period: '91-180天', ...ageingSummary['91-180'], percentage: totalReceivable > 0 ? (ageingSummary['91-180']?.amount || 0) / totalReceivable * 100 : 0 },
      { period: '180天以上', ...ageingSummary.over_180, percentage: totalReceivable > 0 ? (ageingSummary.over_180?.amount || 0) / totalReceivable * 100 : 0 }
    ];

    const invoices = (rawData.new_invoices || []).map(inv => ({
      ...inv,
      invoice_amount: inv.total_amount
    }));

    return {
      ...rawData,
      invoices: invoices,
      payments: rawData.received_payments || [],
      ageing_summary: {
        ...ageingSummary,
        '180+': ageingSummary.over_180
      },
      ageing_table: ageingTableData,
      summary: {
        ...summary,
        invoice_count: summary.new_invoices_count,
        invoice_amount: summary.new_invoices_amount,
        payment_count: summary.received_count,
        payment_amount: summary.received_amount,
        receivable_balance: summary.total_receivable,
        balance_change: 0
      }
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        year: selectedMonth?.year(),
        month: selectedMonth?.month() + 1
      };
      const res = await receivableApi.monthlyReport(params);
      setData(transformData(res));
    } catch (error) {
      message.error('加载月度报告失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const params = {
      year: selectedMonth?.year(),
      month: selectedMonth?.month() + 1
    };
    exportApi.monthlyReport(params);
  };

  const getInvoiceStatusTag = (status) => {
    const statusMap = {
      unpaid: { color: 'red', text: '未付款' },
      partial: { color: 'orange', text: '部分付款' },
      paid: { color: 'green', text: '已结清' }
    };
    const info = statusMap[status] || { color: 'default', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
  };

  const invoiceColumns = [
    { title: '发票编号', dataIndex: 'invoice_no', width: 160 },
    { title: '客户名称', dataIndex: 'customer_name', width: 180 },
    { title: '开票日期', dataIndex: 'invoice_date', width: 120 },
    { title: '到期日期', dataIndex: 'due_date', width: 120 },
    { 
      title: '发票金额', 
      dataIndex: 'invoice_amount',
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '税额', 
      dataIndex: 'tax_amount',
      width: 100,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '总金额', 
      dataIndex: 'total_amount',
      width: 120,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '已付金额', 
      dataIndex: 'paid_amount',
      width: 120,
      render: (val) => <span className="amount-positive">¥ {val?.toLocaleString() || 0}</span>
    },
    { 
      title: '待付金额', 
      dataIndex: 'remaining_amount',
      width: 120,
      render: (val) => <span className="amount-negative">¥ {val?.toLocaleString() || 0}</span>
    },
    { 
      title: '状态', 
      dataIndex: 'status',
      width: 100,
      render: (val) => getInvoiceStatusTag(val)
    }
  ];

  const paymentColumns = [
    { title: '收款编号', dataIndex: 'payment_no', width: 160 },
    { title: '客户名称', dataIndex: 'customer_name', width: 180 },
    { title: '关联发票', dataIndex: 'invoice_no', width: 160 },
    { title: '收款日期', dataIndex: 'payment_date', width: 120 },
    { 
      title: '收款金额', 
      dataIndex: 'amount',
      width: 140,
      render: (val) => <span className="amount-positive">¥ {val?.toLocaleString() || 0}</span>
    },
    { 
      title: '收款方式', 
      dataIndex: 'payment_method',
      width: 100,
      render: (val) => {
        const methodMap = {
          cash: '现金',
          bank: '银行转账',
          check: '支票',
          other: '其他'
        };
        return methodMap[val] || val;
      }
    },
    { title: '备注', dataIndex: 'remarks' }
  ];

  const ageingSummaryColumns = [
    { title: '账龄区间', dataIndex: 'period', width: 150 },
    { 
      title: '金额', 
      dataIndex: 'amount',
      width: 150,
      render: (val) => `¥ ${val?.toLocaleString() || 0}`
    },
    { 
      title: '占比', 
      dataIndex: 'percentage',
      width: 100,
      render: (val) => `${val?.toFixed(2) || 0}%`
    },
    { 
      title: '笔数', 
      dataIndex: 'count',
      width: 100,
      render: (val) => val || 0
    }
  ];

  const tabItems = [
    {
      key: 'invoices',
      label: '本月开票明细',
      children: (
        <Card loading={loading}>
          <Table
            dataSource={data?.invoices || []}
            columns={invoiceColumns}
            rowKey="id"
            scroll={{ x: 1400 }}
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
      key: 'payments',
      label: '本月收款明细',
      children: (
        <Card loading={loading}>
          <Table
            dataSource={data?.payments || []}
            columns={paymentColumns}
            rowKey="id"
            scroll={{ x: 1200 }}
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
      key: 'ageing',
      label: '账龄分析汇总',
      children: (
        <Card loading={loading}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small">
                <Statistic
                  title="未到期金额"
                  value={data?.ageing_summary?.not_due?.amount || 0}
                  precision={2}
                  suffix="元"
                  valueStyle={{ color: '#1890ff', fontSize: 18 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small">
                <Statistic
                  title="逾期30天内"
                  value={data?.ageing_summary?.['0-30']?.amount || 0}
                  precision={2}
                  suffix="元"
                  valueStyle={{ color: '#faad14', fontSize: 18 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small">
                <Statistic
                  title="逾期180天以上"
                  value={data?.ageing_summary?.['180+']?.amount || 0}
                  precision={2}
                  suffix="元"
                  valueStyle={{ color: '#f5222d', fontSize: 18 }}
                />
              </Card>
            </Col>
          </Row>
          <Table
            dataSource={data?.ageing_table || []}
            columns={ageingSummaryColumns}
            rowKey="period"
            pagination={false}
            summary={(pageData) => {
              let totalAmount = 0;
              let totalCount = 0;
              pageData.forEach(item => {
                totalAmount += item.amount || 0;
                totalCount += item.count || 0;
              });
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <strong>¥ {totalAmount.toLocaleString()}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <strong>100.00%</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <strong>{totalCount}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </Card>
      )
    }
  ];

  return (
    <div>
      <Card
        title={`月度报告 - ${selectedMonth?.format('YYYY年MM月') || ''}`}
        extra={
          <Space>
            <MonthPicker
              value={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="选择月份"
              format="YYYY年MM月"
            />
            <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
            <Button icon={<ExportOutlined />} type="primary" onClick={handleExport}>导出Excel</Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="本月新增发票"
                value={data?.summary?.invoice_count || 0}
                suffix="张"
                valueStyle={{ color: '#1890ff' }}
                prefix={<FileTextOutlined />}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                金额：<span style={{ color: '#1890ff' }}>¥ {data?.summary?.invoice_amount?.toLocaleString() || 0}</span>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="本月收款笔数"
                value={data?.summary?.payment_count || 0}
                suffix="笔"
                valueStyle={{ color: '#52c41a' }}
                prefix={<MoneyCollectOutlined />}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                金额：<span style={{ color: '#52c41a' }}>¥ {data?.summary?.payment_amount?.toLocaleString() || 0}</span>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="应收账款余额"
                value={data?.summary?.receivable_balance || 0}
                precision={2}
                suffix="元"
                valueStyle={{ color: '#faad14' }}
                prefix={<AccountBookOutlined />}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c' }}>
                较上月：
                <span style={{ 
                  color: (data?.summary?.balance_change || 0) > 0 ? '#f5222d' : '#52c41a' 
                }}>
                  {(data?.summary?.balance_change || 0) > 0 ? '+' : ''}¥ {data?.summary?.balance_change?.toLocaleString() || 0}
                </span>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs items={tabItems} defaultActiveKey="invoices" />
      </Card>
    </div>
  );
}

export default MonthlyReport;
