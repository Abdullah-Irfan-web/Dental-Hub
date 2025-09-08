const express=require('express');
const app=express();
const path=require('path');
const mongoose=require('mongoose');
const bodyparser=require('body-parser');
const passport=require('passport');
const LocalStrategy=require('passport-local').Strategy
const bcrypt=require('bcryptjs');
const session=require('express-session');
const dotenv=require("dotenv");
const notifier = require('node-notifier');
const nodemailer = require("nodemailer");
const multer = require("multer");
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');
app.use(express.static('public'));
app.use(bodyparser.urlencoded({extended:true}));
app.use(express.json());


dotenv.config({path:'./config.env'})
 const user=require('./Model/User');
 const product=require('./Model/Product');
 const Cart=require('./Model/Cart');
 const Address = require("./Model/Address");
 const Order = require("./Model/Order");
 

const DB=process.env.MONGO_URI

mongoose.connect(DB,{
    useNewUrlParser:true,
   
});

const db=mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {

    console.log("Connected");
   
});



  

passport.use(new LocalStrategy({usernameField:'email'},(email,password,done)=>{
    user.findOne({email:email})
    .then(userr=>{
        if(!userr){
            return done(null,false)
        }
        bcrypt.compare(password,userr.password,(err,isMatch)=>{
            if(isMatch){
                return done(null,userr)
            }
            else{
                return done(null,false)
            }
        })
    })
    .catch(err=>{
        console.log(err);
    })
}))


app.use(session({
    secret:"Node",
    resave:true,
    saveUninitialized:true
}))



passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.name ,role:user.role,useremail:user.email});
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
app.use(passport.initialize());
app.use(passport.session());



const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/img/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });



app.use((req,res,next)=>{
   
    res.locals.currentUser=req.user;
    next();
});





app.get('/',async(req,res)=>{
    
    let currentUser=req.user;
    if(currentUser===undefined){
    currentUser="";
    }
    if(currentUser.role==="admin"){
      return res.redirect('/admin')
    }

    try {
       
        const featuredProducts = await product.aggregate([
          { $sample: { size: 12 } }
        ]);
       
        const topseller=await product.find({isTopSeller:true});
    
       
        res.render("index", { Products: featuredProducts,currentUser:currentUser,top:topseller});
       
    
      } catch (err) {
        console.error("Error fetching featured products:", err);
        res.render('index',{currentUser:currentUser});
      }
    
})




app.get('/detail/:id',async(req,res)=>{

    let id=req.params.id;
    let currentUser=req.user;
    if(currentUser===undefined){
    currentUser="";
    }

    try{
        let Product= await product.findById(id);
        res.render('detail',{Pro:Product,currentUser:currentUser})
    }
    catch (err) {
        console.error("Error fetching  product detail:", err);
        res.render('detail',{currentUser:currentUser});
      }

   
})

app.get("/cart", async (req, res) => {
  let currentUser=req.user;
  if(currentUser===undefined){
  currentUser="";
  }
  try {
    let items = [];
    let total=0;
    if (req.user) {
      // ✅ Logged in → check DB cart
      let dbCart = await Cart.findOne({ userEmail: req.user.useremail });

      // If DB cart doesn't exist, create it
      if (!dbCart) {
        dbCart = new Cart({ userEmail: req.user.useremail, items: [] });
      }

      // ✅ If session cart exists, merge it into DB
   

      // Populate products for rendering
      await dbCart.populate("items.product");
      items = dbCart.items;
     

    } else {
      // ✅ Guest user → just use session cart
      const sessionCart = req.session.cart || [];

      const productIds = sessionCart.map(item => item.productId);
      const products = await product.find({ _id: { $in: productIds } });

      items = sessionCart.map(item => {
        const product = products.find(p => p._id.toString() === item.productId);
        return { product, quantity: item.quantity };
      });
    }
    if (items && items.length > 0) {
      for (let item of items) {
        // if logged in: item.productId is populated object
        // if guest: item.productId is string → fetch product
        let productt = item.product.productName 
            ? item.product 
            : await product.findById(item.product);

        total += productt.price * item.quantity;
    }
    }
    // Render cart page
   
    res.render('cart', { items:items,currentUser:currentUser,total:total });

  } catch (err) {
    console.error("Cart error:", err);
   res.render('cart',{currentUser:currentUser,items:""})
  }
});

