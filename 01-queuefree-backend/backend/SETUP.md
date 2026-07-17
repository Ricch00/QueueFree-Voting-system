# Backend Setup

## Step 1 - Edit .env
Open `.env` and change `DB_PASSWORD=your_mysql_password_here` to your actual MySQL password.

## Step 2 - Install packages
```
npm install
```

## Step 3 - Create database tables
```
npm run migrate
```

## Step 4 - Add default admin accounts
```
npm run seed
```

## Step 5 - Start the server
```
npm run dev
```

Server runs at: http://localhost:5000
Health check: http://localhost:5000/health

## Default Login Credentials
- Admin: admin@queuefree.edu.gh / Admin@123456
- EC:    ec@queuefree.edu.gh    / Electoral@123
- Student (sample): kwame@ug.edu.gh / Student@123
