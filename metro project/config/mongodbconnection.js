const mongoose=require("mongoose");
async function connectDB(){
    try{
        let connect=await mongoose.connect(process.env.CONNECTION_STRING);
        console.log("connected db");
    }catch(err){
        throw new Error("Cant connect to db");
    }
    

}
module.exports=connectDB;