app.get('/signup',(req,res)=>{
  if (req.user) return res.redirect("/");
    res.render('signup')
})
app.get('/login',(req,res)=>{
  if (req.user) return res.redirect("/");
    res.render('login')
})

app.get('/dentalproducts',async(req,res)=>{
    let currentUser=req.user;
    if(currentUser===undefined){
    currentUser="";
    }
    try{
        const DentalProduct=await product.find({category:"dental"})
        res.render('dentalproducts',{Products:DentalProduct,currentUser:currentUser})
    }
    catch (err) {
    console.error("Error fetching dental products:", err);
    res.render('dentalproducts',{currentUser:currentUser});
  }
})
app.get('/stationaryproducts',async(req,res)=>{
    let currentUser=req.user;
    if(currentUser===undefined){
    currentUser="";
    }
    try{
        const stationaryProduct=await product.find({category:"stationary"})
        res.render('stationaryproducts',{Products:stationaryProduct,currentUser:currentUser})
    }
    catch (err) {
    console.error("Error fetching stationary products:", err);
    res.render('dentalproducts',{currentUser:currentUser});
  }
})


 app.post('/register',(req,res)=>{
    const{name,email,password}=req.body;
    user.findOne({email:email})
    .then(userr=>{
        if(userr){
            notifier.notify({
                title: 'Message!',
                message: 'User Already Exist!',
              
                sound: true,
                wait: true
              })
           
            return res.redirect('/signup')
        }

       
        const newuser=new user({
            name:name,
            email:email,
            password:password

        })
        bcrypt.genSalt(10,(err,salt)=>
        bcrypt.hash(newuser.password,salt,(err,hash)=>{
            if(err)
            throw err;
            newuser.password=hash;
           
        newuser.save()
        .then(userr=>{
            notifier.notify({
                title: 'Message!',
                message: 'Account Created Successfully!',
              
                sound: true,
                wait: true
              })
           
            res.redirect('/login')
        })
        .catch(err=>{
            console.log(err);
        })
        })
        
        )


    })

})



app.get("/increase/:productId", async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    // Guest cart (session)
    let cart = req.session.cart || [];
    let item = cart.find(i => i.productId.toString() === productId);

    if (item) {
      item.quantity += 1;
    }
    req.session.cart = cart;
    return res.redirect("/cart");
  }

  // Logged in user
  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    let item = dbCart.items.find(i => i.product._id.toString() === productId);
    if (item) {
      item.quantity += 1;
    }
    await dbCart.save();
  }
  res.redirect("/cart");
});

// Decrease quantity
app.get("/decrease/:productId", async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    // Guest cart
    let cart = req.session.cart || [];
    let itemIndex = cart.findIndex(i => i.productId.toString() === productId);

    if (itemIndex > -1) {
      if (cart[itemIndex].quantity > 1) {
        cart[itemIndex].quantity -= 1;
      } else {
        cart.splice(itemIndex, 1); // remove item
      }
    }
    req.session.cart = cart;
    return res.redirect("/cart");
  }

  // Logged in user
  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    let itemIndex = dbCart.items.findIndex(i => i.product._id.toString() === productId);

    if (itemIndex > -1) {
      if (dbCart.items[itemIndex].quantity > 1) {
        dbCart.items[itemIndex].quantity -= 1;
      } else {
        dbCart.items.splice(itemIndex, 1); // remove item
      }
      if (dbCart.items.length === 0) {
        await Cart.deleteOne({ userEmail: req.user.useremail });
      } else {
        await dbCart.save();
      }
    }
  }
  res.redirect("/cart");
});

