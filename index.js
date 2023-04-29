const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");

const mongoose = require("mongoose");
const config = require("./config/key");

const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());


/////
app.use("/api/product", require("./routes/product")); 
app.use("/api/user", require("./routes/user"));
app.use("/api/s3", require("./routes/s3"));
app.use("/uploads", express.static("uploads")); 

mongoose
  .connect(config.mongoURI)

  .then(() => {
    console.log("DB Connected");
  })
  .catch((err) => console.log(err));


app.listen(port, () => console.log(`port : ${port}`));
