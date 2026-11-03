require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const path = require("path");

const app = express();
app.set("trust proxy", 1);

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
let dbPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing");
  }

  if (!dbPromise) {
    dbPromise = mongoose.connect(MONGODB_URI)
      .catch(err => {
        dbPromise = null;
        throw err;
      });
  }

  await dbPromise;
}

// Database models
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "student", "staff"],
    default: "student"
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: [
      "Electrical",
      "Plumbing",
      "Cleaning",
      "Furniture",
      "Internet",
      "Other"
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium"
  },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Resolved"],
    default: "Pending"
  },
  location: { type: String, required: true, trim: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  adminNote: { type: String, default: "" }
}, { timestamps: true });

const User = mongoose.models.User ||
  mongoose.model("User", userSchema);

const Ticket = mongoose.models.Ticket ||
  mongoose.model("Ticket", ticketSchema);

// Create demo accounts
let seedPromise;

async function seedDemoAccounts() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const demo = [
        {
          name: "Campus Admin",
          email: "admin@campus.com",
          password: "Admin@123",
          role: "admin"
        },
        {
          name: "Demo Student",
          email: "student@campus.com",
          password: "Student@123",
          role: "student"
        },
        {
          name: "Maintenance Staff",
          email: "staff@campus.com",
          password: "Staff@123",
          role: "staff"
        }
      ];

      for (const item of demo) {
        const exists = await User.findOne({ email: item.email });

        if (!exists) {
          const hashed = await bcrypt.hash(item.password, 10);

          await User.create({
            ...item,
            password: hashed
          });
        }
      }
    })().catch(err => {
      seedPromise = null;
      throw err;
    });
  }

  await seedPromise;
}

// Connect database before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    await seedDemoAccounts();
    next();
  } catch (err) {
    console.error("Database error:", err.message);

    res.status(503).json({
      message: "Database connection failed. Check MongoDB settings."
    });
  }
});

// Session configuration
app.use(session({
  name: "campuscare.sid",
  secret: SESSION_SECRET || "development-only-secret-change-this",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGODB_URI,
    collectionName: "sessions",
    ttl: 86400
  }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 86400000
  }
}));

// Authentication
function auth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "Please login to continue."
    });
  }
  next();
}

function roles(...allowed) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({
        message: "Please login to continue."
      });
    }

    if (!allowed.includes(req.session.user.role)) {
      return res.status(403).json({
        message: "You are not allowed to do this."
      });
    }

    next();
  };
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please fill in all fields."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters."
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(409).json({
        message: "This email is already registered. Please login."
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "student"
    });

    res.status(201).json({
      message: "Account created successfully.",
      user: publicUser(user)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Could not create account."
    });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Enter your email and password."
      });
    }

    const user = await User.findOne({
      email,
      active: true
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    req.session.regenerate(err => {
      if (err) {
        return res.status(500).json({
          message: "Login session failed."
        });
      }

      req.session.user = publicUser(user);

      req.session.save(saveErr => {
        if (saveErr) {
          return res.status(500).json({
            message: "Could not save session."
          });
        }

        res.json({
          message: "Login successful.",
          user: req.session.user
        });
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Login service error."
    });
  }
});

// CURRENT USER
app.get("/api/me", auth, (req, res) => {
  res.json({ user: req.session.user });
});

// LOGOUT
app.post("/api/logout", auth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        message: "Logout failed."
      });
    }

    res.clearCookie("campuscare.sid");
    res.json({ message: "Logged out successfully." });
  });
});

// GET STAFF
app.get("/api/staff", roles("admin"), async (req, res) => {
  try {
    const list = await User.find({
      role: "staff",
      active: true
    }).select("name email").sort({ name: 1 });

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: "Could not load staff." });
  }
});

