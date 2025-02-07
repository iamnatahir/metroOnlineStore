const User=require("../../models/user");
const express=require("express");
const bcrypt=require("bcrypt");
const jwt=require("jsonwebtoken");
const router=express.Router();
const { generateTokens, verifyRefreshToken } = require("../../middleware/auth");
const { authenticateAccessToken } = require("../../middleware/auth");
const flash=require("connect-flash");
const nodemailer = require("nodemailer");
const Order = require('../../models/order'); 

// REGISTER USER
router.post("/register",async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
  
      // Validate role
      if (!["customer",  "admin"].includes(role)) {
        req.flash('error', 'Invalid role specified.');
            return res.redirect('/register');
      }
  
    
      // Validate password strength
      const passwordRequirements = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
      if (!passwordRequirements.test(password)) {
        req.flash('error', 'Password must be at least 8 characters long, include an uppercase letter, and a number.');
        return res.redirect('/register');
      }
  
      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        req.flash('error', 'Email is already registered.');
            return res.redirect('/register');
      }
  
      // Hash password and save user
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role,
      });

      req.flash('success', 'Registered successfully! Please log in.');
      return res.redirect('/login');
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error });
    }
  });

// LOGIN 
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      req.flash('error', 'Please enter both email and password.');
      return res.redirect('/login');
    }

    const findUser = await User.findOne({ email });

    if (findUser && await bcrypt.compare(password, findUser.password)) {
      // Set user in session
      req.session.user = {
        id: findUser._id,
        email: findUser.email,
        role: findUser.role
      };

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(findUser);

      // Set tokens in cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax'
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: 'lax',
      });

      // Redirect based on role
      if (findUser.role === 'admin') {
        req.flash('success', 'Welcome back, Admin!');
        return res.redirect('/admin/dashboard');
      } else {
        req.flash('success', 'Login successful!');
        return res.redirect('/');
      }
    } else {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Error logging in. Please try again.');
    res.redirect('/login');
  }
});


// REFRESH TOKEN
router.get('/refreshToken ',async(req,res)=>{
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ message: "No refresh token provided" });

    const { user } = verifyRefreshToken(refreshToken);
    const newAccessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });

    res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(403).json({ message: "Invalid refresh token", error });
  }
});

// LOGOUT USER
router.get('/logout',(req, res) => {
  console.log("Logout request received");
  req.session.user = null; // Clear the user session
  res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
  });
  req.flash('success', 'You have successfully logged out.');
return res.redirect('/login');
  
});




// Forgot Password
router.post("/forgotPassword",async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user){ 
      req.flash("error", "User not found");
    return res.redirect("/forgotPassword");
  }

    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MY_GMAIL,
        pass: process.env.MY_PASSWORD,
      },
    });

    const resetLink = `${process.env.CLIENT_URL}/resetPassword?token=${token}`;

    const mailOptions = {
      from: process.env.MY_GMAIL,
      to: email,
      subject: "Password Reset Request",
      text: `Click on this link to reset your password: ${resetLink}`
    };

    await transporter.sendMail(mailOptions);
    req.flash("success", "Password reset email sent. Please check your inbox.");
    res.render('passwordResetSent',{layout:"minimal-layout"});
  
  } catch (error) {
    console.error("Error sending email:", error);
    req.flash("error", "An error occurred while sending the email. Please try again.");
    res.redirect("/forgotPassword");
  }
})



// Reset Password
router.post("/resetPassword" , async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user){
      req.flash("error", "User not found");
      return res.redirect("/resetPassword");
    }
     

    // Validate and hash new password
    const passwordRequirements = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRequirements.test(newPassword)) {
      req.flash(
        "error",
        "Password must be at least 8 characters long, include an uppercase letter, and a number."
      );
      return res.redirect(`/resetPassword?token=${token}`);
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

   
    req.flash("success", "Password successfully reset. You can now log in.");
    res.redirect("/login");

  } catch (error) {
    console.error("Error resetting password:", error);
    req.flash("error", "Invalid or expired token.");
    res.redirect("/resetPassword");
  }
});

router.post('/checkout', authenticateAccessToken, async (req, res) => {
  try {
      const { address, city, postalCode } = req.body;
      const userId = req.user.id;

      if (!req.user) {
        req.flash('error', 'Unauthorized. Please log in.');
        return res.redirect('/login');
      }
      // Validate user email
      if (!req.user.email) {
          req.flash('error', 'User email is not available. Please log in again.');
          return res.redirect('/login');
      }

      // Map cart items for database
      const cartItems = req.session.cart.map(item => ({
          productId: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
      }));

      // Save order to database
      const order = new Order({
          userId,
          deliveryInfo: { address, city, postalCode },
          cartItems,
          paymentMethod: 'Cash on Delivery',
           status: 'Pending'
      });
      await order.save();

     

      const emailContent = ` <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f4f4f4; }
        .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
        </div>
        <div class="content">
          <p>Hello ${req.user.name},</p>
          <p>Thank you for your order. We're pleased to confirm that it has been successfully placed.</p>
          <h2>Order Details</h2>
          <p><strong>Delivery Address:</strong> ${address}, ${city}, ${postalCode}</p>
          <p><strong>Payment Method:</strong> ${Order.paymentMethod}</p>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${cartItems.map(item => `
                <tr>
                  <td>${item.title}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.price.toFixed(2)}</td>
                  <td>$${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            
          </table>
          <p>We will notify you once your order has been shipped.</p>
          <p>If you have any questions about your order, please don't hesitate to contact our customer service.</p>
        </div>
        <div class="footer">
          <p>&copy; 2023 Your Company Name. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
      // Send email
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: process.env.MY_GMAIL,
              pass: process.env.MY_PASSWORD,
          },
      });

      const mailOptions = {
          from: process.env.MY_GMAIL,
          to: req.user.email,
          subject: 'Order Confirmation',
          html: emailContent,
      };

      await transporter.sendMail(mailOptions);

      // Clear cart after order
      req.session.cart = [];
      req.flash('success', 'Order confirmed successfully!');
      res.redirect('/checkout-success');
  } catch (error) {
      console.error('Error while processing order:', error);
      req.flash('error', 'Something went wrong! Please try again.');
      res.redirect('/checkout');
  }
});

    






module.exports = router;