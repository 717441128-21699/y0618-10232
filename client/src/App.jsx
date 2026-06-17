import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import MainLayout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CustomerList from './pages/CustomerList.jsx';
import CustomerStatement from './pages/CustomerStatement.jsx';
import ContractList from './pages/ContractList.jsx';
import OrderList from './pages/OrderList.jsx';
import InvoiceList from './pages/InvoiceList.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import PaymentList from './pages/PaymentList.jsx';
import BatchPayment from './pages/BatchPayment.jsx';
import ReceivableList from './pages/ReceivableList.jsx';
import AgeingAnalysis from './pages/AgeingAnalysis.jsx';
import PaymentSpeed from './pages/PaymentSpeed.jsx';
import MonthlyReport from './pages/MonthlyReport.jsx';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <MainLayout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/:id/statement" element={<CustomerStatement />} />
        <Route path="contracts" element={<ContractList />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="invoices" element={<InvoiceList />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="payments" element={<PaymentList />} />
        <Route path="payments/batch" element={<BatchPayment />} />
        <Route path="receivables" element={<ReceivableList />} />
        <Route path="ageing-analysis" element={<AgeingAnalysis />} />
        <Route path="payment-speed" element={<PaymentSpeed />} />
        <Route path="monthly-report" element={<MonthlyReport />} />
      </Route>
    </Routes>
  );
}

export default App;
