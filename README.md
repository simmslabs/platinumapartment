# 🏨 Apartment Management System

A comprehensive apartment management system built with **Remix.js**, **Mantine UI**, **Prisma**, and **SQLite**. This system provides a complete solution for managing apartment operations including units, bookings, residents, payments, and analytics.

## ✨ Features

### 🔐 Authentication & Authorization
- **Multi-role system**: Admin, Manager, Staff, and Guest roles
- **Secure authentication** with bcrypt password hashing
- **Session management** with cookies
- **Role-based access control** for different features

### 🏠 Room Management
- **Room inventory** with different types (Single, Double, Suite, Deluxe, Presidential)
- **Real-time room status** (Available, Occupied, Maintenance, Out of Order)
- **Room details** including capacity, price, floor, and amenities
- **Status updates** for housekeeping and maintenance

### 📅 Booking Management
- **Complete booking lifecycle** (Pending → Confirmed → Checked-in → Checked-out)
- **Guest information** and special requests
- **Automatic pricing calculation** based on room rates and duration
- **Booking status tracking** and updates

### 👥 Guest Management
- **Guest profiles** with contact information
- **Booking history** and preferences
- **Guest communication** and service tracking

### 💳 Payment Processing
- **Multiple payment methods** (Cash, Credit Card, Debit Card, Online, Bank Transfer)
- **Payment status tracking** (Pending, Completed, Failed, Refunded)
- **Transaction management** and receipts
- **Revenue tracking** and reporting

### 📊 Analytics & Reporting
- **Occupancy rates** and trends
- **Revenue analytics** with month-over-month comparisons
- **Room type distribution** and utilization
- **Payment method analytics**
- **Guest statistics** and trends

### 🛠️ Additional Features
- **Responsive design** that works on all devices
- **Modern UI** with Mantine components
- **Dark/Light theme** support
- **Real-time notifications**
- **Data validation** and error handling

## 🚀 Tech Stack

- **Frontend**: React with Remix.js framework
- **UI Library**: Mantine UI components
- **Database**: SQLite with Prisma ORM
- **Authentication**: Custom auth with bcrypt and JWT
- **Styling**: Mantine + Tailwind CSS
- **Runtime**: Bun.js
- **TypeScript**: Full type safety

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd apartment-management-system
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   SESSION_SECRET="your-session-secret-change-this-in-production"
   ```

4. **Initialize the database**
   ```bash
   bun run db:migrate
   bun run db:seed
   ```

5. **Start the development server**
   ```bash
   bun run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

## 🔑 Default Login Credentials

After running the seed script, you can log in with these accounts:

### Admin User
- **Email**: `admin@apartment.com`
- **Password**: `admin123`
- **Access**: Full system access

### Manager User
- **Email**: `manager@apartment.com`
- **Password**: `manager123`
- **Access**: Operations management (no system settings)

### Staff User
- **Email**: `staff@apartment.com`
- **Password**: `staff123`
- **Access**: Daily operations (rooms, bookings, guests)

### Guest User
- **Email**: `guest@apartment.com`
- **Password**: `guest123`
- **Access**: Personal bookings and profile

## 📁 Project Structure

```
app/
├── components/           # Reusable UI components
│   └── DashboardLayout.tsx
├── routes/              # Remix routes
│   ├── _index.tsx       # Landing page
│   ├── login.tsx        # Authentication
│   ├── register.tsx     # User registration
│   ├── dashboard._index.tsx    # Main dashboard
│   ├── dashboard.rooms.tsx     # Room management
│   ├── dashboard.bookings.tsx  # Booking management
│   ├── dashboard.guests.tsx    # Guest management
│   ├── dashboard.payments.tsx  # Payment management
│   └── dashboard.analytics.tsx # Analytics dashboard
├── utils/               # Utility functions
│   ├── auth.server.ts   # Authentication utilities
│   ├── session.server.ts # Session management
│   └── db.server.ts     # Database connection
└── root.tsx            # App root with providers

prisma/
├── schema.prisma       # Database schema
├── migrations/         # Database migrations
└── seed.ts            # Sample data seeder
```

## 🗄️ Database Schema

The system uses a comprehensive database schema with the following entities:

- **Users**: Admin, Manager, Staff, and Guest accounts
- **Rooms**: Apartment unit inventory with types and status
- **Bookings**: Reservation management with lifecycle tracking
- **Payments**: Financial transaction processing
- **Services**: Additional apartment services (Maintenance, Concierge, etc.)
- **Maintenance**: Room maintenance and repair tracking
- **Reviews**: Guest feedback and ratings
- **Analytics**: Performance metrics and reporting data

## 🔧 Available Scripts

```bash
# Development
bun run dev              # Start development server
bun run build            # Build for production
bun run start            # Start production server

# Database
bun run db:migrate       # Run database migrations
bun run db:seed          # Seed database with sample data
bun run db:generate      # Generate Prisma client

# Code Quality
bun run lint             # Run ESLint
bun run typecheck        # Run TypeScript checks
```

## 🌟 Key Features in Detail

### Dashboard Overview
- **Real-time metrics** showing occupancy, revenue, and booking status
- **Quick actions** for common tasks
- **Role-based navigation** with appropriate access controls

### Room Management
- **Visual room grid** showing availability at a glance
- **Quick status updates** for housekeeping and maintenance
- **Room details** with pricing and amenities

### Booking System
- **Intuitive booking flow** with real-time availability
- **Guest management** integrated with booking process
- **Automatic pricing** calculation with taxes and fees

### Payment Processing
- **Multiple payment methods** support
- **Transaction tracking** with receipts
- **Revenue reporting** and analytics

### Analytics Dashboard
- **Occupancy trends** and patterns
- **Revenue analytics** with comparisons
- **Performance metrics** for decision making

## 🔒 Security Features

- **Password hashing** with bcrypt
- **Session management** with secure cookies
- **Role-based access control** (RBAC)
- **Input validation** and sanitization
- **SQL injection prevention** with Prisma
- **CSRF protection** built into Remix

## 🚀 Production Deployment

1. **Build the application**
   ```bash
   bun run build
   ```

2. **Set up production database**
   - Update `DATABASE_URL` in production environment
   - Run migrations: `bun run db:migrate`

3. **Deploy**
   - The built application is in the `build/` directory
   - Deploy to your preferred hosting platform (Vercel, Railway, etc.)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Remix.js** for the excellent full-stack framework
- **Mantine** for the beautiful UI components
- **Prisma** for the type-safe database toolkit
- **Bun** for the fast JavaScript runtime

---

## 📞 Support

For support, email support@apartment-management.com or join our Discord community.

## 🔮 Future Enhancements

- [ ] **Real-time notifications** with WebSockets
- [ ] **Mobile app** with React Native
- [ ] **Advanced reporting** with charts and graphs
- [ ] **Inventory management** for apartment supplies
- [ ] **Staff scheduling** and time tracking
- [ ] **Integration APIs** for third-party services
- [ ] **Multi-property support** for apartment complexes
- [ ] **Advanced analytics** with machine learning insights
