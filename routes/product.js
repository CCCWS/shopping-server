const express = require("express");
const app = express.Router();
const multer = require("multer");
const fs = require("fs");
const { ProductData } = require("../models/productData");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "client/public/uploads");
  }, //파일 저장 경로

  filename: function (req, file, cb) {
    console.log(file);
    const ext = file.mimetype.split("/")[1];
    if (["png", "jpg", "jpeg", "gif"].includes(ext)) {
      cb(null, `${Date.now()}.${ext}`);
    } else {
      cb(new Error("이미지만 업로드 가능"));
    }
  }, //저장할때 파일명
});

const upload = multer({ storage: storage });

app.post("/img", upload.single("file"), (req, res) => {
  //서버에 이미지파일 업로드
  return res.json({
    success: true,
    file: res.req.file,
  }); //front로 저장된 파일의 경로와 이름 전달
});

app.post("/write", (req, res) => {
  //새로운 상품 등록
  //받은 정보를 DB에 저장
  const productData = new ProductData(req.body);

  productData.save((err) => {
    if (err) return res.status(400).json({ success: false, err });
    return res.status(200).json({ success: true });
  });
});

app.post("/edit", (req, res) => {
  ProductData.findOneAndUpdate(
    { _id: req.body.id },
    {
      $set: {
        title: req.body.title,
        price: req.body.price,
        description: req.body.description,
        category: req.body.category,
        image: req.body.image,
        count: req.body.count,
      },
    },
    { new: true }
  )
    .lean()
    .exec((err, productInfo) => {
      if (err) {
        return res.status(400).json({ success: false, err });
      }
      return res.status(200).json({ success: true, productInfo });
    });
});

app.post("/delImg", async (req, res) => {
  //상품 등록 페이지에서 업로드 이미지 삭제

  // if (fs.existsSync(`uploads/${req.body.image}`)) {
  // 파일이 존재한다면 true 그렇지 않은 경우 false 반환
  try {
    fs.unlinkSync(`client/public/uploads/${req.body.image}`);
    return res.json({
      success: true,
    });
  } catch (error) {
    return res.json({
      success: false,
    });
  }
});

app.post("/delImgEditPage", async (req, res) => {
  try {
    req.body.forEach((data) => fs.unlinkSync(`uploads/${data}`));
    return res.json({
      success: true,
    });
  } catch (error) {
    return res.json({
      success: false,
    });
  }
});

app.post("/productList", (req, res) => {
  //상품목록 가져오기
  const arg = {};

  //가격 범위에 따른 필터링
  if (req.body.price) {
    const range = req.body.price.split(",");
    arg.price = {
      $gte: parseInt(range[0], 10),
      $lte: parseInt(range[1], 10),
    };
  }

  //카테고리에 따른 필터링
  if (req.body.category) {
    if (req.body.category !== "전체") {
      arg.category = req.body.category;
    }
  }

  //검색어에 따른 필터링
  if (req.body.searchValue) {
    if (req.body.searchValue.length > 0) {
      arg.title = { $regex: req.body.searchValue, $options: "i" };
    }
  }

  //특정 id를 제외한 나머지
  if (req.body.filterId) {
    arg._id = { $ne: req.body.filterId };
  }

  //등록한 상품 리스트를 가져옴
  ProductData.find(arg)
    .sort({ createdAt: -1 }) //mongoDb의 ProductData의 리스트를 조건없이 가져옴 필터기능 구현시 괄호안에 조건 입력
    // .populate("writer") //현재 저장된 id에는 암호회 되어있음. 해당 id에 대한 정보를 모두 가져옴
    .skip(parseInt(req.body.skip, 10))
    .limit(parseInt(req.body.limit, 10))
    .lean()
    .exec((err, productInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json([...productInfo]);
    });
});

app.post("/productDetail", (req, res) => {
  //특정 상품 상세정보
  ProductData.findOneAndUpdate(
    { _id: req.body.id },
    {
      $inc: {
        //edit페이지에서 상품을 불러올때는 조회수를 증가시키지 않음
        views: req.body.edit ? 0 : 1,
      },
    },
    { new: true }
  )
    .lean()
    // .populate("writer")
    .exec((err, productInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json({ ...productInfo });
    });
});

app.post("/cart", (req, res) => {
  //사용자의 카트에 등록된 상품 목록
  ProductData.find({ _id: { $in: req.body } })
    .sort({ createdAt: -1 })
    .lean()
    .exec((err, productInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json([...productInfo]);
    });
});

app.post("/successBuy", (req, res) => {
  //구매 성공시 처리
  for (let i of req.body) {
    ProductData.findOneAndUpdate(
      { _id: i.id },
      {
        $inc: {
          sold: i.purchasesCount,
          count: -i.purchasesCount,
        },
      },
      { new: true }
    )
      .lean()
      .exec((err) => {
        if (err) return res.status(400).json({ success: false, err });
      });
  }
  return res.status(200).json({ success: true });
  //서버에서 클라이언트로 응답을 보낼때 둘 이상을 보내게 되면 에러가 발생함
  //에러 발생시에는 즉시 리턴시켜서 for문을 종료시키고
  //정상적으로 모두 처리가 되었을때만 성공 메세지를 전송
});

app.post("/myProduct", (req, res) => {
  //사용자가 등록한 상품 목록
  ProductData.find({
    writer: { $in: req.body.id },
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec((err, productList) => {
      if (err) return res.status(400).json({ success: false, err });
      res.status(200).json(productList);
    });
});

app.post("/productSort", (req, res) => {
  let arg = {
    [req.body.type]: -1,
  };

  ProductData.find()
    .sort(arg)
    .limit(req.body.count)
    .lean()
    .exec((err, productInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      res.status(200).json([...productInfo]);
    });
});

module.exports = app;
