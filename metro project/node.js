const express=require("express");
const Product = require("./models/product");
const cors = require("cors");
const connectDB=require("./config/mongodbconnection");
const layout=require("express-ejs-layouts");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const userRouter = require('./routes/user/userRouter');

const flash=require("connect-flash");
const app=express();

app.use(cookieParser());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
require("dotenv").config();

app.use(layout);

function isLoggedIn(req, res, next) {
    if (req.session.user) {
        next(); // User is logged in, proceed to the next middleware
    } else {
        req.flash('error', 'Please login to proceed to checkout.');
        res.redirect('/login'); // Redirect to the login page
    }
}

app.use(
    session({
      secret: "My_session_secret",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );



app.use((req, res, next) => {
    res.locals.user = req.session.user || null; 
    next();
});


app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    res.locals.cartCount = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    res.locals.user = req.session.user || null;
    next();
});

app.use(flash());
// Middleware to pass flash messages to templates
app.use((req, res, next) => {
    res.locals.successMessage = req.flash('success');   
    res.locals.errorMessage = req.flash('error');
    next();
  });
  
app.use(cors({
    origin: "http://localhost:5000", 
    credentials: true,   
           
  }));

app.use(userRouter);



app.set("view engine","ejs");
app.use(express.static("public")); 

app.listen(5000,()=>{
    console.log("server started at local host");
});




app.get("/", async (req, res) => {
    try {
       
        const sortBy = req.query.sort;
        const search = req.query.search || '';

        let sortOptions = {};
        if (sortBy === 'priceLowToHigh') {
            sortOptions.price = 1;
        } else if (sortBy === 'priceHighToLow') {
            sortOptions.price = -1;
        } else if (sortBy === 'titleAsc') {
            sortOptions.title = 1;
        } else if (sortBy === 'titleDesc') {
            sortOptions.title = -1;
        } else {
            sortOptions.title = 1;
        }

        const products = await Product.find({
            title: { $regex: ".*" + search + ".*", $options: "i" }
        }).sort(sortOptions);

        res.render("home", { layout: "layout", products, user: req.session.user, });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching products");
    }
});

app.post("/add-to-cart/:id", async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const cartItem = req.session.cart.find(item => item.id === productId);

        if (cartItem) {
            cartItem.quantity += 1;
        } else {
            req.session.cart.push({
                id: productId,
                title: product.title,
                price: product.price,
                quantity: 1
            });
        }

        const cartCount = req.session.cart.reduce((total, item) => total + item.quantity, 0);
        res.json({ cartCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error adding item to cart" });
    }
});

app.get("/cart", async (req, res) => {
    try {
        const cartItems = req.session.cart;
        const productIds = cartItems.map(item => item.id);
        const products = await Product.find({ _id: { $in: productIds } });

        const cartProducts = products.map(product => {
            const cartItem = cartItems.find(item => item.id === product._id.toString());
            return {
                ...product.toObject(),
                quantity: cartItem.quantity
            };
        });

        res.render("cart", { layout: "minimal-layout", products: cartProducts });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching cart items");
    }
});






//login
app.get('/login',async (req,res)=>{
    res.render('login',{layout:"minimal-layout"});
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('/login');
    });
  });




 

  app.get('/checkout',isLoggedIn,(req,res)=>{
    const products = req.session.cart || [];
    res.render('checkout',{layout:"minimal-layout",products});
  })

app.get('/register',async (req,res)=>{
    res.render('register',{layout:"minimal-layout"});
});

app.get('/checkout-success', (req, res) => {
    res.render('checkout-success',{layout:"minimal-layout"});
  });

app.get('/forgotPassword',async(req,res)=>{
    res.render('forgotPassword',{layout:"minimal-layout"});
});

app.get('/resetPassword',async(req,res)=>{
    const token = req.query.token; 
    if (!token) {
        return res.status(400).send("Invalid or missing token.");
    }
    res.render('resetPassword', {layout:"minimal-layout", token });

});


app.get('/passwordResetSent', (req, res) => {
        res.render('passwordResetSent', { layout: "minimal-layout" });
});

const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


let productsRouter = require("./routes/admin/products.router");
const { authenticateAccessToken } = require("./middleware/auth");
app.use(productsRouter);


connectDB();

