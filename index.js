const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcrypt");
const app = express();
const jwt = require("jsonwebtoken"); // Added JWT for session handling
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const SECRET_KEY = "mHn3Q8zYtnv5Gv4jR1XJp2zS6oWxF97b";
// MongoDB Connection
mongoose
  .connect("mongodb://localhost:27017/Users")
  .then(() => {
    console.log("✅ Database Connected Successfully");
  })
  .catch((error) => {
    console.error("❌ Connection error:", error);
  });

// Schemas
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  borrowedBooks: [
    {
      bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
      dueDate: { type: Date, required: true },
      status: { 
        type: String, 
        enum: ["Active", "Expired", "Pending Renewal"], // Add "Pending Renewal" here
        default: "Active" 
      },
    },
  ],
});
const User = mongoose.model("Student", userSchema);

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
  email: String,
});

const Admin = mongoose.model("Admins", adminSchema);

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  copies: Number,
  availableCopies: Number,
  isbn: String,
  link: String,
  category: String, // Add this line for category
  imageCoverLink: String, // Add this line for cover image
  renewals: { type: Number, default: 0 },
  borrowCount: { type: Number, default: 0 }
});

const Book = mongoose.model("Book", bookSchema);

const requestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  requestDate: { type: Date, default: Date.now },
  dueDate: Date,
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  isRenewal: { type: Boolean, default: false }  // Add this field
});

const Request = mongoose.model("Request", requestSchema);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/student", (req, res) => {
  res.sendFile(path.join(__dirname, "student.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Authentication Routes
app.post("/post", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this username or email" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Error registering user" });
  }
});

app.post("/logon", async (req, res) => {
  try {
    const { role, username, password } = req.body;
    let user;

    console.log("Login attempt:", { role, username });

    if (role === "admin") {
      user = await Admin.findOne({ username });
      if (!user) {
        console.log("Admin not found");
        return res.status(404).json({ error: "Admin not found" });
      }
    } else if (role === "student") {
      user = await User.findOne({ username });
      if (!user) {
        console.log("Student not found");
        return res.status(404).json({ error: "Student not found" });
      }
    } else {
      console.log("Invalid role selected");
      return res.status(400).json({ error: "Invalid role selected" });
    }

    let passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log("Incorrect password");
      return res.status(401).json({ error: "Incorrect password" });
    }

    // Generate JWT token
    const token = jwt.sign({ username: user.username, role }, SECRET_KEY, {
      expiresIn: "1h",
    });

    console.log("Login successful for:", username);

    // Store token in cookie (optional)
    res.cookie("token", token, { httpOnly: true });

    // Send success response
    res.json({
      message: "Login successful",
      role,
      username: user.username,
      userId: user._id,
      token,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Protected route to fetch user details (if needed)
app.get("/api/user/profile", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    res.json({ username: decoded.username, role: decoded.role });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

app.post("/admin/addBook", async (req, res) => {
  try {
    const { title, author, copies, isbn, link, category, imageCoverLink } = req.body;

    // Validate input
    if (!title || !author || !copies || !isbn) {
      return res.status(400).json({ error: "Title, author, copies and ISBN are required" });
    }

    // Check if book with same ISBN already exists
    const existingBook = await Book.findOne({ isbn });
    if (existingBook) {
      return res.status(400).json({ error: "A book with this ISBN already exists" });
    }

    // Create new book
    const newBook = new Book({
      title,
      author,
      copies: parseInt(copies),
      availableCopies: parseInt(copies),
      isbn,
      link: link || null,
      category: category || "General", // Default category if not provided
      imageCoverLink: imageCoverLink || null
    });

    await newBook.save();
    res.status(201).json({ message: "Book added successfully", book: newBook });
  } catch (error) {
    console.error("Error adding book:", error);
    res.status(500).json({ error: "Failed to add book" });
  }
});
app.post("/api/requests", async (req, res) => {
  try {
    const { studentId, bookId, days } = req.body;

    const book = await Book.findById(bookId);
    if (!book || book.availableCopies <= 0) {
      return res.status(400).json({ error: "Book not available" });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);

    const newRequest = new Request({
      student: studentId,
      book: bookId,
      dueDate,
      status: "Pending",
    });

    await newRequest.save();
    res.status(201).json({ message: "Request submitted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Error processing request" });
  }
});

app.get("/api/requests", async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("student", "username")
      .populate("book", "title");
    res.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/requests/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const request = await Request.findById(req.params.id)
      .populate("student")
      .populate("book");
    
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (status === "Approved") {
      const book = await Book.findById(request.book._id);
      if (!book) return res.status(404).json({ error: "Book not found" });

      if (request.isRenewal) {
        const student = await User.findById(request.student._id);
        const borrowedBook = student.borrowedBooks.find(
          b => b.bookId.toString() === request.book._id.toString()
        );
        
        if (borrowedBook) {
          borrowedBook.dueDate = request.dueDate;
          borrowedBook.status = "Active";
          await student.save();
          
          await Book.findByIdAndUpdate(
            request.book._id, 
            { $inc: { renewals: 1 } },
            { new: true }
          );
        }
      } else {
        if (book.availableCopies <= 0) {
          return res.status(400).json({ error: "Book not available" });
        }

        await User.findByIdAndUpdate(
          request.student._id,
          {
            $push: {
              borrowedBooks: {
                bookId: request.book._id,
                dueDate: request.dueDate,
                status: "Active",
              },
            },
          },
          { new: true }
        );

        // Increment borrowCount when a book is borrowed (not for renewals)
        book.availableCopies -= 1;
        book.borrowCount = (book.borrowCount || 0) + 1;
        await book.save();
      }
    }

    request.status = status;
    await request.save();

    res.json({ 
      message: "Request status updated successfully",
      updatedBook: status === "Approved" && request.isRenewal 
        ? await Book.findById(request.book._id) 
        : null
    });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({ error: "Error updating request" });
  }
});
// Book Routes
app.get("/api/books", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sort = req.query.sort || '';

    let query = { availableCopies: { $gt: 0 } };
    let sortOption = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } } // Add category to search
      ];
    }

    if (sort === 'borrows') {
      sortOption = { borrowCount: -1 };
    }

    const books = await Book.find(query)
      .select('title author copies availableCopies isbn link category imageCoverLink borrowCount') // Add category and imageCoverLink
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/students", async (req, res) => {
  try {
    const students = await User.find(); // Fetch all students
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ error: "Failed to fetch students" });
  }
});

