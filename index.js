const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const { App } = require("@slack/bolt");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const OAuth2 = google.auth.OAuth2;
const { connection } = require("./config/db");
const User = require("./Modals/UserModal");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require('cookie-parser')
const twilio = require("twilio")
const stripe = require('stripe')(process.env.STRIPE_URL)

dotenv.config();

const app = express();
app.use(cookieParser());
//app.use(cors({ origin : process.env.ACCESS_CONTROL_URL  , credentials : true }));

app.use(
  cors({
    credentials: true,
    origin: "https://c1067-zss.vercel.app",
  })
);
app.use(bodyParser.json());

const port = 8000;
app.listen(port, async () => {
  try {
    await connection;
    console.log("Connected to DB Successfully");
  } catch (err) {
    console.log("Connection failed");
    console.log(err);
  }
  console.log(`Server listening on port ${port}.`);
});

// Route to create a meeting
app.post("/api/create-meeting", async (req, res) => {
  const { title, type, date, duration, channel } = req.body;

  try {
    const response = await axios.post(process.env.ZOOM_HOOK, {
      meetingTitle: title,
      meetingType: type,
      date: date,
      duration: duration,
      channel: channel,
    });
    if (response.status === 200) {
      res.status(200).json({
        message: "Meeting link created",
      });
    } else {
      res.status(500).json({ error: "Error sending data to Zapier" });
    }
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
});

app.post("/api/create-issue", async (req, res) => {
  const {
    summary,
    desc,
    project_id,
    priority,
    due_date,
    meeting_date,
    duration,
    channel,
  } = req.body;

  try {
    const response = await axios.post(process.env.JIRA_HOOK, {
      summary,
      desc,
      project_id,
      priority,
      due_date,
      meeting_date,
      duration,
      channel,
    });
    if (response.status === 200) {
      res.status(200).json({
        message: "Issue created on Jira",
      });
    } else {
      res.status(500).json({ error: "Error sending data to Zapier" });
    }
  } catch (err) {
    res.status(404).json({ err });
  }
});

app.post("/api/send-issue", async (req, res) => {
  const {
    subject,
    group,
    rname,
    remail,
    description,
    type,
    priority,
    customerType,
    channel,
  } = req.body;

  try {
    const response = await axios.post(process.env.ZENDESK_HOOK, {
      subject: subject,
      group: group,
      request_name: rname,
      request_email: remail,
      description: description,
      type: type,
      priority: priority,
      customer_type: customerType,
      channel: channel,
    });

    if (response.status === 200) {
      res.status(200).json({
        message: "Zendesk issue notified to members",
      });
    } else {
      res.status(500).json({ error: "Error sending data to Zapier" });
    }
  } catch (error) {
    res.status(404).json({ error });
  }
});

app.get("/api/get-tickets", async (req, res) => {
  const auth = {
    username: process.env.ZENDESK_USERNAME,
    password: process.env.ZENDESK_API_TOKEN,
  };

  try {
    const response = await axios.get(
      `https://zipper5743.zendesk.com/api/v2/tickets.json`,
      { auth }
    );
    return res.json(response.data);
  } catch (error) {
    return res.json(error);
  }
});

// Define Slack API related constants
const SLACK_ACCESS_TOKEN = process.env.SLACK_TOKEN;
const SLACK_API_URL = "https://slack.com/api";

// Route to fetch Slack channels
app.get("/api/channels", async (req, res) => {
  try {
    const response = await axios.get(`${SLACK_API_URL}/conversations.list`, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${SLACK_ACCESS_TOKEN}`,
        Accept: "application/json",
      },
    });

    const channels = response.data.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
    }));

    res.json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).json({ error: "An error occurred." });
  }
});

// Route to send a message to Slack
app.post("/send-message", async (req, res) => {
  const { channel, text } = req.body;

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: text,
      },
    },
    {
      type: "divider",
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Click me!",
          },
          action_id: "button_click",
        },
      ],
    },
  ];

  try {
    const app = new App({
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      token: SLACK_ACCESS_TOKEN,
    });

    await app.client.chat.postMessage({
      token: SLACK_ACCESS_TOKEN,
      channel: channel,
      blocks: blocks,
      text: text,
    });

    res.status(200).json({
      success: true,
      message: "Message sent successfully.",
    });
  } catch (error) {
    console.error("Error sending message to Slack:", error);
    res.status(500).json({ success: false, message: "An error occurred." });
  }
});

//Sending message
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

async function sendMail(senderName, senderEmail, senderMessage) {
  try {
    const ACCESS_TOKEN = await oAuth2Client.getAccessToken();
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "mehulparekh144@gmail.com",
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: ACCESS_TOKEN,
      },
    });

    const mailOptions = {
      from: "Bot <developersonline.org@gmail.com>",
      to: "mehulparekh144@gmail.com",
      subject: `${senderEmail} sent you a message`,
      text: `Message from ${senderName}: ${senderMessage}`,
    };

    const result = await transport.sendMail(mailOptions);
    return result;
  } catch (error) {
    return error;
  }
}

app.post("/api/sendmail", (req, res) => {
  const senderName = req.body.name;
  const senderEmail = req.body.email;
  const senderMessage = req.body.message;

  sendMail(senderName, senderEmail, senderMessage)
    .then((result) => console.log("Message Sent"))
    .catch((error) => console.log(error.message));
});

// loginpage

// app.post("/api/login", async (req, res) => {
//   const { email, password } = req.body;
//   const user = await User.findOne({ email });
//   const hashed_password = user.password;
//   const user_id = user._id;
//   const user_email = user.email;
//   console.log(user);
//   console.log(user_id);
//   const options ={
//     expires : new Date(Date.now() + 15*24*60*60*1000),
//     httpOnly : true , 
//     // secure :true,
//     sameSite : "Lax",
// };
//   bcrypt.compare(password, hashed_password, function (err, result) {
//     // result == true
//     if (err) {
//       res.send("Something Went Wrong,Try again Later");
//     }

//     if (result) {
//       // const token = jwt.sign({ user_id }, process.env.SECRET_KEY);
//       // res.send({ msg: "Login SuccessFully", token });

//       jwt.sign(
//         {
//           email: user_email,
//           id: user_id,
//         },
//         process.env.SECRET_KEY,
//         {},
//         (err, token) => {
//           if (err) throw err;
//           res.cookie("token",token,options).json({
//             _id: user.id,
//             name: user.name,
//             email: user.email,
//             mobile: user.mobile,
//             city: user.city,
//           });
//         // console.log(res.cookie);
//         }
//       );
//     } else {
//       res.send("Login Failed");
//     }
//   });
// });

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json("Email doesn't exists")
  }
  const hashed_password = user.password;
  const user_id = user._id;
  const user_email = user.email;


  bcrypt.compare(password, hashed_password, function (err, result) {
    if (err) {
      res.send("Something Went Wrong, Try again Later");
    }

    if (result) {
      jwt.sign(
        {
          email: user_email,
          id: user_id,
        },
        process.env.SECRET_KEY,
        {},
        (err, token) => {
          if (err) throw err;
          const options = {
            expires: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: true,
            sameSite: "none",
          };

          res.cookie("token", token, options).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            city: user.city,
            token: token, // Sending the token in the response
          });
        }
      );
    } else {
      res.send("Login Failed");
    }
  });
});


// signup

app.post("/api/signup", async (req, res) => {
  const { name, email, password, mobile, city } = req.body;

  try {
    const isUser = await User.findOne({ email });

    if (isUser) {
      return res.send({ msg: "User already exists, try logging in." });
    } else {
      bcrypt.hash(password, 5, async function (err, hash) {
        if (err) {
          return res.send({ msg: "Something Went Wrong" });
        }

        const new_user = new User({
          name,
          email,
          password: hash,
          mobile,
          city,
        });

        try {
          await new_user.save();
          res.send({ msg: "Signup Successfully" });
        } catch (err) {
          res.send({ msg: "Something Went Wrong, Try Again Later" });
        }
      });
    }
  } catch (error) {
    res.status(500).send({ msg: "Internal Server Error" });
  }
});
///otp-send///


const otpMap = new Map();
const client = new twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

app.post("/api/send-otp", async (req, res) => {
    try {
        const { mobile } = req.body;
        const otp = Math.floor(1000 + Math.random() * 9000);

        otpMap.set(mobile, otp);
        await client.messages.create({
            body: "OTP : " + otp,
            from: "+17067703303",
            to: mobile,
        });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Failed to send OTP" });
    }
});

//verify otp
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body
    const storedOtp = otpMap.get(mobile)
    if (!storedOtp || storedOtp != otp) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' })
    }
    else {
      otpMap.delete(mobile)
      res.status(200).json({ success: true })
    }
  }
  catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
}
)



// getprofile


app.get("/api/logout", (req, res) => {
  // Clear the token cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  // Clear any other cookies containing user data
  res.clearCookie("user_id");
  res.clearCookie("user_email");

  res.json({ message: "Logout successful" });
});


//profile
app.get("/api/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, process.env.SECRET_KEY, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id, mobile, city, subscription } = await User.findById(
        userData.id
      ).select("-password");

      // Add subscription-related information to the response
      const profileData = {
        name,
        email,
        _id,
        mobile,
        city,
        subscription
      };

      // Here, you can also add additional subscription-specific features if needed
      if (subscription === "basic") {
        profileData.basicFeature = true;
      } else if (subscription === "medium") {
        profileData.basicFeature = true;
        profileData.mediumFeature = true;
      } else if (subscription === "premium") {
        profileData.basicFeature = true;
        profileData.mediumFeature = true;
        profileData.premiumFeature = true;
      }

      res.json(profileData);

    });
  } else {
    res.json(null);

  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  const { title, features, price } = req.body
  const line_items = [{
    price_data: {
      currency: "inr",
      product_data: {
        name: title,
        description: features,
        metadata: {
          id: title,
        },
      },
      unit_amount: price * 100,
    },
    quantity: 1
  }];

  const session = await stripe.checkout.sessions.create({
    shipping_address_collection: { allowed_countries: ["US", "IN"] },
    shipping_options: [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: 200, currency: "inr" },
          display_name: "Free shipping",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 5 },
            maximum: { unit: "business_day", value: 7 },
          },
        },
      },
    ],
    line_items,
    mode: "payment",
    success_url: `${req.headers.origin}/success?sub=${title}?payment_status=success`,
    cancel_url: `${req.headers.origin}/plans`,
  });
  res.send({ url: session.url, success: session.success_url, cancel: session.cancel_url });
});

app.put('/api/subscription', async (req, res) => {
  const { id, subscription } = req.body

  try {
    const updatedUser = await User.findByIdAndUpdate(id, { subscription }, { new: true })
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    return res.json(updatedUser)
  }
  catch (error) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }


})






// Get user data route
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