// Remove product
app.get("/remove/:productId", async (req, res) => {
  const productId = req.params.productId;

  if (!req.user) {
    // Guest cart
    let cart = req.session.cart || [];
    req.session.cart = cart.filter(i => i.productId.toString() !== productId);
    return res.redirect("/cart");
  }

  // Logged in user
  let dbCart = await Cart.findOne({ userEmail: req.user.useremail });
  if (dbCart) {
    dbCart.items = dbCart.items.filter(i => i.product._id.toString() !== productId);
    if (dbCart.items.length === 0) {
      await Cart.deleteOne({ userEmail: req.user.useremail });
    } else {
      await dbCart.save();
    }
  }
  res.redirect("/cart");
});


app.get("/addaddress", async (req, res) => {
 
  if (!req.user) return res.redirect("/login");

  let address = await Address.findOne({ userEmail: req.user.useremail });
  
  res.render("addaddress", {
    user: req.user,
    address: address || null
  });
});


app.get("/placeorder", async (req, res) => {

  if (!req.user) return res.redirect("/login");

  let currentUser=req.user;
  if(currentUser===undefined){
  currentUser="";
  }



  // fetch user address
  const address = await Address.findOne({ userEmail: req.user.useremail });

  if (!address) {
    // if no address, redirect to add address page
    return res.redirect("/addaddress");
  }
 


  try {
    let items = [];
  let total=0;
    let dbCart = await Cart.findOne({ userEmail: req.user.useremail });

    // If DB cart doesn't exist, create it
    if (!dbCart) {
      dbCart = new Cart({ userEmail: req.user.useremail, items: [] });
    }

    // ✅ If session cart exists, merge it into DB
 

    // Populate products for rendering
    await dbCart.populate("items.product");
    items = dbCart.items;
    if (items && items.length > 0) {
      for (let item of items) {
        // if logged in: item.productId is populated object
        // if guest: item.productId is string → fetch product
        let productt = item.product.productName 
            ? item.product 
            : await product.findById(item.product);

        total += productt.price * item.quantity;
    }
    }
    let deliveryFee = 0;
    if (!address.city || address.city.toLowerCase() !== "rohtak") {
      deliveryFee = 90;
    }
  
    res.render("placeorder", {
      deliveryFee: deliveryFee,
      items:items,currentUser:currentUser,total:total
    });

  }
  catch (err) {
    console.error("Cart error:", err);
   res.render('cart',{currentUser:currentUser,items:""})
  }


 
  
});


app.get("/orderconfirm", async (req, res) => {
  if (!req.user) return res.redirect("/login");
  let currentUser=req.user;
  if(currentUser===undefined){
  currentUser="";
  }
  try {
    let total=0;
    if (!req.user) return res.redirect("/login");

    // fetch address
    const address = await Address.findOne({ userEmail: req.user.useremail });
    if (!address) return res.redirect("/addaddress");

    // fetch cart
    let cart = await Cart.findOne({ userEmail: req.user.useremail }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    // create order
    const order = new Order({
      userEmail: req.user.useremail,
      address: address._id,
      items: cart.items,
      status: "Confirmed",

    });

      for(let item of cart.items){
        total += item.product.price * item.quantity;
      }
    await order.save();

    // empty cart after placing order
    await Cart.deleteOne({ userEmail: req.user.useremail });

    // send confirmation mail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "abd.irfankhan7007@gmail.com",
        pass: "ducvajxuizftpltm" // use App Password, not Gmail password
      }
    });

    const mailOptions = {
      from: "abd.irfankhan7007@gmail.com",
      to: req.user.useremail,
      subject: "Order Confirmation",
      html: `
        <h2>Order Confirmed ✅</h2>
        <p>Hi ${req.user.username || req.user.useremail},</p>
        <p>Thank you for your order. Here are the details:</p>
        <ul>
          ${order.items.map(it => `<li>${it.product.productName} - Qty: ${it.quantity} - Price: ${it.product.price}</li>`).join("")}
        </ul>
        <p>Status: ${order.status}</p>
        <p>Our Delivery Partner will notify you once it ships 🚚</p>
      `
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("Mail error:", err);
      else console.log("Mail sent:", info.response);
    });
    await order.populate("address");
   
    res.render("orderconfirm", {
      orderId: order._id,
      items: order.items,
      total: total,
      address: order.address,
      currentUser: currentUser
    });





  } catch (err) {
    console.error(err);
    res.status(500).send("Server error....Please place order again");
  }
});



