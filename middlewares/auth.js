const User = require("../models/userSchema");

const userAuth = async (req,res,next) => {
  if(req.session.user) {
    User.findById(req.session.user)
    .then(data => {
      if(data && !data.isBlocked) {
        next();
      }else {
        res.redirect("/login")
      }
    })
    .catch(error => {
      console.log("Error in user auth middleware");
      res.status(500).send("Internal Server Error");
    })
  }else {
    res.redirect("/login");
  }
}

const  adminAuth = (req,res,next)=>{
  User.findOne({isAdmin:true})
  .then(data=>{
      if(data && req.session.admin){
          // console.log("The user exist")
      next();
      }else{
          res.redirect("/admin/login")
      }
  })
  .catch(error=>{
      console.log("Error in admin auth middleware",error);
      res.status(500).send("Internal Server error")
  })
}





module.exports = {
  userAuth,
  adminAuth
}