app.put("/api/students/:id", async (req, res) => {
  try {
    const { username, email, status } = req.body;
    const studentId = req.params.id;

    const updatedStudent = await User.findByIdAndUpdate(
      studentId,
      { username, email, status },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({
      message: "Student updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ error: "Failed to update student" });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    const studentId = req.params.id;
    const deletedStudent = await User.findByIdAndDelete(studentId);

    if (!deletedStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    res.status(500).json({ error: "Failed to delete student" });
  }
});
//
app.get("/api/user/books", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, SECRET_KEY);
    const student = await User.findOne({ username: decoded.username })
      .populate("borrowedBooks.bookId"); // Make sure this populates the full book document

    if (!student) {
      return res.status(404).json({ error: "User not found" });
    }

    const books = student.borrowedBooks.map((borrowedBook) => ({
      _id: borrowedBook.bookId._id,
      title: borrowedBook.bookId.title,
      author: borrowedBook.bookId.author,
      dueDate: borrowedBook.dueDate,
      status: borrowedBook.status,
      link: borrowedBook.bookId.link // Add this line to include the link
    }));

    res.json(books);
  } catch (error) {
    console.error("Error fetching user books:", error);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});
//
app.post("/api/user/updateBookStatus", async (req, res) => {
  try {
    const { bookId } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, SECRET_KEY);
    const student = await User.findOne({ username: decoded.username });

    if (!student) return res.status(404).json({ error: "User not found" });

    const borrowedBook = student.borrowedBooks.find(
      (book) => book.bookId.toString() === bookId
    );
    if (!borrowedBook)
      return res.status(404).json({ error: "Book not found in user's list" });

    const currentDate = new Date();
    if (
      borrowedBook.dueDate < currentDate &&
      borrowedBook.status !== "Expired"
    ) {
      // Mark as expired
      borrowedBook.status = "Expired";
      await student.save();

      // Increase available copies of the book
      await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: 1 } });

      return res.json({ message: "Book status updated to Expired" });
    }

    res.json({ message: "Book status unchanged" });
  } catch (error) {
    console.error("Error updating book status:", error);
    res.status(500).json({ error: "Failed to update book status" });
  }
});
app.get("/api/stats", async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalStudents = await User.countDocuments();
    
    // Calculate total borrows by summing up borrowCount for all books
    const totalBorrowsResult = await Book.aggregate([
      { $group: { _id: null, totalBorrows: { $sum: "$borrowCount" } } }
    ]);
    const totalBorrows = totalBorrowsResult.length > 0 ? totalBorrowsResult[0].totalBorrows : 0;

    res.json({
      totalBooks,
      totalStudents,
      totalBorrows,
      pendingRequests: await Request.countDocuments({ status: "Pending" }),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});
app.get("/stats/borrowing-trend", async (req, res) => {
  try {
    const trendData = await Borrowing.aggregate([
      {
        $group: {
          _id: { $month: "$borrowedAt" }, // Group by month
          borrowedCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const booksData = await Book.aggregate([
      {
        $group: {
          _id: null,
          availableCount: { $sum: "$availableCopies" },
        },
      },
    ]);

    const labels = trendData.map((data) => `Month ${data._id}`);
    const borrowedCounts = trendData.map((data) => data.borrowedCount);
    const availableCounts = booksData.length
      ? [booksData[0].availableCount]
      : [];

    res.json({ labels, borrowedCounts, availableCounts });
  } catch (error) {
    console.error("Error fetching borrowing trend:", error);
    res.status(500).json({ error: "Failed to fetch borrowing trend data" });
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({
      _id: student._id,
      username: student.username,
      email: student.email,
      status: student.status,
    });
  } catch (error) {
    console.error("Error fetching student:", error);
    res.status(500).json({ error: "Failed to fetch student data" });
  }
});

// Update the /api/student/stats endpoint in index.js
app.get("/api/student/stats", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, SECRET_KEY);
    const student = await User.findOne({ username: decoded.username }).populate(
      "borrowedBooks.bookId"
    );

    if (!student) return res.status(404).json({ error: "Student not found" });

    const currentDate = new Date();

    // Calculate statistics
    const totalBorrowed = student.borrowedBooks.length;

    const activeBooks = student.borrowedBooks.filter((book) => {
      const dueDate = new Date(book.dueDate);
      return dueDate >= currentDate && book.status === "Active";
    }).length;

    const expiredBooks = student.borrowedBooks.filter((book) => {
      const dueDate = new Date(book.dueDate);
      return dueDate < currentDate || book.status === "Expired";
    }).length;

    res.json({
      borrowedCount: totalBorrowed,
      activeCount: activeBooks,
      expiredCount: expiredBooks,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching student stats:", error);
    res.status(500).json({
      error: "Failed to fetch student statistics",
      success: false,
    });
  }
});

// Add this new endpoint for renewal requests
app.post("/api/books/renew", async (req, res) => {
  try {
    const { studentId, bookId, days } = req.body;

    // Find the student and the book
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: "Book not found" });

    // Check if the student has this book borrowed
    const borrowedBook = student.borrowedBooks.find(b => b.bookId.toString() === bookId);
    if (!borrowedBook) {
      return res.status(400).json({ error: "You haven't borrowed this book" });
    }

    // Calculate new due date
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + parseInt(days));

    // Create a new renewal request
    const newRequest = new Request({
      student: studentId,
      book: bookId,
      dueDate: newDueDate,
      status: "Pending",
      isRenewal: true
    });

    await newRequest.save();
    /*if (status === "Approved" && request.isRenewal) {
      await Book.findByIdAndUpdate(bookId, { $inc: { renewals: 1 } });
    }*/
    // Update the book status to pending renewal
    borrowedBook.status = "Pending Renewal";
    await student.save();

    // Increment renewal count when approved
    

    res.json({ message: "Renewal request submitted successfully!" });
  } catch (error) {
    console.error("Error processing renewal:", error);
    res.status(500).json({ error: "Failed to process renewal request" });
  }
});

app.get("/api/books/stats", async (req, res) => {
  try {
    const books = await Book.find().select('title copies availableCopies renewals category'); // Add category
    const bookStats = books.map(book => ({
      title: book.title,
      category: book.category || 'General', // Ensure category is included
      copiesTotal: book.copies,
      copiesAvailable: book.availableCopies,
      copiesBorrowed: book.copies - book.availableCopies,
      renewals: book.renewals || 0
    }));

    res.json(bookStats);
  } catch (error) {
    console.error("Error fetching book stats:", error);
    res.status(500).json({ error: "Failed to fetch book statistics" });
  }
});

// Logout Route
app.post("/api/auth/logout", (req, res) => {
  try {
    // Clear the token cookie if using cookies
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    // Send success response
    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Error during logout' });
  }
});


// Start the server
app.listen(3000, () => {
  console.log("Server is running on port http://localhost:3000");
});
