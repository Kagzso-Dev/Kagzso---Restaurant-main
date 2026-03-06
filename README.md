# Restaurant POS System (MERN Stack)

A complete production-ready Restaurant POS system with Real-time KOT, Table Management, and Role-based Dashboards.

## Features

- **Role-based Authentication**: Admin, Waiter, Kitchen, Cashier.
- **Real-time Updates**: Socket.io for live order tracking.
- **Order Management**: Dine-In (Table) and Takeaway (Token).
- **Kitchen Dashboard**: Track pending, preparing, and ready orders.
- **Cashier Dashboard**: Process payments and print receipts (mock).
- **Admin Dashboard**: Analytics and Menu Management.

## Setup Instructions

### 1. Prerequisites
- Node.js installed.
- MongoDB installed (Local or Atlas).

### 2. Backend Setup
1. Navigate to `server` folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Seed Database (Initial Data):
   ```bash
   npm run seed
   ```
   *(Note: This creates default users and menu items)*

4. Start Server:
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:5000`.

### 3. Frontend Setup
1. Navigate to `client` folder (new terminal):
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start React App:
   ```bash
   npm run dev
   ```
   App runs on `http://localhost:5173`.

## Default Credentials

All passwords are: `123456`

- **Admin**: `admin`
- **Waiter**: `waiter`
- **Kitchen**: `kitchen`
- **Cashier**: `cashier`

## Usage Flow

1. **Login** as **Waiter** or **Admin** to create orders.
2. Select **Dine-In** (Table) or **Takeaway**.
3. Orders appear instantly on **Kitchen Dashboard**.
4. Kitchen staff updates status: `Accepted` -> `Preparing` -> `Ready`.
5. **Cashier** sees `Ready` orders and processes payment to complete the order.
6. **Admin** can manage Menu Items and view Sales.

## Tech Stack
- MongoDB, Express.js, React (Vite), Node.js, Socket.io, TailwindCSS.

