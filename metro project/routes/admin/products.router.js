const express = require("express");
const multer=require("multer");
const ensureAdmin=require("../../middleware/ensureAdmin");
const Order = require('../../models/order');
const nodemailer = require("nodemailer");

const diskStorage= multer.diskStorage({
  destination: function(req,file,cb){
    return cb(null,"./uploads"); 
  },
  filename:function(req,file,cb){
    return cb(null, `${Date.now()}-${file.originalname}`); 
  }
}
);
const jwt=require("jsonwebtoken");
const upload=multer({storage:diskStorage});
let router = express.Router();
let Product=require("../../models/product");
let Category=require("../../models/category");
const {authenticateAccessToken}=require("../../middleware/auth")

router.get("/admin/dashboard",authenticateAccessToken,async (req, res) => {
  try{

    if (req.user.role !== 'admin') {
      req.flash("error", "Access denied.");
      return res.redirect("/");
  }
    var page="1";
    const limit=5;
    if(req.query.page){
      page=req.query.page;
    }

    var search="";
    if(req.query.search){
      search=req.query.search;
    }
    const products=await Product.find({
      title:{$regex:".*"+search+".*", $options:"i"}
    }).limit(limit*1)
    .skip((page-1)*limit)
    .exec();
    const count=await Product.find({
      title:{$regex:".*"+search+".*", $options:"i"}
    }).countDocuments();


    res.render("admin/dashboard",{layout:"admin/admin-layout",
      products,
      currentPage:parseInt(page),
      totalPages:Math.ceil(count/limit),
      search
    })
  }catch(err){
    console.error("Error creating product:", err);
    req.flash("error", "An error occurred while loading the dashboard.");
    res.redirect("/admin/dashboard");
  }
});

router.get("/admin/products", async (req, res) => {
  let products=await Product.find();
  res.render("admin/products", { layout: "admin/admin-layout", products });
});

router.get("/admin/create",(req,res)=>{
  res.render("admin/create",{ layout: "admin/admin-layout" });
})

router.post("/admin/create", upload.single("productImage"), async (req, res) => {
  try {
    const { title, description, price, isFeatured } = req.body;
    const isFeaturedValue = isFeatured === "on";

    const product = await Product.create({
      title,
      description,
      price,
      isFeatured: isFeaturedValue,
      image: req.file ? req.file.filename : null, 
    });
    req.flash("success", "Product created successfully.");
    res.redirect("/admin/products");
  } catch (err) {
    console.error("Error creating product:", err);
    req.flash("error", "An error occurred while creating the product.");
    res.redirect("/admin/create");
  }
});

router.get("/admin/products/edit/:id", async (req, res) => {
  
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    res.render("admin/product-edit-form", { 
      product, 
      layout: "admin/admin-layout" 
    });
 
});

router.post("/admin/products/edit/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { title, description, price, isFeatured } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(productId, {
      title,
      description,
      price,
      isFeatured: isFeatured === 'on',  
    }, { new: true });

    if (!updatedProduct) {
       req.flash("error", "Product not found.");
      return res.redirect("/admin/products");
    }
    req.flash("success", "Product updated successfully.");
    res.redirect("/admin/products");
  } catch (err) {
    console.error("Error updating product:", err);
    req.flash("error", "An error occurred while updating the product.");
    res.redirect("back");
  }
}); 

router.get("/admin/products/delete/:id",async (req,res)=>{
  try {
    await Product.findByIdAndDelete(req.params.id);
    req.flash("success", "Product deleted successfully.");
    res.redirect("back");
  } catch (err) {
    req.flash("error", "An error occurred while deleting the product.");
    res.redirect("back");
  }
});


router.get("/admin/categories",async (req,res)=>{
  const categories=await Category.find();
  res.render("admin/categories",{ layout: "admin/admin-layout" ,categories});
});

