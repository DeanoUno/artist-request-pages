const fetch = require("node-fetch");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      name = "",
      song = "",
      note = "",
      artistId = "",
      ip = "",
      pushoverUserKey,
      pushoverToken
    } = data;

    console.log("📥 New request received:", data);

    // Optional: Send Pushover notification
    if (pushoverUserKey && pushoverToken && song) {
      const pushMsg = `${name || "Someone"} requested:\n🎵 ${song}\n💬 ${note}`;
      await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token: pushoverToken,
          user: pushoverUserKey,
          message: pushMsg,
          title: "🎶 New Song Request",
          priority: "0"
        })
      });
    }

    return {
      statusCode: 200,
      body: "Request received and processed"
    };
  } catch (err) {
    console.error("❌ Error in submit-request:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: err.message })
    };
  }
};
