const express = require("express");
const app = express.Router();
const { User } = require("../models/User");
const { auth } = require("../middleware/auth");

///////////////////////////////////////////////////////
//사용자 인증, 사용자가 페이지를 이동할지 사용가능한가 체크
app.get("/auth", auth, (req, res) => {
  //통과하지 못하였을 경우는 auth에서 처리했으므로
  //이곳에선 항상 통과했을 경우만 수행하게됨
  res.status(200).json({
    _id: req.user._id, //넘겨줄 인자 입력, auth에서 req에 담아줬기때문에 사용가능
    isAdmin: req.user.role === 0 ? false : true, //role 0이면 사용자, 0이 아니면 관리자
    isAuth: true,
    email: req.user.email,
    name: req.user.name,
    lastname: req.user.lastname,
    role: req.user.role,
    image: req.user.image,
    // cart: req.user.cart,
    // history: req.user.history,
    //해당 정보를 줌으로써 페이지에서 어떤 정보를 필요하는지 확인가능
  });
}); //auth > 미들웨어 중간에서 작업을 해줌 auth.js

app.post("/register", (req, res) => {
  const user = new User(req.body);
  user.save((err) => {
    if (err)
      return res.json({ success: false, message: "중복된 이메일입니다." });
    return res.status(200).json({
      success: true,
    });
  });
});

//////////////////////////////////////////////////
app.post("/login", (req, res) => {
  //요청된 email을 DB에서 있는지 탐색
  User.findOne({ email: req.body.email }, (err, user) => {
    //mongoDB 함수
    if (!user) {
      //유저 정보에 email이 없다면 없으면
      return res.json({
        loginSuccess: false,
        message: "등록되지 않은 유저입니다.",
      });
    }

    //DB에 있다면 비밀번호가 맞는지 확인
    user.comparePassword(req.body.password, (err, isMatch) => {
      //isMatch는 user.js에서 실행된 결과
      if (!isMatch)
        //없으면 비밀번호가 틀린것
        return res.json({
          loginSuccess: false,
          message: "비밀번호를 다시 확인해주세요.",
        });

      //Token생성
      user.createToken((err, user) => {
        if (err) return res.status(400).json(err);

        //토큰을 쿠키에 저장,  로컬스토리지 등에도 저장가능
        res
          .cookie("userCookie", user.token)
          .status(200) //400 = 실패, 200 = 성공
          .json({
            loginSuccess: true,
            user: {
              _id: user._id,
              name: user.name,
              email: user.email,
              admin: user.role === 0 ? false : true,
            },
          });
      });
    });
  });
});

app.get("/logout", auth, (req, res) => {
  //DB에서 id를 찾고 토큰을 비워줌
  User.findOneAndUpdate({ _id: req.id }, { token: "" }, (err, user) => {
    if (err) return res.json({ success: false, err });
    return res.status(200).json({ success: true });
  });
});

app.post("/addCart", (req, res) => {
  User.findOne({ _id: req.body.userId }, { cart: 1 })
    .lean()
    .exec((err, userInfo) => {
      let duplicate = false;
      userInfo.cart.forEach((data) => {
        if (data.id === req.body.productId) {
          duplicate = true;
          if (err) return res.status(400).json({ success: false, err });
          return res.status(200).json({ duplicate: true });
        }
      });

      if (duplicate) return;

      User.findOneAndUpdate(
        { _id: req.body.userId },
        {
          $push: {
            cart: {
              id: req.body.productId,
              purchasesCount: req.body.purchasesCount,
            },
          },
        },
        { new: true }
      )
        .lean()
        .exec((err) => {
          if (err) return res.status(400).json({ success: false, err });
          return res.status(200).json({ duplicate: false });
        });
    });
});

app.post("/changeCart", (req, res) => {
  User.findOneAndUpdate({ _id: req.body.id }, { cart: req.body.cart })
    .lean()
    .exec((err) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json({ success: true });
    });
});

app.post("/removeCart", (req, res) => {
  // const option =
  //   req.body.productId.length > 1
  //     ? { $in: req.body.productId }
  //     : req.body.productId;
  // //상품이 여러개면 그 ID를 포함한 모든 상품 삭제 아니라면 하나만 삭제

  // DB에서 user의 cart에서 항목을 삭제
  User.findOneAndUpdate(
    { _id: req.body.userId },
    { $pull: { cart: { id: { $in: req.body.productId } } } },
    { new: true }
  )
    //pull > 데이터를 빼줌
    .lean()
    .exec((err, userInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json({ success: true, cart: userInfo.cart });
    });
});

app.post("/getCart", (req, res) => {
  User.findOne({ _id: req.body.id }, { cart: 1 })
    .lean()
    .exec((err, userInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json([...userInfo.cart]);
    });
});

app.post("/purchaseHistory", (req, res) => {
  User.findOne(
    { _id: req.body.id },
    {
      purchase: {
        $slice: [req.body.skip, req.body.limit],
      },
    }
  )
    .lean()
    .exec((err, userInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json(userInfo.purchase);
    });
});

app.post("/userInfo", (req, res) => {
  User.findOne({ _id: req.body.id }, { name: 1, email: 1 })
    .lean()
    .exec((err, userInfo) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json({ ...userInfo });
    });
});

app.post("/successBuy", (req, res) => {
  User.findOneAndUpdate(
    { _id: req.body.userId },
    {
      $push: {
        purchase: {
          $each: [
            {
              shippingInfo: req.body.shippingInfo,
              product: req.body.product,
              payment: req.body.payment,
              price: req.body.price,
              date: req.body.date,
            },
          ],
          $position: 0,
        },
      },
    },
    //업데이트된 정보를 받음
    { new: true }
  )
    .lean()
    .exec((err) => {
      if (err) return res.status(400).json({ success: false, err });
      res.status(200).json({ success: true });
    });
});

app.post("/addBuyer", (req, res) => {
  for (let i of req.body.product) {
    User.findOneAndUpdate(
      { _id: i.writer },

      {
        $push: {
          buyer: {
            $each: [
              {
                shippingInfo: req.body.shippingInfo,
                title: i.title,
                purchasesCount: i.purchasesCount,
                date: req.body.date,
              },
            ],
            $position: 0,
          },
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
});

app.post("/buyerList", (req, res) => {
  User.findOne(
    { _id: req.body.id },
    {
      buyer: 1,
    }
  )

    // {
    //   purchase: {
    //     $slice: [req.body.skip, req.body.limit],
    //   },
    // }

    .lean()
    .exec((err, buyer) => {
      if (err) return res.status(400).json({ success: false, err });
      return res.status(200).json(buyer.buyer);
    });
});

module.exports = app;
