# xzity Dispatch App

A full-stack ride dispatch platform with role-based access, Mapbox mapping, and real admin notifications.

## Features

- **User Registration:** Drivers, Customers, Admins. Manual approval with admin email notification and verification code.
- **JWT Authentication & Role System**
- **Ride Management:** Book, accept, and manage rides, with live status and Mapbox-based job board for drivers.
- **Admin Panel:** Manage users and rides.
- **Chat, Billing (Trial logic), Earnings, Notifications (real email for admin)**
- **Responsive UI:** Clean, icon-based, and mobile-friendly.
- **PWA & Docker:** Easy install, offline-ready.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Node.js](https://nodejs.org/) if running locally outside Docker

---

### Setup (Docker Compose)

1. **Clone this repo:**

   ```bash
   git clone https://github.com/your-username/xzity-dispatch.git
   cd xzity-dispatch
   ```

2. **Configure Environment Variables:**

   - Copy and fill the `.env.example` files in both `backend/` and `frontend/` as `.env`.
   - Set your Gmail credentials in `backend/.env`.
   - [Allow Less Secure Apps/2FA and App Passwords](https://support.google.com/accounts/answer/185833) if needed.

3. **Start All Services:**

   ```bash
   docker-compose up --build
   ```

   - Backend: http://localhost:5000
   - Frontend: http://localhost:3000

4. **Initial Admin User:**
   - Register as admin via frontend. You'll receive email notifications on new user signups.

---

### Development (Optional)

- Run backend or frontend locally using `npm run dev` in their respective folders.

---

### Mapbox

- Uses free Mapbox for driver ride board.
- To use your own Mapbox token, set it in `frontend/.env`.

---

### Email

- Admin notification emails are sent via Gmail SMTP.
- Set your Gmail and password/app password in `backend/.env`.
- Admin receives user verification codes, to be sent manually to users.

---

### Logo

- Your logo is in `frontend/src/assets/logo.png` and shown on all main screens.

---

### Customization

- Icons and UI: All navigation and actions are icon-based and mobile-friendly.
- You can swap out Mapbox for Google Maps later if desired.

---

### License

MIT