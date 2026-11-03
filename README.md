# CampusCare – Campus Maintenance Request Management System

## Included technologies
HTML, CSS, Bootstrap 5, jQuery, Node.js, Express.js, MongoDB, Mongoose, bcryptjs and express-session.

## Important: this ZIP uses a fresh database name
The database is `campuscare_presentation`. It does not use the previous `campus_maintenance` database. Existing data in the old database is not deleted.

## Installation on Windows
1. Extract this ZIP.
2. Open the extracted `CampusCare_Full_Project` folder in VS Code.
3. Open Terminal > New Terminal. Confirm that `dir` shows `package.json`, `server.js`, `public`.
4. Start Docker Desktop and wait until it is running.
5. Run:

```powershell
docker compose up -d
npm install
Copy-Item .env.example .env
npm start
```

If PowerShell says `.env` already exists, that is okay. Open `.env` and ensure `MONGODB_URI` is:
`mongodb://127.0.0.1:27017/campuscare_presentation`

Expected terminal output:
- `MongoDB connected successfully: mongodb://127.0.0.1:27017/campuscare_presentation`
- `Created demo admin: admin@campus.com` (first run)
- `Created demo student: student@campus.com` (first run)
- `Created demo staff: staff@campus.com` (first run)
- `CampusCare running at http://localhost:5000`

Open http://localhost:5000 in Chrome. Keep the terminal open while using the application.

## Demo login credentials
Admin: `admin@campus.com` / `Admin@123`
Student: `student@campus.com` / `Student@123`
Staff: `staff@campus.com` / `Staff@123`

Demo accounts are created automatically after MongoDB connects. Passwords are hashed with bcrypt.

## Student registration
Click **Create account** on the login page. Enter a name, email and password (minimum 6 characters). New registrations are created with the Student role. Admin and Staff accounts are seeded for demonstration; students cannot self-register as Admin or Staff.

## Presentation flow
1. Login as Student and create an Electrical request: “Fan not working”, High priority, Block A Room 204.
2. Logout and login as Admin.
3. Assign the ticket to Maintenance Staff and set status to In Progress.
4. Show the dashboard cards and category report.
5. Logout and login as Staff.
6. Open the assigned ticket and set status to Resolved.
7. Login as Admin and show the updated status.
8. Demonstrate search, edit, delete (use a test ticket), and logout.

## If login still says Invalid email or password
1. Check that the terminal shows MongoDB connected and that the demo account messages appeared.
2. Confirm you are opening `http://localhost:5000`, not Live Server or an old port.
3. Confirm the `.env` database line is exactly:
   `MONGODB_URI=mongodb://127.0.0.1:27017/campuscare_presentation`
4. Stop the server with Ctrl+C, then run `npm start` again.
5. Use exact credentials above, including capital letters in the password.
6. If the MongoDB container is not running, open Docker Desktop and run `docker compose up -d`.

## Troubleshooting
- `ENOENT package.json`: terminal is in the wrong folder. Use `cd "path\to\CampusCare_Full_Project"` and run `dir`.
- `MongoDB connection failed`: start Docker Desktop and run `docker compose up -d`.
- `npm` is not recognized: install Node.js LTS, close and reopen VS Code.
- `EADDRINUSE`: another app is using port 5000; stop the other terminal with Ctrl+C.
- Page does not look updated: open `http://localhost:5000` and press Ctrl+Shift+R.

## Security note
This is a college demo project. Before public deployment, configure HTTPS and secure cookies, use a strong private session secret, add rate limiting and CSRF protection, and do not use demo credentials.
