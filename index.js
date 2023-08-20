const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const { App } = require("@slack/bolt");
const { google } = require("googleapis");
const nodemailer = require("nodemailer")
const OAuth2 = google.auth.OAuth2;

dotenv.config();

const app = express();


// app.use(
//     cors({
//       origin: "*",
//       methods: "GET,POST,PATCH,DELETE",
//       credentials: true,
//     })
//   );




app.use(
    cors({
        credentials: true,
        //origin: "http://127.0.0.1:5174",
        origin: "*",
    })
);
//app.options('*', cors()); // Respond to all OPTIONS requests
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // You might also need to include other headers like 'Access-Control-Allow-Methods' and 'Access-Control-Allow-Headers'
    next();
  });


app.use(bodyParser.json());

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
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

// Define Slack API related constants
const SLACK_ACCESS_TOKEN = process.env.SLACK_TOKEN;
const SLACK_API_URL = "https://slack.com/api";

// Route to fetch Slack channels
app.get("/api/channels", async (req, res) => {
    try {
        const response = await axios.get(
            `${SLACK_API_URL}/conversations.list`,
            {
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: `Bearer ${SLACK_ACCESS_TOKEN}`,
                    Accept: "application/json",
                },
            }
        );

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
    .then(result =>  console.log("Message Sent"))
    .catch(error => console.log(error.message));
});