app.get("/myorders", async (req, res) => {

  try {
    if (!req.user) {
      return res.redirect("/login");
    }

    // Fetch all orders for user
    const orders = await Order.find({ userEmail: req.user.useremail })
      .populate("items.product") // only populate product
      .sort({ createdAt: -1 });

    // Format data
    const formattedOrders = orders.map(order => {
      let total = 0;
      const items = order.items.map(i => {
        const subtotal = i.product.price * i.quantity;
        total += subtotal;
        return {
          productName: i.product.productName,
          price: i.product.price,
          img: i.product.img,
          quantity: i.quantity,
          subtotal
        };
      });
      return {
        id: order._id,
        status: order.status,
        createdAt: order.createdAt,
        items,
        total
      };
    });

    res.render("myorder", {
      orders: formattedOrders,
      currentUser: req.user
    });

  } catch (err) {
    console.error("My Orders error:", err);
    res.status(500).send("Error loading orders");
  }
});



const geturl = (req) => {
  return req.user.role === 'admin' ? '/admin' : '/'
}


app.get('/admin',async(req,res)=>{
  try {
    if (!req.user || req.user.role!=="admin") return res.redirect("/login");
    const { page = 1, search = "" } = req.query;
    const limit = 10; // orders per page
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query.$or = [{ userEmail: { $regex: search, $options: "i" } }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }
     
    }

    const orders = await Order.find(query)
    .populate("items.product") // get product details
    .populate("address")    // get full address
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("admin_home", {
      orders,
      currentPage: parseInt(page),
      totalPages,
      search
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching orders");
  }
});

app.get("/admin/add-product", (req, res) => {
  if (!req.user || req.user.role!=="admin") return res.redirect("/login");
  res.render("add_product");
});

app.post("/admin/add-product", upload.single("img"), async (req, res) => {
  try {
   
    const { productName, price, totalStock, shortDescription, longDescription, category, information } = req.body;

    const newProduct = new product({
      productName,
      price,
      totalStock,
      shortDescription,
      longDescription,
      category,
      information,
      img: req.file ? req.file.filename : "default.jpg"
    });

    await newProduct.save();
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding product");
  }
});

app.get("/admin/products", async (req, res) => {
  try {
    if (!req.user || req.user.role!=="admin") return res.redirect("/login");
    const { page = 1, search = "" } = req.query;
    const limit = 10; // orders per page
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query.$or = [{ productName: { $regex: search, $options: "i" } }];
      if (mongoose.Types.ObjectId.isValid(search)) {
        query.$or.push({ _id: search });
      }
     
    }

    
    const products = await product.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
    const totalpro = await product.countDocuments(query);
    const totalPages = Math.ceil(totalpro / limit);
    res.render("admin_products", { products,
      currentPage: parseInt(page),
      totalPages,
      search });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching products");
  }
});


// DELETE product by ID
app.get("/admin/products/delete/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role!=="admin") return res.redirect("/login");
    await product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting product");
  }
});



app.get("/admin/products/edit/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role!=="admin") return res.redirect("/login");
    const products = await product.findById(req.params.id).lean();
    if (!products) return res.status(404).send("Product not found");
    res.render("edit_product", { products });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading edit form");
  }
});


app.post("/admin/products/edit/:id", async (req, res) => {
  try {
    const { productName, price, totalStock, shortDescription, longDescription, category, information } = req.body;

   

    await product.findByIdAndUpdate(req.params.id, {
      productName,
      price,
      totalStock,
      shortDescription, 
      longDescription, 
      category, 
      information
    });

    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating product");
  }
});


app.post("/admin/order/status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating status");
  }
});

