const getClientOrigins = () => {
  const envOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
    : [];

  return [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://192.168.7.3:5173",
    "https://admin.socket.io",
    ...envOrigins,
  ].filter(Boolean);
};

export const isOriginAllowed = (origin) => {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) return true;

  const allowedOrigins = getClientOrigins();
  if (allowedOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    // Allow all vercel preview and production subdomains
    if (hostname.endsWith(".vercel.app") || hostname === "localhost") {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

export const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
