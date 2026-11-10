import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import connectDB from "./src/config/db.js";
import http from "http";
import { initSocket } from "./src/socket/socket.js";
import { initSweeperJob } from "./src/utils/sweeper.util.js";

const server = http.createServer(app);

// Initializing socket
initSocket(server);

const startConnection = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 9000;
    server.listen(PORT, (err) => {
      if (err) {
        console.log("Error occured while starting the server: ", err);
        process.exit(1);
      }
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error while starting the application: ", error);
    process.exit(1);
  }
};
initSweeperJob();
startConnection();