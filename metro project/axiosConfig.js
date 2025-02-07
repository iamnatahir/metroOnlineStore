const axios=require("axios") ;

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000", // Your backend URL
  withCredentials: true, // Ensure cookies are sent with requests
});

module.exports= axiosInstance;
