 function ensureAdmin(req, res, next) {
    if (req.session.user?.role === "admin") {
        next();
    } else {
        res.status(403).send("Access Denied");
    }
}
module.exports=ensureAdmin;