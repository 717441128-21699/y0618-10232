import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  MoneyCollectOutlined,
  BarChartOutlined,
  FileExcelOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
      onClick: () => navigate('/dashboard')
    },
    {
      key: '/customers',
      icon: <TeamOutlined />,
      label: '客户管理',
      onClick: () => navigate('/customers')
    },
    {
      key: '/contracts',
      icon: <FileTextOutlined />,
      label: '合同管理',
      onClick: () => navigate('/contracts')
    },
    {
      key: '/orders',
      icon: <ShoppingOutlined />,
      label: '订单管理',
      onClick: () => navigate('/orders')
    },
    {
      key: '/invoices',
      icon: <FileTextOutlined />,
      label: '发票管理',
      onClick: () => navigate('/invoices')
    },
    {
      key: '/payments',
      icon: <MoneyCollectOutlined />,
      label: '收款管理',
      onClick: () => navigate('/payments')
    },
    {
      key: '/receivables',
      icon: <BarChartOutlined />,
      label: '应收账款',
      onClick: () => navigate('/receivables')
    },
    {
      key: 'reports',
      icon: <FileExcelOutlined />,
      label: '报表中心',
      children: [
        {
          key: '/ageing-analysis',
          label: '账龄分析',
          onClick: () => navigate('/ageing-analysis')
        },
        {
          key: '/payment-speed',
          label: '回款速度分析',
          onClick: () => navigate('/payment-speed')
        },
        {
          key: '/monthly-report',
          label: '月度报告',
          onClick: () => navigate('/monthly-report')
        }
      ]
    }
  ];

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout
      }
    ]
  };

  const selectedKey = location.pathname === '/' ? '/dashboard' : location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="logo">
          {collapsed ? 'IR' : '应收账管理'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['reports']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>欢迎，{user.name || user.username}</span>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer' }} />
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: '24px', minHeight: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