// CREATE TICKET
app.post("/api/tickets", roles("student", "admin"), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      location
    } = req.body;

    if (![title, description, category, priority, location]
      .every(v => String(v || "").trim())) {
      return res.status(400).json({
        message: "Please complete every required field."
      });
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      location: location.trim(),
      createdBy: req.session.user.id
    });

    const result = await Ticket.findById(ticket._id)
      .populate("createdBy", "name")
      .populate("assignedTo", "name");

    res.status(201).json({
      message: "Maintenance request submitted.",
      ticket: result
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: err.message
    });
  }
});

// GET TICKETS
app.get("/api/tickets", auth, async (req, res) => {
  try {
    const role = req.session.user.role;

    const filter = role === "student"
      ? { createdBy: req.session.user.id }
      : role === "staff"
        ? { assignedTo: req.session.user.id }
        : {};

    const list = await Ticket.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json(list);

  } catch (err) {
    res.status(500).json({
      message: "Could not load requests."
    });
  }
});

// UPDATE TICKET
app.put("/api/tickets/:id", auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        message: "Request not found."
      });
    }

    const role = req.session.user.role;
    const owner = ticket.createdBy.toString() === req.session.user.id;

    const assignedStaff = ticket.assignedTo &&
      ticket.assignedTo.toString() === req.session.user.id;

    if (role === "student") {
      if (!owner || ticket.status !== "Pending") {
        return res.status(403).json({
          message: "Students can edit only their own pending requests."
        });
      }

      ["title", "description", "category", "priority", "location"]
        .forEach(key => {
          if (req.body[key] !== undefined) {
            ticket[key] = req.body[key];
          }
        });

    } else if (role === "staff") {
      if (!assignedStaff) {
        return res.status(403).json({
          message: "This request is not assigned to you."
        });
      }

      if (!["In Progress", "Resolved"].includes(req.body.status)) {
        return res.status(400).json({
          message: "Choose a valid status."
        });
      }

      ticket.status = req.body.status;

    } else if (role === "admin") {
      [
        "title",
        "description",
        "category",
        "priority",
        "status",
        "location",
        "adminNote"
      ].forEach(key => {
        if (req.body[key] !== undefined) {
          ticket[key] = req.body[key];
        }
      });

      if (req.body.assignedTo !== undefined) {
        if (!req.body.assignedTo) {
          ticket.assignedTo = null;
        } else {
          const staff = await User.findOne({
            _id: req.body.assignedTo,
            role: "staff",
            active: true
          });

          if (!staff) {
            return res.status(400).json({
              message: "Select a valid staff member."
            });
          }

          ticket.assignedTo = staff._id;
        }
      }
    }

    await ticket.save();

    const updated = await Ticket.findById(ticket._id)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name email");

    res.json({
      message: "Request updated successfully.",
      ticket: updated
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: err.message || "Update failed."
    });
  }
});

// DELETE TICKET
app.delete("/api/tickets/:id", roles("admin", "student"), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        message: "Request not found."
      });
    }

    if (
      req.session.user.role === "student" &&
      (
        ticket.createdBy.toString() !== req.session.user.id ||
        ticket.status !== "Pending"
      )
    ) {
      return res.status(403).json({
        message: "You can delete only your own pending requests."
      });
    }

    await Ticket.findByIdAndDelete(ticket._id);

    res.json({
      message: "Request deleted successfully."
    });

  } catch (err) {
    res.status(500).json({
      message: "Could not delete request."
    });
  }
});

// ADMIN REPORTS
app.get("/api/reports", roles("admin"), async (req, res) => {
  try {
    const [
      total,
      pending,
      inProgress,
      resolved,
      categories
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: "Pending" }),
      Ticket.countDocuments({ status: "In Progress" }),
      Ticket.countDocuments({ status: "Resolved" }),
      Ticket.aggregate([
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      total,
      pending,
      inProgress,
      resolved,
      categories
    });

  } catch (err) {
    res.status(500).json({
      message: "Could not load reports."
    });
  }
});

// FRONTEND
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html"),
    err => {
      if (err && !res.headersSent) {
        res.status(404).send("Frontend file not found.");
      }
    }
  );
});

// Start local server when running with npm start
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`CampusCare running at http://localhost:${PORT}`);
  });
}

// Export Express app for Vercel
module.exports = app;