router.get("/admin/create-category",(req,res)=>{
  res.render("admin/create-category",{ layout: "admin/admin-layout"});
})

router.post("/admin/create-category",upload.single("categoryImage"),async (req,res)=>{
  const {title,description,numberOfItems} = req.body;
  const category=await Category.create({
    title,
    description,
    numberOfItems,
    image: req.file ? req.file.filename : null,
  })
  req.flash("success", "Category created successfully.");
  res.redirect("/admin/categories");
})

router.get("/admin/categories/edit/:id",async (req,res)=>{
  const category=await Category.findById(req.params.id);
  if(!category){
    throw new Error("Category Not found");
  }
res.render("admin/categories-edit-form",{ 
  category, 
  layout: "admin/admin-layout" 
});
});


router.post("/admin/categories/edit/:id", async (req,res)=>{
    const { title, description, numberOfItems } = req.body;

    const updatedCategory = await Category.findByIdAndUpdate(req.params.id, {
      title,
      description,
      numberOfItems
    }, { new: true });

    if (!updatedCategory) {
      req.flash("error", "Category not found.");
      return res.redirect("/admin/categories");
    }
    req.flash("success", "Category updated successfully.");
    res.redirect("/admin/categories");
})


router.get("/admin/categories/delete/:id",async (req,res)=>{
  try {
    await Category.findByIdAndDelete(req.params.id);
    req.flash("success", "Category deleted successfully.");
    res.redirect("back");
  } catch (err) {
    req.flash("error", "An error occurred while deleting the category.");
    res.redirect("back");
  }
});





// Display all orders
router.get('/admin/order', async (req, res) => {
  try {
    var page="1";
    const limit=5;
    if(req.query.page){
      page=req.query.page;
    }
    
const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(limit*1)
    .skip((page - 1) * limit).exec();
const totalOrders = await Order.countDocuments();
res.render('admin/order', {
    layout: "admin/admin-layout",
    orders,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalOrders / limit),
    successMessage: req.flash('success'),
    errorMessage: req.flash('error'),
}); 

  } catch (error) {
      console.error(error);
      req.flash('error', 'An error occurred while fetching orders');
      res.redirect('/admin/dashboard');
  }
});


// Update order status
router.get('/admin/order/:id/status/:status', async (req, res) => {
  try {
      const { id, status } = req.params;
      const order = await Order.findByIdAndUpdate(id, { status }, { new: true }).populate('userId', 'name email');
      
      if (!order) {
          req.flash('error', 'Order not found');
      } 
      const transporter = nodemailer.createTransport({
        service: "Gmail", // or another email service
        auth: {
            user: process.env.MY_GMAIL,
            pass: process.env.MY_PASSWORD, 
        },

    });

    const userEmail = order.userId.email;
    const userName = order.userId.name;

    const subject = `Order Status Update: ${order._id}`;
    const text = `Hello ${userName},\n\nYour order with ID ${order._id} is now ${status}.\n\nThank you for shopping with us!`;

    await transporter.sendMail({
        from: `"Order Management" <${process.env.MY_GMAIL}>`,
        to: userEmail,
        subject,
        text,
    });

    req.flash('success', `Order status updated to ${status} and notification sent`);
  } catch (error) {
      console.error(error);
      req.flash('error', 'An error occurred while updating the order status');
  }
  res.redirect('/admin/order');
});


// View order details
router.get('/admin/order/:id', async (req, res) => {
  try {
      const order = await Order.findById(req.params.id).populate('userId', 'name email');
      if (!order) {
          req.flash('error', 'Order not found');
          return res.redirect('/admin/order');
      }
      res.render('admin/order-details', { 
        layout:"admin/admin-layout",
          order,
          successMessage: req.flash('success'),
          errorMessage: req.flash('error')
      });
  } catch (error) {
      console.error(error);
      req.flash('error', 'An error occurred while fetching order details');
      res.redirect('/admin/order');
  }
});



module.exports = router;