app.get("/admin/order/delete/:id", async (req, res) => {
  try {
    if (!req.user || req.user.role!=="admin") return res.redirect("/login");
    await Order.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting order");
  }
});

app.post("/login", async (req, res, next) => {
  const oldCart = req.session.cart; 
  passport.authenticate("local", async (err, user, info) => {
    if (err || !user) return res.status(400).json({ message: "Login failed" });

    req.logIn(user, async (err) => {
      if (err) return res.status(500).json({ message: "Error during login" });

      // 🔹 Merge session cart into DB cart
      req.session.cart=oldCart ;
      console.log(req.user);
      if (req.session.cart && req.session.cart.length > 0) {
        let dbCart = await Cart.findOne({ userEmail: req.user.email});
        if (!dbCart) dbCart = new Cart({ userEmail: req.user.email, items: [] });
        for (const sessionItem of req.session.cart) {
          const itemIndex = dbCart.items.findIndex(
            (i) => i.product.toString() === sessionItem.productId
          );
          if (itemIndex > -1) {
            dbCart.items[itemIndex].quantity += sessionItem.quantity;
          } else {
            dbCart.items.push({
              product: sessionItem.productId,
              quantity: sessionItem.quantity,
            });
          }
        }

        await dbCart.save();
        req.session.cart = []; // clear guest cart
      }
      res.redirect(geturl(req));
    });
  })(req, res, next);
});


    app.get('/logout', function(req, res, next) {
        req.logout(function(err) {
          if (err) { return next(err); }
          res.redirect('/login');
        });
      });


      app.post("/cart/add", async (req, res) => {
        try {
          const { productId, quantity } = req.body;
          const qty = quantity ? parseInt(quantity) : 1;
      
          if (req.user) {
            // Logged in → Save in DB
            console.log(req.user);
            let cart = await Cart.findOne({ userEmail: req.user.useremail });
      
            if (!cart) cart = new Cart({ userEmail: req.user.useremail, items: [] });
      
            const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
      
            if (itemIndex > -1) {
              cart.items[itemIndex].quantity += qty;
            } else {
              cart.items.push({ product: productId, quantity: qty });
            }
      
            await cart.save();
            return res.json({ success: true, message: "Product added to cart (DB)" });
      
          } else {
            // Guest → Save in session
            if (!req.session.cart) req.session.cart = [];
      
            const itemIndex = req.session.cart.findIndex(item => item.productId === productId);
      
            if (itemIndex > -1) {
              req.session.cart[itemIndex].quantity += qty;
            } else {
              req.session.cart.push({ productId, quantity: qty });
            }
      
            return res.json({ success: true, message: "Product added to cart (Session)" });
          }
        } catch (err) {
          console.error(err);
          res.status(500).json({ success: false, message: "Server error" });
        }
      });
      

      app.post("/addaddress", async (req, res) => {
       
      
        const { name, email, city, pincode, fullAddress, contactNumber } = req.body;
      
        let address = await Address.findOne({ userEmail: req.user.useremail });
      
        if (address) {
          // Update existing
          address.name = name;
          address.email = email;
          address.city = city;
          address.pincode = pincode;
          address.fullAddress = fullAddress;
          address.contactNumber = contactNumber;
          await address.save();
        } else {
          // Create new
          address = new Address({
            userEmail: req.user.useremail,
            name,
            email,
            city,
            pincode,
            fullAddress,
            contactNumber
          });
          await address.save();
        }
      
        res.redirect("/placeorder"); // redirect back to same page
      });
      

      // Search products
app.post("/search", async (req, res) => {
  try {
    const searchTerm = req.body.searchTerm;

    // Case-insensitive partial match
    const Products = await product.find({
      productName: { $regex: searchTerm, $options: "i" }
    });

    res.render("searchResults", {
      Products,
      searchTerm
    });

  } catch (err) {
    console.error("Search error:", err);
    res.status(500).send("Error while searching products");
  }
});

    
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.listen(3000,()=>{
    console.log("Server Started");
})