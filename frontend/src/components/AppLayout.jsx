import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const AppLayout = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar />
        <main className="content-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
