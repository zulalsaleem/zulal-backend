import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import userRouter from "./routes/user.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"
import healthcheckRouter from "./routes/healthcheck.routes.js"



const app = express()

// MIDDLEWARES
app.use(cors({
    origin: ["http://localhost:5173", "https://videotweet.vercel.app"],
    credentials: true
}))

app.use(express.json({ limit: "15kb" }))           // ✅ removed duplicate
app.use(express.urlencoded({ extended: true, limit: "15kb" }))  // ✅ removed duplicate
app.use(express.static("public"))
app.use(cookieParser())

app.get("/test", (req, res) => {
    console.log("TEST ROUTE HIT ✅")  // add this
    res.json({ message: "Backend connected successfully 🚀" })
})


// ROUTES
app.use("/api/v1/user", userRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlists", playlistRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/dashboard", dashboardRouter)
app.use("/api/v1/healthcheck", healthcheckRouter)

export { app }
